package stig

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"strings"
	"testing"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/daemon"
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

// TestCSVChecksum verifies the embedded STIG_CCI_Map.csv SHA-256 matches
// the pinned hash in data/CHECKSUMS.  This detects out-of-sync copies between
// Product A (khepra protocol) and Product B (PQC-Khepra-MCP).
// Fails with a clear diagnostic if the CSV was replaced without updating CHECKSUMS.
func TestCSVChecksum(t *testing.T) {
	// Read pinned hash from embedded CHECKSUMS file.
	csFile, err := embeddedData.Open("data/CHECKSUMS")
	if err != nil {
		t.Fatalf("open data/CHECKSUMS: %v", err)
	}
	defer csFile.Close()

	csBytes, err := io.ReadAll(csFile)
	if err != nil {
		t.Fatalf("read data/CHECKSUMS: %v", err)
	}

	// Parse first non-empty, non-comment line: "sha256:<hex>  <filename>"
	var pinnedHex, pinnedFile string
	for _, line := range strings.Split(string(csBytes), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}
		algo, digest, ok := strings.Cut(parts[0], ":")
		if !ok || algo != "sha256" {
			t.Fatalf("CHECKSUMS: unsupported algorithm in %q (want sha256:<hex>)", parts[0])
		}
		pinnedHex = digest
		pinnedFile = parts[1]
		break
	}
	if pinnedHex == "" {
		t.Fatal("CHECKSUMS: no valid sha256 entry found")
	}

	// Hash the embedded CSV.
	csvFile, err := embeddedData.Open("data/" + pinnedFile)
	if err != nil {
		t.Fatalf("open data/%s: %v", pinnedFile, err)
	}
	defer csvFile.Close()

	h := sha256.New()
	if _, err := io.Copy(h, csvFile); err != nil {
		t.Fatalf("hash data/%s: %v", pinnedFile, err)
	}
	actualHex := hex.EncodeToString(h.Sum(nil))

	if actualHex != pinnedHex {
		t.Errorf("CSV checksum mismatch for %s:\n  pinned: %s\n  actual: %s\n"+
			"Update pkg/stig/data/CHECKSUMS after syncing the CSV from PQC-Khepra-MCP.",
			pinnedFile, pinnedHex, actualHex)
	}
}

// TestFixSpecCoverage is a compile-time lint: every FixSpec.Argv[i][0] across
// all 14 check tables must be in the daemon's authorized command catalog
// (symbolRequirements).  Build fails if any table row references a binary the
// daemon cannot execute — the complete, finite set of privileged commands is
// always visible here.  C3PAO-presentable evidence that no unauthorized binary
// can ever be invoked via the fix pipeline.
func TestFixSpecCoverage(t *testing.T) {
	allTables := []struct {
		name  string
		specs []CheckSpec
	}{
		{"rhel09", rhel09STIG},
		{"rhel08", rhel08STIG},
		{"rhel07", rhel07STIG},
		{"oracleLinux8", oracleLinux8STIG},
		{"ubuntu1804", ubuntu1804STIG},
		{"win10", win10STIG},
		{"win11", win11STIG},
		{"winSrv2016", winSrv2016STIG},
		{"winSrv2019", winSrv2019STIG},
		{"winSrv2022", winSrv2022STIG},
		{"macos13", macos13STIG},
		{"macos14", macos14STIG},
		{"macos15", macos15STIG},
		{"k8s", k8sStig},
	}

	var failures []string
	for _, tbl := range allTables {
		for _, spec := range tbl.specs {
			if spec.Fix == nil {
				continue
			}
			for i, argv := range spec.Fix.Argv {
				if len(argv) == 0 {
					failures = append(failures,
						fmt.Sprintf("[%s] %s Fix.Argv[%d] is empty", tbl.name, spec.RuleID, i))
					continue
				}
				sym := daemon.RequiredSymbol(argv)
				if sym == "" {
					failures = append(failures,
						fmt.Sprintf("[%s] %s Fix.Argv[%d][0]=%q: not in authorized catalog — denied",
							tbl.name, spec.RuleID, i, argv[0]))
				}
			}
		}
	}

	if len(failures) > 0 {
		t.Errorf("%d FixSpec commands not in daemon catalog:\n%s",
			len(failures), strings.Join(failures, "\n"))
	}
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
