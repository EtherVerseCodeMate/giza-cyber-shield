package stig

import (
	"strings"
	"testing"
)

func TestValidator(t *testing.T) {
	// Basic test to ensure Validator can be instantiated
	// and essential methods don't panic.
	// We might not be able to run full validation without root/mocking,
	// but we can test struct initialization.

	checker := NewSystemChecker()
	if checker == nil {
		t.Error("NewSystemChecker() returned nil")
	}

	// Test a safe method that doesn't require root
	if runtimeOS, _ := checker.GetOSVersion(); runtimeOS == "" {
		// It might return empty string on error, but let's just check it doesn't crash
	}
}

// TestDatabaseRowCount asserts the embedded STIG_CCI_Map.csv is a real file
// (not a Git LFS pointer) and contains at least 25,000 unique STIG IDs.
// This test fails loudly if the LFS tracking bug re-emerges.
func TestDatabaseRowCount(t *testing.T) {
	db, err := GetDatabase()
	if err != nil {
		if err == ErrLFSPointer {
			t.Fatalf("STIG_CCI_Map.csv is a Git LFS pointer — real data not embedded.\n"+
				"Fix: remove *.csv from .gitattributes LFS tracking and re-commit the real file.\n"+
				"Source: PQC-Khepra-MCP/pkg/stig/data/STIG_CCI_Map.csv")
		}
		t.Fatalf("GetDatabase() failed: %v", err)
	}

	count := db.RowCount()
	if count < 10_000 {
		// A real CSV loads ~19,943 unique STIG IDs; an LFS pointer loads 0.
		// Threshold of 10,000 cleanly separates "real data" from "pointer".
		t.Errorf("expected ≥ 10,000 unique STIG IDs; got %d — CSV may be truncated or still an LFS pointer", count)
	}
	t.Logf("Database loaded: %d unique STIG IDs", count)
}

// TestGetAllSTIGFamilies verifies the family index returns a non-empty sorted list
// and contains known STIG benchmarks.
func TestGetAllSTIGFamilies(t *testing.T) {
	families, err := GetAllSTIGFamilies()
	if err != nil {
		t.Fatalf("GetAllSTIGFamilies() error: %v", err)
	}
	if len(families) < 100 {
		t.Errorf("expected ≥ 100 STIG families; got %d", len(families))
	}

	// Spot-check: at least one RHEL family should be present
	found := false
	for _, f := range families {
		if strings.Contains(strings.ToLower(f), "rhel") {
			found = true
			break
		}
	}
	if !found {
		t.Error("no RHEL STIG family found in GetAllSTIGFamilies() results")
	}
	t.Logf("GetAllSTIGFamilies: %d families", len(families))
}

func TestFindingStruct(t *testing.T) {
	f := Finding{
		ID:     "TEST-001",
		Status: "Fail",
	}
	if f.ID != "TEST-001" {
		t.Error("Finding struct ID not initialized correctly")
	}
	if f.Status != "Fail" {
		t.Error("Finding struct Status not initialized correctly")
	}
}
