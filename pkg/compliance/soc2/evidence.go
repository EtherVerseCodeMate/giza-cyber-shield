package soc2

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"
)

// EvidenceType classifies evidence artifacts.
type EvidenceType string

const (
	EvidencePolicy        EvidenceType = "POLICY"
	EvidenceProcedure     EvidenceType = "PROCEDURE"
	EvidenceScreenshot    EvidenceType = "SCREENSHOT"
	EvidenceLog           EvidenceType = "LOG"
	EvidenceReport        EvidenceType = "REPORT"
	EvidenceConfiguration EvidenceType = "CONFIGURATION"
	EvidenceTestResult    EvidenceType = "TEST_RESULT"
	EvidenceAttestation   EvidenceType = "ATTESTATION"
)

// Evidence is a single piece of audit evidence.
type Evidence struct {
	ID           string       `json:"id"`
	CriterionID  string       `json:"criterion_id"`
	Type         EvidenceType `json:"type"`
	Title        string       `json:"title"`
	Description  string       `json:"description"`
	CollectedAt  time.Time    `json:"collected_at"`
	CollectedBy  string       `json:"collected_by"`
	Hash         string       `json:"hash"` // SHA-256 of artifact content
	ArtifactPath string       `json:"artifact_path,omitempty"`
	Tags         []string     `json:"tags,omitempty"`
}

// EvidenceRequest describes evidence that must be gathered for an audit.
type EvidenceRequest struct {
	CriterionID string       `json:"criterion_id"`
	Type        EvidenceType `json:"type"`
	Description string       `json:"description"`
	Required    bool         `json:"required"`
	Frequency   string       `json:"frequency"` // e.g. "ANNUAL", "QUARTERLY", "CONTINUOUS"
}

// EvidenceCollector manages the SOC 2 evidence library.
type EvidenceCollector struct {
	items []Evidence
}

// NewEvidenceCollector returns an initialised collector.
func NewEvidenceCollector() *EvidenceCollector {
	return &EvidenceCollector{}
}

// Add registers a new evidence item. The hash is computed from content.
func (ec *EvidenceCollector) Add(criterionID string, evType EvidenceType, title, description, collectedBy string, content []byte) Evidence {
	h := sha256.Sum256(content)
	ev := Evidence{
		ID:          fmt.Sprintf("EV-%s-%d", criterionID, time.Now().UnixNano()),
		CriterionID: criterionID,
		Type:        evType,
		Title:       title,
		Description: description,
		CollectedAt: time.Now().UTC(),
		CollectedBy: collectedBy,
		Hash:        hex.EncodeToString(h[:]),
	}
	ec.items = append(ec.items, ev)
	return ev
}

// List returns all collected evidence, optionally filtered by criterion.
func (ec *EvidenceCollector) List(criterionID string) []Evidence {
	if criterionID == "" {
		return ec.items
	}
	var out []Evidence
	for _, e := range ec.items {
		if e.CriterionID == criterionID {
			out = append(out, e)
		}
	}
	return out
}

// RequiredEvidence returns the canonical list of evidence every SOC 2 audit expects.
func RequiredEvidence() []EvidenceRequest {
	return []EvidenceRequest{
		// CC1 — Control Environment
		{CriterionID: "CC1.1", Type: EvidencePolicy, Required: true, Frequency: "ANNUAL",
			Description: "Code of conduct / ethics policy signed by all employees"},
		{CriterionID: "CC1.4", Type: EvidencePolicy, Required: true, Frequency: "ANNUAL",
			Description: "Job descriptions and competency requirements for security roles"},

		// CC3 — Risk Assessment
		{CriterionID: "CC3.2", Type: EvidenceReport, Required: true, Frequency: "ANNUAL",
			Description: "Formal risk assessment report including threat and vulnerability analysis"},
		{CriterionID: "CC3.3", Type: EvidenceReport, Required: true, Frequency: "ANNUAL",
			Description: "Fraud risk assessment documentation"},

		// CC4 — Monitoring
		{CriterionID: "CC4.1", Type: EvidenceLog, Required: true, Frequency: "CONTINUOUS",
			Description: "Continuous monitoring logs demonstrating ongoing evaluation of controls"},
		{CriterionID: "CC4.2", Type: EvidenceReport, Required: true, Frequency: "QUARTERLY",
			Description: "Internal audit / vulnerability scan reports with remediation tracking"},

		// CC6 — Logical Access
		{CriterionID: "CC6.1", Type: EvidenceConfiguration, Required: true, Frequency: "CONTINUOUS",
			Description: "MFA enforcement configuration evidence (IdP settings, screenshots)"},
		{CriterionID: "CC6.2", Type: EvidenceProcedure, Required: true, Frequency: "ANNUAL",
			Description: "User onboarding / access provisioning procedure"},
		{CriterionID: "CC6.3", Type: EvidenceReport, Required: true, Frequency: "QUARTERLY",
			Description: "Quarterly access review reports with approvals"},
		{CriterionID: "CC6.6", Type: EvidenceConfiguration, Required: true, Frequency: "CONTINUOUS",
			Description: "Firewall/WAF rules and network segmentation configuration"},
		{CriterionID: "CC6.7", Type: EvidenceConfiguration, Required: true, Frequency: "CONTINUOUS",
			Description: "Data-in-transit encryption configuration (TLS 1.2+ / PQC where applicable)"},
		{CriterionID: "CC6.8", Type: EvidenceReport, Required: true, Frequency: "CONTINUOUS",
			Description: "Anti-malware / EDR deployment and scan reports"},

		// CC7 — System Operations
		{CriterionID: "CC7.1", Type: EvidenceReport, Required: true, Frequency: "CONTINUOUS",
			Description: "Vulnerability scan results and patch management records"},
		{CriterionID: "CC7.2", Type: EvidenceConfiguration, Required: true, Frequency: "CONTINUOUS",
			Description: "SIEM / IDS alerting rules and monitoring dashboard screenshots"},
		{CriterionID: "CC7.4", Type: EvidenceProcedure, Required: true, Frequency: "ANNUAL",
			Description: "Incident response plan and tabletop exercise results"},

		// CC8 — Change Management
		{CriterionID: "CC8.1", Type: EvidenceLog, Required: true, Frequency: "CONTINUOUS",
			Description: "Change tickets / pull-request approvals demonstrating change control process"},

		// CC9 — Risk Mitigation
		{CriterionID: "CC9.2", Type: EvidencePolicy, Required: true, Frequency: "ANNUAL",
			Description: "Vendor / third-party risk assessment records and agreements (BAAs, DPAs)"},

		// Availability
		{CriterionID: "A1.2", Type: EvidenceTestResult, Required: true, Frequency: "ANNUAL",
			Description: "Disaster recovery / backup restoration test results"},
		{CriterionID: "A1.3", Type: EvidenceTestResult, Required: true, Frequency: "ANNUAL",
			Description: "Business continuity plan (BCP) tabletop or full test results"},
	}
}

// MarshalJSON returns the evidence library as a JSON byte slice.
func (ec *EvidenceCollector) MarshalJSON() ([]byte, error) {
	return json.Marshal(ec.items)
}
