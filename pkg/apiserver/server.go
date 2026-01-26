package apiserver

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"golang.org/x/crypto/acme/autocert"
)

// Server represents the Khepra API server
type Server struct {
	router     *gin.Engine
	wsHub      *WebSocketHub
	dagStore   DAGStore
	licMgr     LicenseManager
	config     *Config
	startTime  time.Time
	version    string
	httpServer *http.Server
	agentMgr   AgentManagerInterface
}

// AgentManagerInterface abstracts the connection to remote environments
type AgentManagerInterface interface {
	ExecuteOnAgent(machineID string, command string, args []string) (string, error)
}

// Config holds server configuration
type Config struct {
	Host           string
	Port           int
	TLSEnabled     bool
	TLSDomain      string   // For Let's Encrypt
	CertCacheDir   string   // For Let's Encrypt cert cache
	AllowedOrigins []string // CORS origins
	Debug          bool
}

// DAGStore interface for DAG operations
type DAGStore interface {
	NodeCount() int
	// Add more DAG methods as needed
}

// LicenseManager interface for license operations
type LicenseManager interface {
	IsValid() (bool, error)
	ValidateAPIKey(apiKey string) (bool, error)
	// Add more license methods as needed
}

// NewServer creates a new API server instance
func NewServer(config *Config, dagStore DAGStore, licMgr LicenseManager) *Server {
	if !config.Debug {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	wsHub := NewWebSocketHub()

	server := &Server{
		router:    router,
		wsHub:     wsHub,
		dagStore:  dagStore,
		licMgr:    licMgr,
		config:    config,
		startTime: time.Now(),
		version:   "1.0.0",
		agentMgr:  nil, // To be injected if Gateway is present
	}

	// Setup middleware
	server.setupMiddleware()

	// Setup routes
	server.setupRoutes()

	return server
}

// setupMiddleware configures all middleware
func (s *Server) setupMiddleware() {
	s.router.Use(RecoveryMiddleware())
	s.router.Use(LoggingMiddleware())
	s.router.Use(CORSMiddleware())
	s.router.Use(RateLimitMiddleware())
}

// setupRoutes configures all API routes
func (s *Server) setupRoutes() {
	// Public routes (no auth required)
	s.router.GET("/health", s.handleHealth)
	s.router.GET("/version", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"version": s.version,
			"service": "khepra-api",
		})
	})

	// API v1 routes (auth required)
	v1 := s.router.Group("/api/v1")
	v1.Use(s.AuthMiddleware())
	{
		// Scan endpoints
		scans := v1.Group("/scans")
		{
			scans.POST("/trigger", s.handleTriggerScan)
			scans.GET("/:id", s.handleGetScanStatus)
			scans.GET("", s.handleListScans)
		}

		// DAG endpoints
		dag := v1.Group("/dag")
		{
			dag.GET("/nodes", s.handleGetDAGNodes)
			dag.GET("/nodes/:id", func(c *gin.Context) {
				c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
			})
		}

		// STIG endpoints
		stig := v1.Group("/stig")
		{
			stig.POST("/validate", s.handleSTIGValidation)
			stig.POST("/remediate", s.handleSTIGRemediation)
		}

		// CMMC endpoints
		compliance := v1.Group("/compliance")
		{
			compliance.GET("/cmmc-audit", s.handleCMMCAudit)
		}

		// Command Center endpoints (4-Quadrant "Compliance in 4 Clicks")
		cc := v1.Group("/cc")
		{
			// Dashboard
			cc.GET("/dashboard", s.handleCCDashboard)

			// Quadrant 1: Discover
			cc.POST("/discover", s.handleCCDiscover)
			cc.GET("/discover/endpoints", s.handleCCListEndpoints)

			// Quadrant 2: Assess
			cc.POST("/assess", s.handleCCAssess)
			cc.GET("/assess/status", s.handleCCAssessStatus)

			// Quadrant 3: Rollback
			cc.POST("/rollback/snapshot", s.handleCCCreateSnapshot)
			cc.GET("/rollback/snapshots", s.handleCCListSnapshots)
			cc.POST("/rollback/restore", s.handleCCRollback)

			// Quadrant 4: Prove
			cc.POST("/prove/attest", s.handleCCCreateAttestation)
			cc.GET("/prove/verify", s.handleCCVerifyAttestation)
			cc.POST("/prove/export", s.handleCCExportEvidence)
		}

		// ERT (Evidence Recording Token) endpoints
		ert := v1.Group("/ert")
		{
			ert.POST("/generate", s.handleGenerateERT)
			ert.GET("/verify/:id", func(c *gin.Context) {
				c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
			})
		}

		// License endpoints (Merkaba Egyptian mythology licensing system)
		license := v1.Group("/license")
		{
			// Basic license management
			license.GET("/status", s.handleGetLicenseStatus)
			license.POST("/create", s.handleCreateLicense)
			license.GET("/:license_id", s.handleGetLicense)
			license.POST("/:license_id/upgrade", s.handleUpgradeLicense)
			license.GET("/:license_id/usage", s.handleGetLicenseUsage)

			// Admin/list endpoints
			license.GET("/admin/list", s.handleListLicenses)

			// Telemetry integration with Cloudflare server
			telemetry := license.Group("/telemetry")
			{
				telemetry.POST("/enroll", s.handleTelemetryEnroll)
				telemetry.POST("/heartbeat", s.handleTelemetryHeartbeat)
				telemetry.GET("/status", s.handleTelemetryStatus)
			}
		}

		// Telemetry analytics (read-only, requires user auth)
		v1.GET("/telemetry/stats", s.handleTelemetryStats)
		v1.GET("/telemetry/dark-crypto-moat", s.handleDarkCryptoMoat)
	}

	// Service-to-service API (authenticated with service tokens)
	// OWASP API2:2023 - Strong service authentication
	svc := s.router.Group("/api/v1/telemetry")
	svc.Use(ServiceAuthMiddleware())
	svc.Use(RequirePermission("telemetry:write"))
	{
		svc.POST("/ingest", s.handleTelemetryIngest)
	}

	// WebSocket endpoints (auth via query param or first message)
	var upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			// TODO: Implement proper origin checking
			return true
		},
	}

	s.router.GET("/ws/scans", func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("WebSocket upgrade error: %v", err)
			return
		}
		s.wsHub.ServeWebSocket(conn, "scans")
	})

	s.router.GET("/ws/dag", func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("WebSocket upgrade error: %v", err)
			return
		}
		s.wsHub.ServeWebSocket(conn, "dag")
	})

	s.router.GET("/ws/license", func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("WebSocket upgrade error: %v", err)
			return
		}
		s.wsHub.ServeWebSocket(conn, "license")
	})
}

