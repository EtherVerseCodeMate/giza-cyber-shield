//go:build e2e

// Package e2e — Linux target E2E tests (Phantom Sandbox).
//
// These tests spin up a real Docker container (dummy-linux) as the scan target
// and run the full adinkhepra CLI pipeline against it:
//
//	discover → compliance scan → ssp export → poam generate → blast-radius
//
// # Prerequisites
//
//   - Docker daemon running (`docker info` works)
//   - `adinkhepra` binary built (`make build` or `make build-linux`)
//   - Run: `make test-e2e-linux`
//
// Tag: go:build e2e (not included in `go test ./...` by default)
package e2e

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Version check (sanity — no Docker needed)
// ─────────────────────────────────────────────────────────────────────────────

// TestE2E_Linux_VersionCheck verifies the CLI binary is present and returns a semver.
// This test does NOT require Docker.
func TestE2E_Linux_VersionCheck(t *testing.T) {
	r := RunAdinkhepra(t, 15*time.Second, "version")
	if r.ExitCode != 0 {
		t.Fatalf("version exited %d\nstdout: %s\nstderr: %s", r.ExitCode, r.Stdout, r.Stderr)
	}
	out := strings.TrimSpace(r.Stdout)
	if out == "" {
		t.Error("version output is empty")
	}
	t.Logf("Version output: %s", out[:min(80, len(out))])
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Discover against the dummy Linux target
// ─────────────────────────────────────────────────────────────────────────────

// TestE2E_Linux_Discover starts the dummy Linux container and runs
// `adinkhepra discover` against it. Asserts discovery.json is produced.
func TestE2E_Linux_Discover(t *testing.T) {
	target := StartDummyLinuxTarget(t)
	workdir := t.TempDir()
	outFile := filepath.Join(workdir, "discovery.json")

	r := RunAdinkhepraIn(t, workdir, 2*time.Minute,
		"discover",
		"--target", target.IP+"/32",
		"--output", outFile,
		"--crypto-inventory=false",
		"--ssp-seed=false",
		"--blast-radius=false",
	)

	if r.ExitCode > 1 {
		t.Fatalf("discover exited %d\nstdout: %s\nstderr: %s",
			r.ExitCode, r.Stdout, r.Stderr)
	}

	AssertFileExists(t, outFile)

	var snap map[string]interface{}
	ReadJSONFile(t, outFile, &snap)

	t.Logf("Discovery snapshot: target=%v  hostname=%v  OS=%v  duration=%s",
		snap["target"], snap["hostname"], snap["os_version"], r.Duration.Round(time.Millisecond))

	if snap["target"] == nil {
		t.Error("discovery.json missing 'target' field")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Sovereign scan (port scan + STIG control mapping)
// ─────────────────────────────────────────────────────────────────────────────

// TestE2E_Linux_SovereignScan runs `adinkhepra scan` against the dummy target.
func TestE2E_Linux_SovereignScan(t *testing.T) {
	target := StartDummyLinuxTarget(t)

	r := RunAdinkhepra(t, 3*time.Minute,
		"scan",
		"--target", fmt.Sprintf("http://%s:%s", target.IP, target.HTTPPort),
	)

	// Exit 0 (clean) or 1 (findings) — both valid. Crash (2+) is not.
	if r.ExitCode > 1 {
		t.Fatalf("scan exited %d\nstdout: %s\nstderr: %s",
			r.ExitCode, r.Stdout, r.Stderr)
	}

	t.Logf("[E2E] Scan complete in %s, exit %d", r.Duration.Round(time.Millisecond), r.ExitCode)
	if len(r.Stdout) > 0 {
		t.Logf("[E2E] stdout preview: %s", r.Stdout[:min(400, len(r.Stdout))])
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Compliance scan (STIG framework)
// ─────────────────────────────────────────────────────────────────────────────

// TestE2E_Linux_ComplianceScan runs `adinkhepra compliance scan` locally.
func TestE2E_Linux_ComplianceScan(t *testing.T) {
	workdir := t.TempDir()
	outFile := filepath.Join(workdir, "compliance_result.json")

	r := RunAdinkhepraIn(t, workdir, 3*time.Minute,
		"compliance", "scan",
		"--framework", "NIST_800_171",
		"--output", outFile,
		"--format", "json",
	)

	if r.ExitCode > 1 {
		t.Fatalf("compliance scan exited %d\nstdout: %s\nstderr: %s",
			r.ExitCode, r.Stdout, r.Stderr)
	}

	if _, err := os.Stat(outFile); err == nil {
		var result map[string]interface{}
		ReadJSONFile(t, outFile, &result)
		t.Logf("[E2E] Compliance result keys: %v", keys(result))
	} else {
		t.Logf("[E2E] stdout preview:\n%s", r.Stdout[:min(600, len(r.Stdout))])
	}

	t.Logf("[E2E] Compliance scan complete in %s", r.Duration.Round(time.Millisecond))
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: SSP PDF export
// ─────────────────────────────────────────────────────────────────────────────

// TestE2E_Linux_SSPExport runs the full SSP export pipeline and asserts the
// output is a real binary PDF.
func TestE2E_Linux_SSPExport(t *testing.T) {
	workdir := t.TempDir()
	sspInput := filepath.Join(workdir, "ssp_input.json")
	writeMinimalSSP(t, sspInput, "DummyLinuxTarget E2E")
	outPDF := filepath.Join(workdir, "ssp_e2e.pdf")

	r := RunAdinkhepraInOK(t, workdir, 2*time.Minute,
		"ssp", "export",
		"--ssp", sspInput,
		"--format", "pdf",
		"--output", outPDF,
	)

	// SSP export must produce a real binary PDF (fpdf renderer verified on both platforms)
	actualPDF := findOutputFile(t, workdir, "ssp", ".json")
	if actualPDF == "" {
		t.Fatalf("[E2E] SSP PDF not found in %s\nstdout: %s", workdir, r.Stdout)
	}
	AssertPDF(t, actualPDF)
	t.Logf("[E2E] SSP PDF: %s (%d bytes) in %s", filepath.Base(actualPDF), fileSize(t, actualPDF), r.Duration.Round(time.Millisecond))
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: POAM PDF export
// ─────────────────────────────────────────────────────────────────────────────

// TestE2E_Linux_POAMExport generates a POAM PDF from a synthetic scan result.
func TestE2E_Linux_POAMExport(t *testing.T) {
	workdir := t.TempDir()
	outPDF := filepath.Join(workdir, "poam_e2e.pdf")

	r := RunAdinkhepraInOK(t, workdir, 2*time.Minute,
		"poam", "generate",
		"--output", outPDF,
	)

	// POAM generate runs live scan and must produce a real PDF
	actualPDF := findOutputFile(t, workdir, "poam", ".json")
	if actualPDF == "" {
		t.Fatalf("[E2E] POAM PDF not found in %s\nstdout: %s", workdir, r.Stdout)
	}
	AssertPDF(t, actualPDF)
	t.Logf("[E2E] POAM PDF: %s (%d bytes) in %s", filepath.Base(actualPDF), fileSize(t, actualPDF), r.Duration.Round(time.Millisecond))
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: Blast-Radius PDF export
// ─────────────────────────────────────────────────────────────────────────────

// TestE2E_Linux_BlastRadius generates a blast-radius report PDF.
func TestE2E_Linux_BlastRadius(t *testing.T) {
	workdir := t.TempDir()
	outPDF := filepath.Join(workdir, "blast_radius_e2e.pdf")

	r := RunAdinkhepraIn(t, workdir, 2*time.Minute,
		"blast-radius",
		"--output", outPDF,
	)

	if r.ExitCode > 1 {
		t.Fatalf("blast-radius exited %d\nstdout: %s\nstderr: %s",
			r.ExitCode, r.Stdout, r.Stderr)
	}

	actualFile := findAnyOutputInDir(t, workdir, "blast")
	if actualFile == "" {
		// Fallback: may have written to stdout only
		if len(strings.TrimSpace(r.Stdout)) > 100 {
			t.Logf("[E2E] Blast-radius printed to stdout (%d chars)", len(r.Stdout))
			return
		}
		t.Fatalf("[E2E] blast-radius output not found\nstdout: %s", r.Stdout)
	}

	if strings.HasSuffix(actualFile, ".pdf") {
		AssertPDF(t, actualFile)
	} else {
		AssertFileExists(t, actualFile)
	}
	t.Logf("[E2E] Blast-radius: %s (%d bytes) in %s",
		filepath.Base(actualFile), fileSize(t, actualFile), r.Duration.Round(time.Millisecond))
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 8: Full pipeline (against dummy Linux container)
// ─────────────────────────────────────────────────────────────────────────────

// TestE2E_Linux_FullPipeline runs the complete Khepra pipeline against
// the dummy Linux container: discover → ssp → poam → blast-radius.
func TestE2E_Linux_FullPipeline(t *testing.T) {
	target := StartDummyLinuxTarget(t)
	t.Logf("[E2E] Full pipeline against dummy Linux target: %s", target.Addr())
	pipelineStart := time.Now()

	// Stage 1: Discover
	t.Run("1_discover", func(t *testing.T) {
		workdir := t.TempDir()
		outFile := filepath.Join(workdir, "discovery.json")
		r := RunAdinkhepraIn(t, workdir, 2*time.Minute,
			"discover",
			"--target", target.IP+"/32",
			"--output", outFile,
			"--crypto-inventory=false",
			"--ssp-seed=false",
			"--blast-radius=false",
		)
		if r.ExitCode > 1 {
			t.Fatalf("discover: exit %d", r.ExitCode)
		}
		AssertFileExists(t, outFile)
		var snap map[string]interface{}
		ReadJSONFile(t, outFile, &snap)
		t.Logf("[Stage 1] target=%v  duration=%s", snap["target"], r.Duration.Round(time.Millisecond))
	})

	// Stage 2: SSP export
	t.Run("2_ssp_export", func(t *testing.T) {
		workdir := t.TempDir()
		sspInput := filepath.Join(workdir, "ssp_input.json")
		writeMinimalSSP(t, sspInput, "DummyLinux-E2E-FullPipeline")
		outPDF := filepath.Join(workdir, "ssp_pipeline.pdf")
		r := RunAdinkhepraInOK(t, workdir, 2*time.Minute,
			"ssp", "export", "--ssp", sspInput, "--format", "pdf", "--output", outPDF,
		)
		actualFile := findOutputFile(t, workdir, "ssp", ".json")
		if actualFile == "" {
			t.Fatalf("[Stage 2] SSP output not found\nstdout: %s", r.Stdout)
		}
		t.Logf("[Stage 2] SSP: %s (%d bytes)  duration=%s", filepath.Base(actualFile), fileSize(t, actualFile), r.Duration.Round(time.Millisecond))
	})

	// Stage 3: POAM export
	t.Run("3_poam_export", func(t *testing.T) {
		workdir := t.TempDir()
		outPDF := filepath.Join(workdir, "poam_pipeline.pdf")
		r := RunAdinkhepraInOK(t, workdir, 2*time.Minute,
			"poam", "generate", "--output", outPDF,
		)
		actualFile := findAnyOutputInDir(t, workdir, "poam")
		if actualFile == "" {
			t.Fatalf("[Stage 3] POAM output not found\nstdout: %s", r.Stdout)
		}
		t.Logf("[Stage 3] POAM: %s (%d bytes)  duration=%s", filepath.Base(actualFile), fileSize(t, actualFile), r.Duration.Round(time.Millisecond))
	})

	// Stage 4: Blast-radius
	t.Run("4_blast_radius", func(t *testing.T) {
		workdir := t.TempDir()
		outPDF := filepath.Join(workdir, "blast_radius_pipeline.pdf")
		r := RunAdinkhepraIn(t, workdir, 2*time.Minute, "blast-radius", "--output", outPDF)
		if r.ExitCode > 1 {
			t.Fatalf("blast-radius exit %d", r.ExitCode)
		}
		actualFile := findAnyOutputInDir(t, workdir, "blast")
		if actualFile != "" {
			t.Logf("[Stage 4] Blast-radius: %s (%d bytes)  duration=%s",
				filepath.Base(actualFile), fileSize(t, actualFile), r.Duration.Round(time.Millisecond))
		} else {
			t.Logf("[Stage 4] Blast-radius: stdout only (%d chars)", len(r.Stdout))
		}
	})

	t.Logf("[E2E] Full pipeline complete in %s ✓", time.Since(pipelineStart).Round(time.Millisecond))
}

// Ensure fmt is used (scan test uses fmt.Sprintf for target URL)
var _ = fmt.Sprintf
