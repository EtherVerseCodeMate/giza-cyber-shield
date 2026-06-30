package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/agi"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/client"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/auth"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/sekhem"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/webui"
)

// serveCmd starts the DAG visualization web server
func serveCmd(args []string) {
	port := 8080

	// Parse port from args if provided
	if len(args) > 0 && args[0] == "-port" && len(args) > 1 {
		fmt.Sscanf(args[1], "%d", &port)
	}

	fmt.Println("═══════════════════════════════════════════════════════════════")
	fmt.Println("  🔒 KHEPRA PROTOCOL // Living Trust Constellation")
	fmt.Println("═══════════════════════════════════════════════════════════════")
	fmt.Println()
	fmt.Printf("  Starting DAG Viewer on port %d...\n", port)
	fmt.Println()
	fmt.Println("  🌐 Web Interface:")
	fmt.Printf("     http://localhost:%d/\n", port)
	fmt.Println()
	fmt.Println("  📊 API Endpoints:")
	fmt.Printf("     http://localhost:%d/api/dag/nodes      - Get all DAG nodes\n", port)
	fmt.Printf("     http://localhost:%d/api/dag/stats      - Get DAG statistics\n", port)
	fmt.Printf("     http://localhost:%d/health             - Health check\n", port)
	fmt.Printf("     http://localhost:%d/dag/add            - Log event to DAG\n", port)
	fmt.Printf("     http://localhost:%d/adinkra/weave      - PQC obfuscate data\n", port)
	fmt.Printf("     http://localhost:%d/adinkra/unweave    - Decrypt obfuscated data\n", port)
	fmt.Printf("     http://localhost:%d/attest/verify      - Verify system integrity\n", port)
	fmt.Printf("     http://localhost:%d/status             - Full server status\n", port)
	fmt.Printf("     http://localhost:%d/dag/graph          - Compliance Graph UI export\n", port)
	fmt.Printf("     http://localhost:%d/compliance/scan-all - CMMC 145-control scan\n", port)
	fmt.Printf("     http://localhost:%d/api/v1/auth/login     - Sovereign login (on-prem SQLite)\n", port)
	fmt.Printf("     http://localhost:%d/api/v1/auth/validate  - Session validation\n", port)
	fmt.Printf("     http://localhost:%d/api/v1/auth/bootstrap - First-run admin creation\n", port)
	fmt.Println()
	fmt.Println("  Press Ctrl+C to stop the server")
	fmt.Println("═══════════════════════════════════════════════════════════════")
	fmt.Println()

	// Use the global singleton immutable DAG (production-grade)
	// This ensures the standalone viewer, agent server, and ERT all
	// share the same cryptographically-secured data structure
	dagMemory := dag.GlobalDAG()

	// Genesis node is automatically created by GlobalDAG()
	fmt.Printf("  ✅ Connected to global DAG (%d nodes)\n", len(dagMemory.All()))

	// Create production DAG provider (not mock!)
	provider := webui.NewProductionDAGProvider(dagMemory)

	// ── Sovereign auth (Profile B) ─────────────────────────────────────────
	// On-premise SQLite, zero external calls — see pkg/auth/sqlite_provider.go.
	// This is the real implementation of the Adinkhepra-ASAF README's Profile B
	// claim; it replaces the dashboard's old dead-port (45444) license-validate
	// call with a real local auth database.
	authProvider, authErr := newSovereignAuthProvider()
	if authErr != nil {
		log.Fatalf("❌ Failed to initialize sovereign auth store: %v\n", authErr)
	}
	defer authProvider.Close()

	if hasUsers, _ := authProvider.HasAnyUsers(context.Background()); !hasUsers {
		fmt.Println("  ⚠️  No admin account exists yet.")
		fmt.Println("     POST /api/v1/auth/bootstrap {username, email, password} to create one,")
		fmt.Println("     or set ADINKHEPRA_ADMIN_EMAIL + ADINKHEPRA_ADMIN_PASSWORD to auto-create on next start.")
		if email := os.Getenv("ADINKHEPRA_ADMIN_EMAIL"); email != "" {
			if pass := os.Getenv("ADINKHEPRA_ADMIN_PASSWORD"); len(pass) >= 12 {
				if err := bootstrapAdminFromEnv(authProvider, email, pass); err != nil {
					log.Printf("  WARN: auto-bootstrap from env failed: %v", err)
				} else {
					fmt.Printf("  ✅ Admin account auto-created from ADINKHEPRA_ADMIN_EMAIL=%s\n", email)
				}
			}
		}
	}

	// ── KASA Engine — Autonomous Security Auditor ────────────────────────────
	// Continuous loops: forensic snapshots, vuln hunting, internal pentest,
	// compliance audit. Runs unprivileged in this process (NOT inside
	// asaf-daemon, which holds CAP_SYS_ADMIN) — see the daemon/serve
	// privilege-separation decision in project_product_a_architecture memory.
	// All findings are written as ML-DSA-65-signed DAG nodes to the same
	// global DAG the Compliance Graph UI reads from.
	kasaEngine := agi.NewEngine(dagMemory)
	kasaEngine.Start()
	fmt.Println("  ✅ KASA autonomous security auditor online")

	// ── Sekhem DuatRealm — WAF + Ouroboros perimeter ─────────────────────────
	// Awaken() initializes WAFShield (8 ingress rules + egress secret scrub,
	// Kyber-1024 fingerprint rotation) and starts the Ouroboros WAFEye drain
	// loop. The daemon itself has no HTTP surface for this WAF to protect —
	// it's the ML-DSA-65 ChangeRequest signature gate that defends the
	// privileged boundary instead. This WAF protects the network-facing
	// surface: this process's HTTP API.
	duatRealm := sekhem.NewDuatRealm(kasaEngine, dagMemory)
	if err := duatRealm.Awaken(); err != nil {
		log.Printf("  WARN: Sekhem DuatRealm awaken failed: %v — continuing without WAF", err)
		duatRealm = nil
	} else {
		fmt.Println("  ✅ Sekhem WAFShield online (8 rules, Kyber-1024 rotation, Ouroboros eye active)")
	}

	// ── asaf-daemon client — ChangeRequest relay ─────────────────────────────
	// Makes the daemon's own header comment real: "click Remediate in the UI
	// → ChangeRequest arrives here." This process holds no privileges of its
	// own; every remediation request gets ML-DSA-65 signed and relayed over
	// the daemon's Unix socket, which does the actual privileged execution.
	// Non-fatal if the daemon isn't reachable yet (e.g. local dev without
	// asaf-daemon running) — key provisioning still succeeds, only an actual
	// remediate/poll HTTP call would fail (502), not server startup.
	daemonClient, daemonErr := newDaemonClient()
	if daemonErr != nil {
		log.Printf("  WARN: asaf-daemon client unavailable: %v — /api/v1/asaf/* routes disabled", daemonErr)
	}

	// Create and start DAG viewer. WithAPI attaches the DAG/weave/attest/
	// compliance-graph endpoints that previously ran as the standalone
	// cmd/khepra-daemon process — now sharing this same global DAG singleton.
	// WithAuth attaches the sovereign login/validate/bootstrap endpoints.
	// WithRemediate attaches the asaf-daemon relay, if keys provisioned.
	// WithWAF attaches the bilateral ingress/egress WAF, if it started.
	viewer := webui.NewDAGViewer(port, provider).
		WithAPI(webui.NewDAGAPI()).
		WithAuth(webui.NewAuthAPI(authProvider))
	if daemonClient != nil {
		viewer = viewer.WithRemediate(webui.NewRemediateAPI(daemonClient, authProvider))
		fmt.Printf("     http://localhost:%d/api/v1/asaf/remediate - Submit signed ChangeRequest to asaf-daemon\n", port)
		fmt.Printf("     http://localhost:%d/api/v1/asaf/staging   - Poll staging job status\n", port)
	}
	if duatRealm != nil {
		viewer = viewer.WithWAF(duatRealm.WAFShield)
	}

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		fmt.Println("\n\n🛑 Shutdown signal received...")
		fmt.Println("Stopping DAG Viewer...")
		if err := viewer.Stop(); err != nil {
			log.Printf("Error stopping server: %v\n", err)
		}
		kasaEngine.Stop()
		if duatRealm != nil {
			duatRealm.Stop()
		}
		fmt.Println("✅ Server stopped gracefully")
		os.Exit(0)
	}()

	// Start server (blocking)
	if err := viewer.Start(); err != nil {
		log.Fatalf("❌ Failed to start DAG Viewer: %v\n", err)
	}
}

