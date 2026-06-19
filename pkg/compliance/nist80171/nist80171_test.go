package nist80171

import (
	"testing"
)

func TestValidatorValidateACFamily(t *testing.T) {
	v := &Validator{}
	results := v.ValidateACFamily()

	// All 22 AC controls must be present.
	if len(results) != 22 {
		t.Errorf("expected 22 AC controls, got %d", len(results))
	}

	// Every result must have a non-empty ControlID, Family, and Status.
	validStatuses := map[string]bool{
		"PASS": true, "FAIL": true, "MANUAL_REVIEW": true, "NOT_APPLICABLE": true,
	}
	controlsSeen := map[string]bool{}
	for _, res := range results {
		if res.ControlID == "" {
			t.Errorf("result has empty ControlID")
		}
		if res.Family != FamilyAC {
			t.Errorf("control %s: expected family %s, got %s", res.ControlID, FamilyAC, res.Family)
		}
		if !validStatuses[res.Status] {
			t.Errorf("control %s: invalid status %q", res.ControlID, res.Status)
		}
		if res.Finding == "" {
			t.Errorf("control %s: empty Finding field (stubs are prohibited)", res.ControlID)
		}
		controlsSeen[res.ControlID] = true
	}

	// Verify all 22 AC control IDs are present.
	expected := []string{
		"3.1.1", "3.1.2", "3.1.3", "3.1.4", "3.1.5", "3.1.6",
		"3.1.7", "3.1.8", "3.1.9", "3.1.10", "3.1.11", "3.1.12",
		"3.1.13", "3.1.14", "3.1.15", "3.1.16", "3.1.17", "3.1.18",
		"3.1.19", "3.1.20", "3.1.21", "3.1.22",
	}
	for _, id := range expected {
		if !controlsSeen[id] {
			t.Errorf("AC control %s missing from ValidateACFamily() output", id)
		}
	}

	// MANUAL_REVIEW controls must have evidence requirements in Finding.
	for _, res := range results {
		if res.Status == "MANUAL_REVIEW" && res.Finding == "MANUAL REVIEW REQUIRED — " {
			t.Errorf("control %s: MANUAL_REVIEW has empty evidence requirement", res.ControlID)
		}
	}
}

func TestValidatorRequiresManualReview(t *testing.T) {
	v := &Validator{}
	res := v.requiresManualReview("test-id", FamilyAC,
		"Test description for manual review.",
		"Requires test evidence documentation.")

	if res.ControlID != "test-id" {
		t.Errorf("expected ID test-id, got %s", res.ControlID)
	}
	if res.Status != "MANUAL_REVIEW" {
		t.Errorf("expected status MANUAL_REVIEW, got %s", res.Status)
	}
	if res.Family != FamilyAC {
		t.Errorf("expected family %s, got %s", FamilyAC, res.Family)
	}
}
