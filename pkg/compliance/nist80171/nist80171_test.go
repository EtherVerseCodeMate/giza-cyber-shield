package nist80171

import (
	"testing"
)

func TestValidatorValidateACFamily(t *testing.T) {
	v := &Validator{}
	results := v.ValidateACFamily()

	// AC family now covers all 22 controls (3.1.1 – 3.1.22)
	if len(results) < 22 {
		t.Errorf("expected at least 22 AC results, got %d", len(results))
	}

	// Verify specific controls exist and have valid status values
	validStatuses := map[string]bool{
		"PASS":           true,
		"FAIL":           true,
		"MANUAL_REVIEW":  true,
		"NOT_APPLICABLE": true,
	}

	seenIDs := map[string]bool{}
	for _, res := range results {
		if !validStatuses[res.Status] {
			t.Errorf("control %s has invalid status %q", res.ControlID, res.Status)
		}
		if res.ControlID == "" {
			t.Error("result with empty ControlID found")
		}
		if res.Family != FamilyAC {
			t.Errorf("control %s has wrong family %q, expected %q", res.ControlID, res.Family, FamilyAC)
		}
		if res.Status == "MANUAL_REVIEW" && res.Finding == "" {
			t.Errorf("control %s is MANUAL_REVIEW but has no finding/reasoning", res.ControlID)
		}
		seenIDs[res.ControlID] = true
	}

	// These controls must exist
	required := []string{"3.1.1", "3.1.2", "3.1.5", "3.1.7", "3.1.8", "3.1.9", "3.1.11", "3.1.13"}
	for _, id := range required {
		if !seenIDs[id] {
			t.Errorf("required control %s not found in AC results", id)
		}
	}
}

func TestValidatorRequiresManualReview(t *testing.T) {
	v := &Validator{}
	res := v.requiresManualReview("test-id", FamilyAC, "Test description.", "Requires evidence X.")

	if res.ControlID != "test-id" {
		t.Errorf("expected ID test-id, got %s", res.ControlID)
	}
	if res.Status != "MANUAL_REVIEW" {
		t.Errorf("expected status MANUAL_REVIEW, got %s", res.Status)
	}
	if res.Finding == "" {
		t.Error("MANUAL_REVIEW result must have a Finding (reasoning)")
	}
}

func TestValidateAllFamilies(t *testing.T) {
	v := &Validator{}
	all := v.ValidateAllFamilies()

	// NIST 800-171 Rev 2 has 110 security requirements across 14 families
	// AC=22, AU=9, AT=3, CM=9, IA=11, IR=3, MA=6, MP=9, PE=6, PS=2, RA=3, CA=4, SC=16, SI=7 = 110
	if len(all) < 100 {
		t.Errorf("expected at least 100 total controls across all families, got %d", len(all))
	}

	// Verify no controls have empty IDs or invalid statuses
	validStatuses := map[string]bool{
		"PASS": true, "FAIL": true, "MANUAL_REVIEW": true, "NOT_APPLICABLE": true,
	}
	for _, res := range all {
		if res.ControlID == "" {
			t.Errorf("result with empty ControlID in family %q", res.Family)
		}
		if !validStatuses[res.Status] {
			t.Errorf("control %s has invalid status %q", res.ControlID, res.Status)
		}
	}

	// Summary should compute without panic
	summary := v.ComputeSummary()
	if summary.TotalControls != len(all) {
		t.Errorf("summary total %d != results count %d", summary.TotalControls, len(all))
	}
	if summary.Score < 0 || summary.Score > 100 {
		t.Errorf("summary score %f out of range [0, 100]", summary.Score)
	}
}
