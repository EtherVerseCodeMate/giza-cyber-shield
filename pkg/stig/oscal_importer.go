// Package stig — oscal_importer.go
//
// Imports OSCAL Assessment Results (AR) JSON into stig.Finding slices.
//
// OSCAL Assessment Results is the NIST SP 800-53A-aligned structured output
// format produced by:
//
//   - OpenSCAP / SCAP Compliance Checker (SCC) — oscap xccdf eval --results-arf ...
//   - Tenable Nessus / Tenable.io OSCAL export
//   - GovReady-Q / Trestle
//   - CIS-CAT Pro Assessor
//
// The canonical OSCAL AR JSON envelope is:
//
//	{ "assessment-results": { "results": [ { "findings": [...] } ] } }
//
// Each finding maps to one compliance control.  The importer extracts:
//   - control ID   (finding.target.target-id or finding.title)
//   - status       (finding.target.status.state → Pass/Fail/Not Applicable)
//   - description  (finding.description)
//   - severity     (from props or risk characterization; defaults CAT II)
//   - observations (finding.related-observations → observation.description)
//
// References (CCI, SP 800-53) are extracted from finding.related-risks and
// risk.threat-ids / risk.characterizations.
package stig

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
)

// ── OSCAL JSON structs (minimal — only the fields we need) ────────────────────

// oscalDocument is the top-level OSCAL Assessment Results envelope.
// Both the canonical form ("assessment-results") and the simplified schema
// form ("AssessmentResults") are handled.
type oscalDocument struct {
	AssessmentResults *oscalAR `json:"assessment-results"`
	SchemaAR          *oscalAR `json:"AssessmentResults"`
}

type oscalAR struct {
	UUID     string          `json:"uuid"`
	Metadata oscalMetadata   `json:"metadata"`
	Results  []oscalResult   `json:"results"`
}

type oscalMetadata struct {
	Title        string `json:"title"`
	LastModified string `json:"last-modified"`
	Published    string `json:"published"`
	Version      string `json:"version"`
}

type oscalResult struct {
	UUID         string              `json:"uuid"`
	Title        string              `json:"title"`
	Description  string              `json:"description"`
	Start        string              `json:"start"`
	End          string              `json:"end"`
	Findings     []oscalFinding      `json:"findings"`
	Observations []oscalObservation  `json:"observations"`
	Risks        []oscalRisk         `json:"risks"`
}

type oscalFinding struct {
	UUID                       string                `json:"uuid"`
	Title                      string                `json:"title"`
	Description                string                `json:"description"`
	Target                     oscalFindingTarget    `json:"target"`
	Props                      []oscalProp           `json:"props"`
	RelatedObservations        []oscalRelatedObs     `json:"related-observations"`
	RelatedRisks               []oscalRelatedRisk    `json:"related-risks"`
	ImplementationStatementUUID string               `json:"implementation-statement-uuid"`
}

type oscalFindingTarget struct {
	Type     string            `json:"type"`
	TargetID string            `json:"target-id"`
	Title    string            `json:"title"`
	Status   oscalTargetStatus `json:"status"`
	Props    []oscalProp       `json:"props"`
}

type oscalTargetStatus struct {
	// NIST OSCAL 1.1+ uses "state" field.
	// Some tools use "value" instead.
	State string `json:"state"`
	Value string `json:"value"`
}

type oscalProp struct {
	Name  string `json:"name"`
	NS    string `json:"ns"`
	Value string `json:"value"`
	Class string `json:"class"`
}

type oscalRelatedObs struct {
	ObservationUUID string `json:"observation-uuid"`
}

type oscalRelatedRisk struct {
	RiskUUID string `json:"risk-uuid"`
}

type oscalObservation struct {
	UUID            string         `json:"uuid"`
	Title           string         `json:"title"`
	Description     string         `json:"description"`
	Methods         []string       `json:"methods"`
	Types           []string       `json:"types"`
	RelevantEvidence []oscalEvidence `json:"relevant-evidence"`
	Collected       string         `json:"collected"`
}

type oscalEvidence struct {
	Description string      `json:"description"`
	Props       []oscalProp `json:"props"`
}

type oscalRisk struct {
	UUID            string   `json:"uuid"`
	Title           string   `json:"title"`
	Statement       string   `json:"statement"`
	Characterizations []oscalCharacterization `json:"characterizations"`
}

type oscalCharacterization struct {
	Facets []oscalFacet `json:"facets"`
}

