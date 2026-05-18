package sca

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// ──────────────────────────────────────────────────────────────────────────────
// CycloneDX Types (minimal — expanded as needed by downstream consumers)
// ──────────────────────────────────────────────────────────────────────────────

// CycloneDXBOM represents the subset of a CycloneDX JSON SBOM we need.
type CycloneDXBOM struct {
	BOMFormat   string        `json:"bomFormat"`
	SpecVersion string        `json:"specVersion"`
	Version     int           `json:"version"`
	Metadata    CDXMetadata   `json:"metadata,omitempty"`
	Components  []CDXComponent `json:"components"`
}

// CDXMetadata holds SBOM metadata including the generating tool.
type CDXMetadata struct {
	Timestamp string   `json:"timestamp,omitempty"`
	Tools     CDXTools `json:"tools,omitempty"`
}

// CDXTools wraps the tools block in CycloneDX 1.5+ format.
type CDXTools struct {
	Components []CDXToolComponent `json:"components,omitempty"`
}

// CDXToolComponent identifies a tool (e.g. Syft) and its version.
type CDXToolComponent struct {
	Type    string `json:"type,omitempty"`
	Name    string `json:"name"`
	Version string `json:"version"`
}

// CDXComponent represents a software component in the CycloneDX SBOM.
type CDXComponent struct {
	Type       string       `json:"type"`
	Name       string       `json:"name"`
	Version    string       `json:"version"`
	PURL       string       `json:"purl,omitempty"`
	CPE        string       `json:"cpe,omitempty"`
	BOMRef     string       `json:"bom-ref,omitempty"`
	Licenses   []CDXLicense `json:"licenses,omitempty"`
	Properties []CDXProp    `json:"properties,omitempty"`
}

// CDXLicense represents a license entry.
type CDXLicense struct {
	License struct {
		ID   string `json:"id,omitempty"`
		Name string `json:"name,omitempty"`
	} `json:"license,omitempty"`
}

// CDXProp represents a key-value property.
type CDXProp struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// ──────────────────────────────────────────────────────────────────────────────
// SyftAdapter
// ──────────────────────────────────────────────────────────────────────────────

// SyftAdapter generates SBOMs by shelling out to the Syft binary.
// Follows AD-002: shell out to Syft for independent upgradeability.
type SyftAdapter struct {
	// Timeout for syft execution. Default: 120s.
	Timeout time.Duration

	// cache stores checksums of lockfiles to avoid redundant SBOM generation.
	cache   map[string]cachedBOM
	cacheMu sync.RWMutex
}

type cachedBOM struct {
	checksum string
	bom      *CycloneDXBOM
	meta     *ScannerMetadata
}

// Known lockfile names per ecosystem — used for cache invalidation.
var lockfileNames = []string{
	"go.sum",               // Go
	"package-lock.json",    // Node.js (npm)
	"yarn.lock",            // Node.js (yarn)
	"pnpm-lock.yaml",       // Node.js (pnpm)
	"Pipfile.lock",         // Python (pipenv)
	"poetry.lock",          // Python (poetry)
	"requirements.txt",     // Python (pip)
	"Cargo.lock",           // Rust
	"Gemfile.lock",         // Ruby
	"composer.lock",        // PHP
	"pom.xml",              // Java (Maven)
	"build.gradle.kts",     // Java (Gradle)
	"gradle.lockfile",      // Java (Gradle)
}

// NewSyftAdapter creates a SyftAdapter with production defaults.
func NewSyftAdapter() *SyftAdapter {
	return &SyftAdapter{
		Timeout: 120 * time.Second,
		cache:   make(map[string]cachedBOM),
	}
}

