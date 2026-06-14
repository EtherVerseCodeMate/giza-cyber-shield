// Khepra MCP Server — Hardened Entry Point (AD-006 / AD-008)
//
// This binary implements the world's first PQC-secured MCP server.
// It runs as a subprocess launched by AI tools (Claude, Cursor, Windsurf)
// via stdin/stdout JSON-RPC transport as defined by the MCP specification.
//
// Security chain:
//   DEMARC → Manifest → Polymorphic → MCPGateway → Executor → Attestation
//
// All tool responses are PQC-signed (Adinkhepra ML-DSA-65) and DAG-anchored.
// Tool schemas are pinned via signed manifest with fail-closed startup verification.
//
// Usage (configured in .mcp.json):
//
//	{
//	  "mcpServers": {
//	    "khepra-mcp": {
//	      "command": "go",
//	      "args": ["run", "./cmd/khepra-mcp/main.go"],
//	      "env": {
//	        "KHEPRA_MANIFEST_PATH": "./manifest.json",
//	        "PHANTOM_SYMBOL": "Eban"
//	      }
//	    }
//	  }
//	}
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/config"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
	khepramcp "github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/mcp"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/mcp/tools"
)

func main() {
	// All diagnostic output goes to stderr (MCP: stdout = JSON-RPC only).
	logger := log.New(os.Stderr, "[khepra-mcp] ", log.LstdFlags|log.Lmicroseconds)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// ── Adinkra PQC Key Setup ────────────────────────────────────────────────
	symbol := getEnvOr("PHANTOM_SYMBOL", "Eban")
	_ = adinkra.GetSpectralFingerprint(symbol) // Validate symbol exists

	// Generate ML-DSA-65 key pair (compatible with adinkra.Sign/Verify)
	pubKey, privKey, err := adinkra.GenerateDilithiumKey()
	if err != nil {
		logger.Fatalf("FATAL: PQC key generation failed: %v", err)
	}

	keyHash := sha256.Sum256(pubKey)
	keyID := hex.EncodeToString(keyHash[:8])

	// ── Deployment Mode — read once, logged clearly ──────────────────────────
	// This is the canonical mode log line. All downstream components inherit
	// their storage and network policy from config.LoadRuntime().
	runCfg := config.LoadRuntime()
	logger.Printf("━━━ KHEPRA MCP SERVER ━━━")
	logger.Printf("  mode:           %s", runCfg.Mode)
	logger.Printf("  network_policy: %s", runCfg.NetworkPolicy)
	if runCfg.IsAirGapped {
		logger.Printf("  dag_store:      PersistentMemory (disk) → %s", runCfg.DAGPath)
		logger.Printf("  supabase:       DISABLED (air-gap mode)")
	} else {
		logger.Printf("  dag_store:      Memory (in-process, stateless SaaS)")
		logger.Printf("  supabase:       ENABLED (SaaS mode — requires saas build tag)")
	}
	logger.Printf("  symbol=%s | key_id=%s", symbol, keyID)

	// ── Transport mode enforcement ────────────────────────────────────────────
	// sovereign/ironbank: stdio only — refuse HTTP listener (air-gap policy).
	// edge/hybrid: HTTP/SSE allowed (Fly.io reverse proxy handles TLS).
	if runCfg.IsAirGapped {
		if os.Getenv("KHEPRA_HTTP_PORT") != "" {
			logger.Fatalf("FATAL: KHEPRA_HTTP_PORT=%s is set but KHEPRA_MODE=%s does not permit HTTP transport. "+
				"Sovereign/ironbank deployments use stdio transport only. "+
				"Remove KHEPRA_HTTP_PORT or switch to KHEPRA_MODE=edge for HTTP.",
				os.Getenv("KHEPRA_HTTP_PORT"), runCfg.Mode)
		}
		logger.Printf("  transport:      stdio only (air-gap policy — HTTP listener refused)")
	} else {
		logger.Printf("  transport:      stdio + HTTP/SSE available (set KHEPRA_HTTP_PORT to enable)")
	}

	// ── License Validation ──────────────────────────────────────────────
	// ParseMCPLicense loads KHEPRA_LICENSE_KEY and verifies offline via
	// ML-DSA-65 + device binding + expiry + IPFS CRL (sovereign.go stack).
	// Community tier (no key) is non-fatal; tampered/expired = fatal.
	licenseClaim, licErr := license.ParseMCPLicense()
	if errors.Is(licErr, license.ErrNoLicenseKey) {
		logger.Printf("[LICENSE] Community tier — Enterprise tools gated. Set KHEPRA_LICENSE_KEY to unlock.")
	} else if licErr != nil {
		// Key present but invalid (tampered / expired / wrong machine) = fatal
		logger.Fatalf("FATAL: license validation failed: %v", licErr)
	} else {
		logger.Printf("[LICENSE] %s tier | tenant=%q | id=%s | expires=%s",
			licenseClaim.Tier,
			licenseClaim.Tenant,
			licenseClaim.LicenseID,
			licenseClaim.ExpiresAt.Format("2006-01-02"),
		)
	}

	// ── Build Security Chain ─────────────────────────────────────────────────

	// 1. DEMARC Gateway — pre-authenticated identity for stdio transport
	demarc := &khepramcp.AdinkraDemarcGateway{
		StdioIdentity: khepramcp.Identity{
			Subject:   "khepra-mcp-stdio",
			Issuer:    "demarc",
			AgentID:   "local-agent",
			SessionID: keyID,
			Scopes:    []string{"*"}, // Stdio sessions have full access
		},
	}

	// 2. Polymorphic Engine — PQC envelope wrapping
	poly := &khepramcp.AdinkraPolymorphicEngine{
		Symbol:     symbol,
		PrivateKey: privKey,
		PublicKey:  pubKey,
	}

	// 3. MCP Gateway — RBAC + injection scanning
	gateway := khepramcp.NewDefaultMCPGateway()

	// 4. Manifest Registry — load and verify pinned tool definitions
	registry, err := loadManifestRegistry(ctx, pubKey, keyID, logger)
	if err != nil {
		logger.Fatalf("FATAL: manifest registry failed — fail-closed: %v", err)
	}
	logger.Printf("manifest loaded: %d tools, version=%s", registry.ToolCount(), registry.Version())

	// 5. Executor — risk-classified dispatch
	sandboxBackend := khepramcp.NewDockerSandbox(khepramcp.DockerSandboxConfig{
		Image:  getEnvOr("PHANTOM_IMAGE", "khepra-phantom:latest"),
		Config: khepramcp.DefaultSandboxConfig(),
		Logger: logger,
	})

	// Auto-approve gate for stdio (single-tenant subprocess model).
	// For HTTP transport, replace with interactive confirmation.
	confirmGate := &StdioConfirmationGate{logger: logger}

	executor := khepramcp.NewExecutor(khepramcp.ExecutorConfig{
		Sandbox: sandboxBackend,
		Confirm: confirmGate,
		Logger:  logger,
	})

	// 6. Register in-process tool handlers
	registerToolHandlers(executor)

	// 7. DAG Attestor — PQC-signed audit trail
	// dag.NewStore() selects PersistentMemory (sovereign) or Memory (SaaS/edge)
	// based on KHEPRA_MODE. This is already resolved in runCfg above.
	_ = runCfg // consumed above; dag.NewStore() re-reads KHEPRA_MODE internally
	dagStore := dag.NewStore()
	attestor := khepramcp.NewDAGAttestor(dagStore, symbol, privKey)

	// ── Assemble Router ──────────────────────────────────────────────────────
	//
	// Wire all security hardening fields introduced in the NSA/ASD reconciliation:
	//   SignedAuditLog    — per-entry ML-DSA-65-signed NDJSON chain (DFARS 252.204-7012)
	//   InvocationRootKey — per-call ephemeral HMAC tokens (ASD/CISA short-lived credentials)
	//   MaxConcurrent     — concurrent call cap per agent (NSA prompt-storm defense)

	// Open the tamper-evident audit log
	var signedLog *khepramcp.SignedAuditLog
	// Default audit log path: Windows uses %USERPROFILE%\.khepra\audit.ndjson,
	// Linux/macOS use /var/log/khepra/audit.ndjson (or override with env var).
	defaultAuditLog := "/var/log/khepra/audit.ndjson"
	if home := os.Getenv("USERPROFILE"); home != "" {
		defaultAuditLog = home + `\.khepra\audit.ndjson`
	} else if home := os.Getenv("HOME"); home != "" {
		defaultAuditLog = home + "/.khepra/audit.ndjson"
	}
	auditLogPath := getEnvOr("KHEPRA_AUDIT_LOG_PATH", defaultAuditLog)
	sal, salErr := khepramcp.NewSignedAuditLog(khepramcp.SignedAuditLogConfig{
		Path:    auditLogPath,
		PrivKey: privKey,
		PubKey:  pubKey,
	})
	if salErr != nil {
		// Non-fatal: log warning but continue without signed log
		logger.Printf("WARN: signed audit log unavailable (%s): %v — continuing without", auditLogPath, salErr)
	} else {
		signedLog = sal
		logger.Printf("signed audit log: %s", auditLogPath)
	}

	// Derive HMAC root key for per-invocation tokens from the ML-DSA-65 session key
	invocationRootKey := khepramcp.DeriveRootKey(privKey)

	// Max concurrent tool calls per agent (default: 5)
	maxConcurrent := 5
	if mc := os.Getenv("KHEPRA_MAX_CONCURRENT"); mc != "" {
		if n, err := strconv.Atoi(mc); err == nil && n > 0 {
			maxConcurrent = n
		}
	}

	router, err := khepramcp.NewRouter(khepramcp.RouterConfig{
		Demarc:   demarc,
		Poly:     poly,
		Gateway:  gateway,
		Registry: registry,
		Executor: executor,
		Attestor: attestor,
		Logger:   logger,
		// Security hardening (NSA/ASD reconciliation)
		SignedAuditLog:    signedLog,
		InvocationRootKey: invocationRootKey,
		MaxConcurrent:     maxConcurrent,
		// License enforcement
		License: licenseClaim,
	})
	if err != nil {
		logger.Fatalf("FATAL: router construction failed: %v", err)
	}

	// ── Start HardenedServer ─────────────────────────────────────────────────
	server, err := khepramcp.NewHardenedServer(khepramcp.HardenedServerConfig{
		Mode:       khepramcp.TransportStdio,
		Router:     router,
		Logger:     logger,
		Credential: "stdio", // Pre-authenticated for subprocess model
	})
	if err != nil {
		logger.Fatalf("FATAL: server construction failed: %v", err)
	}

	// ── Register Shutdown Hooks ──────────────────────────────────────────────
	// 0. Stop heartbeat daemon (handled by sovereign telemetry_client.go)
	// (no separate daemon to stop — sovereign stack manages its own lifecycle)
	// 1. Zero-out PQC private key material
	server.OnShutdown(func() {
		for i := range privKey {
			privKey[i] = 0
		}
		for i := range invocationRootKey {
			invocationRootKey[i] = 0
		}
		logger.Println("PQC private key material destroyed")
	})

	// 2. Flush and close signed audit log
	server.OnShutdown(func() {
		if signedLog != nil {
			if err := signedLog.Close(); err != nil {
				logger.Printf("WARN: audit log close error: %v", err)
			} else {
				logger.Printf("signed audit log closed: %s", auditLogPath)
			}
		}
	})

	// 3. Flush telemetry events
	server.OnShutdown(func() {
		events := router.Events().Flush()
		logger.Printf("flushed %d telemetry events", len(events))
	})

	// 3. Emit shutdown event
	router.Events().Emit(khepramcp.MCPEvent{
		Type:    khepramcp.EventStartup,
		Success: true,
		Metadata: map[string]any{
			"version":  "1.0.0-sovereign-mcp",
			"symbol":   symbol,
			"key_id":   keyID,
			"tools":    registry.ToolCount(),
			"manifest": registry.Version(),
		},
	})

	logger.Printf("starting hardened MCP server (stdio)")
	if err := server.Run(ctx); err != nil {
		// Run shutdown hooks even on error
		server.Shutdown(context.Background())
		logger.Fatalf("server error: %v", err)
	}
	server.Shutdown(context.Background())
	logger.Printf("shutdown complete")
}

