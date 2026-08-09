package daemon

import (
	"strings"
	"testing"
)

// TestParseStageOutput_FullRoundTrip verifies that a realistic stage.sh output
// is parsed into the correct FileDiffs and exit code.
func TestParseStageOutput_FullRoundTrip(t *testing.T) {
	// Simulate stage.sh output for a faillock --conf edit.
	output := strings.Join([]string{
		"ASAF_BEFORE_BEGIN /etc/security/faillock.conf",
		"# faillock config",
		"deny = 3",
		"unlock_time = 900",
		"ASAF_BEFORE_END /etc/security/faillock.conf",
		// command stdout (not a marker) — should be filtered
		"applying changes...",
		"ASAF_AFTER_BEGIN /etc/security/faillock.conf",
		"# faillock config",
		"deny = 5",
		"unlock_time = 900",
		"ASAF_AFTER_END /etc/security/faillock.conf",
		"ASAF_EXIT_CODE 0",
	}, "\n")

	diffs, exitCode := parseStageOutput(output)

	if exitCode != 0 {
		t.Fatalf("exitCode = %d, want 0", exitCode)
	}
	if len(diffs) != 1 {
		t.Fatalf("len(diffs) = %d, want 1", len(diffs))
	}
	d := diffs[0]
	if d.Path != "/etc/security/faillock.conf" {
		t.Errorf("path = %q", d.Path)
	}
	if !d.Changed {
		t.Error("diff must be marked Changed")
	}
	if !strings.Contains(d.Before, "deny = 3") {
		t.Errorf("before state missing 'deny = 3': %q", d.Before)
	}
	if !strings.Contains(d.After, "deny = 5") {
		t.Errorf("after state missing 'deny = 5': %q", d.After)
	}
}

// TestParseStageOutput_NoChange verifies that identical before/after is
// reflected as Changed=false.
func TestParseStageOutput_NoChange(t *testing.T) {
	output := strings.Join([]string{
		"ASAF_BEFORE_BEGIN /etc/sysctl.d/99-asaf.conf",
		"kernel.randomize_va_space = 2",
		"ASAF_BEFORE_END /etc/sysctl.d/99-asaf.conf",
		"ASAF_AFTER_BEGIN /etc/sysctl.d/99-asaf.conf",
		"kernel.randomize_va_space = 2",
		"ASAF_AFTER_END /etc/sysctl.d/99-asaf.conf",
		"ASAF_EXIT_CODE 0",
	}, "\n")

	diffs, exitCode := parseStageOutput(output)

	if exitCode != 0 {
		t.Fatalf("exitCode = %d, want 0", exitCode)
	}
	if len(diffs) != 1 {
		t.Fatalf("len(diffs) = %d, want 1", len(diffs))
	}
	if diffs[0].Changed {
		t.Error("unchanged file must not be marked Changed")
	}
}

// TestParseStageOutput_NonZeroExit verifies failed command exit codes propagate.
func TestParseStageOutput_NonZeroExit(t *testing.T) {
	output := "ASAF_EXIT_CODE 1\n"
	_, exitCode := parseStageOutput(output)
	if exitCode != 1 {
		t.Errorf("exitCode = %d, want 1", exitCode)
	}
}

// TestParseStageOutput_MultipleFiles verifies two files are both captured.
func TestParseStageOutput_MultipleFiles(t *testing.T) {
	output := strings.Join([]string{
		"ASAF_BEFORE_BEGIN /etc/pam.d/system-auth",
		"before-system-auth",
		"ASAF_BEFORE_END /etc/pam.d/system-auth",
		"ASAF_BEFORE_BEGIN /etc/pam.d/password-auth",
		"before-password-auth",
		"ASAF_BEFORE_END /etc/pam.d/password-auth",
		"ASAF_AFTER_BEGIN /etc/pam.d/system-auth",
		"after-system-auth",
		"ASAF_AFTER_END /etc/pam.d/system-auth",
		"ASAF_AFTER_BEGIN /etc/pam.d/password-auth",
		"before-password-auth",
		"ASAF_AFTER_END /etc/pam.d/password-auth",
		"ASAF_EXIT_CODE 0",
	}, "\n")

	diffs, _ := parseStageOutput(output)

	if len(diffs) != 2 {
		t.Fatalf("len(diffs) = %d, want 2", len(diffs))
	}
	if !diffs[0].Changed {
		t.Error("system-auth should be Changed")
	}
	if diffs[1].Changed {
		t.Error("password-auth should NOT be Changed")
	}
}

// TestParseStageOutput_EmptyNoMarkers verifies empty output is handled safely.
func TestParseStageOutput_EmptyNoMarkers(t *testing.T) {
	diffs, exitCode := parseStageOutput("")
	if len(diffs) != 0 {
		t.Errorf("expected no diffs, got %d", len(diffs))
	}
	if exitCode != 0 {
		t.Errorf("expected exitCode 0 from empty output, got %d", exitCode)
	}
}

// TestFilterASAFMarkers verifies that ASAF_* lines are stripped and command
// stdout is preserved.
func TestFilterASAFMarkers(t *testing.T) {
	raw := "ASAF_BEFORE_BEGIN /etc/foo\nsome command output\nASAF_EXIT_CODE 0\n"
	got := filterASAFMarkers(raw)
	if strings.Contains(got, "ASAF_") {
		t.Errorf("ASAF markers not stripped: %q", got)
	}
	if !strings.Contains(got, "some command output") {
		t.Errorf("command output was stripped: %q", got)
	}
}

// TestStagingResultTextDiff_NilSafe verifies TextDiff does not panic on nil.
func TestStagingResultTextDiff_NilSafe(t *testing.T) {
	var r *StagingResult
	got := r.TextDiff()
	if got != "" {
		t.Errorf("nil TextDiff = %q, want empty", got)
	}
}

// TestSelectBackend_DryRunFallback verifies SelectBackend returns DryRunBackend
// when Docker is unavailable or no image exists for a profile.
func TestSelectBackend_DryRunFallback(t *testing.T) {
	// "windows" has no image → should always fall through to DryRun
	b := SelectBackend("windows")
	if _, ok := b.(*DryRunBackend); !ok {
		t.Errorf("expected *DryRunBackend for windows profile, got %T", b)
	}
}
