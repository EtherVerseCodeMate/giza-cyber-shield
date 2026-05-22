package soc2

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

// ReadinessLevel describes how prepared the system is for a SOC 2 audit.
type ReadinessLevel string

const (
	ReadinessAuditReady ReadinessLevel = "AUDIT_READY"     // ≥90 % implemented
	ReadinessNearReady  ReadinessLevel = "NEAR_READY"      // 70–89 %
	ReadinessInProgress ReadinessLevel = "IN_PROGRESS"     // 40–69 %
	ReadinessEarly      ReadinessLevel = "EARLY_STAGE"     // <40 %
)

// GapFinding describes a control gap that needs remediation before the audit.
type GapFinding struct {
	CriterionID string
	Title       string
	Family      CriteriaFamily
	Status      ImplementationStatus
	Remediation string
	Priority    string // HIGH, MEDIUM, LOW
}

// ReadinessReport is the output of a SOC 2 gap assessment.
type ReadinessReport struct {
	GeneratedAt    time.Time                        `json:"generated_at"`
	SystemName     string                           `json:"system_name"`
	ScopeNote      string                           `json:"scope_note"`
	Implementations map[string]ControlImplementation `json:"implementations"`
	Gaps            []GapFinding                     `json:"gaps"`
	Score           float64                          `json:"score_pct"`
	Level           ReadinessLevel                   `json:"readiness_level"`
	Summary         string                           `json:"summary"`
	NextSteps       []string                         `json:"next_steps"`
}

// AssessmentEngine performs a SOC 2 readiness gap assessment.
type AssessmentEngine struct {
	implementations map[string]ControlImplementation
	systemName      string
	scopeNote       string
}

// NewAssessmentEngine creates an engine pre-loaded with the system name and scope.
func NewAssessmentEngine(systemName, scopeNote string) *AssessmentEngine {
	return &AssessmentEngine{
		implementations: make(map[string]ControlImplementation),
		systemName:      systemName,
		scopeNote:       scopeNote,
	}
}

// SetImplementation records how a criterion is satisfied.
func (ae *AssessmentEngine) SetImplementation(impl ControlImplementation) {
	ae.implementations[impl.CriterionID] = impl
}

// BulkSet loads a map of criterion IDs to implementations.
func (ae *AssessmentEngine) BulkSet(impls map[string]ControlImplementation) {
	for id, impl := range impls {
		ae.implementations[id] = impl
	}
}

// Assess runs the gap analysis and returns a ReadinessReport.
func (ae *AssessmentEngine) Assess() *ReadinessReport {
	var gaps []GapFinding
	implemented := 0

	for _, c := range Catalog {
		impl, ok := ae.implementations[c.ID]
		if !ok {
			impl = ControlImplementation{
				CriterionID: c.ID,
				Status:      StatusNotImplemented,
			}
		}

		if impl.Status == StatusImplemented {
			implemented++
			continue
		}
		if impl.Status == StatusNotApplicable {
			continue
		}

		gap := GapFinding{
			CriterionID: c.ID,
			Title:       c.Title,
			Family:      c.Family,
			Status:      impl.Status,
			Remediation: defaultRemediation(c),
			Priority:    gapPriority(c, impl),
		}
		gaps = append(gaps, gap)
	}

	// Sort gaps: HIGH → MEDIUM → LOW, then by criterion ID.
	sort.Slice(gaps, func(i, j int) bool {
		pi, pj := priorityRank(gaps[i].Priority), priorityRank(gaps[j].Priority)
		if pi != pj {
			return pi < pj
		}
		return gaps[i].CriterionID < gaps[j].CriterionID
	})

	total := float64(len(Catalog))
	score := (float64(implemented) / total) * 100.0
	level := scoreToLevel(score)

	report := &ReadinessReport{
		GeneratedAt:     time.Now().UTC(),
		SystemName:      ae.systemName,
		ScopeNote:       ae.scopeNote,
		Implementations: ae.implementations,
		Gaps:            gaps,
		Score:           score,
		Level:           level,
		Summary:         buildSummary(ae.systemName, implemented, len(Catalog), len(gaps), level),
		NextSteps:       buildNextSteps(gaps, level),
	}
	return report
}