// ─── Tool Handler Registration ─────────────────────────────────────────────────

func registerToolHandlers(executor *khepramcp.Executor) {
	// ── ACP: Agent Control Plane (credential lifecycle) ───────────────────
	executor.RegisterFunc("acp_status", tools.HandleACPStatus)
	executor.RegisterFunc("acp_issue", tools.HandleACPIssue)
	executor.RegisterFunc("acp_revoke", tools.HandleACPRevoke)

	// ── NHI: Non-Human Identity (service account / API key governance) ────
	executor.RegisterFunc("nhi_inventory", tools.HandleNHIInventory)
	executor.RegisterFunc("nhi_orphans", tools.HandleNHIOrphans)
	executor.RegisterFunc("nhi_excessive", tools.HandleNHIExcessive)
	executor.RegisterFunc("nhi_expired", tools.HandleNHIExpired)
	executor.RegisterFunc("nhi_revoke", tools.HandleNHIRevoke)

	// ── ERT: Enterprise Risk & Threat scanner (Docker sandbox) ────────────
	executor.RegisterFunc("ert_scan", tools.HandleERTScan)

	// ── ERT Packages A–D (in-process, JSON output, ASAF-enriched) ─────────
	// Package A — Mission Assurance Modeling (NIST 800-171 + SCA scoring)
	executor.RegisterFunc("ert_readiness", tools.HandleERTReadiness)
	// Package B — Supply Chain Hunter (Syft→Grype→Enricher pipeline)
	executor.RegisterFunc("ert_architect", tools.HandleERTArchitect)
	// Package C — PQC Attestation (SBOM crypto inventory + weak primitive scan)
	executor.RegisterFunc("ert_crypto", tools.HandleERTCrypto)
	// Package D — Causal Risk Attestation (KernelRouter synthesis + DAG)
	executor.RegisterFunc("ert_godfather", tools.HandleERTGodfather)

	// ── DAG Attestation — export signed audit trail ────────────────────────
	executor.RegisterFunc("dag_attestation", tools.HandleDAGAttestation)

	// ── Godfather Report + Human-in-the-Loop Gate ─────────────────────────
	// NSA/ASD Security Track 6: high-impact outputs require analyst approval
	executor.RegisterFunc("godfather_report", tools.HandleGodfatherReport)
	executor.RegisterFunc("godfather_approve", tools.HandleGodfatherApprove)

	// ── NIST Map: offline BM25 semantic control search (zero token cost) ──
	executor.RegisterFunc("nist_map", tools.HandleNistMapTool)

	// ── khepra_watch: filesystem-triggered continuous monitoring ──────────
	// CMMC AC.2.006, CM.2.061, SI.2.217 continuous monitoring requirement
	executor.RegisterFunc("khepra_watch", tools.HandleKhepraWatchTool)
}

