// DEMARC API Server - Khepra Protocol Secure Gateway
//
// The DEMARC (Demilitarized Architecture Resilience Control) server handles:
// - License validation and telemetry
// - Service-to-service authentication (CloudFlare → DEMARC)
// - Dark Crypto Moat analytics
// - WebSocket real-time updates
//
// Environment Variables:
//   KHEPRA_SERVICE_SECRET - Shared HMAC secret for service authentication (required)
//   PORT                  - Server port (default: 8080)
//   HOST                  - Server host (default: 0.0.0.0)
//   TLS_ENABLED           - Enable TLS (default: false)
//   TLS_DOMAIN            - Domain for Let's Encrypt
//   DEBUG                 - Enable debug mode (default: false)

package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/apiserver"
)

// Simple DAG store implementation for standalone mode
type simpleDAGStore struct {
	nodes int
}

func (s *simpleDAGStore) NodeCount() int {
	return s.nodes
}

// Simple license manager for standalone mode
type simpleLicenseManager struct{}

func (m *simpleLicenseManager) IsValid() (bool, error) {
	return true, nil
}

func (m *simpleLicenseManager) ValidateAPIKey(apiKey string) (bool, error) {
	// In production, validate against database
	// For now, accept any non-empty key
	return apiKey != "", nil
}

func main() {
	// CLI flags
	port := flag.Int("port", 8080, "Server port")
	host := flag.String("host", "0.0.0.0", "Server host")
	tlsEnabled := flag.Bool("tls", false, "Enable TLS")
	tlsDomain := flag.String("tls-domain", "", "Domain for Let's Encrypt")
	debug := flag.Bool("debug", false, "Enable debug mode")
	flag.Parse()

	// Environment overrides
	if envPort := os.Getenv("PORT"); envPort != "" {
		if p, err := strconv.Atoi(envPort); err == nil {
			*port = p
		}
	}
	if envHost := os.Getenv("HOST"); envHost != "" {
		*host = envHost
	}
	if os.Getenv("TLS_ENABLED") == "true" {
		*tlsEnabled = true
	}
	if envDomain := os.Getenv("TLS_DOMAIN"); envDomain != "" {
		*tlsDomain = envDomain
	}
	if os.Getenv("DEBUG") == "true" {
		*debug = true
	}

	// Check required environment variables
	if os.Getenv("KHEPRA_SERVICE_SECRET") == "" {
		log.Println("WARNING: KHEPRA_SERVICE_SECRET not set!")
		log.Println("Service-to-service authentication will use development defaults.")
		log.Println("Set this for production: export KHEPRA_SERVICE_SECRET=<your-256-bit-hex-secret>")
	}

	printBanner()

	// Create configuration
	config := &apiserver.Config{
		Host:         *host,
		Port:         *port,
		TLSEnabled:   *tlsEnabled,
		TLSDomain:    *tlsDomain,
		CertCacheDir: "./certs",
		AllowedOrigins: []string{
			"https://souhimbou.org",
			"https://gateway.souhimbou.org",
			"https://telemetry.souhimbou.org",
			"http://localhost:3000",
			"http://localhost:5173",
		},
		Debug: *debug,
	}

	// Create simple implementations for standalone mode
	dagStore := &simpleDAGStore{nodes: 0}
	licMgr := &simpleLicenseManager{}

	// Create server
	server := apiserver.NewServer(config, dagStore, licMgr)

	// Start server in background
	go func() {
		if err := server.Start(); err != nil {
			log.Fatalf("Server error: %v", err)
		}
	}()

	log.Printf("DEMARC API Server running on %s:%d", *host, *port)
	log.Printf("Service Auth: KHEPRA_SERVICE_SECRET %s", getSecretStatus())
	log.Printf("Endpoints:")
	log.Printf("  Health:        GET  /health")
	log.Printf("  Version:       GET  /version")
	log.Printf("  Telemetry:     POST /api/v1/telemetry/ingest (service auth)")
	log.Printf("  Stats:         GET  /api/v1/telemetry/stats")
	log.Printf("  Dark Crypto:   GET  /api/v1/telemetry/dark-crypto-moat")
	log.Printf("  WebSocket:     WS   /ws/scans, /ws/dag, /ws/license")

	// Wait for shutdown signal
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("Shutting down DEMARC server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Shutdown error: %v", err)
	}

	log.Println("DEMARC server stopped.")
}

func getSecretStatus() string {
	if os.Getenv("KHEPRA_SERVICE_SECRET") != "" {
		return "configured ✓"
	}
	return "NOT SET (using development default)"
}

func printBanner() {
	banner := `
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║    ██████╗ ███████╗███╗   ███╗ █████╗ ██████╗  ██████╗            ║
║    ██╔══██╗██╔════╝████╗ ████║██╔══██╗██╔══██╗██╔════╝            ║
║    ██║  ██║█████╗  ██╔████╔██║███████║██████╔╝██║                 ║
║    ██║  ██║██╔══╝  ██║╚██╔╝██║██╔══██║██╔══██╗██║                 ║
║    ██████╔╝███████╗██║ ╚═╝ ██║██║  ██║██║  ██║╚██████╗            ║
║    ╚═════╝ ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝            ║
║                                                                   ║
║      Demilitarized Architecture Resilience Control - KHEPRA      ║
║                                                                   ║
║    Service-to-Service Auth | Telemetry Ingestion | WebSocket     ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
`
	fmt.Println(banner)
}
