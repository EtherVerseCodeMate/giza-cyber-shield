//go:build saas

// Package apiserver — license_gate.go
//
// Provides Gin middleware and inline guard helpers for license-tier gating.
// Uses license.Global from pkg/license (set by ValidateFromEnv at startup).
//
// Usage at route registration (preferred — zero handler changes):
//
//	pilot := r.Group("/api/v1/autopilot", s.RequireFeatureMiddleware(license.FeatureCMMCAutopilot))
//	pilot.POST("/start", s.handleAutopilotStart)
//
// Usage inline (for per-field gating):
//
//	if !s.licenseGate(c, license.FeatureCMMCAutopilot) { return }
package apiserver

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
)

// RequireFeatureMiddleware returns a Gin middleware that halts the request
// with 402 Payment Required if the active license does not include `feature`.
//
// The response body is JSON so clients can display a meaningful upgrade prompt:
//
//	{ "error": "...", "feature": "cmmc_autopilot", "tier": "community",
//	  "upgrade_url": "https://khepra.nouchix.com/billing" }
func (s *Server) RequireFeatureMiddleware(feature string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !license.IsFeatureEnabled(feature) {
			tier := license.GetActiveTier()
			c.AbortWithStatusJSON(http.StatusPaymentRequired, gin.H{
				"error":       "Feature not available on " + license.TierDisplayName(tier) + " tier",
				"feature":     feature,
				"tier":        tier,
				"upgrade_url": "https://khepra.nouchix.com/billing",
			})
			return
		}
		c.Next()
	}
}

// RequireTierMiddleware returns a Gin middleware that halts the request
// with 402 if the active license tier is below `required`.
func (s *Server) RequireTierMiddleware(required string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := license.RequireTier(required); err != nil {
			tier := license.GetActiveTier()
			c.AbortWithStatusJSON(http.StatusPaymentRequired, gin.H{
				"error":       err.Error(),
				"tier":        tier,
				"required":    required,
				"upgrade_url": "https://khepra.nouchix.com/billing",
			})
			return
		}
		c.Next()
	}
}

// licenseGate is an inline guard for use inside handlers.
// Returns true and continues if the feature is available.
// Returns false and writes a 402 JSON response if not — caller must return.
//
// Example:
//
//	if !s.licenseGate(c, license.FeatureCMMCAutopilot) { return }
func (s *Server) licenseGate(c *gin.Context, feature string) bool {
	if license.IsFeatureEnabled(feature) {
		return true
	}
	tier := license.GetActiveTier()
	c.JSON(http.StatusPaymentRequired, gin.H{
		"error":       "Feature '" + feature + "' requires " + license.TierDisplayName(license.TierPilot) + " tier or higher",
		"feature":     feature,
		"tier":        tier,
		"upgrade_url": "https://khepra.nouchix.com/billing",
	})
	return false
}

// licenseGateEnterprise is a shorthand for enterprise-tier gate.
func (s *Server) licenseGateEnterprise(c *gin.Context, feature string) bool {
	if license.IsFeatureEnabled(feature) {
		return true
	}
	tier := license.GetActiveTier()
	c.JSON(http.StatusPaymentRequired, gin.H{
		"error":       "Feature '" + feature + "' requires " + license.TierDisplayName(license.TierEnterprise) + " tier",
		"feature":     feature,
		"tier":        tier,
		"upgrade_url": "https://khepra.nouchix.com/billing?plan=enterprise",
	})
	return false
}
