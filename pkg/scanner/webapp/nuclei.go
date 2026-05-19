// Package webapp provides active web application vulnerability scanning via Nuclei.
// It wraps the nuclei binary, auto-installing it if absent, and maps findings
// to KHEPRA's AuditSnapshot.WebFindings for OSCAL export and Paramify import.
package webapp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/types"
)

// ScanOptions configures a Nuclei scan run.
type ScanOptions struct {
	// Tags filters templates by Nuclei tag (e.g. "owasp", "cve", "sqli").
	// Nil/empty runs the default set (owasp + cve + misconfig + exposure).
	Tags []string
	// Severity limits findings returned (default: critical,high,medium,low).
	Severity []string
	// RateLimit caps HTTP requests per second to the target (default: 50).
	RateLimit int
	// Timeout is the total scan deadline (default: 15 min).
	Timeout time.Duration
}

// DefaultScanOptions returns sensible defaults for isolated test environments.
func DefaultScanOptions() ScanOptions {
	return ScanOptions{
		Tags:      []string{"owasp", "cve", "sqli", "xss", "ssrf", "lfi", "rce", "misconfig", "exposure", "default-login"},
		Severity:  []string{"critical", "high", "medium", "low"},
		RateLimit: 50,
		Timeout:   15 * time.Minute,
	}
}

// NetworkScanOptions extends DefaultScanOptions with tags suited for
// network-service-heavy targets (e.g. Metasploitable2).
func NetworkScanOptions() ScanOptions {
	opts := DefaultScanOptions()
	opts.Tags = append(opts.Tags, "ftp", "ssh", "telnet", "tomcat", "phpmyadmin", "mysql", "postgres", "network")
	opts.Timeout = 25 * time.Minute
	return opts
}

// Scanner wraps the nuclei binary.
type Scanner struct {
	binPath string
}

// New returns a Scanner, auto-installing nuclei into toolsDir if not in PATH.
func New(toolsDir string) (*Scanner, error) {
	if path, err := exec.LookPath("nuclei"); err == nil {
		return &Scanner{binPath: path}, nil
	}

	localBin := filepath.Join(toolsDir, "nuclei")
	if _, err := os.Stat(localBin); err == nil {
		return &Scanner{binPath: localBin}, nil
	}

	fmt.Printf("[WEBAPP] nuclei not found — installing via go install (GOBIN=%s)...\n", toolsDir)
	if err := os.MkdirAll(toolsDir, 0755); err != nil {
		return nil, fmt.Errorf("webapp: create tools dir: %w", err)
	}

	cmd := exec.Command("go", "install", "github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest")
	cmd.Env = append(os.Environ(), "GOBIN="+toolsDir)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("webapp: install nuclei: %w", err)
	}

	return &Scanner{binPath: localBin}, nil
}

// UpdateTemplates pulls the latest Nuclei template bundle. Safe to call before
// each scan; exits quickly if templates are already current.
func (s *Scanner) UpdateTemplates() error {
	cmd := exec.Command(s.binPath, "-update-templates", "-silent")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		// Non-fatal: offline environments may not reach the template repo.
		fmt.Printf("[WEBAPP] template update skipped (offline?): %v\n", err)
	}
	return nil
}

// nucleiJSON is the raw JSONL line emitted by nuclei -json.
type nucleiJSON struct {
	TemplateID string `json:"template-id"`
	Info       struct {
		Name        string   `json:"name"`
		Severity    string   `json:"severity"`
		Tags        []string `json:"tags"`
		Description string   `json:"description"`
		Classification struct {
			CVSSScore float64  `json:"cvss-score"`
			CVEIDs    []string `json:"cve-id"`
		} `json:"classification"`
	} `json:"info"`
	Host             string    `json:"host"`
	MatchedAt        string    `json:"matched-at"`
	ExtractedResults []string  `json:"extracted-results"`
	Timestamp        time.Time `json:"timestamp"`
}

