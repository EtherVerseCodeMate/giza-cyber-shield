package apiserver

import (
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware validates API key authentication
func (s *Server) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "unauthorized",
				Message: "Missing Authorization header",
				Code:    http.StatusUnauthorized,
			})
			c.Abort()
			return
		}

		// Expected format: "Bearer <api_key>" or "Bearer <machine_id>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "unauthorized",
				Message: "Invalid Authorization header format",
				Code:    http.StatusUnauthorized,
			})
			c.Abort()
			return
		}

		apiKey := parts[1]

		// Validate API key (using machine_id as API key for now)
		// In production, this should validate against license manager
		if s.licMgr != nil {
			valid, err := s.licMgr.ValidateAPIKey(apiKey)
			if err != nil || !valid {
				c.JSON(http.StatusUnauthorized, ErrorResponse{
					Error:   "unauthorized",
					Message: "Invalid or expired API key",
					Code:    http.StatusUnauthorized,
				})
				c.Abort()
				return
			}
		}

		// Store API key in context for later use
		c.Set("api_key", apiKey)
		c.Next()
	}
}

// CORSMiddleware handles CORS headers
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		allowedOrigins := map[string]bool{
			"https://souhimbou.ai":            true,
			"http://localhost:3000":           true,
			"https://telemetry.souhimbou.org": true,
		}

		if allowedOrigins[origin] {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			// Fallback for non-browser clients or unknown origins (optional: remove to be strict)
			// c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// LoggingMiddleware logs all API requests
func LoggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		statusCode := c.Writer.Status()
		clientIP := c.ClientIP()
		method := c.Request.Method

		if raw != "" {
			path = path + "?" + raw
		}

		log.Printf("[API] %s %s %d %v %s",
			method,
			path,
			statusCode,
			latency,
			clientIP,
		)
	}
}

// RateLimitMiddleware implements basic rate limiting
func RateLimitMiddleware() gin.HandlerFunc {
	// Simple in-memory rate limiter
	// In production, use Redis or similar
	type clientInfo struct {
		lastRequest time.Time
		requests    int
	}

	clients := make(map[string]*clientInfo)
	const (
		maxRequests = 100
		timeWindow  = 1 * time.Minute
	)

	return func(c *gin.Context) {
		clientIP := c.ClientIP()

		now := time.Now()
		client, exists := clients[clientIP]

		if !exists {
			clients[clientIP] = &clientInfo{
				lastRequest: now,
				requests:    1,
			}
			c.Next()
			return
		}

		// Reset counter if time window has passed
		if now.Sub(client.lastRequest) > timeWindow {
			client.lastRequest = now
			client.requests = 1
			c.Next()
			return
		}

		// Check rate limit
		if client.requests >= maxRequests {
			c.JSON(http.StatusTooManyRequests, ErrorResponse{
				Error:   "rate_limit_exceeded",
				Message: "Too many requests, please try again later",
				Code:    http.StatusTooManyRequests,
			})
			c.Abort()
			return
		}

		client.requests++
		c.Next()
	}
}

// RecoveryMiddleware recovers from panics and logs them
func RecoveryMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("[PANIC] %v", err)
				c.JSON(http.StatusInternalServerError, ErrorResponse{
					Error:   "internal_server_error",
					Message: "An unexpected error occurred",
					Code:    http.StatusInternalServerError,
				})
				c.Abort()
			}
		}()
		c.Next()
	}
}
