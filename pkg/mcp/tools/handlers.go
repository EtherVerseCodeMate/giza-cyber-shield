// Package tools — standalone handler functions for cmd/khepra-mcp registration.
//
// These functions adapt the struct-based tools for direct registration with
// executor.RegisterFunc(). They initialize with default/nil instances and
// return graceful errors when the underlying service is not configured.
//
// In production with full service wiring, prefer the struct constructors
// (NewACPStatusTool, NewNHIInventoryTool, etc.) for dependency injection.

package tools

import (
	"context"
	"log"
	"os/exec"
	"sync"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/acp"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/ert"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/mcp"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/nhi"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/sca"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/vuln"
)


// ─── Default service instances (lazy init, singleton) ──────────────────────────

var (
	defaultACP *acp.AgentControlPlane
	defaultNHI *nhi.NHITracker
	defaultERT *ert.ScanOrchestrator
	acpOnce    sync.Once
	nhiOnce    sync.Once
	ertOnce    sync.Once
)

func getACP() *acp.AgentControlPlane {
	acpOnce.Do(func() {
		var err error
		defaultACP, err = acp.NewAgentControlPlane()
		if err != nil {
			log.Printf("[mcp/tools] WARNING: ACP init failed: %v (ACP tools will return errors)", err)
		}
	})
	return defaultACP
}

func getNHI() *nhi.NHITracker {
	nhiOnce.Do(func() {
		defaultNHI = nhi.NewNHITracker()
	})
	return defaultNHI
}


// ─── ERT Wired Orchestrator ────────────────────────────────────────────────────

// newWiredOrchestrator builds a ScanOrchestrator with all available scan lanes
// pre-registered. This is the production-wired version used by MCP handlers.
//
// Lane registration is conditional:
//   - SCA lane: registered only when syft+grype are in PATH
//   - Horus lanes: always registered (zero-binary-dependency built-in scanners)
func newWiredOrchestrator() *ert.ScanOrchestrator {
	orch := ert.NewScanOrchestrator()

	// ── Horus lanes — always available (zero external deps) ─────────────────
	orch.RegisterLane(ert.NewHorusVulnLane())
	orch.RegisterLane(ert.NewHorusSecretLane())
	orch.RegisterLane(ert.NewHorusComplianceLane())
	orch.RegisterLane(ert.NewHorusContainerLane())

	// ── SCA lane — conditional on Syft + Grype being in PATH ────────────────
	// When tools are absent the Horus lanes still provide coverage; this avoids
	// a hard start-up dependency on external binaries per AD-002.
	if scaBinaryAvailable("syft") && scaBinaryAvailable("grype") {
		feedMgr := vuln.NewIntelFeedManager()
		syftAdapter := sca.NewSyftAdapter()
		grypeAdapter := sca.NewGrypeAdapter()
		enricher := sca.NewEnricher(feedMgr)
		orch.RegisterLane(ert.NewSCALane(syftAdapter, grypeAdapter, enricher))
		log.Println("[mcp/tools] SCA lane registered (syft+grype found in PATH)")
	} else {
		log.Println("[mcp/tools] SCA lane skipped (syft or grype not in PATH — Horus lanes active)")
	}

	// ── Sonar lane — network/OSINT/crawler (no external binary dep) ──────────
	// Secrets (Shodan/Censys keys) are NOT required at init — the orchestrator
	// silently skips OSINT when no SecretBundle is provided, so the lane still
	// delivers port scan and Horus vulnerability results in keyless mode.
	// The lane only activates on network targets (ImageRef or explicit lanes=[sonar]).
	orch.RegisterLane(ert.NewSonarLane(nil, nil, nil))
	log.Println("[mcp/tools] Sonar lane registered (network/OSINT/port-scan active)")

	return orch
}