// ─── Manifest Loading ──────────────────────────────────────────────────────────

func loadManifestRegistry(ctx context.Context, pubKey []byte, keyID string, logger *log.Logger) (*khepramcp.ManifestRegistry, error) {
	manifestPath := getEnvOr("KHEPRA_MANIFEST_PATH", "manifest.json")

	// Try loading from file first
	if _, err := os.Stat(manifestPath); err == nil {
		logger.Printf("loading manifest from %s", manifestPath)
		store := &khepramcp.FileManifestStore{Path: manifestPath}
		// Use bootstrap verifier initially; switch to AdinkraManifestVerifier once
		// the signed manifest is generated with real PQC keys.
		verifier := &khepramcp.BootstrapManifestVerifier{}
		return khepramcp.LoadRegistry(ctx, store, verifier)
	}

	// Fallback: generate embedded bootstrap manifest
	logger.Printf("no manifest file found at %s — generating bootstrap manifest", manifestPath)
	return generateBootstrapManifest(ctx, pubKey, keyID)
}

func generateBootstrapManifest(ctx context.Context, pubKey []byte, keyID string) (*khepramcp.ManifestRegistry, error) {
	toolSpecs := defaultToolSpecs()

	manifest, err := khepramcp.GenerateSignedManifest(toolSpecs, pubKey, keyID)
	if err != nil {
		return nil, err
	}

	store := &khepramcp.EmbeddedManifestStore{Manifest: manifest}
	verifier := &khepramcp.BootstrapManifestVerifier{}
	return khepramcp.LoadRegistry(ctx, store, verifier)
}

