package scanner

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unicode"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/mcp"
)

// injectionPatterns are substrings flagged as prompt-injection vectors in
// tool descriptions (T01 — Tool Poisoning).
var injectionPatterns = []string{
	"ignore previous",
	"ignore prior",
	"disregard all",
	"you are now",
	"system prompt",
	"jailbreak",
	"override instructions",
}

func (sc *Scanner) checkToolPoisoning(_ context.Context) []MCPFinding {
	var findings []MCPFinding
	for _, t := range sc.srv.Tools() {
		lower := strings.ToLower(t.Description)
		for _, pattern := range injectionPatterns {
			if strings.Contains(lower, pattern) {
				findings = append(findings, MCPFinding{
					ID:          fmt.Sprintf("T01-%s-inj", t.Name),
					ThreatClass: T01ToolPoisoning,
					Severity:    SeverityCritical,
					Title:       "Tool Poisoning Pattern in Description",
					Detail:      fmt.Sprintf("tool %q matches injection pattern %q", t.Name, pattern),
					Control:     "SI-3",
					Framework:   "NIST SP 800-53",
					DetectedAt:  time.Now().UTC(),
				})
				break // one finding per tool
			}
		}
		// Check for non-printable / control characters (hidden injection vector).
		for _, r := range t.Description {
			if r != '\n' && r != '\t' && r != '\r' && !unicode.IsPrint(r) {
				findings = append(findings, MCPFinding{
					ID:          fmt.Sprintf("T01-%s-ctrl", t.Name),
					ThreatClass: T01ToolPoisoning,
					Severity:    SeverityHigh,
					Title:       "Non-printable Character in Tool Description",
					Detail:      fmt.Sprintf("tool %q contains control char U+%04X", t.Name, r),
					Control:     "SI-3",
					Framework:   "NIST SP 800-53",
					DetectedAt:  time.Now().UTC(),
				})
				break
			}
		}
	}
	return findings
}

func (sc *Scanner) checkManifestRugPull(_ context.Context) []MCPFinding {
	if sc.baseline == nil {
		return nil // first run; caller should call CaptureBaseline() on startup
	}
	current := sc.srv.ComputeManifest()
	added, removed, changed := mcp.DiffManifests(sc.baseline, current)

	var findings []MCPFinding
	for _, name := range added {
		findings = append(findings, MCPFinding{
			ID:          fmt.Sprintf("T03-add-%s", name),
			ThreatClass: T03ManifestRugPull,
			Severity:    SeverityHigh,
			Title:       "Tool Added Post-Baseline",
			Detail:      fmt.Sprintf("tool %q registered after baseline snapshot", name),
			Control:     "CM-3",
			Framework:   "NIST SP 800-53",
			DetectedAt:  time.Now().UTC(),
		})
	}
	for _, name := range removed {
		findings = append(findings, MCPFinding{
			ID:          fmt.Sprintf("T03-rem-%s", name),
			ThreatClass: T03ManifestRugPull,
			Severity:    SeverityMedium,
			Title:       "Tool Removed Post-Baseline",
			Detail:      fmt.Sprintf("tool %q was removed after baseline snapshot", name),
			Control:     "CM-3",
			Framework:   "NIST SP 800-53",
			DetectedAt:  time.Now().UTC(),
		})
	}
	for _, name := range changed {
		findings = append(findings, MCPFinding{
			ID:          fmt.Sprintf("T10-%s", name),
			ThreatClass: T10SchemaDrift,
			Severity:    SeverityHigh,
			Title:       "Tool Schema Mutated Post-Baseline",
			Detail:      fmt.Sprintf("tool %q schema hash changed since baseline", name),
			Control:     "CM-6",
			Framework:   "NIST SP 800-53",
			DetectedAt:  time.Now().UTC(),
		})
	}
	return findings
}

