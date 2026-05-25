// Package tools — standalone handler functions for cmd/khepra-mcp registration.
package tools

import (
	"context"
	"log"
	"sync"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/acp"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/ert"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/mcp"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/nhi"
)

var (
	defaultACP *acp.AgentControlPlane
	defaultNHI *nhi.NHITracker
	defaultERT *ert.ScanOrchestrator
	acpOnce    sync.Once
	manyOnce   sync.Once
	ertOnce    sync.Once
)

func getACP() *acp.AgentControlPlane {
	acpOnce.Do(func() {
		var err error
		defaultACP, err = acp.NewAgentControlPlane()
		if err != nil {
			log.Printf("[mcp/tools] WARNING: ACP init failed: %v", err)
		}
	})
	return defaultACP
}

func getNHI() *nhi.NHITracker {
	manyOnce.Do(func() {
		defaultNHI = nhi.NewNHITracker()
	})
	return defaultNHI
}

func getERT() *ert.ScanOrchestrator {
	ertOnce.Do(func() {
		defaultERT = ert.NewScanOrchestrator()
	})
	return defaultERT
}

// HandleACPStatus is a standalone handler for the acp_status tool.
func HandleACPStatus(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return NewACPStatusTool(getACP()).Handle(ctx, call)
}

// HandleACPIssue is a standalone handler for the acp_issue tool.
func HandleACPIssue(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return NewACPIssueTool(getACP()).Handle(ctx, call)
}

// HandleACPRevoke is a standalone handler for the acp_revoke tool.
func HandleACPRevoke(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return NewACPRevokeTool(getACP()).Handle(ctx, call)
}

// HandleNHIInventory is a standalone handler for the nhi_inventory tool.
func HandleNHIInventory(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return NewNHIInventoryTool(getNHI()).Handle(ctx, call)
}

// HandleNHIOrphans is a standalone handler for the nhi_orphans tool.
func HandleNHIOrphans(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return NewNHIOrphansTool(getNHI()).Handle(ctx, call)
}

// HandleNHIExcessive is a standalone handler for the nhi_excessive tool.
func HandleNHIExcessive(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return NewNHIExcessiveTool(getNHI()).Handle(ctx, call)
}

// HandleNHIExpired is a standalone handler for the nhi_expired tool.
func HandleNHIExpired(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return NewNHIExpiredTool(getNHI()).Handle(ctx, call)
}

// HandleNHIRevoke is a standalone handler for the nhi_revoke tool.
func HandleNHIRevoke(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return NewNHIRevokeTool(getNHI()).Handle(ctx, call)
}

// HandleERTScan is a standalone handler for the ert_scan tool.
func HandleERTScan(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return NewERTScanTool(getERT()).Handle(ctx, call)
}

// HandleGodfatherReport is a standalone handler for the godfather_report tool.
func HandleGodfatherReport(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return NewGodfatherReportTool(nil).Handle(ctx, call)
}

// HandleGodfatherApprove is a standalone handler for the godfather_approve tool.
func HandleGodfatherApprove(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return NewGodfatherApproveTool().Handle(ctx, call)
}

// HandleKhepraWatchTool is the free-function handler for khepra_watch.
func HandleKhepraWatchTool(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return HandleKhepraWatch(ctx, call)
}

// HandleNistMapTool is the free-function handler for nist_map.
func HandleNistMapTool(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	return HandleNistMap(ctx, call)
}
