package sca

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	// Grype library imports — direct Go library, no binary required
	"github.com/anchore/grype/grype"
	"github.com/anchore/grype/grype/db"
	grypeMatch "github.com/anchore/grype/grype/match"
	grypePkg "github.com/anchore/grype/grype/pkg"
	"github.com/anchore/grype/grype/store"
	"github.com/anchore/grype/grype/vulnerability"
	"github.com/anchore/syft/syft/sbom"
)

// ──────────────────────────────────────────────────────────────────────────────
// Grype JSON output types (kept for backward compatibility with existing code)
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
	ID          string      `json:"id"`
	DataSource  string      `json:"dataSource,omitempty"`
	Severity    string      `json:"severity"` // Critical, High, Medium, Low, Negligible
	Description string      `json:"description,omitempty"`
	CVSS        []GrypeCVSS `json:"cvss,omitempty"`
	Fix         GrypeFix    `json:"fix,omitempty"`
	URLs        []string    `json:"urls,omitempty"`
}

// GrypeCVSS represents a CVSS score entry from Grype output.
type GrypeCVSS struct {
	Source  string          `json:"source,omitempty"`
	Type    string          `json:"type,omitempty"`    // e.g. "Primary"
	Version string          `json:"version,omitempty"` // "3.1"
	Vector  string          `json:"vector,omitempty"`
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
	Name    string  `json:"name,omitempty"`
	Version string  `json:"version,omitempty"`
	DB      GrypeDB `json:"db,omitempty"`
}

// GrypeDB describes the Grype vulnerability database state.
type GrypeDB struct {
	Built         string `json:"built,omitempty"`
	SchemaVersion int    `json:"schemaVersion,omitempty"`
	Location      string `json:"location,omitempty"`
	Checksum      string `json:"checksum,omitempty"`
}

// ──────────────────────────────────────────────────────────────────────────────
// GrypeAdapter — Sovereign In-Process Vulnerability Matching
// ──────────────────────────────────────────────────────────────────────────────

// GrypeAdapter performs vulnerability matching using the Grype Go library directly.
// Zero external binary dependency — full sovereignty per AD-002.
type GrypeAdapter struct {
	// Timeout for vulnerability matching. Default: 180s.
	Timeout time.Duration

	// dbStore caches the vulnerability database across scans.
	dbStore     *store.Store
	dbStatus    *db.Status
	dbLoadOnce  sync.Once
	dbLoadErr   error
}

// NewGrypeAdapter creates a GrypeAdapter with production defaults.
func NewGrypeAdapter() *GrypeAdapter {
	return &GrypeAdapter{
		Timeout: 180 * time.Second,
	}
}

// MatchVulnerabilities runs Grype vulnerability matching against a target.
// It accepts either:
//   - An *sbom.SBOM (direct from SyftAdapter — zero-copy, preferred)
//   - A file path to a CycloneDX/SPDX SBOM file
//   - A project directory path
//
// Returns pre-enrichment EnrichedFinding structs plus scanner metadata.
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

	cmdCtx, cancel := context.WithTimeout(ctx, a.Timeout)
	defer cancel()

	// ── Load vulnerability database ──────────────────────────────────
	log.Println("[SCA/GRYPE] Loading vulnerability database...")
	dbCfg := db.NewDefaultConfig()

	dbSession, dbStatus, _, err := grype.LoadVulnerabilityDB(dbCfg, true)
	if err != nil {
		return nil, nil, fmt.Errorf("sca/grype: failed to load vulnerability DB: %w", err)
	}
	defer dbSession.Close()

	log.Println("[SCA/GRYPE] DB loaded, resolving packages...")

	// ── Resolve packages from the target ─────────────────────────────
	// Build the grype target string
	grypeTarget := absTarget
	if isSBOMFile(absTarget) {
		grypeTarget = "sbom:" + absTarget
	} else {
		info, _ := os.Stat(absTarget)
		if info != nil && info.IsDir() {
			grypeTarget = "dir:" + absTarget
		}
	}

	// Use Grype's package provider to extract packages from the target
	providerCfg := grypePkg.ProviderConfig{}
	packages, pkgContext, _, err := grypePkg.Provide(cmdCtx, grypeTarget, providerCfg)
	if err != nil {
		if cmdCtx.Err() == context.DeadlineExceeded {
			return nil, nil, fmt.Errorf("sca/grype: package resolution timed out after %s", a.Timeout)
		}
		return nil, nil, fmt.Errorf("sca/grype: failed to resolve packages: %w", err)
	}

	log.Printf("[SCA/GRYPE] Resolved %d packages, matching vulnerabilities...", len(packages))

	// ── Run vulnerability matching ───────────────────────────────────
	vulnMatcher := grype.VulnerabilityMatcher{
		Store:    *dbSession,
		Matchers: grype.DefaultMatchers(grypeMatch.NewDefaultMatcherConfig()),
	}

	matches, _, err := vulnMatcher.FindMatches(packages, pkgContext)
	if err != nil {
		return nil, nil, fmt.Errorf("sca/grype: vulnerability matching failed: %w", err)
	}

	// ── Convert to EnrichedFinding ───────────────────────────────────
	findings := convertMatchesToEnriched(matches, dbSession)
	meta := buildGrypeMetadata(dbStatus)

	log.Printf("[SCA/GRYPE] Matching complete: %d findings (in-process)", len(findings))
	return findings, meta, nil
}

