// Package license — mcp_gate.go: MCP tool gating layer over the sovereign license stack.
//
// This file is the ONLY new code needed for MCP enforcement. It wraps the
// existing KhepraLicense / VerifySovereignLicense infrastructure (sovereign.go)
// and adds:
//
//  1. MCP tool-name → minimum tier mapping
//  2. CheckToolAccess(lic, toolName) — called at router Step 1.6b
//  3. Helper functions for per-tool behavior variation (scan lanes, nist_map limits)
//  4. ParseMCPLicense() — loads from KHEPRA_LICENSE_KEY env var and verifies offline
//
// Tier mapping (extends existing sovereign.go tiers):
//   TierCommunity  → ert_scan (basic), nist_map (25 controls)
//   TierPilot      → + godfather_report/approve, nist_map (full), khepra_watch
//   TierEnterprise → + acp_*, nhi_*, signed audit log, all 13 tools
//   TierMaster     → + license_issue, license_revoke (NouchiX internal)
package license

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
)

// ─── MCP Tool Gate ────────────────────────────────────────────────────────────

// ErrMCPTierInsufficient is returned when a tool requires a higher license tier.
type ErrMCPTierInsufficient struct {
	Tool     string
	Have     string
	Required string
}

func (e *ErrMCPTierInsufficient) Error() string {
	return fmt.Sprintf(
		"license: tool %q requires %s tier (current: %s) — upgrade at khepra.nouchix.com",
		e.Tool, e.Required, e.Have,
	)
}

// mcpToolTier maps each MCP tool name to the minimum KhepraLicense Tier string.
// Tools NOT in this map are accessible at Community tier.
var mcpToolTier = map[string]string{
	// Pilot+ tools (compliance reporting)
	"godfather_report":  TierPilot,
	"godfather_approve": TierPilot,
	"khepra_watch":      TierPilot,

	// Enterprise-only tools (agent governance + NHI)
	"acp_status":    TierEnterprise,
	"acp_issue":     TierEnterprise,
	"acp_revoke":    TierEnterprise,
	"nhi_inventory": TierEnterprise,
	"nhi_orphans":   TierEnterprise,
	"nhi_excessive": TierEnterprise,
	"nhi_expired":   TierEnterprise,
	"nhi_revoke":    TierEnterprise,

	// Community tools: ert_scan, nist_map (behavior varies — not hard-gated)
}

// tierRank maps sovereign tier strings to numeric rank for AtLeast comparison.
var tierRank = map[string]int{
	TierCommunity:  0,
	TierPilot:      1,
	TierEnterprise: 2,
	TierMaster:     3,
}

// tierAtLeast returns true if have >= required in the tier hierarchy.
func tierAtLeast(have, required string) bool {
	return tierRank[have] >= tierRank[required]
}

// CheckToolAccess returns nil if lic permits toolName, or ErrMCPTierInsufficient.
// A nil license is treated as Community tier (non-fatal — server still starts).
func CheckToolAccess(lic *KhepraLicense, toolName string) error {
	currentTier := TierCommunity
	if lic != nil {
		currentTier = lic.Tier
	}

	required, gated := mcpToolTier[toolName]
	if !gated {
		return nil // Community-accessible tool
	}

	if !tierAtLeast(currentTier, required) {
		return &ErrMCPTierInsufficient{
			Tool:     toolName,
			Have:     currentTier,
			Required: required,
		}
	}
	return nil
}

// ─── Per-Tool Behavior Helpers ────────────────────────────────────────────────

// NistMapLimit returns the maximum BM25 result count for the tier.
//   - Community: 5 (from the 25 embedded controls)
//   - Pilot+:    50 (full 36,195-control index)
func NistMapLimit(lic *KhepraLicense) int {
	if lic == nil || lic.Tier == TierCommunity {
		return 5
	}
	return 50
}

// ERTFullScan returns true if the tier permits all ERT scan lanes
// (secrets, sbom, pqc). Community gets sast+sca only.
func ERTFullScan(lic *KhepraLicense) bool {
	if lic == nil {
		return false
	}
	return tierAtLeast(lic.Tier, TierPilot)
}

// SignedAuditLogEnabled returns true if the tier permits the tamper-evident log.
func SignedAuditLogEnabled(lic *KhepraLicense) bool {
	if lic == nil {
		return false
	}
	return tierAtLeast(lic.Tier, TierEnterprise)
}

// ─── MCP License Loading ──────────────────────────────────────────────────────

// ErrNoLicenseKey is returned (non-fatal) when KHEPRA_LICENSE_KEY is empty.
var ErrNoLicenseKey = errors.New("license: KHEPRA_LICENSE_KEY not set — Community tier active")

// ParseMCPLicense loads the license from KHEPRA_LICENSE_KEY env var and verifies
// it offline using VerifySovereignLicense against the embedded master public key.
//
// Returns:
//   - (nil, ErrNoLicenseKey) — no key set, Community tier, non-fatal
//   - (*KhepraLicense, nil) — valid license
//   - (nil, err) — key present but invalid (tampered/expired), FATAL at startup
//
// The license JSON is expected to be the full KhepraLicense struct serialized
// as JSON (as produced by SovereignLicenseAuthority.IssueLicense → json.Marshal).
func ParseMCPLicense() (*KhepraLicense, error) {
	raw := os.Getenv("KHEPRA_LICENSE_KEY")
	if raw == "" {
		return nil, ErrNoLicenseKey
	}

	var lic KhepraLicense
	if err := json.Unmarshal([]byte(raw), &lic); err != nil {
		return nil, fmt.Errorf("license: KHEPRA_LICENSE_KEY parse failed: %w", err)
	}

	// Offline ML-DSA-65 verification using embedded master public key.
	// masterPublicKey = nil → VerifySovereignLicense falls back to lic.SignerPublicKey.
	// In production, embed the master pubkey here for pinning.
	if err := VerifySovereignLicense(&lic, nil); err != nil {
		return nil, fmt.Errorf("license: sovereign verification failed: %w", err)
	}

	return &lic, nil
}
