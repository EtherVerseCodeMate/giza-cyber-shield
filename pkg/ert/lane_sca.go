package ert

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/sca"
)

// ──────────────────────────────────────────────────────────────────────────────
// SCA Lane — wraps the sovereign Syft → Grype → Enricher pipeline
// ──────────────────────────────────────────────────────────────────────────────

// SCALane wraps the sovereign SCA pipeline (Syft → Grype → Enricher)
// as a LaneRunner for the ScanOrchestrator.
type SCALane struct {
	syft     *sca.SyftAdapter
	grype    *sca.GrypeAdapter
	enricher *sca.Enricher
}

// NewSCALane creates a new SCA lane with configured adapters.
// If any adapter is nil, the lane will return an error on Run().
func NewSCALane(syft *sca.SyftAdapter, grype *sca.GrypeAdapter, enricher *sca.Enricher) *SCALane {
	return &SCALane{
		syft:     syft,
		grype:    grype,
		enricher: enricher,
	}
}

// Name returns the lane identifier.
func (l *SCALane) Name() ScanLane {
	return LaneSCA
}

// Run executes the full SCA pipeline: SBOM → Vulnerability Match → Enrichment.
// The resulting sca.EnrichedFindings are wrapped as UnifiedFindings.
func (l *SCALane) Run(ctx context.Context, req ScanRequest) ([]UnifiedFinding, error) {
	if l.syft == nil || l.grype == nil {
		return nil, fmt.Errorf("sca lane: syft and grype adapters required")
	}

	target := req.TargetPath
	if target == "" {
		target = req.ImageRef
	}

	log.Printf("[SCA-LANE] Starting SCA pipeline for: %s", target)

	// Step 1: Generate SBOM via Syft
	sbom, err := l.syft.GenerateSBOM(ctx, target)
	if err != nil {
		return nil, fmt.Errorf("syft sbom generation failed: %w", err)
	}

	log.Printf("[SCA-LANE] SBOM generated: %d packages", sbom.Source.ID)

	// Step 2: Vulnerability matching via Grype
	matches, err := l.grype.MatchVulnerabilities(ctx, sbom)
	if err != nil {
		return nil, fmt.Errorf("grype vulnerability matching failed: %w", err)
	}

	log.Printf("[SCA-LANE] Grype matched %d vulnerabilities", len(matches))

	// Step 3: Enrich with EPSS/KEV/CVSS if enricher is available
	var enrichedFindings []sca.EnrichedFinding
	if l.enricher != nil {
		enrichedFindings, err = l.enricher.Enrich(ctx, matches)
		if err != nil {
			log.Printf("[SCA-LANE] WARN: Enrichment failed, using raw matches: %v", err)
			enrichedFindings = matches // Fall back to unenriched
		}
	} else {
		enrichedFindings = matches
	}

	// Step 4: Convert to UnifiedFindings
	unified := make([]UnifiedFinding, 0, len(enrichedFindings))
	for _, ef := range enrichedFindings {
		unified = append(unified, scaToUnified(ef))
	}

	log.Printf("[SCA-LANE] Pipeline complete: %d unified findings", len(unified))
	return unified, nil
}

// scaToUnified converts an sca.EnrichedFinding to a UnifiedFinding.
// This preserves the full EnrichedFinding in the Raw field for later
// EA conversion without data loss.
func scaToUnified(ef sca.EnrichedFinding) UnifiedFinding {
	return UnifiedFinding{
		ID:       fmt.Sprintf("sca:%s:%s:%s", ef.Component, ef.Version, ef.CVEID),
		Source:   "sca",
		Category: CategorySCA,

		Severity:    ef.Severity,
		Title:       fmt.Sprintf("%s in %s@%s", ef.CVEID, ef.Component, ef.Version),
		Description: fmt.Sprintf("CVSSv3: %.1f | EPSS: %.4f | KEV: %v", ef.CVSSv3Score, ef.EPSSScore, ef.InCISAKEV),

		Asset:    ef.Component,
		Location: ef.PackageURL,

		CVEID:     ef.CVEID,
		CVSSv3:    ef.CVSSv3Score,
		FixedIn:   "", // EnrichedFinding doesn't carry FixedIn directly
		EPSSScore: ef.EPSSScore,
		InCISAKEV: ef.InCISAKEV,

		Evidence: map[string]interface{}{
			"ecosystem":        ef.Ecosystem,
			"cvss_vector":      ef.CVSSv3Vector,
			"sources":          ef.Sources,
			"nist_53_controls": ef.NIST53Controls,
			"nist_171_controls": ef.NIST171Controls,
			"stig_findings":    ef.STIGFindings,
		},

		Timestamp: ef.DetectedAt,
		Raw:       ef, // Preserve for EA boundary conversion
	}
}
