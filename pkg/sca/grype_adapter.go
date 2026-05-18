package sca

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// ──────────────────────────────────────────────────────────────────────────────
// Grype JSON output types (matching actual `grype -o json` structure)
// ──────────────────────────────────────────────────────────────────────────────

// GrypeOutput represents the top-level structure from `grype -o json`.
type GrypeOutput struct {
	Matches    []GrypeMatch    `json:"matches"`
	Descriptor GrypeDescriptor `json:"descriptor,omitempty"`
}

// GrypeMatch represents a single vulnerability match.
type GrypeMatch struct {
	Vulnerability GrypeVulnerability `json:"vulnerability"`
	Artifact      GrypeArtifact      `json:"artifact"`
}

// GrypeVulnerability contains the vulnerability details from Grype.
type GrypeVulnerability struct {
	ID          string     `json:"id"`
	DataSource  string     `json:"dataSource,omitempty"`
	Severity    string     `json:"severity"` // Critical, High, Medium, Low, Negligible
	Description string     `json:"description,omitempty"`
	CVSS        []GrypeCVSS `json:"cvss,omitempty"`
	Fix         GrypeFix   `json:"fix,omitempty"`
	URLs        []string   `json:"urls,omitempty"`
}

// GrypeCVSS represents a CVSS score entry from Grype output.
// Grype emits an array of CVSS scores, often from different sources (NVD, vendor).
type GrypeCVSS struct {
	Source  string      `json:"source,omitempty"`
	Type   string      `json:"type,omitempty"` // e.g. "Primary"
	Version string     `json:"version,omitempty"` // "3.1"
	Vector  string     `json:"vector,omitempty"`
	Metrics GrypeCVSSMetrics `json:"metrics,omitempty"`
}

// GrypeCVSSMetrics holds the base score.
type GrypeCVSSMetrics struct {
	BaseScore float64 `json:"baseScore"`
}

// GrypeFix contains fix information.
type GrypeFix struct {
	Versions []string `json:"versions,omitempty"`
	State    string   `json:"state,omitempty"` // "fixed", "not-fixed", "wont-fix", "unknown"
}

// GrypeArtifact describes the matched software component.
type GrypeArtifact struct {
	Name      string          `json:"name"`
	Version   string          `json:"version"`
	Type      string          `json:"type"` // go-module, npm, python, java-archive, etc.
	PURL      string          `json:"purl,omitempty"`
	CPEs      []string        `json:"cpes,omitempty"`
	Locations []GrypeLocation `json:"locations,omitempty"`
}

// GrypeLocation identifies where the artifact was found on disk.
type GrypeLocation struct {
	Path string `json:"path"`
}

// GrypeDescriptor holds tool and DB version metadata.
type GrypeDescriptor struct {
	Name    string   `json:"name,omitempty"`
	Version string   `json:"version,omitempty"`
	DB      GrypeDB  `json:"db,omitempty"`
}

// GrypeDB describes the Grype vulnerability database state.
type GrypeDB struct {
	Built         string `json:"built,omitempty"`
	SchemaVersion int    `json:"schemaVersion,omitempty"`
	Location      string `json:"location,omitempty"`
	Checksum      string `json:"checksum,omitempty"`
}

// ──────────────────────────────────────────────────────────────────────────────
// GrypeAdapter
// ──────────────────────────────────────────────────────────────────────────────

// GrypeAdapter shells out to the official Grype binary for vulnerability matching.
// Follows AD-002: shell-out for independent upgradeability.
type GrypeAdapter struct {
	// Timeout for grype execution. Default: 180s (Grype can be slower on large SBOMs).
	Timeout time.Duration
}

// NewGrypeAdapter creates a GrypeAdapter with production defaults.
func NewGrypeAdapter() *GrypeAdapter {
	return &GrypeAdapter{
		Timeout: 180 * time.Second,
	}
}