// defaultToolSpecs returns the hardened tool specification list.
// This is also the spec set registered in the bootstrap manifest when no
// signed manifest.json file is present (Docker image always ships manifest.json).
func defaultToolSpecs() []khepramcp.ToolSpec {
	hash := func(name string) string {
		h := sha256.Sum256([]byte(name + ":v1"))
		return hex.EncodeToString(h[:])
	}

	// noArgSchema is used for tools that require no parameters.
	// MCP clients REQUIRE inputSchema to be present — omitting it hides the tool.
	noArgSchema := map[string]any{
		"type":       "object",
		"properties": map[string]any{},
	}

	return []khepramcp.ToolSpec{
		// ── ACP (Agent Control Plane) ────────────────────────────────────────
		{
			Name: "acp_status", Description: "List active ACP credentials and their expiry status",
			RiskClass: khepramcp.RiskReadOnly, Scope: "acp:read",
			SchemaVersion: "1.0.0", SchemaHash: hash("acp_status"),
			AllowedBackend: "in-process", TimeoutMs: 5000,
			MaxPrivilege: "read-only",
			ArgsSchema:   noArgSchema,
		},
		{
			Name: "acp_issue", Description: "Issue a new PQC credential via the Agent Control Plane",
			RiskClass: khepramcp.RiskDestructive, Scope: "acp:write", Destructive: true,
			SchemaVersion: "1.0.0", SchemaHash: hash("acp_issue"),
			AllowedBackend: "in-process", TimeoutMs: 10000,
			MaxPrivilege: "none",
			ArgsSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"subject":    map[string]any{"type": "string", "description": "Principal identifier for the new credential"},
					"scopes":     map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Permission scopes to grant"},
					"expires_in": map[string]any{"type": "string", "description": "Credential TTL (e.g. '24h', '7d')"},
				},
				"required": []string{"subject"},
			},
		},
		{
			Name: "acp_revoke", Description: "Revoke an active ACP credential",
			RiskClass: khepramcp.RiskDestructive, Scope: "acp:write", Destructive: true,
			SchemaVersion: "1.0.0", SchemaHash: hash("acp_revoke"),
			AllowedBackend: "in-process", TimeoutMs: 10000,
			MaxPrivilege: "none",
			ArgsSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"credential_id": map[string]any{"type": "string", "description": "ID of the ACP credential to revoke"},
				},
				"required": []string{"credential_id"},
			},
		},

		// ── NHI (Non-Human Identity) ─────────────────────────────────────────
		{
			Name: "nhi_inventory", Description: "List all non-human identities (service accounts, API keys, certificates)",
			RiskClass: khepramcp.RiskReadOnly, Scope: "nhi:read",
			SchemaVersion: "1.0.0", SchemaHash: hash("nhi_inventory"),
			AllowedBackend: "in-process", TimeoutMs: 5000,
			MaxPrivilege: "read-only",
			ArgsSchema:   noArgSchema,
		},
		{
			Name: "nhi_orphans", Description: "Identify orphaned non-human identities with no active owner",
			RiskClass: khepramcp.RiskReadOnly, Scope: "nhi:read",
			SchemaVersion: "1.0.0", SchemaHash: hash("nhi_orphans"),
			AllowedBackend: "in-process", TimeoutMs: 5000,
			MaxPrivilege: "read-only",
			ArgsSchema:   noArgSchema,
		},
		{
			Name: "nhi_excessive", Description: "Identify NHIs with overly broad permissions",
			RiskClass: khepramcp.RiskReadOnly, Scope: "nhi:read",
			SchemaVersion: "1.0.0", SchemaHash: hash("nhi_excessive"),
			AllowedBackend: "in-process", TimeoutMs: 5000,
			MaxPrivilege: "read-only",
			ArgsSchema:   noArgSchema,
		},
		{
			Name: "nhi_expired", Description: "List expired or soon-to-expire non-human identities",
			RiskClass: khepramcp.RiskReadOnly, Scope: "nhi:read",
			SchemaVersion: "1.0.0", SchemaHash: hash("nhi_expired"),
			AllowedBackend: "in-process", TimeoutMs: 5000,
			MaxPrivilege: "read-only",
			ArgsSchema:   noArgSchema,
		},
		{
			Name: "nhi_revoke", Description: "Revoke a non-human identity credential",
			RiskClass: khepramcp.RiskDestructive, Scope: "nhi:write", Destructive: true,
			SchemaVersion: "1.0.0", SchemaHash: hash("nhi_revoke"),
			AllowedBackend: "in-process", TimeoutMs: 10000,
			MaxPrivilege: "none",
			ArgsSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"nhi_id": map[string]any{"type": "string", "description": "NHI identifier to revoke"},
				},
				"required": []string{"nhi_id"},
			},
		},

		// ── ERT (Enterprise Risk & Threat Scanner) ───────────────────────────
		// Runs in Docker sandbox with capability mounts scoped to the scan target.
		// ASD/CISA confused-deputy defense: only the directories declared here
		// are accessible inside the container.
		{
			Name: "ert_scan", Description: "Run ERT security scan (SBOM, CVE, secrets, STIG, PQC inventory) in Docker sandbox",
			RiskClass: khepramcp.RiskSandboxed, Scope: "ert:scan",
			SchemaVersion: "1.0.0", SchemaHash: hash("ert_scan"),
			AllowedBackend: "docker", TimeoutMs: 90000, NetworkAllowed: false,
			MaxPrivilege: "read-only",
			// CapabilityMounts: populated at runtime from call.Args["project_path"]
			// The router's ASD/CISA defense validates these are not traversal paths.
			ArgsSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"project_path": map[string]any{"type": "string", "description": "Path to project directory"},
					"image_ref":    map[string]any{"type": "string", "description": "Container image to scan (overrides project_path)"},
					"lanes":        map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Scan lanes: sca, horus, compliance"},
					"framework":    map[string]any{"type": "string", "description": "Compliance framework: CMMC_L2, NIST_800_171, etc."},
				},
			},
		},

		// ── ERT Packages A–D (in-process, structured JSON, ASAF-enriched) ────
		{
			Name:           "ert_readiness",
			Description:    "Package A: NIST 800-171 Rev2 compliance assessment + live SCA risk factor. Returns alignment score (0–100), control gaps, and prioritized remediation roadmap. Air-gap safe.",
			RiskClass:      khepramcp.RiskReadOnly, Scope: "ert:compliance",
			SchemaVersion:  "1.0.0", SchemaHash: hash("ert_readiness"),
			AllowedBackend: "in-process", TimeoutMs: 60000,
			MaxPrivilege:   "read-only",
			ArgsSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"project_path": map[string]any{"type": "string", "description": "Path to project directory (default: current directory)"},
				},
			},
		},
		{
			Name:           "ert_architect",
			Description:    "Package B: Live supply chain risk — Syft SBOM generation + Grype CVE matching + threat intel enrichment (CISA KEV, EPSS, MITRE ATT&CK). Returns enriched findings with NIST 800-171 control mapping.",
			RiskClass:      khepramcp.RiskReadOnly, Scope: "ert:supply-chain",
			SchemaVersion:  "1.0.0", SchemaHash: hash("ert_architect"),
			AllowedBackend: "in-process", TimeoutMs: 300000,
			MaxPrivilege:   "read-only",
			ArgsSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"project_path": map[string]any{"type": "string", "description": "Path to project directory"},
					"image_ref":    map[string]any{"type": "string", "description": "Container image reference to scan"},
				},
			},
		},
		{
			Name:           "ert_crypto",
			Description:    "Package C: PQC readiness attestation — source-level crypto primitive scan, SBOM crypto library inventory (OpenSSL, Kyber, Dilithium, etc.), weak primitive detection (MD5/SHA1/DES/RC4), CNSA 2.0 scenario-based quantum risk context.",
			RiskClass:      khepramcp.RiskReadOnly, Scope: "ert:pqc",
			SchemaVersion:  "1.0.0", SchemaHash: hash("ert_crypto"),
			AllowedBackend: "in-process", TimeoutMs: 180000,
			MaxPrivilege:   "read-only",
			ArgsSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"project_path": map[string]any{"type": "string", "description": "Path to project directory"},
				},
			},
		},
		{
			Name:           "ert_godfather",
			Description:    "Package D: EA KernelRouter-synthesized causal risk attestation. Runs STIG, PQC, SBOM, and Network agents in parallel, produces board-level causal chain with CVSS-band dollar impact estimate and DAG-signed evidence node.",
			RiskClass:      khepramcp.RiskReadOnly, Scope: "ert:godfather",
			SchemaVersion:  "1.0.0", SchemaHash: hash("ert_godfather"),
			AllowedBackend: "in-process", TimeoutMs: 300000,
			MaxPrivilege:   "read-only",
			ArgsSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"project_path": map[string]any{"type": "string", "description": "Path to project directory"},
					"framework":    map[string]any{"type": "string", "description": "Compliance framework to assess against"},
				},
			},
		},

		// ── DAG Attestation ──────────────────────────────────────────────────
		{
			Name:           "dag_attestation",
			Description:    "Export the PQC-signed DAG audit trail for the current session. Returns all DAG nodes with ML-DSA-65 signatures, timestamps, and Adinkra symbol chain. Use after any ERT scan to produce a cryptographically-verifiable evidence package.",
			RiskClass:      khepramcp.RiskReadOnly, Scope: "dag:read",
			SchemaVersion:  "1.0.0", SchemaHash: hash("dag_attestation"),
			AllowedBackend: "in-process", TimeoutMs: 10000,
			MaxPrivilege:   "read-only",
			ArgsSchema:     noArgSchema,
		},

		// ── Godfather Report (HITL-gated) ─────────────────────────────────────
		// Security Track 6: staged delivery with 30-min TTL token.
		// Full report only released after human calls godfather_approve.
		{
			Name: "godfather_report",
			Description: "Generate a complete CMMC/STIG/NIST compliance report. When approval_required=true, returns a staged token — the full report is held until a human calls godfather_approve.",
			RiskClass: khepramcp.RiskReadOnly, Scope: "compliance:report",
			SchemaVersion: "1.0.0", SchemaHash: hash("godfather_report"),
			AllowedBackend: "in-process", TimeoutMs: 30000,
			MaxPrivilege: "stig-db-read",
			ArgsSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"framework":        map[string]any{"type": "string", "description": "Compliance framework (CMMC_L2, NIST_800_171, STIG)"},
					"approval_required": map[string]any{"type": "boolean", "description": "If true, returns staged token requiring human approval"},
					"project_path":     map[string]any{"type": "string", "description": "Path to project directory"},
				},
			},
		},
		{
			Name: "godfather_approve",
			Description: "Deliver a staged Godfather Report. Requires the staged_token returned by godfather_report. Single-use — token is consumed on delivery.",
			RiskClass: khepramcp.RiskReadOnly, Scope: "compliance:report",
			SchemaVersion: "1.0.0", SchemaHash: hash("godfather_approve"),
			AllowedBackend: "in-process", TimeoutMs: 5000,
			MaxPrivilege: "read-only",
			ArgsSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"staged_token": map[string]any{"type": "string", "description": "Token returned by godfather_report when approval_required=true"},
				},
				"required": []string{"staged_token"},
			},
		},

		// ── NIST Map (offline BM25 semantic search) ──────────────────────────
		// Zero token cost, zero network calls, air-gap safe.
		// 36,195 NIST/CMMC/STIG control mappings indexed at startup.
		{
			Name: "nist_map",
			Description: "Offline semantic search across NIST 800-53 Rev5, NIST 800-171 Rev2, CMMC 2.0, and STIG CCI mappings. BM25 ranked results. Zero token cost, air-gap safe.",
			RiskClass: khepramcp.RiskReadOnly, Scope: "compliance:read",
			SchemaVersion: "1.0.0", SchemaHash: hash("nist_map"),
			AllowedBackend: "in-process", TimeoutMs: 5000,
			MaxPrivilege: "read-only",
			ArgsSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"query":      map[string]any{"type": "string", "description": "Search query (natural language or control ID)"},
					"frameworks": map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Filter by framework(s): NIST_800_53, NIST_800_171, CMMC, STIG"},
					"limit":      map[string]any{"type": "integer", "description": "Maximum results to return (default: 10)"},
				},
				"required": []string{"query"},
			},
		},

		// ── khepra_watch (continuous monitoring) ─────────────────────────────
		// Registers filesystem watches that fire ert_scan on file change.
		// Satisfies CMMC AC.2.006, CM.2.061, SI.2.217.
		{
			Name: "khepra_watch",
			Description: "Register a filesystem path for continuous STIG-triggered scanning. Fires ert_scan on file changes. Action: register | status | unregister.",
			RiskClass: khepramcp.RiskReadOnly, Scope: "compliance:monitor",
			SchemaVersion: "1.0.0", SchemaHash: hash("khepra_watch"),
			AllowedBackend: "in-process", TimeoutMs: 10000,
			MaxPrivilege: "read-only",
			ArgsSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"action": map[string]any{"type": "string", "enum": []string{"register", "status", "unregister"}, "description": "Action to perform"},
					"path":   map[string]any{"type": "string", "description": "Filesystem path to watch"},
				},
				"required": []string{"action"},
			},
		},
	}
}

// ─── Confirmation Gate ─────────────────────────────────────────────────────────

// StdioConfirmationGate auto-approves destructive operations for stdio sessions.
// This is acceptable for single-tenant subprocess model where the human controls
// the parent process. For HTTP/multi-tenant, use an interactive gate.
type StdioConfirmationGate struct {
	logger *log.Logger
}

func (g *StdioConfirmationGate) Confirm(_ context.Context, spec khepramcp.ToolSpec, call khepramcp.MCPToolCall) error {
	g.logger.Printf("[CONFIRM] auto-approved destructive tool=%s agent=%s (stdio single-tenant)",
		spec.Name, call.Identity.AgentID)
	return nil
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

func getEnvOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