// PrintText renders the report as a human-readable text block.
func (r *ReadinessReport) PrintText() string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("SOC 2 Readiness Report — %s\n", r.SystemName))
	sb.WriteString(fmt.Sprintf("Generated : %s\n", r.GeneratedAt.Format(time.RFC1123)))
	sb.WriteString(fmt.Sprintf("Scope     : %s\n", r.ScopeNote))
	sb.WriteString(fmt.Sprintf("Score     : %.1f%% (%s)\n\n", r.Score, r.Level))
	sb.WriteString(r.Summary + "\n\n")

	if len(r.Gaps) > 0 {
		sb.WriteString("──── Gap Findings ────────────────────────────────────────\n")
		for _, g := range r.Gaps {
			sb.WriteString(fmt.Sprintf("[%s] %s — %s\n", g.Priority, g.CriterionID, g.Title))
			sb.WriteString(fmt.Sprintf("  Status     : %s\n", g.Status))
			sb.WriteString(fmt.Sprintf("  Remediation: %s\n\n", g.Remediation))
		}
	}

	sb.WriteString("──── Recommended Next Steps ──────────────────────────────\n")
	for i, step := range r.NextSteps {
		sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, step))
	}
	return sb.String()
}

// ── helpers ──────────────────────────────────────────────────────────────────

func scoreToLevel(score float64) ReadinessLevel {
	switch {
	case score >= 90:
		return ReadinessAuditReady
	case score >= 70:
		return ReadinessNearReady
	case score >= 40:
		return ReadinessInProgress
	default:
		return ReadinessEarly
	}
}

func priorityRank(p string) int {
	switch p {
	case "HIGH":
		return 0
	case "MEDIUM":
		return 1
	default:
		return 2
	}
}

func gapPriority(c Criterion, impl ControlImplementation) string {
	highCC := map[string]bool{
		"CC6.1": true, "CC6.2": true, "CC6.3": true, "CC6.6": true,
		"CC6.7": true, "CC7.1": true, "CC7.4": true, "CC8.1": true,
		"CC3.2": true, "CC4.1": true,
	}
	if highCC[c.ID] {
		return "HIGH"
	}
	if impl.Status == StatusNotImplemented {
		return "MEDIUM"
	}
	return "LOW"
}

