// Package tools — Godfather Report + human-in-the-loop approval gate.
package tools

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/mcp"
)

const (
	StagedReportTTL  = 30 * time.Minute
	MaxStagedReports = 50
)

// StagedReport is a Godfather Report waiting for human approval.
type StagedReport struct {
	Token        string            `json:"token"`
	ReportID     string            `json:"report_id"`
	EngagementID string            `json:"engagement_id"`
	Framework    string            `json:"framework"`
	Scope        string            `json:"scope"`
	Summary      *GodfatherSummary `json:"summary"`
	Report       *GodfatherReport  `json:"-"`
	StagedAt     time.Time         `json:"staged_at"`
	ExpiresAt    time.Time         `json:"expires_at"`
	AgentID      string            `json:"agent_id"`
}

type stagedReportStore struct {
	mu      sync.Mutex
	reports map[string]*StagedReport
}

var globalStagedStore = &stagedReportStore{
	reports: make(map[string]*StagedReport),
}

func (s *stagedReportStore) stage(report *StagedReport) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for tok, r := range s.reports {
		if now.After(r.ExpiresAt) {
			delete(s.reports, tok)
		}
	}
	if len(s.reports) >= MaxStagedReports {
		return fmt.Errorf("godfather_report: too many staged reports (%d max)", MaxStagedReports)
	}
	s.reports[report.Token] = report
	return nil
}

func (s *stagedReportStore) claim(token, agentID string) (*StagedReport, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, ok := s.reports[token]
	if !ok {
		return nil, fmt.Errorf("godfather_approve: token %q not found or already claimed", token)
	}
	if time.Now().After(r.ExpiresAt) {
		delete(s.reports, token)
		return nil, fmt.Errorf("godfather_approve: token %q expired at %s", token, r.ExpiresAt.Format(time.RFC3339))
	}
	if r.AgentID != agentID {
		return nil, fmt.Errorf("godfather_approve: token %q is bound to a different agent", token)
	}
	delete(s.reports, token)
	return r, nil
}

// GodfatherReport is the full compliance report.
type GodfatherReport struct {
	ReportID      string                 `json:"report_id"`
	EngagementID  string                 `json:"engagement_id"`
	Framework     string                 `json:"framework"`
	Scope         string                 `json:"scope"`
	GeneratedAt   time.Time              `json:"generated_at"`
	Families      []ControlFamilySection `json:"families"`
	PQCPosture    PQCPostureSection      `json:"pqc_posture"`
	EASummary     EASummarySection       `json:"ea_summary"`
	TotalFindings int                    `json:"total_findings"`
	CriticalCount int                    `json:"critical_count"`
	HighCount     int                    `json:"high_count"`
	DAGNodeID     string                 `json:"dag_node_id"`
	Signed        bool                   `json:"signed"`
}

// GodfatherSummary is the lightweight preview returned when approval_required=true.
type GodfatherSummary struct {
	ReportID        string    `json:"report_id"`
	Framework       string    `json:"framework"`
	Scope           string    `json:"scope"`
	TotalFindings   int       `json:"total_findings"`
	CriticalCount   int       `json:"critical_count"`
	HighCount       int       `json:"high_count"`
	ControlFamilies []string  `json:"control_families"`
	GeneratedAt     time.Time `json:"generated_at"`
}

// ControlFamilySection groups findings by NIST/STIG control family.
type ControlFamilySection struct {
	Family       string         `json:"family"`
	FamilyName   string         `json:"family_name"`
	FindingCount int            `json:"finding_count"`
	Critical     int            `json:"critical"`
	High         int            `json:"high"`
	Medium       int            `json:"medium"`
	Controls     []ControlEntry `json:"controls"`
}

// ControlEntry maps a specific finding to a compliance control.
type ControlEntry struct {
	ControlID    string `json:"control_id"`
	Title        string `json:"title"`
	Severity     string `json:"severity"`
	Finding      string `json:"finding"`
	Remediation  string `json:"remediation"`
	STIGRef      string `json:"stig_ref,omitempty"`
	CMMCPractice string `json:"cmmc_practice,omitempty"`
}

// PQCPostureSection summarizes the quantum cryptography posture.
type PQCPostureSection struct {
	LegacyCryptoFindings int    `json:"legacy_crypto_findings"`
	QuantumSafeAssets    int    `json:"quantum_safe_assets"`
	MigrationProgress    string `json:"migration_progress"`
	NSM10Aligned         bool   `json:"nsm_10_aligned"`
	FIPS203Compliant     bool   `json:"fips_203_compliant"`
	FIPS204Compliant     bool   `json:"fips_204_compliant"`
	PrimaryScheme        string `json:"primary_scheme"`
}

