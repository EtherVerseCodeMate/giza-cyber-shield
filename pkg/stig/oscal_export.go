package stig

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ExportToOSCAL writes an OSCAL 1.1.2 Assessment Results document to outputPath.
//
// The output conforms to https://pages.nist.gov/OSCAL/reference/1.1.2/assessment-results/
// and can be imported directly into Paramify or any OSCAL-aware SSP platform.
// Every finding is mapped to an observation so assessors have traceable evidence.
func (r *ComprehensiveReport) ExportToOSCAL(outputPath string) error {
	doc := r.buildOSCALDocument()

	f, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("oscal: create file: %w", err)
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(doc); err != nil {
		return fmt.Errorf("oscal: encode: %w", err)
	}
	return nil
}

// OSCALDocument is the top-level OSCAL Assessment Results wrapper.
type OSCALDocument struct {
	AssessmentResults oscalAssessmentResults `json:"assessment-results"`
}

type oscalAssessmentResults struct {
	UUID             string             `json:"uuid"`
	Metadata         oscalMetadata      `json:"metadata"`
	ImportAP         oscalImportAP      `json:"import-ap"`
	Results          []oscalResult      `json:"results"`
}

type oscalMetadata struct {
	Title        string    `json:"title"`
	LastModified time.Time `json:"last-modified"`
	Version      string    `json:"version"`
	OSCALVersion string    `json:"oscal-version"`
	Remarks      string    `json:"remarks,omitempty"`
}

type oscalImportAP struct {
	Href string `json:"href"`
}

type oscalResult struct {
	UUID             string                  `json:"uuid"`
	Title            string                  `json:"title"`
	Description      string                  `json:"description"`
	Start            time.Time               `json:"start"`
	End              time.Time               `json:"end"`
	ReviewedControls oscalReviewedControls   `json:"reviewed-controls"`
	Findings         []oscalFinding          `json:"findings,omitempty"`
	Observations     []oscalObservation      `json:"observations,omitempty"`
}

type oscalReviewedControls struct {
	ControlSelections []oscalControlSelection `json:"control-selections"`
}

type oscalControlSelection struct {
	// include-all: {} signals that all controls from the referenced catalog apply.
	IncludeAll *struct{} `json:"include-all,omitempty"`
}

type oscalFinding struct {
	UUID                string                   `json:"uuid"`
	Title               string                   `json:"title"`
	Description         string                   `json:"description,omitempty"`
	Target              oscalFindingTarget        `json:"target"`
	RelatedObservations []oscalRelatedObservation `json:"related-observations,omitempty"`
}

type oscalFindingTarget struct {
	Type     string             `json:"type"`     // always "statement-id"
	TargetID string             `json:"target-id"` // normalized control ID
	Status   oscalTargetStatus  `json:"status"`
}

type oscalTargetStatus struct {
	State   string `json:"state"`             // "satisfied" | "not-satisfied"
	Remarks string `json:"remarks,omitempty"`
}

type oscalRelatedObservation struct {
	ObservationUUID string `json:"observation-uuid"`
}

type oscalObservation struct {
	UUID             string          `json:"uuid"`
	Title            string          `json:"title"`
	Description      string          `json:"description"`
	Methods          []string        `json:"methods"`
	Types            []string        `json:"types"`
	RelevantEvidence []oscalEvidence `json:"relevant-evidence,omitempty"`
	Collected        time.Time       `json:"collected"`
	Remarks          string          `json:"remarks,omitempty"`
}

type oscalEvidence struct {
	Description string `json:"description"`
	Remarks     string `json:"remarks,omitempty"`
}

