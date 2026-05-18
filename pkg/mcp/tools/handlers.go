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

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/acp"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/ert"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/mcp"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/nhi"
)

// ─── Default service instances (lazy init, singleton) ──────────────────────────

var (
	defaultACP *acp.AgentControlPlane
	defaultNHI *nhi.NHITracker
	defaultERT *ert.ScanOrchestrator
)

func init() {
	// Initialize ACP.
	var err error
	defaultACP, err = acp.NewAgentControlPlane()
	if err != nil {
		log.Printf("[mcp/tools] WARNING: ACP init failed: %v (ACP tools will return errors)", err)
	}

	// Initialize NHI tracker.
	defaultNHI = nhi.NewNHITracker()

	// Initialize ERT orchestrator with default lanes.
	defaultERT = ert.NewScanOrchestrator()
}

// ─── ACP Free Functions ────────────────────────────────────────────────────────

// HandleACPStatus is a standalone handler for the acp_status tool.
func HandleACPStatus(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewACPStatusTool(defaultACP)
	return tool.Handle(ctx, call)
}

// HandleACPIssue is a standalone handler for the acp_issue tool.
func HandleACPIssue(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewACPIssueTool(defaultACP)
	return tool.Handle(ctx, call)
}

// HandleACPRevoke is a standalone handler for the acp_revoke tool.
func HandleACPRevoke(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewACPRevokeTool(defaultACP)
	return tool.Handle(ctx, call)
}

// ─── NHI Free Functions ────────────────────────────────────────────────────────

// HandleNHIInventory is a standalone handler for the nhi_inventory tool.
func HandleNHIInventory(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewNHIInventoryTool(defaultNHI)
	return tool.Handle(ctx, call)
}

// HandleNHIOrphans is a standalone handler for the nhi_orphans tool.
func HandleNHIOrphans(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewNHIOrphansTool(defaultNHI)
	return tool.Handle(ctx, call)
}

// HandleNHIExcessive is a standalone handler for the nhi_excessive tool.
func HandleNHIExcessive(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewNHIExcessiveTool(defaultNHI)
	return tool.Handle(ctx, call)
}

// HandleNHIExpired is a standalone handler for the nhi_expired tool.
func HandleNHIExpired(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewNHIExpiredTool(defaultNHI)
	return tool.Handle(ctx, call)
}

// HandleNHIRevoke is a standalone handler for the nhi_revoke tool.
func HandleNHIRevoke(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewNHIRevokeTool(defaultNHI)
	return tool.Handle(ctx, call)
}

// ─── ERT Free Functions ────────────────────────────────────────────────────────

// HandleERTScan is a standalone handler for the ert_scan tool.
func HandleERTScan(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	tool := NewERTScanTool(defaultERT)
	return tool.Handle(ctx, call)
}