// newSovereignAuthProvider opens the on-prem auth database. Path resolution
// mirrors pkg/dag/global.go's KHEPRA_DAG_PATH pattern: explicit env var
// override, else ~/.khepra/auth.db.
func newSovereignAuthProvider() (*auth.SQLiteProvider, error) {
	dbPath := os.Getenv("KHEPRA_AUTH_DB_PATH")
	if dbPath == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			home = "."
		}
		dbPath = filepath.Join(home, ".khepra", "auth.db")
	}
	if dir := filepath.Dir(dbPath); dir != "." {
		if err := os.MkdirAll(dir, 0700); err != nil {
			return nil, fmt.Errorf("create auth db directory %s: %w", dir, err)
		}
	}
	return auth.NewSQLiteProvider(dbPath)
}

// newDaemonClient provisions (or loads) this process's agent identity keypair
// and constructs a client for asaf-daemon's Unix socket. The public half of
// a freshly generated keypair must be copied to wherever asaf-daemon's
// --agent-pubkey flag points — they're different processes, possibly
// different machines/containers, so this can't do that copy itself.
func newDaemonClient() (*client.Client, error) {
	socketPath := os.Getenv("ASAF_DAEMON_SOCKET")
	if socketPath == "" {
		socketPath = "/var/run/asaf/asaf.sock"
	}

	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	privKeyPath := os.Getenv("ASAF_AGENT_KEY_PATH")
	if privKeyPath == "" {
		privKeyPath = filepath.Join(home, ".khepra", "asaf-agent.key")
	}
	pubKeyPath := os.Getenv("ASAF_AGENT_PUBKEY_PATH")
	if pubKeyPath == "" {
		pubKeyPath = filepath.Join(home, ".khepra", "asaf-agent.pub")
	}

	keys, err := client.ProvisionAgentKeys(privKeyPath, pubKeyPath)
	if err != nil {
		return nil, fmt.Errorf("provision agent keys: %w", err)
	}
	if keys.Generated {
		fmt.Printf("  🔑 Generated new ASAF agent identity — copy %s to asaf-daemon's --agent-pubkey path\n", keys.PubKeyPath)
	}

	agentID := os.Getenv("ASAF_AGENT_ID")
	if agentID == "" {
		agentID = "adinkhepra-serve"
	}

	return client.New(client.Config{
		SocketPath: socketPath,
		AgentID:    agentID,
		PrivKey:    keys.PrivKey,
	})
}

// bootstrapAdminFromEnv creates the first admin account non-interactively,
// for scripted/Docker deployments that pre-set ADINKHEPRA_ADMIN_EMAIL and
// ADINKHEPRA_ADMIN_PASSWORD rather than using the one-time HTTP bootstrap
// endpoint.
func bootstrapAdminFromEnv(provider *auth.SQLiteProvider, email, password string) error {
	admin := &auth.User{
		ID:       "user_bootstrap_" + email,
		Username: email,
		Email:    email,
		Roles:    []string{"admin"},
		Attributes: map[string]interface{}{"password": password},
	}
	return provider.CreateUser(context.Background(), admin)
}