type oscalFacet struct {
	Name   string `json:"name"`
	System string `json:"system"`
	Value  string `json:"value"`
}

// ── Import result ─────────────────────────────────────────────────────────────

// OSCALImportResult holds findings and metadata parsed from an OSCAL AR file.
type OSCALImportResult struct {
	Title    string
	Version  string
	ScanDate time.Time
	Findings []Finding
}

// ── Public API ─────────────────────────────────────────────────────────────────

// ParseOSCALFile parses an OSCAL Assessment Results JSON file at path.
func ParseOSCALFile(path string) ([]OSCALImportResult, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	return ParseOSCALBytes(data)
}

// ParseOSCALBytes parses OSCAL Assessment Results from a byte slice.
func ParseOSCALBytes(data []byte) ([]OSCALImportResult, error) {
	var doc oscalDocument
	if err := json.Unmarshal(data, &doc); err != nil {
		return nil, fmt.Errorf("parse OSCAL JSON: %w", err)
	}

	ar := doc.AssessmentResults
	if ar == nil {
		ar = doc.SchemaAR
	}
	if ar == nil {
		return nil, fmt.Errorf("no 'assessment-results' or 'AssessmentResults' key found in document")
	}

	return extractOSCALResults(ar), nil
}

// ── Extraction ─────────────────────────────────────────────────────────────────

func extractOSCALResults(ar *oscalAR) []OSCALImportResult {
	var out []OSCALImportResult

	for _, r := range ar.Results {
		// Build observation lookup: uuid → description+evidence
		obsMap := buildObsMap(r.Observations)

		// Build risk lookup: uuid → severity facet value
		riskMap := buildRiskMap(r.Risks)

		ir := OSCALImportResult{
			Title:    coalesce(r.Title, ar.Metadata.Title),
			Version:  ar.Metadata.Version,
			ScanDate: parseOSCALTime(coalesce(r.End, r.Start, ar.Metadata.LastModified)),
		}

		for _, f := range r.Findings {
			ir.Findings = append(ir.Findings, oscalFindingToStig(f, obsMap, riskMap))
		}

		out = append(out, ir)
	}
	return out
}

// oscalFindingToStig converts one OSCAL finding to stig.Finding.
func oscalFindingToStig(f oscalFinding, obsMap map[string]oscalObservation, riskMap map[string]string) Finding {
	controlID := coalesce(f.Target.TargetID, f.UUID)
	title := coalesce(f.Target.Title, f.Title)

	status := mapOSCALStatus(f.Target.Status)
	severity := extractOSCALSeverity(f.Props, f.Target.Props, f.RelatedRisks, riskMap)

	// Build actual (evidence / observation text).
	actual := buildOSCALActual(f.RelatedObservations, obsMap)
	if actual == "" {
		actual = strings.TrimSpace(f.Description)
	}

	// Build references from props (CCI, NIST) and risk UUIDs.
	refs := extractOSCALRefs(f.Props, f.Target.Props)

	return Finding{
		ID:          controlID,
		Title:       title,
		Description: strings.TrimSpace(f.Description),
		Severity:    severity,
		Status:      status,
		Actual:      actual,
		References:  refs,
		CheckedAt:   time.Now(),
	}
}

// ── Observation map ───────────────────────────────────────────────────────────

func buildObsMap(obs []oscalObservation) map[string]oscalObservation {
	m := make(map[string]oscalObservation, len(obs))
	for _, o := range obs {
		m[o.UUID] = o
	}
	return m
}

func buildOSCALActual(related []oscalRelatedObs, obsMap map[string]oscalObservation) string {
	var parts []string
	for _, ro := range related {
		if o, ok := obsMap[ro.ObservationUUID]; ok {
			text := strings.TrimSpace(o.Description)
			for _, ev := range o.RelevantEvidence {
				if d := strings.TrimSpace(ev.Description); d != "" {
					text += " | " + d
				}
			}
			if text != "" {
				parts = append(parts, text)
			}
		}
	}
	return strings.Join(parts, "\n")
}

// ── Risk map (uuid → severity string) ────────────────────────────────────────

func buildRiskMap(risks []oscalRisk) map[string]string {
	m := make(map[string]string, len(risks))
	for _, r := range risks {
		sev := extractRiskSeverity(r)
		if sev != "" {
			m[r.UUID] = sev
		}
	}
	return m
}

