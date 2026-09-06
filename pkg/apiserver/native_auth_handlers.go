package apiserver

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// handleNativeSignup creates a new local user
func (s *Server) handleNativeSignup(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := s.nativeAuth.CreateUser(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user", "detail": err.Error()})
		return
	}

	session, err := s.nativeAuth.CreateSession(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create session"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"token": session.ID,
		"user": gin.H{
			"id":    user.ID,
			"email": user.Email,
		},
	})
}

// handleNativeLogin authenticates a user
func (s *Server) handleNativeLogin(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := s.nativeAuth.Authenticate(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	session, err := s.nativeAuth.CreateSession(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create session"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": session.ID,
		"user": gin.H{
			"id":    user.ID,
			"email": user.Email,
		},
	})
}

// handleNativeMe returns the current user profile
func (s *Server) handleNativeMe(c *gin.Context) {
	authHdr := c.GetHeader("Authorization")
	if !strings.HasPrefix(authHdr, "Bearer ") {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	token := strings.TrimPrefix(authHdr, "Bearer ")

	session, err := s.nativeAuth.ValidateSession(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired session"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user_id": session.UserID,
	})
}
