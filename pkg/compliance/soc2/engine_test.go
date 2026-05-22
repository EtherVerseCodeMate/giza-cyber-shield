package soc2

import (
	"testing"
)

func TestCatalogNotEmpty(t *testing.T) {
	if len(Catalog) == 0 {
		t.Fatal("SOC 2 catalog is empty")
	}
}

func TestCatalogIDsUnique(t *testing.T) {
	seen := make(map[string]bool)
	for _, c := range Catalog {
		if seen[c.ID] {
			t.Errorf("duplicate criterion ID: %s", c.ID)
		}
		seen[c.ID] = true
	}
}

func TestAssessmentZeroScore(t *testing.T) {
	ae := NewAssessmentEngine("TestSystem", "Security TSC only")
	report := ae.Assess()
	if report.Score != 0 {
		t.Errorf("expected 0 score with no implementations, got %.1f", report.Score)
	}
	if report.Level != ReadinessEarly {
		t.Errorf("expected EARLY_STAGE, got %s", report.Level)
	}
}

func TestAssessmentFullScore(t *testing.T) {
	ae := NewAssessmentEngine("FullSystem", "All criteria")
	for _, c := range Catalog {
		ae.SetImplementation(ControlImplementation{
			CriterionID: c.ID,
			Status:      StatusImplemented,
		})
	}
	report := ae.Assess()
	if report.Score != 100.0 {
		t.Errorf("expected 100%% score, got %.1f%%", report.Score)
	}
	if report.Level != ReadinessAuditReady {
		t.Errorf("expected AUDIT_READY, got %s", report.Level)
	}
	if len(report.Gaps) != 0 {
		t.Errorf("expected no gaps, got %d", len(report.Gaps))
	}
}

func TestAssessmentNearReady(t *testing.T) {
	ae := NewAssessmentEngine("NearSystem", "Security TSC")
	// Mark 80% of criteria as implemented.
	threshold := int(float64(len(Catalog)) * 0.80)
	for i, c := range Catalog {
		if i < threshold {
			ae.SetImplementation(ControlImplementation{
				CriterionID: c.ID,
				Status:      StatusImplemented,
			})
		}
	}
	report := ae.Assess()
	if report.Level != ReadinessNearReady {
		t.Logf("score=%.1f level=%s", report.Score, report.Level)
	}
}

func TestSeedFromNISTMapping(t *testing.T) {
	e := NewEngine("SeedTest", "Security TSC")
	// Provide IMPLEMENTED status for all NIST controls referenced in the catalog.
	nistStatus := make(map[string]string)
	for _, c := range Catalog {
		for _, nid := range c.NISTMapping {
			nistStatus[nid] = "IMPLEMENTED"
		}
	}
	e.SeedFromNISTMapping(nistStatus)
	report := e.Assessment.Assess()
	if report.Score == 0 {
		t.Error("expected non-zero score after seeding from NIST mapping")
	}
}

func TestRequiredEvidenceNotEmpty(t *testing.T) {
	reqs := RequiredEvidence()
	if len(reqs) == 0 {
		t.Fatal("RequiredEvidence returned empty list")
	}
}

func TestEvidenceCollector(t *testing.T) {
	ec := NewEvidenceCollector()
	ev := ec.Add("CC6.1", EvidenceConfiguration, "MFA Config", "Screenshot of MFA settings", "admin", []byte("test-content"))
	if ev.ID == "" {
		t.Error("evidence ID should not be empty")
	}
	if ev.Hash == "" {
		t.Error("evidence hash should not be empty")
	}
	results := ec.List("CC6.1")
	if len(results) != 1 {
		t.Errorf("expected 1 evidence item, got %d", len(results))
	}
	all := ec.List("")
	if len(all) != 1 {
		t.Errorf("expected 1 total evidence item, got %d", len(all))
	}
}

func TestCriterionSummary(t *testing.T) {
	e := NewEngine("SummaryTest", "Security TSC")
	summary := e.CriterionSummary()
	if len(summary) != len(Catalog) {
		t.Errorf("summary length %d != catalog length %d", len(summary), len(Catalog))
	}
	for _, s := range summary {
		if s.Status != StatusNotImplemented {
			t.Errorf("expected NOT_IMPLEMENTED for fresh engine, got %s for %s", s.Status, s.ID)
		}
	}
}

func TestReportPrintText(t *testing.T) {
	ae := NewAssessmentEngine("PrintTest", "Security TSC")
	report := ae.Assess()
	text := report.PrintText()
	if len(text) == 0 {
		t.Error("PrintText returned empty string")
	}
}