func (sc *Scanner) checkUnsignedResponse(_ context.Context) []MCPFinding {
	if sc.srv.HasPQCSigning() {
		return nil
	}
	return []MCPFinding{{
		ID:          "T06-no-signing-key",
		ThreatClass: T06UnsignedResponse,
		Severity:    SeverityCritical,
		Title:       "MCP Responses Not PQC-Signed",
		Detail:      "no Dilithium signing key configured; tool responses cannot be verified by callers",
		Control:     "SC.3.177",
		Framework:   "CMMC 2.0",
		DetectedAt:  time.Now().UTC(),
	}}
}

func (sc *Scanner) checkDAGGap(_ context.Context) []MCPFinding {
	if sc.srv.HasAuditLogger() {
		return nil
	}
	return []MCPFinding{{
		ID:          "T07-no-audit-logger",
		ThreatClass: T07DAGGap,
		Severity:    SeverityHigh,
		Title:       "MCP Tool Calls Not DAG-Audited",
		Detail:      "AuditLogger is nil; tool invocations are not anchored in the immutable DAG chain",
		Control:     "AU.3.045",
		Framework:   "CMMC 2.0",
		DetectedAt:  time.Now().UTC(),
	}}
}

func (sc *Scanner) checkSchemaDrift(_ context.Context) []MCPFinding {
	// Drift is caught by checkManifestRugPull when a baseline exists.
	// Without a baseline, report that the check is unconfigured.
	if sc.baseline != nil {
		return nil
	}
	return []MCPFinding{{
		ID:          "T10-no-baseline",
		ThreatClass: T10SchemaDrift,
		Severity:    SeverityMedium,
		Title:       "No Manifest Baseline for Schema Drift Detection",
		Detail:      "call Scanner.CaptureBaseline() on startup to enable T03/T10 detection",
		Control:     "CM-6",
		Framework:   "NIST SP 800-53",
		DetectedAt:  time.Now().UTC(),
	}}
}

func (sc *Scanner) checkStaleCredential(_ context.Context) []MCPFinding {
	if sc.acp == nil {
		return nil
	}
	var findings []MCPFinding
	for _, cred := range sc.acp.ListCredentials() {
		ttl := cred.SecondsUntilExpiry()
		if ttl < 300 { // within 5 minutes of expiry
			findings = append(findings, MCPFinding{
				ID:          fmt.Sprintf("T11-%s", cred.ID),
				ThreatClass: T11StaleCredential,
				Severity:    SeverityMedium,
				Title:       "Agent Credential Nearing Expiry",
				Detail:      fmt.Sprintf("credential %s for agent %s expires in %ds — rotate now", cred.ID, cred.AgentID, ttl),
				Control:     "IA-5",
				Framework:   "NIST SP 800-53",
				DetectedAt:  time.Now().UTC(),
			})
		}
	}
	return findings
}

// dilithium3KeyMin / dilithium3KeyMax bracket the ML-DSA-65 private key size
// across FIPS 204 draft and final revisions (circl mode3: 4000 bytes).
const (
	dilithium3KeyMin = 3900
	dilithium3KeyMax = 4200
)

func (sc *Scanner) checkPQCDowngrade(_ context.Context) []MCPFinding {
	if !sc.srv.HasPQCSigning() {
		return nil // T06 already fires; don't double-report
	}
	keyLen := sc.srv.SigningKeyLen()
	if keyLen >= dilithium3KeyMin && keyLen <= dilithium3KeyMax {
		return nil
	}
	return []MCPFinding{{
		ID:          "T16-pqc-downgrade",
		ThreatClass: T16PQCDowngrade,
		Severity:    SeverityCritical,
		Title:       "PQC Algorithm Downgrade Detected",
		Detail:      fmt.Sprintf("signing key length %d bytes is outside ML-DSA-65 range [%d,%d]; possible downgrade to weaker algorithm", keyLen, dilithium3KeyMin, dilithium3KeyMax),
		Control:     "SC.3.177",
		Framework:   "CMMC 2.0",
		DetectedAt:  time.Now().UTC(),
	}}
}