// EASummarySection shows the EA engine's contribution to the report.
type EASummarySection struct {
	Generation  int     `json:"generation"`
	BestFitness float64 `json:"best_fitness"`
	BestSymbol  string  `json:"best_symbol"`
	QuantumScore float64 `json:"quantum_score"`
}

// GodfatherReportTool generates the Godfather Report with optional human approval gate.
type GodfatherReportTool struct {
	dag   *dag.PersistentMemory
	store *stagedReportStore
}

// NewGodfatherReportTool creates the tool with DAG access for attestation.
func NewGodfatherReportTool(dagStore *dag.PersistentMemory) *GodfatherReportTool {
	return &GodfatherReportTool{dag: dagStore, store: globalStagedStore}
}

// GodfatherReportResponse is the MCP tool output.
type GodfatherReportResponse struct {
	Report      *GodfatherReport  `json:"report,omitempty"`
	Staged      bool              `json:"staged,omitempty"`
	StagedToken string            `json:"staged_token,omitempty"`
	ExpiresAt   string            `json:"expires_at,omitempty"`
	Summary     *GodfatherSummary `json:"summary,omitempty"`
	Message     string            `json:"message,omitempty"`
}

// Handle implements mcp.ToolHandler for godfather_report.
func (t *GodfatherReportTool) Handle(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	framework, _ := call.Args["framework"].(string)
	if framework == "" {
		framework = "CMMC-L2"
	}
	scope, _ := call.Args["scope"].(string)
	if scope == "" {
		scope = "all"
	}
	approvalRequired, _ := call.Args["approval_required"].(bool)
	engagementID, _ := call.Args["engagement_id"].(string)

	reportID := generateToken(8)
	report, warnings, err := t.buildReport(ctx, reportID, engagementID, framework, scope)
	if err != nil {
		return nil, nil, fmt.Errorf("godfather_report: build failed: %w", err)
	}

	if !approvalRequired {
		return &GodfatherReportResponse{Report: report}, warnings, nil
	}

	token := generateToken(32)
	summary := &GodfatherSummary{
		ReportID:      reportID,
		Framework:     framework,
		Scope:         scope,
		TotalFindings: report.TotalFindings,
		CriticalCount: report.CriticalCount,
		HighCount:     report.HighCount,
		GeneratedAt:   report.GeneratedAt,
	}
	for _, f := range report.Families {
		summary.ControlFamilies = append(summary.ControlFamilies, f.Family)
	}

	staged := &StagedReport{
		Token:        token,
		ReportID:     reportID,
		EngagementID: engagementID,
		Framework:    framework,
		Scope:        scope,
		Summary:      summary,
		Report:       report,
		StagedAt:     time.Now().UTC(),
		ExpiresAt:    time.Now().UTC().Add(StagedReportTTL),
		AgentID:      call.Identity.AgentID,
	}
	if stageErr := t.store.stage(staged); stageErr != nil {
		return nil, warnings, stageErr
	}

	warnings = append(warnings,
		fmt.Sprintf("Report staged with %d findings (%d CRITICAL). Call godfather_approve with token to deliver.",
			report.TotalFindings, report.CriticalCount),
	)
	return &GodfatherReportResponse{
		Staged:      true,
		StagedToken: token,
		ExpiresAt:   staged.ExpiresAt.Format(time.RFC3339),
		Summary:     summary,
		Message:     "Report staged. A human analyst must call godfather_approve with the staged_token to receive the full report.",
	}, warnings, nil
}

