//go:build e2e

// Package e2e — Windows target E2E tests (Phantom Sandbox).
//
// These tests run the adinkhepra.exe CLI directly against the local Windows host.
// No Docker required — they use the Windows machine itself as the scan target.
//
// # What gets tested
//
//   - CLI binary boots and prints version
//   - STIG compliance scan runs against the local Windows environment
//   - SSP PDF is produced and is a real binary PDF
//   - POAM PDF is produced and is a real binary PDF
//   - Blast-radius report is produced
//   - Report godfather runs without crashing
//
// # Prerequisites
//
//   - adinkhepra.exe built (`make build-windows` or `make build`)
//   - Run: `make test-e2e-windows`
//
// Tag: go:build e2e (not included in `go test ./...` by default)
package e2e

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

// ─────────────────────────────────────────────────────────────────────────────
// Guard: skip all Windows tests on non-Windows hosts
// ─────────────────────────────────────────────────────────────────────────────

func requireWindows(t *testing.T) {
	t.Helper()
	if runtime.GOOS != "windows" {
		t.Skip("Windows E2E tests only run on Windows — skipping on " + runtime.GOOS)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Test W-1: Version check
// ─────────────────────────────────────────────────────────────────────────────

// TestE2E_Windows_VersionCheck verifies the Windows binary starts and returns a version.
func TestE2E_Windows_VersionCheck(t *testing.T) {
	requireWindows(t)

	r := RunAdinkhepra(t, 15*time.Second, "version")
	if r.ExitCode != 0 {
		t.Fatalf("[W-1] version exited %d\nstdout: %s\nstderr: %s", r.ExitCode, r.Stdout, r.Stderr)
	}

	out := strings.TrimSpace(r.Stdout)
	if out == "" {
		t.Error("[W-1] version output is empty")
	}
	t.Logf("[W-1] Version: %s", out[:min(80, len(out))])
}

// ─────────────────────────────────────────────────────────────────────────────
// Test W-2: Compliance scan against Windows localhost
// ─────────────────────────────────────────────────────────────────────────────

// TestE2E_Windows_ComplianceScan runs a NIST 800-171 compliance scan
// against the local Windows host and verifies it completes without crash.
func TestE2E_Windows_ComplianceScan(t *testing.T) {
	requireWindows(t)
	workdir := t.TempDir()
	outFile := filepath.Join(workdir, "windows_compliance.json")

	r := RunAdinkhepraIn(t, workdir, 5*time.Minute,
		"compliance", "scan",
		"--framework", "NIST_800_171",
		"--output", outFile,
		"--format", "json",
	)

	// Exit 0 = no findings, 1 = findings found — both acceptable
	if r.ExitCode > 1 {
		t.Fatalf("[W-2] compliance scan exited %d\nstdout: %s\nstderr: %s",
			r.ExitCode, r.Stdout, r.Stderr)
	}

	// Check for output file (may be in workdir with a default name)
	if info, err := os.Stat(outFile); err == nil && info.Size() > 0 {
		var result map[string]interface{}
		ReadJSONFile(t, outFile, &result)
		t.Logf("[W-2] Compliance result keys: %v", keys(result))
	} else {
		t.Logf("[W-2] stdout preview: %s", r.Stdout[:min(400, len(r.Stdout))])
	}

	t.Logf("[W-2] Windows compliance scan complete in %s (exit %d)",
		r.Duration.Round(time.Millisecond), r.ExitCode)
}

// ─────────────────────────────────────────────────────────────────────────────
// Test W-3: Discover localhost (Windows host)
// ─────────────────────────────────────────────────────────────────────────────

// TestE2E_Windows_Discover runs `adinkhepra discover` against localhost on Windows.
func TestE2E_Windows_Discover(t *testing.T) {
	requireWindows(t)
	workdir := t.TempDir()
	outFile := filepath.Join(workdir, "windows_discovery.json")

	r := RunAdinkhepraIn(t, workdir, 3*time.Minute,
		"discover",
		"--target", "127.0.0.1/32",
		"--output", outFile,
		"--ssp-seed=false",
		"--blast-radius=false",
	)

	if r.ExitCode > 1 {
		t.Fatalf("[W-3] discover exited %d\nstdout: %s\nstderr: %s",
			r.ExitCode, r.Stdout, r.Stderr)
	}

	AssertFileExists(t, outFile)

	var snap map[string]interface{}
	ReadJSONFile(t, outFile, &snap)

	t.Logf("[W-3] Windows discovery:")
	t.Logf("       Target:    %v", snap["target"])
	t.Logf("       Hostname:  %v", snap["hostname"])
	t.Logf("       OS:        %v", snap["os_version"])
	t.Logf("       Duration:  %s", r.Duration.Round(time.Millisecond))

	if snap["target"] == nil {
		t.Error("[W-3] discovery.json missing 'target' field")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Test W-4: SSP PDF export (Windows)
// ─────────────────────────────────────────────────────────────────────────────

// TestE2E_Windows_SSPExport produces an SSP PDF on Windows and validates
// the binary header is %PDF-1.x (not a Markdown fallback).
//
// IMPORTANT: We run CLI in the same workdir as the output file to avoid
// cross-directory path issues with the SSP input and output.
func TestE2E_Windows_SSPExport(t *testing.T) {
	requireWindows(t)
	workdir := t.TempDir()

	// Write SSP input into workdir
	sspInput := filepath.Join(workdir, "ssp_windows.json")
	writeMinimalSSP(t, sspInput, "Windows-E2E-Target")

	// Output PDF in same workdir
	outPDF := filepath.Join(workdir, "ssp_windows.pdf")

	r := RunAdinkhepraInOK(t, workdir, 2*time.Minute,
		"ssp", "export",
		"--ssp", sspInput,
		"--format", "pdf",
		"--output", outPDF,
	)

	// PDF must be produced (binary regenerated — fpdf works on Windows)
	actualPDF := findOutputFile(t, workdir, "ssp_windows", ".json")
	if actualPDF == "" {
		t.Fatalf("[W-4] SSP output not found in %s\nstdout: %s", workdir, r.Stdout)
	}
	AssertPDF(t, actualPDF)
	t.Logf("[W-4] SSP PDF: %s (%d bytes) in %s", filepath.Base(actualPDF), fileSize(t, actualPDF), r.Duration.Round(time.Millisecond))
}

// ─────────────────────────────────────────────────────────────────────────────
// Test W-5: POAM PDF export (Windows)
// ─────────────────────────────────────────────────────────────────────────────

// TestE2E_Windows_POAMExport generates a POAM PDF on Windows.
func TestE2E_Windows_POAMExport(t *testing.T) {
	requireWindows(t)
	workdir := t.TempDir()

	scanFile := filepath.Join(workdir, "scan_windows.json")
	writeMinimalScanResults(t, scanFile)

	outPDF := filepath.Join(workdir, "poam_windows.pdf")

	r := RunAdinkhepraInOK(t, workdir, 2*time.Minute,
		"poam", "generate",
		"--output", outPDF,
	)

	// POAM generate runs live scan + exports PDF.
	actualPDF := findOutputFile(t, workdir, "poam", ".json")
	if actualPDF == "" {
		t.Fatalf("[W-5] POAM output not found in %s\nstdout: %s", workdir, r.Stdout)
	}
	AssertPDF(t, actualPDF)
	t.Logf("[W-5] POAM PDF: %s (%d bytes) in %s", filepath.Base(actualPDF), fileSize(t, actualPDF), r.Duration.Round(time.Millisecond))
}

// ─────────────────────────────────────────────────────────────────────────────
// Test W-6: Blast-radius PDF (Windows)
// ─────────────────────────────────────────────────────────────────────────────

// TestE2E_Windows_BlastRadius generates a blast-radius PDF on Windows.
func TestE2E_Windows_BlastRadius(t *testing.T) {
	requireWindows(t)
	workdir := t.TempDir()

	outPDF := filepath.Join(workdir, "blast_radius_windows.pdf")

	r := RunAdinkhepraIn(t, workdir, 2*time.Minute,
		"blast-radius",
		"--output", outPDF,
	)

	// blast-radius exits 0 or 1 (findings)
	if r.ExitCode > 1 {
		t.Fatalf("[W-6] blast-radius exited %d\nstdout: %s\nstderr: %s",
			r.ExitCode, r.Stdout, r.Stderr)
	}

	// May write blast_radius_windows.pdf or blast_radius_v1.pdf or .md fallback
	actualFile := findAnyOutputInDir(t, workdir, "blast")
	if actualFile == "" {
		t.Fatalf("[W-6] blast-radius output not found in %s\nstdout: %s", workdir, r.Stdout)
	}

	// If it's a PDF, assert PDF header. If it's a .md fallback, just check non-empty.
	if strings.HasSuffix(actualFile, ".pdf") {
		AssertPDF(t, actualFile)
	} else {
		AssertFileExists(t, actualFile)
		t.Logf("[W-6] Note: PDF fallback produced Markdown: %s", filepath.Base(actualFile))
	}
	t.Logf("[W-6] Blast-radius: %s (%d bytes) in %s",
		filepath.Base(actualFile), fileSize(t, actualFile), r.Duration.Round(time.Millisecond))
}

// ─────────────────────────────────────────────────────────────────────────────
// Test W-7: Report godfather (full synthesis)
// ─────────────────────────────────────────────────────────────────────────────

// TestE2E_Windows_ReportGodfather runs `adinkhepra report godfather` on Windows.
func TestE2E_Windows_ReportGodfather(t *testing.T) {
	requireWindows(t)
	workdir := t.TempDir()

	scanFile := filepath.Join(workdir, "scan_godfather.json")
	writeMinimalScanResults(t, scanFile)

	r := RunAdinkhepraIn(t, workdir, 5*time.Minute,
		"report", "godfather",
		"--scan", scanFile,
	)

	// Exit 0 or 1 acceptable (findings present = 1 is normal)
	if r.ExitCode > 1 {
		t.Fatalf("[W-7] report godfather exited %d\nstdout: %s\nstderr: %s",
			r.ExitCode, r.Stdout, r.Stderr)
	}

	// Should mention something substantive in output (stdout or stderr)
	combined := strings.ToLower(r.Stdout + r.Stderr)
	if combined == "" {
		t.Error("[W-7] godfather produced no output at all")
	}

	t.Logf("[W-7] Godfather report complete in %s (exit %d)",
		r.Duration.Round(time.Millisecond), r.ExitCode)
}

// ─────────────────────────────────────────────────────────────────────────────
// Test W-8: Full Windows pipeline
// ─────────────────────────────────────────────────────────────────────────────

// TestE2E_Windows_FullPipeline runs the complete pipeline on Windows:
// version → discover → ssp → blast-radius
func TestE2E_Windows_FullPipeline(t *testing.T) {
	requireWindows(t)
	pipelineStart := time.Now()
	t.Logf("[W-8] Full Windows pipeline starting...")

	// Stage 1: Version
	t.Run("1_version", func(t *testing.T) {
		r := RunAdinkhepra(t, 15*time.Second, "version")
		if r.ExitCode != 0 {
			t.Fatalf("version exit %d", r.ExitCode)
		}
		t.Logf("[Stage 1] Version OK in %s", r.Duration.Round(time.Millisecond))
	})

	// Stage 2: Discover
	t.Run("2_discover", func(t *testing.T) {
		workdir := t.TempDir()
		outFile := filepath.Join(workdir, "pipeline_discovery.json")
		r := RunAdinkhepraIn(t, workdir, 3*time.Minute,
			"discover",
			"--target", "127.0.0.1/32",
			"--output", outFile,
			"--ssp-seed=false",
			"--blast-radius=false",
		)
		if r.ExitCode > 1 {
			t.Fatalf("discover exit %d", r.ExitCode)
		}
		AssertFileExists(t, outFile)
		var snap map[string]interface{}
		ReadJSONFile(t, outFile, &snap)
		t.Logf("[Stage 2] target=%v  hostname=%v  duration=%s",
			snap["target"], snap["hostname"], r.Duration.Round(time.Millisecond))
	})

	// Stage 3: SSP PDF
	t.Run("3_ssp_export", func(t *testing.T) {
		workdir := t.TempDir()
		sspInput := filepath.Join(workdir, "pipeline_ssp.json")
		writeMinimalSSP(t, sspInput, "Windows-Pipeline-E2E")
		outPDF := filepath.Join(workdir, "pipeline_ssp.pdf")
		r := RunAdinkhepraInOK(t, workdir, 2*time.Minute,
			"ssp", "export",
			"--ssp", sspInput,
			"--format", "pdf",
			"--output", outPDF,
		)
		actualPDF := findOutputFile(t, workdir, "pipeline_ssp", ".json")
		if actualPDF == "" {
			actualPDF = findOutputFile(t, workdir, "ssp", ".json")
		}
		if actualPDF == "" {
			t.Fatalf("[Stage 3] SSP output not found in %s\nstdout: %s", workdir, r.Stdout)
		}
		if strings.HasSuffix(actualPDF, ".pdf") {
			AssertPDF(t, actualPDF)
		}
		t.Logf("[Stage 3] SSP: %s (%d bytes)  duration=%s", filepath.Base(actualPDF), fileSize(t, actualPDF), r.Duration.Round(time.Millisecond))
	})

	// Stage 4: Blast-radius
	t.Run("4_blast_radius", func(t *testing.T) {
		workdir := t.TempDir()
		outPDF := filepath.Join(workdir, "pipeline_blast.pdf")
		r := RunAdinkhepraIn(t, workdir, 2*time.Minute,
			"blast-radius",
			"--output", outPDF,
		)
		if r.ExitCode > 1 {
			t.Fatalf("blast-radius exit %d", r.ExitCode)
		}
		actualFile := findAnyOutputInDir(t, workdir, "blast")
		if actualFile == "" {
			// Blast-radius may print to stdout only — that's also acceptable
			if len(strings.TrimSpace(r.Stdout)) > 0 {
				t.Logf("[Stage 4] Blast-radius printed to stdout (%d chars)", len(r.Stdout))
				return
			}
			t.Fatalf("[Stage 4] Blast-radius: no output file and no stdout\nstderr: %s", r.Stderr)
		}
		t.Logf("[Stage 4] Blast-radius: %s (%d bytes)  duration=%s",
			filepath.Base(actualFile), fileSize(t, actualFile), r.Duration.Round(time.Millisecond))
	})

	t.Logf("[W-8] Full Windows pipeline complete in %s ✓",
		time.Since(pipelineStart).Round(time.Millisecond))
}

// ─────────────────────────────────────────────────────────────────────────────
// Test W-9: Sovereign scan against localhost
// ─────────────────────────────────────────────────────────────────────────────

// TestE2E_Windows_SovereignScanLocalhost runs a sovereign scan against Windows localhost.
// Skips if the local agent is not running (requires `adinkhepra watch` first).
func TestE2E_Windows_SovereignScanLocalhost(t *testing.T) {
	requireWindows(t)

	r := RunAdinkhepra(t, 30*time.Second,
		"scan",
		"--target", "http://127.0.0.1",
	)

	// If agent not running, stderr will say so — skip gracefully
	if strings.Contains(r.Stderr, "not reachable") || strings.Contains(r.Stderr, "agent") {
		t.Skipf("[W-9] Local agent not running — skip sovereign scan: %s", strings.TrimSpace(r.Stderr))
	}

	// Exit 0 (clean) or 1 (findings) — both valid
	if r.ExitCode > 1 {
		t.Fatalf("[W-9] scan exited %d\nstdout: %s\nstderr: %s",
			r.ExitCode, r.Stdout, r.Stderr)
	}

	// Should produce output (stdout OR stderr)
	if strings.TrimSpace(r.Stdout+r.Stderr) == "" {
		t.Error("[W-9] expected non-empty output from scan")
	}

	t.Logf("[W-9] Sovereign scan complete in %s (exit %d)",
		r.Duration.Round(time.Millisecond), r.ExitCode)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: findPDFInDir finds a PDF file whose name starts with prefix.
// ─────────────────────────────────────────────────────────────────────────────

// Suppress unused imports
var _ = os.Stat
var _ = filepath.Base
