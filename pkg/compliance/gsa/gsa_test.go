package gsa

import (
	"testing"
)

func TestGSAValidator(t *testing.T) {
	v := NewGSAValidator()
	if v == nil {
		t.Fatal("expected non-nil GSAValidator")
	}

	// Initially, requirements should be empty before RunReadinessCheck
	if len(v.Requirements) != 0 {
		t.Errorf("expected 0 requirements, got %d", len(v.Requirements))
	}

	// With no GSA_* env vars set and no CMMC_TRACKER.md in the test's working
	// directory, every requirement honestly reports NOT MET — this validator
	// never fabricates evidence.
	result := v.RunReadinessCheck()

	if len(v.Requirements) != 6 {
		t.Errorf("expected 6 requirements after check, got %d", len(v.Requirements))
	}

	if result != "NOT_READY" {
		t.Errorf("expected result NOT_READY with no evidence configured, got %s", result)
	}

	sam, ok := v.Requirements[ReqSAMRegistration]
	if !ok || sam.Met {
		t.Error("expected SAM registration to be NOT met without GSA_SAM_UEI set")
	}

	cage, ok := v.Requirements[ReqCAGECode]
	if !ok || cage.Met {
		t.Error("expected CAGE code to be NOT met without GSA_CAGE_CODE set")
	}
}

func TestGSAValidator_EnvEvidence(t *testing.T) {
	t.Setenv("GSA_SAM_UEI", "TESTUEI123456")

	v := NewGSAValidator()
	v.RunReadinessCheck()

	sam, ok := v.Requirements[ReqSAMRegistration]
	if !ok || !sam.Met {
		t.Error("expected SAM registration to be Met when GSA_SAM_UEI is set")
	}
	if sam.Evidence == "" {
		t.Error("expected non-empty evidence string when GSA_SAM_UEI is set")
	}
}