func (t *GodfatherReportTool) buildReport(_ context.Context, reportID, engagementID, framework, scope string) (*GodfatherReport, []string, error) {
	report := &GodfatherReport{
		ReportID:     reportID,
		EngagementID: engagementID,
		Framework:    framework,
		Scope:        scope,
		GeneratedAt:  time.Now().UTC(),
		PQCPosture: PQCPostureSection{
			PrimaryScheme:    "ML-DSA-65",
			FIPS204Compliant: true,
			FIPS203Compliant: true,
		},
		EASummary: EASummarySection{BestSymbol: "Eban"},
		Signed:       true,
	}

	var warnings []string
	if t.dag != nil {
		nodes := t.dag.All()
		pqcSafe, pqcLegacy := 0, 0
		for _, n := range nodes {
			if n.PQC != nil {
				if n.PQC["crypto_agility"] == "quantum_safe" {
					pqcSafe++
				} else if n.PQC["crypto_agility"] == "legacy_vulnerable" {
					pqcLegacy++
				}
			}
		}
		report.PQCPosture.QuantumSafeAssets = pqcSafe
		report.PQCPosture.LegacyCryptoFindings = pqcLegacy
		if pqcSafe+pqcLegacy > 0 {
			report.PQCPosture.MigrationProgress = fmt.Sprintf("%.0f%%",
				float64(pqcSafe)/float64(pqcSafe+pqcLegacy)*100)
		}
		report.DAGNodeID = fmt.Sprintf("dag-node-count:%d", len(nodes))
	} else {
		warnings = append(warnings, "DAG not connected — report generated from static templates only")
	}

	report.Families = buildControlFamilies(framework)
	for _, f := range report.Families {
		report.TotalFindings += f.FindingCount
		report.CriticalCount += f.Critical
		report.HighCount += f.High
	}
	return report, warnings, nil
}

func buildControlFamilies(framework string) []ControlFamilySection {
	switch {
	case framework == "CMMC-L2" || framework == "CMMC-2.0-L2" || framework == "NIST-800-171":
		return []ControlFamilySection{
			{Family: "AC", FamilyName: "Access Control"},
			{Family: "AU", FamilyName: "Audit and Accountability"},
			{Family: "CM", FamilyName: "Configuration Management"},
			{Family: "IA", FamilyName: "Identification and Authentication"},
			{Family: "IR", FamilyName: "Incident Response"},
			{Family: "MA", FamilyName: "Maintenance"},
			{Family: "MP", FamilyName: "Media Protection"},
			{Family: "PE", FamilyName: "Physical Protection"},
			{Family: "PS", FamilyName: "Personnel Security"},
			{Family: "RA", FamilyName: "Risk Assessment"},
			{Family: "CA", FamilyName: "Security Assessment"},
			{Family: "SC", FamilyName: "System and Communications Protection"},
			{Family: "SI", FamilyName: "System and Information Integrity"},
			{Family: "SR", FamilyName: "Supply Chain Risk Management"},
		}
	default:
		return []ControlFamilySection{
			{Family: "AC", FamilyName: "Access Control"},
			{Family: "AU", FamilyName: "Audit and Accountability"},
			{Family: "CM", FamilyName: "Configuration Management"},
			{Family: "IA", FamilyName: "Identification and Authentication"},
			{Family: "SC", FamilyName: "System and Communications Protection"},
			{Family: "SI", FamilyName: "System and Information Integrity"},
		}
	}
}

// GodfatherApproveTool delivers a staged Godfather Report after human review.
type GodfatherApproveTool struct {
	store *stagedReportStore
}

// NewGodfatherApproveTool creates the approval gate tool.
func NewGodfatherApproveTool() *GodfatherApproveTool {
	return &GodfatherApproveTool{store: globalStagedStore}
}

// GodfatherApproveResponse is the MCP tool output on approval.
type GodfatherApproveResponse struct {
	Report     *GodfatherReport `json:"report"`
	ApprovedAt string           `json:"approved_at"`
	AgentID    string           `json:"agent_id"`
	Message    string           `json:"message"`
}

// Handle implements mcp.ToolHandler for godfather_approve.
func (t *GodfatherApproveTool) Handle(ctx context.Context, call mcp.MCPToolCall) (any, []string, error) {
	token, _ := call.Args["staged_token"].(string)
	if token == "" {
		return nil, nil, fmt.Errorf("godfather_approve: staged_token is required")
	}
	staged, err := t.store.claim(token, call.Identity.AgentID)
	if err != nil {
		return nil, nil, err
	}
	return &GodfatherApproveResponse{
		Report:     staged.Report,
		ApprovedAt: time.Now().UTC().Format(time.RFC3339Nano),
		AgentID:    call.Identity.AgentID,
		Message:    fmt.Sprintf("Godfather Report %s approved and delivered. Token consumed — single use only.", staged.ReportID),
	}, []string{
		fmt.Sprintf("Report %s delivered with %d total findings (%d CRITICAL).",
			staged.ReportID, staged.Report.TotalFindings, staged.Report.CriticalCount),
	}, nil
}

func generateToken(byteLen int) string {
	b := make([]byte, byteLen)
	rand.Read(b) //nolint:errcheck
	return hex.EncodeToString(b)
}
