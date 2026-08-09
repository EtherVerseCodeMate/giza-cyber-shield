package main

import (
	"strings"
	"testing"
)

func TestParseKeyValue(t *testing.T) {
	tests := []struct {
		line     string
		wantKey  string
		wantVal  string
	}{
		{"deny 3", "deny", "3"},
		{"deny = 3", "deny", "3"},
		{"deny=3", "deny", "3"},
		{"MaxAuthTries 6", "MaxAuthTries", "6"},
		{"password required pam_pwquality.so retry=3", "password", "required pam_pwquality.so retry=3"},
		{"SELINUX = enforcing", "SELINUX", "enforcing"},
	}
	for _, tc := range tests {
		k, v := parseKeyValue(tc.line)
		if k != tc.wantKey || v != tc.wantVal {
			t.Errorf("parseKeyValue(%q) = (%q, %q), want (%q, %q)", tc.line, k, v, tc.wantKey, tc.wantVal)
		}
	}
}

func TestDetectLineSeparator(t *testing.T) {
	if got := detectLineSeparator("deny = 3"); got != " = " {
		t.Errorf("got %q want \" = \"", got)
	}
	if got := detectLineSeparator("deny=3"); got != "=" {
		t.Errorf("got %q want \"=\"", got)
	}
	if got := detectLineSeparator("MaxAuthTries 6"); got != " " {
		t.Errorf("got %q want \" \"", got)
	}
}

func TestRewriteLines_SpaceSeparated(t *testing.T) {
	lines := []string{"MaxAuthTries 3", "PermitRootLogin no"}
	out, changed := rewriteLines(lines, "MaxAuthTries", "6")
	if !changed {
		t.Fatal("expected change")
	}
	if out[0] != "MaxAuthTries 6" {
		t.Errorf("got %q want \"MaxAuthTries 6\"", out[0])
	}
}

func TestRewriteLines_INIStyle_PreservesSeparator(t *testing.T) {
	lines := []string{"# faillock config", "deny = 3", "unlock_time = 900"}
	out, changed := rewriteLines(lines, "deny", "5")
	if !changed {
		t.Fatal("expected change")
	}
	// Must preserve " = " separator, not collapse to "deny 5"
	want := "deny = 5"
	if out[1] != want {
		t.Errorf("got %q want %q (separator must be preserved)", out[1], want)
	}
}

func TestRewriteLines_Idempotent(t *testing.T) {
	lines := []string{"deny = 3"}
	_, changed := rewriteLines(lines, "deny", "3")
	if changed {
		t.Error("already-correct line must not be changed")
	}
}

func TestRewriteLines_Append_MatchesFileFormat(t *testing.T) {
	// File uses " = " — appended line must also use " = "
	lines := []string{"unlock_time = 900"}
	out, changed := rewriteLines(lines, "deny", "3")
	if !changed {
		t.Fatal("expected change (append)")
	}
	appended := out[len(out)-1]
	if !strings.Contains(appended, " = ") {
		t.Errorf("appended line %q should use \" = \" to match file format", appended)
	}
}

func TestRewriteLines_CommentsDuplicates(t *testing.T) {
	lines := []string{"deny = 3", "deny = 5"}
	out, _ := rewriteLines(lines, "deny", "6")
	if !strings.HasPrefix(out[1], "#") {
		t.Errorf("duplicate active directive must be commented out, got: %q", out[1])
	}
}