func extractRiskSeverity(r oscalRisk) string {
	for _, c := range r.Characterizations {
		for _, f := range c.Facets {
			if strings.EqualFold(f.Name, "severity") || strings.EqualFold(f.Name, "impact") {
				return f.Value
			}
		}
	}
	return ""
}

// ── Status mapping ────────────────────────────────────────────────────────────

// mapOSCALStatus converts OSCAL finding target status to stig.Finding.Status.
//
// NIST OSCAL 1.1+ status.state values:
//
//	"satisfied"      → Pass
//	"not-satisfied"  → Fail
//	"not-applicable" → Not Applicable
//	absent/empty     → Manual Review Required
func mapOSCALStatus(s oscalTargetStatus) string {
	raw := strings.ToLower(strings.TrimSpace(coalesce(s.State, s.Value)))
	switch raw {
	case "satisfied", "pass", "compliant":
		return "Pass"
	case "not-satisfied", "fail", "non-compliant", "error":
		return "Fail"
	case "not-applicable", "na", "not_applicable":
		return "Not Applicable"
	}
	return "Manual Review Required"
}

// ── Severity extraction ───────────────────────────────────────────────────────

// extractOSCALSeverity tries to determine severity from props (priority, impact,
// severity) and falls back to the risk map.
func extractOSCALSeverity(findingProps, targetProps []oscalProp, relatedRisks []oscalRelatedRisk, riskMap map[string]string) Severity {
	for _, props := range [][]oscalProp{findingProps, targetProps} {
		for _, p := range props {
			switch strings.ToLower(p.Name) {
			case "severity", "impact", "priority", "cat":
				return mapOSCALSeverityString(p.Value)
			}
		}
	}

	// Fall back to associated risk severity.
	for _, rr := range relatedRisks {
		if sev, ok := riskMap[rr.RiskUUID]; ok {
			return mapOSCALSeverityString(sev)
		}
	}

	return SeverityCAT2
}

func mapOSCALSeverityString(s string) Severity {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "high", "cat i", "cat_i", "critical", "very-high":
		return SeverityCAT1
	case "medium", "cat ii", "cat_ii", "moderate":
		return SeverityCAT2
	case "low", "cat iii", "cat_iii", "low-moderate":
		return SeverityCAT3
	}
	return SeverityCAT2
}

// ── Reference extraction ──────────────────────────────────────────────────────

// extractOSCALRefs pulls CCI and NIST identifiers from OSCAL props arrays.
// Props carrying control references use names like "cci", "nist", "reference".
func extractOSCALRefs(propSets ...[]oscalProp) []string {
	seen := make(map[string]bool)
	var refs []string

	add := func(s string) {
		s = strings.TrimSpace(s)
		if s != "" && !seen[s] {
			seen[s] = true
			refs = append(refs, s)
		}
	}

	for _, props := range propSets {
		for _, p := range props {
			name := strings.ToLower(p.Name)
			if name == "cci" || name == "cci-ref" ||
				name == "nist" || name == "reference" ||
				name == "control-id" || strings.HasPrefix(name, "cci-") {
				add(p.Value)
			}
		}
	}

	return refs
}

// ── ImportOSCAL on Validator ──────────────────────────────────────────────────

// ImportOSCAL parses an OSCAL Assessment Results JSON file and returns a
// ComprehensiveReport.  Each OSCAL result element becomes a separate
// ValidationResult keyed by its title.
func (v *Validator) ImportOSCAL(path string) (*ComprehensiveReport, error) {
	start := time.Now()

	results, err := ParseOSCALFile(path)
	if err != nil {
		return nil, fmt.Errorf("import OSCAL %s: %w", path, err)
	}

	report := &ComprehensiveReport{
		Hostname:        v.report.Hostname,
		OSVersion:       v.report.OSVersion,
		ScanDate:        start,
		Results:         make(map[string]*ValidationResult),
		CrossReferences: make(map[string][]string),
	}

	for _, r := range results {
		key := cklFrameworkKey(r.Title, r.Version)
		vr := buildValidationResultFromFindings(key, r.Version, r.Findings, r.ScanDate)
		report.Results[key] = vr
	}

	report.ScanDuration = time.Since(start)
	return report, nil
}

// ── Time parsing helper ───────────────────────────────────────────────────────

// parseOSCALTime parses an OSCAL datetime string.  Returns time.Now() on failure.
func parseOSCALTime(s string) time.Time {
	for _, layout := range []string{
		time.RFC3339,
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05",
		"2006-01-02",
	} {
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	return time.Now()
}
