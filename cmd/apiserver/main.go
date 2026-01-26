// DEMARC API Server - Khepra Protocol Secure Gateway
// "The Mitochondreal-Scarab / The Motherboard"
//
// The central consciousness hub connecting:
// - Go AGI (KASA) - Logic & Execution
// - Python AGI (SouHimBou) - Intuition & Soul
// - Telemetry Server - Long-Term Memory
// - Client API - User Interface
//
// Environment Variables:
//   KHEPRA_SERVICE_SECRET - Shared HMAC secret for service authentication (required)
//   PORT                  - Server port (default: 8080)
//   HOST                  - Server host (default: 0.0.0.0)
//   TLS_ENABLED           - Enable TLS (default: false)
//   TLS_DOMAIN            - Domain for Let's Encrypt
//   CERT_CACHE_DIR        - Directory for certificate cache
//   DEBUG                 - Enable debug mode (default: false)
//   TELEMETRY_URL         - Telemetry server URL (default: https://telemetry.souhimbou.org)

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
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
)

func main() {
	// CLI flags
	port := flag.Int("port", 8080, "Server port")
	host := flag.String("host", "0.0.0.0", "Server host")
	tlsEnabled := flag.Bool("tls", false, "Enable TLS with Let's Encrypt")
	tlsDomain := flag.String("tls-domain", "", "Domain for Let's Encrypt")
	certCacheDir := flag.String("cert-cache", "/var/cache/khepra-certs", "Certificate cache directory")
	debug := flag.Bool("debug", false, "Enable debug mode")
	telemetryURL := flag.String("telemetry-url", "https://telemetry.souhimbou.org", "Telemetry server URL")
	flag.Parse()

	// Environment variable overrides
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
	if envCertDir := os.Getenv("CERT_CACHE_DIR"); envCertDir != "" {
		*certCacheDir = envCertDir
	}
	if os.Getenv("DEBUG") == "true" {
		*debug = true
	}
	if envTelemetry := os.Getenv("TELEMETRY_URL"); envTelemetry != "" {
		*telemetryURL = envTelemetry
	}

	// Validate service secret
	if os.Getenv("KHEPRA_SERVICE_SECRET") == "" {
		log.Println("WARNING: KHEPRA_SERVICE_SECRET not set!")
		log.Println("Service-to-service authentication will use development defaults.")
		log.Println("Set this for production: export KHEPRA_SERVICE_SECRET=<your-256-bit-hex-secret>")
	}

	printBanner()

	// Initialize DAG (global singleton - The Long-Term Memory)
	dagStore := dag.GlobalDAG()
	log.Printf("DAG initialized with %d nodes", len(dagStore.All()))

	// Initialize license manager (Merkaba Egyptian mythology system)
	licMgr, err := license.NewManager(*telemetryURL)
	if err != nil {
		log.Fatalf("Failed to create license manager: %v", err)
	}

	// Initialize license (validates with server and starts heartbeat)
	if err := licMgr.Initialize(); err != nil {
		log.Printf("License validation failed: %v", err)
		log.Println("Running in community mode - proprietary features disabled")
	} else {
		log.Println("License validated - full features enabled")
	}

	// Create API server configuration
	config := &apiserver.Config{
		Host:         *host,
		Port:         *port,
		TLSEnabled:   *tlsEnabled,
		TLSDomain:    *tlsDomain,
		CertCacheDir: *certCacheDir,
		AllowedOrigins: []string{
			"https://souhimbou.org",
			"https://www.souhimbou.org",
			"https://gateway.souhimbou.org",
			"https://telemetry.souhimbou.org",
			"https://adinkhepra.dev",
			"http://localhost:3000",
			"http://localhost:5173",
			"http://localhost:8080",
		},
		Debug: *debug,
	}

	// Create adapters to bridge existing components with API server
	dagAdapter := apiserver.NewDAGStoreAdapter(dagStore)
	licAdapter := apiserver.NewLicenseManagerAdapter(licMgr)

	// Create server (The Motherboard)
	server := apiserver.NewServer(config, dagAdapter, licAdapter)

	// Start server in background
	go func() {
		if err := server.Start(); err != nil {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Log service status
	log.Println("╔═══════════════════════════════════════════════════════════════════╗")
	log.Println("║                    DEMARC Server Active                           ║")
	log.Println("╚═══════════════════════════════════════════════════════════════════╝")
	log.Printf("  Address:           %s:%d", *host, *port)
	log.Printf("  TLS:               %v", *tlsEnabled)
	log.Printf("  Service Auth:      %s", getSecretStatus())
	log.Printf("  Telemetry Server:  %s", *telemetryURL)
	log.Println("")
	log.Println("  REST Endpoints:")
	log.Println("    GET  /health                      - Health check")
	log.Println("    GET  /version                     - Version info")
	log.Println("    POST /api/v1/telemetry/ingest     - Telemetry ingestion (service auth)")
	log.Println("    GET  /api/v1/telemetry/stats      - Telemetry statistics")
	log.Println("    GET  /api/v1/telemetry/dark-crypto-moat - Dark Crypto Moat analytics")
	log.Println("    POST /api/v1/scans/trigger        - Trigger crypto scan")
	log.Println("    GET  /api/v1/license/status       - License status")
	log.Println("")
	log.Println("  WebSocket Endpoints:")
	log.Println("    WS   /ws/scans                    - Real-time scan updates")
	log.Println("    WS   /ws/dag                      - DAG state changes")
	log.Println("    WS   /ws/license                  - License events")
	log.Println("")
	log.Println("  The Motherboard is online. The Scarab watches.")

	// Graceful shutdown on interrupt
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("")
	log.Println("Received shutdown signal...")

	// Shutdown with 30-second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	// Stop license heartbeat
	licMgr.Stop()

	log.Println("DEMARC server exited gracefully. The Scarab rests.")
}

func getSecretStatus() string {
	if os.Getenv("KHEPRA_SERVICE_SECRET") != "" {
		return "configured (HMAC-SHA256)"
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
║      "The Mitochondreal-Scarab / The Motherboard"                 ║
║                                                                   ║
║   Polymorphic API Hub | Service Auth | Telemetry | WebSocket      ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
`
	fmt.Println(banner)
}