// scaBinaryAvailable returns true when the named binary is resolvable in PATH.
func scaBinaryAvailable(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

func getERT() *ert.ScanOrchestrator {
	ertOnce.Do(func() {
		defaultERT = newWiredOrchestrator()
	})
	return defaultERT
}


// ─── ACP Free Functions ────────────────────────────────────────────────────────

// HandleACPStatus is a standalone handler for the acp_status tool.
func HandleACPStatus(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewACPStatusTool(getACP())
	return tool.Handle(ctx, call)
}

// HandleACPIssue is a standalone handler for the acp_issue tool.
func HandleACPIssue(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewACPIssueTool(getACP())
	return tool.Handle(ctx, call)
}

// HandleACPRevoke is a standalone handler for the acp_revoke tool.
func HandleACPRevoke(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewACPRevokeTool(getACP())
	return tool.Handle(ctx, call)
}

// ─── NHI Free Functions ────────────────────────────────────────────────────────

// HandleNHIInventory is a standalone handler for the nhi_inventory tool.
func HandleNHIInventory(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewNHIInventoryTool(getNHI())
	return tool.Handle(ctx, call)
}

// HandleNHIOrphans is a standalone handler for the nhi_orphans tool.
func HandleNHIOrphans(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewNHIOrphansTool(getNHI())
	return tool.Handle(ctx, call)
}

// HandleNHIExcessive is a standalone handler for the nhi_excessive tool.
func HandleNHIExcessive(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewNHIExcessiveTool(getNHI())
	return tool.Handle(ctx, call)
}

// HandleNHIExpired is a standalone handler for the nhi_expired tool.
func HandleNHIExpired(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewNHIExpiredTool(getNHI())
	return tool.Handle(ctx, call)
}

// HandleNHIRevoke is a standalone handler for the nhi_revoke tool.
func HandleNHIRevoke(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewNHIRevokeTool(getNHI())
	return tool.Handle(ctx, call)
}

// ─── ERT Free Functions ────────────────────────────────────────────────────────

// HandleERTScan is a standalone handler for the ert_scan tool.
func HandleERTScan(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewERTScanTool(getERT())
	return tool.Handle(ctx, call)
}

// HandleERTReadiness is the standalone handler for the ert_readiness MCP tool.
// Returns NIST 800-171 alignment score, control gaps, and remediation roadmap as JSON.
func HandleERTReadinessMCP(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return HandleERTReadiness(ctx, call)
}

// HandleERTArchitectMCP is the standalone handler for the ert_architect MCP tool.
// Returns enriched supply chain SBOM findings as structured JSON.
func HandleERTArchitectMCP(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return HandleERTArchitect(ctx, call)
}

// HandleERTCryptoMCP is the standalone handler for the ert_crypto MCP tool.
// Returns SBOM crypto library inventory, weak primitives, and PQC migration path.
func HandleERTCryptoMCP(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return HandleERTCrypto(ctx, call)
}

// HandleERTGodfatherMCP is the standalone handler for the ert_godfather MCP tool.
// Returns EA KernelRouter-synthesized causal risk attestation as structured JSON.
func HandleERTGodfatherMCP(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return HandleERTGodfather(ctx, call)
}



// ─── Godfather Free Functions ──────────────────────────────────────────────────

// HandleGodfatherReport is a standalone handler for the godfather_report tool.
// Generates the Godfather Report with optional human-in-the-loop approval gate.
func HandleGodfatherReport(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewGodfatherReportTool(nil) // nil DAG = template mode; wire real DAG at server init
	return tool.Handle(ctx, call)
}

// HandleGodfatherApprove is a standalone handler for the godfather_approve tool.
// Delivers a staged Godfather Report after human analyst approval.
func HandleGodfatherApprove(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewGodfatherApproveTool()
	return tool.Handle(ctx, call)
}

// ─── Watch Free Function ───────────────────────────────────────────────────────

// HandleKhepraWatchTool is the free-function handler for khepra_watch.
// Registers, queries, or unregisters filesystem-triggered scan watches.
func HandleKhepraWatchTool(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return HandleKhepraWatch(ctx, call)
}

// ─── NIST Map Free Function ────────────────────────────────────────────────────

// HandleNistMapTool is the free-function handler for nist_map.
// Performs offline BM25 semantic search across NIST/CMMC/STIG control taxonomy.
func HandleNistMapTool(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return HandleNistMap(ctx, call)
}