// MatchVulnerabilitiesFromSBOM performs vulnerability matching directly from a
// Syft SBOM object — zero-copy, zero-serialization handoff between adapters.
// This is the preferred path for the Pipeline.
func (a *GrypeAdapter) MatchVulnerabilitiesFromSBOM(ctx context.Context, s *sbom.SBOM) ([]EnrichedFinding, *ScannerMetadata, error) {
	if s == nil {
		return nil, nil, fmt.Errorf("sca/grype: nil SBOM provided")
	}

	cmdCtx, cancel := context.WithTimeout(ctx, a.Timeout)
	defer cancel()

	// ── Load vulnerability database ──────────────────────────────────
	log.Println("[SCA/GRYPE] Loading vulnerability database...")
	dbCfg := db.NewDefaultConfig()

	dbSession, dbStatus, _, err := grype.LoadVulnerabilityDB(dbCfg, true)
	if err != nil {
		return nil, nil, fmt.Errorf("sca/grype: failed to load vulnerability DB: %w", err)
	}
	defer dbSession.Close()

	log.Println("[SCA/GRYPE] DB loaded, extracting packages from SBOM...")

	// Extract packages directly from the Syft SBOM
	packages, pkgContext, err := grypePkg.FromSBOM(cmdCtx, s)
	if err != nil {
		return nil, nil, fmt.Errorf("sca/grype: failed to extract packages from SBOM: %w", err)
	}

	log.Printf("[SCA/GRYPE] Extracted %d packages, matching vulnerabilities...", len(packages))

	// ── Run vulnerability matching ───────────────────────────────────
	vulnMatcher := grype.VulnerabilityMatcher{
		Store:    *dbSession,
		Matchers: grype.DefaultMatchers(grypeMatch.NewDefaultMatcherConfig()),
	}

	matches, _, err := vulnMatcher.FindMatches(packages, pkgContext)
	if err != nil {
		return nil, nil, fmt.Errorf("sca/grype: vulnerability matching failed: %w", err)
	}

	// ── Convert to EnrichedFinding ───────────────────────────────────
	findings := convertMatchesToEnriched(matches, dbSession)
	meta := buildGrypeMetadata(dbStatus)

	log.Printf("[SCA/GRYPE] Matching complete: %d findings (in-process, SBOM path)", len(findings))
	return findings, meta, nil
}

// ──────────────────────────────────────────────────────────────────────────────
// Conversion: Grype matches → EnrichedFinding
// ──────────────────────────────────────────────────────────────────────────────

// convertMatchesToEnriched maps Grype match results to our EnrichedFinding schema.
func convertMatchesToEnriched(matches *grypeMatch.Matches, store vulnerability.Provider) []EnrichedFinding {
	if matches == nil {
		return make([]EnrichedFinding, 0)
	}

	sorted := matches.Sorted()
	findings := make([]EnrichedFinding, 0, len(sorted))
	now := time.Now().UTC()

	for _, m := range sorted {
		f := EnrichedFinding{
			// Component identity
			Component:  m.Package.Name,
			Version:    m.Package.Version,
			Ecosystem:  normalizeEcosystem(string(m.Package.Type)),
			PackageURL: m.Package.PURL,
			CPE:        firstCPE(m.Package),

			// Vulnerability
			CVEID:    m.Vulnerability.ID,
			Severity: normalizeSeverity(string(m.Vulnerability.Severity)),

			// Sources
			Sources: []string{"grype"},

			// Metadata
			DetectedAt: now,
		}

		// Extract CVSS data from the vulnerability metadata
		if store != nil {
			extractCVSSFromStore(&f, m.Vulnerability, store)
		}

		// If CVSS populated but severity was empty/unknown, derive it
		if f.Severity == "UNKNOWN" && f.CVSSv3Score > 0 {
			f.Severity = string(SeverityFromCVSS(f.CVSSv3Score))
		}

		findings = append(findings, f)
	}

	return findings
}

// extractCVSSFromStore looks up detailed vulnerability metadata including CVSS.
func extractCVSSFromStore(f *EnrichedFinding, vuln vulnerability.Reference, prov vulnerability.Provider) {
	// Try to get detailed vulnerability info from the store
	vulns, err := prov.Get(vuln.ID, vuln.Namespace)
	if err != nil || len(vulns) == 0 {
		return
	}

	// Find best CVSSv3 score
	for _, v := range vulns {
		for _, cvss := range v.Cvss {
			if strings.HasPrefix(cvss.Version, "3") {
				if cvss.Metrics.BaseScore > f.CVSSv3Score {
					f.CVSSv3Score = cvss.Metrics.BaseScore
					f.CVSSv3Vector = cvss.Vector
				}
			}
		}
	}
}

// firstCPE extracts the first CPE string from a Grype package.
func firstCPE(p grypePkg.Package) string {
	if len(p.CPEs) > 0 {
		return p.CPEs[0].Attributes.BindToFmtString()
	}
	return ""
}

// buildGrypeMetadata constructs scanner metadata from the DB status.
func buildGrypeMetadata(status *db.Status) *ScannerMetadata {
	meta := &ScannerMetadata{
		GrypeVersion: "embedded",
		ScannedAt:    time.Now().UTC(),
	}
	if status != nil {
		meta.GrypeDBVersion = status.Built.String()
	}
	return meta
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
	ext := strings.ToLower(filepath.Ext(path))
	if ext == ".json" || ext == ".xml" {
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

// jsonMarshalImpl is the actual JSON marshaling implementation.
func jsonMarshalImpl(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}
