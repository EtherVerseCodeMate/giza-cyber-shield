// Package license — validator.go
//
// ValidateFromEnv bootstraps the license Manager from environment variables and
// exposes a package-level Global manager for feature gating queries.
//
// Usage (in cmd/apiserver/main.go or any server entrypoint):
//
//	if err := license.ValidateFromEnv(); err != nil {
//	    log.Fatalf("[FATAL] License: %v", err)
//	}
//	defer license.Global.Stop()
//
//	// Feature gate example:
//	if license.Global.HasFeature("cmmc_autopilot") {
//	    enableCMMCRoutes(r)
//	}
//
// Environment variables consumed:
//
//	KHEPRA_TELEMETRY_URL      – License / telemetry server URL (default: https://agent.souhimbou.org)
//	KHEPRA_ENROLLMENT_TOKEN   – Auto-registration enrollment token (optional)
//	KHEPRA_LICENSE_KEY        – Hex-encoded ML-DSA-65 private key (optional; generated if absent)
//	KHEPRA_MASTER_PUBLIC_KEY  – Hex-encoded ML-DSA-65 master public key (required for offline mode)
//	KHEPRA_LICENSE_FILE       – Path to a signed .khepra offline license file (optional)
package license

import (
	"errors"
	"log"
	"os"
	"sync"
)

const (
	defaultTelemetryURL = "https://agent.souhimbou.org"

	// Feature constants — use these in HasFeature() calls throughout the codebase.
	FeatureCMMCAutopilot     = "cmmc_autopilot"
	FeatureSTIGCodex         = "stig_codex"
	FeatureFlightRecorder    = "flight_recorder"
	FeaturePQCAttestation    = "pqc_attestation"
	FeatureDAGViewer         = "dag_viewer"
	FeatureEvidenceEngine    = "evidence_engine"
	FeatureSOARIntegration   = "soar_integration"
	FeatureGovCloudDeploy    = "govcloud_deploy"
	FeatureAuditExport       = "audit_export"
	FeatureMultiOrg          = "multi_org"
	FeatureAdvisoryCheckout  = "advisory_checkout"
	FeatureDiagnosticService = "diagnostic_service"
)

// Note: TierCommunity / TierPilot / TierEnterprise / TierMaster are declared in sovereign.go.

// Global is the package-level license manager, initialized by ValidateFromEnv.
// Access is safe for concurrent reads after ValidateFromEnv returns.
// Before ValidateFromEnv is called, Global is nil — callers should check.
var (
	Global   *Manager
	globalMu sync.RWMutex
)

// ValidateFromEnv bootstraps the license manager from environment variables.
//
// It attempts offline verification first (via ~/.khepra/license.khepra or
// KHEPRA_LICENSE_FILE). If no offline license is found, it contacts the
// telemetry server at KHEPRA_TELEMETRY_URL.
//
// A missing license key is NON-FATAL: the server starts in Community tier.
// A present-but-invalid key IS FATAL: the server must not start.
//
// Returns nil on success (including Community-tier fallback).
// Returns a non-nil error only when a key is present but cryptographically invalid.
func ValidateFromEnv() error {
	url := os.Getenv("KHEPRA_TELEMETRY_URL")
	if url == "" {
		url = defaultTelemetryURL
	}

	mgr, err := NewManager(url)
	if err != nil {
		// Manager constructor failure is non-fatal (PQC key gen issues etc.)
		log.Printf("[LICENSE] Manager init warning: %v — running Community tier", err)
		mgr, _ = NewManager(url) // retry with no key; constructor won't fail here
	}

	// Wire enrollment token for auto-registration
	if token := os.Getenv("KHEPRA_ENROLLMENT_TOKEN"); token != "" {
		mgr.SetEnrollmentToken(token)
	}

	// Initialize: offline → telemetry server → community fallback
	if initErr := mgr.Initialize(); initErr != nil {
		// Determine if this is a community fallback (non-fatal) or key fraud (fatal)
		tier := mgr.GetTier()
		if tier == TierCommunity {
			// Server starts — just no premium features
			log.Printf("[LICENSE] ⚠️  Community tier active: %v", initErr)
		} else {
			// A key was present but verification failed — prevent startup
			return initErr
		}
	}

	setGlobal(mgr)

	tier := mgr.GetTier()
	log.Printf("[LICENSE] ✅ Initialized — tier: %s", TierDisplayName(tier))
	return nil
}

// setGlobal safely replaces the package-level manager.
func setGlobal(mgr *Manager) {
	globalMu.Lock()
	defer globalMu.Unlock()
	Global = mgr
}

// TierDisplayName returns the customer-facing name for an internal tier constant.
func TierDisplayName(tier string) string {
	if name, ok := TierDisplayNames[tier]; ok {
		return name
	}
	return tier
}

// IsFeatureEnabled is a nil-safe shorthand for Global.HasFeature.
// Returns false (Community behavior) if the global manager is not yet initialized.
func IsFeatureEnabled(feature string) bool {
	globalMu.RLock()
	defer globalMu.RUnlock()
	if Global == nil {
		return false
	}
	return Global.HasFeature(feature)
}

// GetActiveTier is a nil-safe shorthand for Global.GetTier.
// Returns TierCommunity if the global manager is not yet initialized.
func GetActiveTier() string {
	globalMu.RLock()
	defer globalMu.RUnlock()
	if Global == nil {
		return TierCommunity
	}
	return Global.GetTier()
}

// RequireFeature returns an error if the feature is not available in the active tier.
// Use this to gate HTTP handlers or RPC methods.
//
// Example:
//
//	if err := license.RequireFeature(license.FeatureCMMCAutopilot); err != nil {
//	    http.Error(w, err.Error(), http.StatusPaymentRequired)
//	    return
//	}
func RequireFeature(feature string) error {
	if !IsFeatureEnabled(feature) {
		tier := GetActiveTier()
		return errors.New(
			"license: feature \"" + feature + "\" not available on " +
				TierDisplayName(tier) + " tier — upgrade at khepra.nouchix.com",
		)
	}
	return nil
}

// RequireTier returns an error if the active tier is below the required tier.
func RequireTier(required string) error {
	have := GetActiveTier()
	if tierRank[have] < tierRank[required] {
		return errors.New(
			"license: requires " + TierDisplayName(required) +
				" tier (current: " + TierDisplayName(have) +
				") — upgrade at khepra.nouchix.com",
		)
	}
	return nil
}