// tagToParamify maps the first matching Nuclei tag to a Paramify Solution
// Capability label. The list is ordered by specificity (most specific first).
var tagToParamify = []struct {
	tag        string
	capability string
}{
	{"sqli", "Application Access Control: SQL Injection Prevention"},
	{"xss", "Application Access Control: XSS Prevention"},
	{"ssrf", "Network Access Control: SSRF Prevention"},
	{"lfi", "Intrusion Detection: Path Traversal Prevention"},
	{"rce", "Intrusion Detection: Remote Code Execution Prevention"},
	{"default-login", "Password Policy: Default Credential Elimination"},
	{"exposure", "Data Protection: Sensitive Data Exposure Remediation"},
	{"misconfig", "Configuration Management: Misconfiguration Remediation"},
	{"cve", "Vulnerability Management: CVE Remediation"},
	{"owasp", "Application Access Control: OWASP Top 10 Remediation"},
}

func capabilityForTags(tags []string) string {
	tagSet := make(map[string]bool, len(tags))
	for _, t := range tags {
		tagSet[strings.ToLower(t)] = true
	}
	for _, entry := range tagToParamify {
		if tagSet[entry.tag] {
			return entry.capability
		}
	}
	return "Vulnerability Management: Web Application Finding"
}

// Scan runs Nuclei against target and returns structured findings ingested into
// the KHEPRA types. ctx is honored for cancellation/timeout.
func (s *Scanner) Scan(ctx context.Context, target string, opts ScanOptions) ([]types.WebFinding, error) {
	if opts.Timeout == 0 {
		opts.Timeout = 15 * time.Minute
	}
	if opts.RateLimit == 0 {
		opts.RateLimit = 50
	}
	if len(opts.Severity) == 0 {
		opts.Severity = []string{"critical", "high", "medium", "low"}
	}

	args := []string{
		"-u", target,
		"-json",
		"-silent",
		"-no-color",
		"-rate-limit", fmt.Sprintf("%d", opts.RateLimit),
		"-severity", strings.Join(opts.Severity, ","),
	}
	if len(opts.Tags) > 0 {
		args = append(args, "-tags", strings.Join(opts.Tags, ","))
	}

	scanCtx, cancel := context.WithTimeout(ctx, opts.Timeout)
	defer cancel()

	cmd := exec.CommandContext(scanCtx, s.binPath, args...)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("webapp: stdout pipe: %w", err)
	}
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("webapp: start nuclei (%s): %w", s.binPath, err)
	}

	var findings []types.WebFinding
	sc := bufio.NewScanner(stdout)
	sc.Buffer(make([]byte, 1024*1024), 1024*1024) // 1 MB per line (large responses)
	for sc.Scan() {
		line := sc.Bytes()
		if len(line) == 0 || line[0] != '{' {
			continue // skip non-JSON progress lines
		}
		var r nucleiJSON
		if err := json.Unmarshal(line, &r); err != nil {
			continue
		}
		ts := r.Timestamp
		if ts.IsZero() {
			ts = time.Now().UTC()
		}
		findings = append(findings, types.WebFinding{
			TemplateID:         r.TemplateID,
			Name:               r.Info.Name,
			Severity:           r.Info.Severity,
			Tags:               r.Info.Tags,
			Description:        r.Info.Description,
			CVSS:               r.Info.Classification.CVSSScore,
			CVEIDs:             r.Info.Classification.CVEIDs,
			URL:                r.Host,
			MatchedAt:          r.MatchedAt,
			ExtractedResults:   r.ExtractedResults,
			ParamifyCapability: capabilityForTags(r.Info.Tags),
			ScannedAt:          ts,
		})
	}

	if err := cmd.Wait(); err != nil && scanCtx.Err() != nil {
		return findings, fmt.Errorf("webapp: scan timed out after %s: %w", opts.Timeout, scanCtx.Err())
	}

	return findings, nil
}

// ScanSummary returns counts by severity for logging.
func ScanSummary(findings []types.WebFinding) map[string]int {
	counts := map[string]int{}
	for _, f := range findings {
		counts[f.Severity]++
	}
	return counts
}