func defaultRemediation(c Criterion) string {
	remediations := map[string]string{
		"CC1.1": "Draft and distribute a Code of Conduct; collect signed employee acknowledgments annually.",
		"CC1.4": "Define role-based competency requirements and link them to hiring and performance reviews.",
		"CC1.5": "Implement quarterly manager attestation that staff understand their control responsibilities.",
		"CC2.2": "Establish a security awareness training programme (e.g., annual + phishing simulation).",
		"CC3.2": "Conduct and document a formal risk assessment using ISO 27005 or NIST RMF methodology.",
		"CC3.3": "Add fraud risk scenarios to the annual risk assessment and document mitigating controls.",
		"CC3.4": "Integrate change-impact review into the risk assessment cycle.",
		"CC4.1": "Deploy continuous monitoring (SIEM, Khepra Sonar agent) and set alert thresholds.",
		"CC4.2": "Establish a findings-tracking register; require owners to sign off on remediation within SLA.",
		"CC5.2": "Enforce least-privilege, MFA, and encryption controls via IaC and policy-as-code.",
		"CC5.3": "Publish security policies in a central knowledge base; require annual sign-off.",
		"CC6.1": "Enforce MFA for all user accounts; implement SSO with JIT provisioning.",
		"CC6.2": "Create a formal access-request and approval workflow (JIRA, ServiceNow, or equivalent).",
		"CC6.3": "Implement quarterly access reviews; deprovision unnecessary accounts within 24 h of departure.",
		"CC6.4": "Restrict data-centre access to badge + biometric; log all entries.",
		"CC6.5": "Use certified data destruction (NIST 800-88) for all decommissioned storage.",
		"CC6.6": "Deploy WAF, IDS/IPS, and enforce network segmentation per zero-trust principles.",
		"CC6.7": "Mandate TLS 1.2+/PQC for all data-in-transit; encrypt data at rest with AES-256/Kyber.",
		"CC6.8": "Deploy EDR on all endpoints; enable real-time malware scanning in CI/CD pipeline.",
		"CC7.1": "Run weekly authenticated vulnerability scans; enforce patch SLAs (Critical: 7 d, High: 30 d).",
		"CC7.2": "Configure SIEM correlation rules for account brute-force, data exfil, and privilege escalation.",
		"CC7.3": "Define security event severity tiers and escalation runbooks.",
		"CC7.4": "Document and table-top-test the incident response plan at least annually.",
		"CC7.5": "Define RTO/RPO; test backup restoration quarterly.",
		"CC8.1": "Enforce peer-reviewed PRs with required approvals, staging deploys, and rollback procedures.",
		"CC9.1": "Develop a Business Continuity Plan (BCP) and Disaster Recovery Plan (DRP); test annually.",
		"CC9.2": "Complete security reviews and BAAs/DPAs for all third-party vendors handling customer data.",
		"A1.1":  "Implement auto-scaling and capacity alarms; review peak-load thresholds quarterly.",
		"A1.2":  "Automate daily encrypted backups to geo-redundant storage; test restoration quarterly.",
		"A1.3":  "Schedule annual BCP tabletop exercises; document lessons learned and update the plan.",
		"PI1.1": "Implement input validation, checksums, and audit logging for all data processing pipelines.",
		"PI1.3": "Add automated integrity checks (hash verification) on data at every processing stage.",
		"C1.1":  "Classify and label all data assets; apply confidentiality controls proportional to sensitivity.",
		"C1.2":  "Enforce certified media sanitisation (NIST 800-88) before disposal or reuse.",
	}
	if r, ok := remediations[c.ID]; ok {
		return r
	}
	return fmt.Sprintf("Document and implement controls satisfying %s — %s.", c.ID, c.Title)
}

func buildSummary(system string, implemented, total, gaps int, level ReadinessLevel) string {
	return fmt.Sprintf(
		"%s has implemented %d of %d SOC 2 TSC criteria (%.0f%%). "+
			"There are %d open gap findings. Readiness level: %s.",
		system, implemented, total,
		float64(implemented)/float64(total)*100,
		gaps, level,
	)
}

func buildNextSteps(gaps []GapFinding, level ReadinessLevel) []string {
	steps := []string{}

	if level == ReadinessEarly {
		steps = append(steps, "Assign a SOC 2 project owner and establish a steering committee.")
		steps = append(steps, "Complete the free SOC 2 masterclass (Scytale / StrongDM) to train the core team.")
	}

	highCount := 0
	for _, g := range gaps {
		if g.Priority == "HIGH" {
			highCount++
		}
	}
	if highCount > 0 {
		steps = append(steps, fmt.Sprintf("Remediate the %d HIGH-priority gaps before scheduling the auditor.", highCount))
	}

	steps = append(steps, "Collect the required evidence artefacts listed by RequiredEvidence().")
	steps = append(steps, "Engage a SOC 2-qualified CPA firm for a Type 1 readiness assessment (costs ~$5 k–$15 k).")
	steps = append(steps, "Target a Type 2 observation window of 6 months once Type 1 is clean.")
	steps = append(steps, "Integrate the Khepra continuous-monitoring agent (CC4.1, CC7.1) to auto-collect evidence.")

	return steps
}