// Start starts the API server
func (s *Server) Start() error {
	// Start WebSocket hub in background
	go s.wsHub.Run()

	addr := fmt.Sprintf("%s:%d", s.config.Host, s.config.Port)
	log.Printf("Starting Khepra API Server on %s", addr)
	log.Printf("TLS Enabled: %v", s.config.TLSEnabled)
	log.Printf("Version: %s", s.version)

	s.httpServer = &http.Server{
		Addr:         addr,
		Handler:      s.router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	if s.config.TLSEnabled {
		return s.startTLS()
	}

	return s.httpServer.ListenAndServe()
}

// startTLS starts the server with TLS using Let's Encrypt
func (s *Server) startTLS() error {
	if s.config.TLSDomain == "" {
		return fmt.Errorf("TLS domain not configured")
	}

	log.Printf("Starting with Let's Encrypt TLS for domain: %s", s.config.TLSDomain)

	certManager := autocert.Manager{
		Prompt:     autocert.AcceptTOS,
		HostPolicy: autocert.HostWhitelist(s.config.TLSDomain),
		Cache:      autocert.DirCache(s.config.CertCacheDir),
	}

	s.httpServer.TLSConfig = &tls.Config{
		GetCertificate: certManager.GetCertificate,
		MinVersion:     tls.VersionTLS12,
	}

	// Start HTTP->HTTPS redirect server
	go func() {
		httpServer := &http.Server{
			Addr:    ":80",
			Handler: certManager.HTTPHandler(nil),
		}
		log.Printf("Starting HTTP->HTTPS redirect server on :80")
		if err := httpServer.ListenAndServe(); err != nil {
			log.Printf("HTTP redirect server error: %v", err)
		}
	}()

	return s.httpServer.ListenAndServeTLS("", "")
}

// Shutdown gracefully shuts down the server
func (s *Server) Shutdown(ctx context.Context) error {
	log.Println("Shutting down Khepra API Server...")

	if s.httpServer != nil {
		if err := s.httpServer.Shutdown(ctx); err != nil {
			return fmt.Errorf("server shutdown error: %w", err)
		}
	}

	log.Println("Server shutdown complete")
	return nil
}

// GetWebSocketHub returns the WebSocket hub for external use
func (s *Server) GetWebSocketHub() *WebSocketHub {
	return s.wsHub
}

// GetRouter returns the Gin router for testing
func (s *Server) GetRouter() *gin.Engine {
	return s.router
}