// buildOSCALDocument converts the ComprehensiveReport into the OSCAL structure.
func (r *ComprehensiveReport) buildOSCALDocument() OSCALDocument {
	docUUID := uuid.New().String()
	scanEnd := r.ScanDate.Add(r.ScanDuration)
	if scanEnd.IsZero() || scanEnd.Equal(r.ScanDate) {
		scanEnd = r.ScanDate
	}

	var findings []oscalFinding
	var observations []oscalObservation

	for frameworkName, result := range r.Results {
		for _, f := range result.Findings {
			obsUUID := uuid.New().String()
			findUUID := uuid.New().String()

			state := "not-satisfied"
			if f.Status == "Pass" {
				state = "satisfied"
			}

			// Build the observation (raw evidence from the scan)
			obs := oscalObservation{
				UUID:        obsUUID,
				Title:       fmt.Sprintf("[%s] %s", frameworkName, f.ID),
				Description: f.Description,
				Methods:     []string{"TEST"},
				Types:       []string{"finding"},
				Collected:   f.CheckedAt,
			}
			if f.Actual != "" || f.Expected != "" {
				obs.RelevantEvidence = []oscalEvidence{
					{
						Description: "Observed: " + f.Actual,
						Remarks:     "Expected: " + f.Expected,
					},
				}
			}
			if f.Remediation != "" {
				obs.Remarks = "Remediation: " + f.Remediation
			}
			observations = append(observations, obs)

			// Build the finding (control satisfaction judgment)
			targetID := normalizeControlID(f.ID, f.References)
			remarks := ""
			if f.Status != "Pass" && f.Remediation != "" {
				remarks = f.Remediation
			}
			findings = append(findings, oscalFinding{
				UUID:  findUUID,
				Title: f.Title,
				Target: oscalFindingTarget{
					Type:     "statement-id",
					TargetID: targetID,
					Status: oscalTargetStatus{
						State:   state,
						Remarks: remarks,
					},
				},
				RelatedObservations: []oscalRelatedObservation{
					{ObservationUUID: obsUUID},
				},
			})
		}
	}

	result := oscalResult{
		UUID:  uuid.New().String(),
		Title: "KHEPRA Automated Compliance Assessment",
		Description: fmt.Sprintf(
			"Automated compliance scan of %s (%s) performed by KHEPRA/ADINKHEPRA. "+
				"Findings are cryptographically attested via Dilithium3 (ML-DSA-65). "+
				"Framework coverage: %s.",
			r.Hostname, r.OSVersion, frameworkList(r),
		),
		Start: r.ScanDate,
		End:   scanEnd,
		ReviewedControls: oscalReviewedControls{
			ControlSelections: []oscalControlSelection{
				{IncludeAll: &struct{}{}},
			},
		},
		Findings:     findings,
		Observations: observations,
	}

	return OSCALDocument{
		AssessmentResults: oscalAssessmentResults{
			UUID: docUUID,
			Metadata: oscalMetadata{
				Title:        "KHEPRA Security Assessment Results — " + r.Hostname,
				LastModified: r.ScanDate,
				Version:      "1.0",
				OSCALVersion: "1.1.2",
				Remarks: fmt.Sprintf(
					"Generated by KHEPRA (ADINKHEPRA) on %s. "+
						"Signatures use ML-DSA-65 (Dilithium3) post-quantum cryptography.",
					r.ScanDate.Format(time.RFC3339),
				),
			},
			ImportAP: oscalImportAP{Href: "#"},
			Results:  []oscalResult{result},
		},
	}
}

// normalizeControlID converts a KHEPRA control ID into the canonical form
// expected by OSCAL consumers (Paramify, NIST OSCAL validators).
//
// Priority: extract from NIST 800-53 reference if present, then 800-171,
// then CMMC — fall back to the raw finding ID lowercased and hyphenated.
func normalizeControlID(findingID string, refs []string) string {
	// Try to extract a NIST 800-53 control ID from references first (most canonical)
	nist53Re := regexp.MustCompile(`(?i)(?:NIST\s*(?:SP\s*)?800-53[^:]*::?\s*)([A-Z]{2}-\d+(?:\.\d+)?)`)
	for _, ref := range refs {
		if m := nist53Re.FindStringSubmatch(ref); len(m) == 2 {
			return strings.ToLower(strings.ReplaceAll(m[1], " ", "-"))
		}
	}

	// Try NIST 800-171 control reference
	nist171Re := regexp.MustCompile(`(?i)(?:800-171[^:]*::?\s*)(\d+\.\d+\.\d+)`)
	for _, ref := range refs {
		if m := nist171Re.FindStringSubmatch(ref); len(m) == 2 {
			return m[1]
		}
	}

	// Try CMMC control reference
	cmmcRe := regexp.MustCompile(`(?i)(?:CMMC[^:]*::?\s*[A-Z]{2}\.L\d+-)([\d.]+)`)
	for _, ref := range refs {
		if m := cmmcRe.FindStringSubmatch(ref); len(m) == 2 {
			return m[1]
		}
	}

	// Fall back: lowercase the finding ID with spaces replaced by hyphens
	return strings.ToLower(strings.ReplaceAll(findingID, " ", "-"))
}

// frameworkList returns a comma-joined list of framework names in the report.
func frameworkList(r *ComprehensiveReport) string {
	names := make([]string, 0, len(r.Results))
	for k := range r.Results {
		names = append(names, k)
	}
	return strings.Join(names, ", ")
}
