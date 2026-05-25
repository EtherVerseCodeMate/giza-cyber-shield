// Package scanner implements continuous MCP threat detection for the Khepra
// PQC-secured MCP server. It checks for threats T01–T16 from the AdinKhepra
// MCP Threat Model and converts findings into ert.ComplianceGap records for
// the ERT pipeline.
package scanner

import (
	"context"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/acp"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/mcp"
)

// ThreatClass identifies an MCP threat category.
type ThreatClass string

const (
	T01ToolPoisoning    ThreatClass = "T01"
	T02PromptInjection  ThreatClass = "T02"
	T03ManifestRugPull  ThreatClass = "T03"
	T04ConfusedDeputy   ThreatClass = "T04"
	T05ScopeCreep       ThreatClass = "T05"
	T06UnsignedResponse ThreatClass = "T06"
	T07DAGGap           ThreatClass = "T07"
	T08RateLimitBypass  ThreatClass = "T08"
	T09SSEExposure      ThreatClass = "T09"
	T10SchemaDrift      ThreatClass = "T10"
	T11StaleCredential  ThreatClass = "T11"
	T12UnauthorizedDisc ThreatClass = "T12"
	T13SandboxEgress    ThreatClass = "T13"
	T14SSRF             ThreatClass = "T14"
	T15ToolShadowing    ThreatClass = "T15"
	T16PQCDowngrade     ThreatClass = "T16"
)

// Scanner runs MCP threat checks against a live Server instance.
type Scanner struct {
	srv      *mcp.Server
	acp      *acp.AgentControlPlane // nil → ACP checks skipped
	baseline *mcp.SignedToolManifest
}

// New returns a Scanner bound to srv.
func New(srv *mcp.Server, acPlane *acp.AgentControlPlane) *Scanner {
	return &Scanner{srv: srv, acp: acPlane}
}

// CaptureBaseline takes a manifest snapshot used for T03/T10 drift detection.
// Call once after all tools are registered.
func (sc *Scanner) CaptureBaseline() {
	sc.baseline = sc.srv.ComputeManifest()
}

// SetBaseline allows injecting a pre-computed baseline (e.g. loaded from DB).
func (sc *Scanner) SetBaseline(m *mcp.SignedToolManifest) { sc.baseline = m }

// Scan executes all configured checks and returns the aggregate findings.
func (sc *Scanner) Scan(ctx context.Context) ([]MCPFinding, error) {
	checks := []func(context.Context) []MCPFinding{
		sc.checkToolPoisoning,
		sc.checkManifestRugPull,
		sc.checkUnsignedResponse,
		sc.checkDAGGap,
		sc.checkSchemaDrift,
		sc.checkStaleCredential,
		sc.checkPQCDowngrade,
	}

	var findings []MCPFinding
	for _, check := range checks {
		select {
		case <-ctx.Done():
			return findings, ctx.Err()
		default:
		}
		findings = append(findings, check(ctx)...)
	}
	return findings, nil
}