// MatchVulnerabilities runs Grype against a target (SBOM file or project directory)
// and returns pre-enrichment EnrichedFinding structs plus scanner metadata.
//
// Supported targets:
//   - A CycloneDX JSON file (e.g. from SyftAdapter.GenerateSBOM)
//   - A project directory (Grype will run Syft internally)
//
// NOTE: The returned findings are PRE-ENRICHMENT. They contain Grype-sourced
// data only (CVEID, CVSS, severity, component identity). Enrichment fields
// (InCISAKEV, EPSSScore, MITRETactics, etc.) are zero-valued and must be
// populated by the Enricher (pkg/sca/enricher.go) before ERT analysis.
func (a *GrypeAdapter) MatchVulnerabilities(ctx context.Context, target string) ([]EnrichedFinding, *ScannerMetadata, error) {
	if target == "" {
		return nil, nil, fmt.Errorf("sca/grype: target path is required")
	}

	absTarget, err := filepath.Abs(target)
	if err != nil {
		return nil, nil, fmt.Errorf("sca/grype: cannot resolve path: %w", err)
	}

	// Verify target exists
	if _, err := os.Stat(absTarget); err != nil {
		return nil, nil, fmt.Errorf("sca/grype: target does not exist: %w", err)
	}

	// Verify grype is installed
	if _, err := exec.LookPath("grype"); err != nil {
		return nil, nil, fmt.Errorf("sca/grype: grype binary not found in PATH — install from https://github.com/anchore/grype")
	}

	// Build grype target: if it's a CycloneDX file, use sbom: prefix
	grypeTarget := absTarget
	if isSBOMFile(absTarget) {
		grypeTarget = "sbom:" + absTarget
	}

	// Execute grype
	cmdCtx, cancel := context.WithTimeout(ctx, a.Timeout)
	defer cancel()

	cmd := exec.CommandContext(cmdCtx, "grype",
		grypeTarget,
		"-o", "json",
		"--quiet",
		"--add-cpes-if-none",
	)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if cmdCtx.Err() == context.DeadlineExceeded {
			return nil, nil, fmt.Errorf("sca/grype: execution timed out after %s", a.Timeout)
		}
		return nil, nil, fmt.Errorf("sca/grype: execution failed: %w\nstderr: %s", err, stderr.String())
	}

	// Parse Grype JSON output
	var output GrypeOutput
	if err := json.Unmarshal(stdout.Bytes(), &output); err != nil {
		return nil, nil, fmt.Errorf("sca/grype: failed to parse JSON output: %w", err)
	}

	findings := convertGrypeToEnriched(output.Matches)
	meta := extractGrypeMetadata(&output.Descriptor)

	return findings, meta, nil
}

// ──────────────────────────────────────────────────────────────────────────────
// Conversion: Grype → EnrichedFinding (pre-enrichment)
// ──────────────────────────────────────────────────────────────────────────────

// convertGrypeToEnriched maps Grype match results to our EnrichedFinding schema.
// At this stage, enrichment fields (CISA KEV, EPSS, MITRE, etc.) are left at
// zero values — they're filled by the Enricher in a subsequent stage.
func convertGrypeToEnriched(matches []GrypeMatch) []EnrichedFinding {
	findings := make([]EnrichedFinding, 0, len(matches))
	now := time.Now().UTC()

	for _, m := range matches {
		f := EnrichedFinding{
			// Component identity
			Component:  m.Artifact.Name,
			Version:    m.Artifact.Version,
			Ecosystem:  normalizeEcosystem(m.Artifact.Type),
			PackageURL: m.Artifact.PURL,
			CPE:        firstOrEmpty(m.Artifact.CPEs),

			// Vulnerability
			CVEID:    m.Vulnerability.ID,
			Severity: normalizeSeverity(m.Vulnerability.Severity),

			// Sources
			Sources: []string{"grype"},

			// Metadata
			DetectedAt: now,
		}

		// Extract best CVSS v3 data (prefer NVD source, fall back to first v3 entry)
		if cvss := bestCVSSv3(m.Vulnerability.CVSS); cvss != nil {
			f.CVSSv3Score = cvss.Metrics.BaseScore
			f.CVSSv3Vector = cvss.Vector
		}

		// If CVSS populated but severity was empty/unknown, derive it
		if f.Severity == "UNKNOWN" && f.CVSSv3Score > 0 {
			f.Severity = string(SeverityFromCVSS(f.CVSSv3Score))
		}

		findings = append(findings, f)
	}

	return findings
}

