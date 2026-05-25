package ert

import (
	"context"
	"fmt"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/mcp/scanner"
)

// AnalyzeMCPServer runs sc.Scan and records findings as ComplianceGaps in the
// ERT DAG chain. The caller builds the Scanner (binding it to a Server and
// AgentControlPlane) so that pkg/ert does not take a direct dependency on
// pkg/acp.
//
// Integration pipeline:
//
//	pkg/mcp/scanner.Scanner.Scan()
//	  → []MCPFinding
//	  → Engine.AnalyzeMCPServer() converts to []ComplianceGap
//	  → DAG audit node written via recordToDAG()
//	  → Caller inserts ea_evolution_triggers row for Mitochondrial Server
func (e *Engine) AnalyzeMCPServer(ctx context.Context, sc *scanner.Scanner, serverName string) ([]ComplianceGap, error) {
	findings, err := sc.Scan(ctx)
	if err != nil {
		return nil, fmt.Errorf("mcp scanner (%s): %w", serverName, err)
	}

	gaps := make([]ComplianceGap, 0, len(findings))
	for _, f := range findings {
		fw, ctrl, desc, sev := f.ComplianceGapFields()
		gaps = append(gaps, ComplianceGap{
			Framework:   fw,
			Control:     ctrl,
			Description: desc,
			Severity:    sev,
		})
	}

	e.recordToDAG("ert_mcp_scan", map[string]interface{}{
		"server":   serverName,
		"findings": len(findings),
		"tenant":   e.tenant,
	})

	return gaps, nil
}
