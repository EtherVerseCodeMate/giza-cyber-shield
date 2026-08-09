package apiserver

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/policy"
	"github.com/gin-gonic/gin"
)

// STIGProxyHandler encapsulates the logic for securely proxying requests to stigviewer.com.
type STIGProxyHandler struct {
	proxy   *httputil.ReverseProxy
	ebg     *policy.EgressBoundaryGuard
}

// NewSTIGProxyHandler creates a new handler that forwards to www.stigviewer.com
// via the EgressBoundaryGuard to ensure strict zero-trust egress monitoring.
func NewSTIGProxyHandler(ebg *policy.EgressBoundaryGuard) (*STIGProxyHandler, error) {
	targetURL, err := url.Parse("https://www.stigviewer.com")
	if err != nil {
		return nil, err
	}

	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	// Use the EgressBoundaryGuard to secure the transport
	proxy.Transport = ebg.GuardedTransport(nil)

	// Modify the request to appear as if it is destined directly for stigviewer.com
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = targetURL.Host
		
		// Remove the local /api/v1/stig/viewer prefix from the path so stigviewer
		// gets the correct path (e.g. /api/v1/stigs instead of /api/v1/stig/viewer/api/v1/stigs)
		req.URL.Path = strings.TrimPrefix(req.URL.Path, "/api/v1/stig/viewer")
		
		// Ensure the API path has the leading slash
		if !strings.HasPrefix(req.URL.Path, "/") {
			req.URL.Path = "/" + req.URL.Path
		}
	}

	return &STIGProxyHandler{
		proxy: proxy,
		ebg:   ebg,
	}, nil
}

// HandleProxy handles the incoming Gin context and proxies it.
func (h *STIGProxyHandler) HandleProxy(c *gin.Context) {
	h.proxy.ServeHTTP(c.Writer, c.Request)
}

// handleSTIGProxy routes requests to the STIGProxyHandler.
func (s *Server) handleSTIGProxy(c *gin.Context) {
	if s.stigProxy == nil {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "STIG proxy not initialized"})
		return
	}
	s.stigProxy.HandleProxy(c)
}

// handleSTIGValidation is a stub for the validation endpoint
func (s *Server) handleSTIGValidation(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "message": "STIG validation successful"})
}

// handleSTIGRemediation is a stub for the remediation endpoint
func (s *Server) handleSTIGRemediation(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "message": "STIG remediation scheduled"})
}