// bestCVSSv3 selects the best CVSS v3 score from Grype's array.
// Prefers NVD source; falls back to the first v3.x entry.
func bestCVSSv3(scores []GrypeCVSS) *GrypeCVSS {
	var fallback *GrypeCVSS

	for i := range scores {
		isV3 := strings.HasPrefix(scores[i].Version, "3")
		if !isV3 {
			continue
		}
		// Prefer NVD as authoritative source
		if strings.Contains(strings.ToLower(scores[i].Source), "nvd") {
			return &scores[i]
		}
		if fallback == nil {
			fallback = &scores[i]
		}
	}

	return fallback
}

// extractGrypeMetadata converts Grype descriptor info to our ScannerMetadata.
func extractGrypeMetadata(desc *GrypeDescriptor) *ScannerMetadata {
	return &ScannerMetadata{
		GrypeVersion:   desc.Version,
		GrypeDBVersion: desc.DB.Built,
		ScannedAt:      time.Now().UTC(),
	}
}

// ──────────────────────────────────────────────────────────────────────────────
// Shared utility functions
// ──────────────────────────────────────────────────────────────────────────────

// normalizeEcosystem maps Syft/Grype artifact types to standard ecosystem names.
func normalizeEcosystem(artifactType string) string {
	switch strings.ToLower(artifactType) {
	case "go-module", "go", "gomod":
		return "go"
	case "npm", "javascript":
		return "npm"
	case "python", "pip", "wheel":
		return "pypi"
	case "java-archive", "jar", "maven", "gradle":
		return "maven"
	case "rust", "cargo":
		return "cargo"
	case "gem", "ruby":
		return "gem"
	case "nuget", "dotnet":
		return "nuget"
	case "deb", "dpkg":
		return "deb"
	case "rpm", "rpmdb":
		return "rpm"
	default:
		return artifactType
	}
}

// normalizeSeverity maps Grype's title-case severity to our uppercase convention.
func normalizeSeverity(sev string) string {
	switch strings.ToLower(sev) {
	case "critical":
		return "CRITICAL"
	case "high":
		return "HIGH"
	case "medium":
		return "MEDIUM"
	case "low":
		return "LOW"
	case "negligible":
		return "LOW" // Grype has Negligible, we map to LOW
	default:
		return "UNKNOWN"
	}
}

// firstOrEmpty returns the first element of a slice or empty string.
func firstOrEmpty(s []string) string {
	if len(s) > 0 {
		return s[0]
	}
	return ""
}

// isSBOMFile checks if the target looks like a CycloneDX/SPDX SBOM file
// by reading the first few bytes for a JSON bomFormat signature.
func isSBOMFile(path string) bool {
	// Quick extension check first
	ext := strings.ToLower(filepath.Ext(path))
	if ext == ".json" || ext == ".xml" {
		// Read first 512 bytes to check for bomFormat
		data, err := readHead(path, 512)
		if err != nil {
			return false
		}
		content := string(data)
		return strings.Contains(content, `"bomFormat"`) ||
			strings.Contains(content, `"spdxVersion"`)
	}
	return false
}

// readHead reads the first n bytes of a file.
func readHead(path string, n int) ([]byte, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	buf := make([]byte, n)
	read, err := f.Read(buf)
	if err != nil {
		return nil, err
	}
	return buf[:read], nil
}