// GenerateSBOM runs Syft against projectPath and returns a parsed CycloneDX BOM
// plus the scanner metadata for audit reproducibility.
//
// It uses `syft <path> -o cyclonedx-json --quiet` per AD-001 and AD-002.
func (a *SyftAdapter) GenerateSBOM(ctx context.Context, projectPath string) (*CycloneDXBOM, *ScannerMetadata, error) {
	if projectPath == "" {
		return nil, nil, fmt.Errorf("sca/syft: projectPath is required")
	}

	absPath, err := filepath.Abs(projectPath)
	if err != nil {
		return nil, nil, fmt.Errorf("sca/syft: cannot resolve path: %w", err)
	}

	// Verify path exists
	info, err := os.Stat(absPath)
	if err != nil {
		return nil, nil, fmt.Errorf("sca/syft: path does not exist: %w", err)
	}

	// Build target string (Syft uses dir: prefix for directories)
	target := absPath
	if info.IsDir() {
		target = "dir:" + absPath
	}

	// ── Cache check ────────────────────────────────────────────────────
	checksum := a.computeLockfileChecksum(absPath)
	if checksum != "" {
		a.cacheMu.RLock()
		if cached, ok := a.cache[absPath]; ok && cached.checksum == checksum {
			a.cacheMu.RUnlock()
			return cached.bom, cached.meta, nil
		}
		a.cacheMu.RUnlock()
	}

	// ── Verify syft is installed ───────────────────────────────────────
	if _, err := exec.LookPath("syft"); err != nil {
		return nil, nil, fmt.Errorf("sca/syft: syft binary not found in PATH — install from https://github.com/anchore/syft")
	}

	// ── Execute syft ───────────────────────────────────────────────────
	cmdCtx, cancel := context.WithTimeout(ctx, a.Timeout)
	defer cancel()

	cmd := exec.CommandContext(cmdCtx, "syft",
		target,
		"-o", "cyclonedx-json",
		"--quiet",
	)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		if cmdCtx.Err() == context.DeadlineExceeded {
			return nil, nil, fmt.Errorf("sca/syft: execution timed out after %s", a.Timeout)
		}
		return nil, nil, fmt.Errorf("sca/syft: execution failed: %w\nstderr: %s", err, stderr.String())
	}

	// ── Parse CycloneDX JSON ───────────────────────────────────────────
	var bom CycloneDXBOM
	if err := json.Unmarshal(stdout.Bytes(), &bom); err != nil {
		return nil, nil, fmt.Errorf("sca/syft: failed to parse CycloneDX JSON: %w", err)
	}

	// ── Extract metadata ───────────────────────────────────────────────
	meta := extractSyftMetadata(&bom)

	// ── Update cache ───────────────────────────────────────────────────
	if checksum != "" {
		a.cacheMu.Lock()
		a.cache[absPath] = cachedBOM{
			checksum: checksum,
			bom:      &bom,
			meta:     meta,
		}
		a.cacheMu.Unlock()
	}

	return &bom, meta, nil
}

// InvalidateCache clears the cached SBOM for a given project path.
func (a *SyftAdapter) InvalidateCache(projectPath string) {
	absPath, err := filepath.Abs(projectPath)
	if err != nil {
		return
	}
	a.cacheMu.Lock()
	delete(a.cache, absPath)
	a.cacheMu.Unlock()
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

// extractSyftMetadata pulls the Syft version from the CycloneDX BOM metadata.
func extractSyftMetadata(bom *CycloneDXBOM) *ScannerMetadata {
	meta := &ScannerMetadata{
		ScannedAt: time.Now(),
	}

	// Look for syft in tools.components
	for _, tool := range bom.Metadata.Tools.Components {
		if strings.EqualFold(tool.Name, "syft") {
			meta.SyftVersion = tool.Version
			break
		}
	}

	return meta
}

// computeLockfileChecksum computes a combined SHA-256 of all lockfiles found
// in the project directory. Returns empty string if none found (no caching).
func (a *SyftAdapter) computeLockfileChecksum(projectDir string) string {
	h := sha256.New()
	found := false

	for _, name := range lockfileNames {
		path := filepath.Join(projectDir, name)
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		h.Write([]byte(name))
		h.Write(data)
		found = true
	}

	if !found {
		return ""
	}
	return hex.EncodeToString(h.Sum(nil))
}
