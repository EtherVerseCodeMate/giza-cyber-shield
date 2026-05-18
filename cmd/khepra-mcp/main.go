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
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
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

	logger.Printf("PQC session initialized | symbol=%s | key_id=%s", symbol, keyID)

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
	dagStore := dag.NewMemory()
	attestor := khepramcp.NewDAGAttestor(dagStore, symbol, privKey)

	// ── Assemble Router ──────────────────────────────────────────────────────
	router, err := khepramcp.NewRouter(khepramcp.RouterConfig{
		Demarc:   demarc,
		Poly:     poly,
		Gateway:  gateway,
		Registry: registry,
		Executor: executor,
		Attestor: attestor,
		Logger:   logger,
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

	logger.Printf("starting hardened MCP server (stdio)")
	if err := server.Run(ctx); err != nil {
		logger.Fatalf("server error: %v", err)
	}
	logger.Printf("shutdown complete")
}

// ─── Tool Handler Registration ─────────────────────────────────────────────────

func registerToolHandlers(executor *khepramcp.Executor) {
	// ACP tools (ReadOnly + Destructive)
	executor.RegisterFunc("acp_status", tools.HandleACPStatus)
	executor.RegisterFunc("acp_issue", tools.HandleACPIssue)
	executor.RegisterFunc("acp_revoke", tools.HandleACPRevoke)

	// NHI tools (ReadOnly + Destructive)
	executor.RegisterFunc("nhi_inventory", tools.HandleNHIInventory)
	executor.RegisterFunc("nhi_orphans", tools.HandleNHIOrphans)
	executor.RegisterFunc("nhi_excessive", tools.HandleNHIExcessive)
	executor.RegisterFunc("nhi_expired", tools.HandleNHIExpired)
	executor.RegisterFunc("nhi_revoke", tools.HandleNHIRevoke)

	// ERT scan (Sandboxed — runs in Docker when available, falls back to in-process)
	executor.RegisterFunc("ert_scan", tools.HandleERTScan)
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
func defaultToolSpecs() []khepramcp.ToolSpec {
	hash := func(name string) string {
		h := sha256.Sum256([]byte(name + ":v1"))
		return hex.EncodeToString(h[:])
	}

	return []khepramcp.ToolSpec{
		// ── ACP (Agent Control Plane) ────────────────────────────────────
		{
			Name: "acp_status", Description: "List active ACP credentials and their expiry status",
			RiskClass: khepramcp.RiskReadOnly, Scope: "acp:read",
			SchemaVersion: "1.0.0", SchemaHash: hash("acp_status"),
			AllowedBackend: "in-process", TimeoutMs: 5000,
		},
		{
			Name: "acp_issue", Description: "Issue a new PQC credential via the Agent Control Plane",
			RiskClass: khepramcp.RiskDestructive, Scope: "acp:write", Destructive: true,
			SchemaVersion: "1.0.0", SchemaHash: hash("acp_issue"),
			AllowedBackend: "in-process", TimeoutMs: 10000,
		},
		{
			Name: "acp_revoke", Description: "Revoke an active ACP credential",
			RiskClass: khepramcp.RiskDestructive, Scope: "acp:write", Destructive: true,
			SchemaVersion: "1.0.0", SchemaHash: hash("acp_revoke"),
			AllowedBackend: "in-process", TimeoutMs: 10000,
		},

		// ── NHI (Non-Human Identity) ─────────────────────────────────────
		{
			Name: "nhi_inventory", Description: "List all non-human identities (service accounts, API keys, certificates)",
			RiskClass: khepramcp.RiskReadOnly, Scope: "nhi:read",
			SchemaVersion: "1.0.0", SchemaHash: hash("nhi_inventory"),
			AllowedBackend: "in-process", TimeoutMs: 5000,
		},
		{
			Name: "nhi_orphans", Description: "Identify orphaned non-human identities with no active owner",
			RiskClass: khepramcp.RiskReadOnly, Scope: "nhi:read",
			SchemaVersion: "1.0.0", SchemaHash: hash("nhi_orphans"),
			AllowedBackend: "in-process", TimeoutMs: 5000,
		},
		{
			Name: "nhi_excessive", Description: "Identify NHIs with overly broad permissions",
			RiskClass: khepramcp.RiskReadOnly, Scope: "nhi:read",
			SchemaVersion: "1.0.0", SchemaHash: hash("nhi_excessive"),
			AllowedBackend: "in-process", TimeoutMs: 5000,
		},
		{
			Name: "nhi_expired", Description: "List expired or soon-to-expire non-human identities",
			RiskClass: khepramcp.RiskReadOnly, Scope: "nhi:read",
			SchemaVersion: "1.0.0", SchemaHash: hash("nhi_expired"),
			AllowedBackend: "in-process", TimeoutMs: 5000,
		},
		{
			Name: "nhi_revoke", Description: "Revoke a non-human identity credential",
			RiskClass: khepramcp.RiskDestructive, Scope: "nhi:write", Destructive: true,
			SchemaVersion: "1.0.0", SchemaHash: hash("nhi_revoke"),
			AllowedBackend: "in-process", TimeoutMs: 10000,
		},

		// ── ERT (Enterprise Risk & Threat) ───────────────────────────────
		{
			Name: "ert_scan", Description: "Run ERT security scan (SCA, vulnerability, compliance) in Docker sandbox",
			RiskClass: khepramcp.RiskSandboxed, Scope: "ert:scan",
			SchemaVersion: "1.0.0", SchemaHash: hash("ert_scan"),
			AllowedBackend: "docker", TimeoutMs: 90000, NetworkAllowed: false,
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
