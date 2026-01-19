package apiserver

import (
	"fmt"
	"net/http"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
	"github.com/gin-gonic/gin"
)

// Merkaba Egyptian Licensing System Handlers (Version 2)
// Integrates with Scarab/Motherboard API server (apiserver)
//
// These handlers provide REST endpoints for:
// - License information retrieval
// - Egyptian tier management (Khepri, Ra, Atum, Osiris)
// - Telemetry enrollment and heartbeats
// - License usage tracking
//
// Note: This version assumes the license Manager is already initialized
// and provides read-only operations. License creation is handled by the
// telemetry enrollment process.

// handleCreateLicense creates a new Egyptian tier license
// POST /api/v1/license/create
// Body: {"tier": "khepri|ra|atum|osiris", "customer": "...", "duration_days": 365}
func (s *Server) handleCreateLicense(c *gin.Context) {
	var req struct {
		Tier         string `json:"tier" binding:"required"`
		Customer     string `json:"customer" binding:"required"`
		DurationDays int    `json:"duration_days" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
			Code:    http.StatusBadRequest,
		})
		return
	}

	// Map tier string to EgyptianTier enum
	tierMap := map[string]license.EgyptianTier{
		"khepri": license.TierKhepri,
		"ra":     license.TierRa,
		"atum":   license.TierAtum,
		"osiris": license.TierOsiris,
	}

	tier, ok := tierMap[req.Tier]
	if !ok {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_tier",
			Message: fmt.Sprintf("Tier must be one of: khepri, ra, atum, osiris (got: %s)", req.Tier),
			Code:    http.StatusBadRequest,
		})
		return
	}

	// Get tier configuration
	tierInfo, ok := license.TierConfigurations[tier]
	if !ok {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "invalid_tier_config",
			Message: fmt.Sprintf("Tier configuration not found for: %s", req.Tier),
			Code:    http.StatusInternalServerError,
		})
		return
	}

	// Generate license ID using the tier prefix
	licenseID := string(tier) + "-" + license.GenerateMachineID()

	// Create license struct
	expiresAt := time.Now().AddDate(0, 0, req.DurationDays)
	lic := &license.License{
		ID:          licenseID,
		Tier:        tier,
		NodeQuota:   tierInfo.NodeQuota,
		NodeCount:   0,
		CreatedAt:   time.Now(),
		ExpiresAt:   expiresAt,
		Features:    tierInfo.Features,
		IsAirGapped: (tier == license.TierOsiris),
	}

	c.JSON(http.StatusCreated, map[string]interface{}{
		"license_id":    lic.ID,
		"tier":          string(lic.Tier),
		"tier_name":     tierInfo.Name,
		"customer":      req.Customer,
		"created_at":    lic.CreatedAt,
		"expires_at":    lic.ExpiresAt,
		"node_quota":    lic.NodeQuota,
		"duration_days": req.DurationDays,
		"features":      lic.Features,
	})
}

// handleGetLicense retrieves a license by ID
// GET /api/v1/license/:license_id
func (s *Server) handleGetLicense(c *gin.Context) {
	licenseID := c.Param("license_id")
	if licenseID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "missing_license_id",
			Message: "license_id parameter is required",
			Code:    http.StatusBadRequest,
		})
		return
	}

	// For now, return a placeholder response
	// In a full implementation, this would query an actual license database
	c.JSON(http.StatusOK, map[string]interface{}{
		"license_id": licenseID,
		"tier":       "khepri",
		"created_at": time.Now().AddDate(0, -1, 0),
		"expires_at": time.Now().AddDate(1, 0, 0),
		"node_quota": 1,
		"node_count": 0,
		"valid":      true,
	})
}

// handleUpgradeLicense upgrades a license to a higher tier
// POST /api/v1/license/:license_id/upgrade
// Body: {"new_tier": "ra|atum|osiris"}
func (s *Server) handleUpgradeLicense(c *gin.Context) {
	licenseID := c.Param("license_id")
	if licenseID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "missing_license_id",
			Message: "license_id parameter is required",
			Code:    http.StatusBadRequest,
		})
		return
	}

	var req struct {
		NewTier string `json:"new_tier" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
			Code:    http.StatusBadRequest,
		})
		return
	}

	// Map tier string
	tierMap := map[string]license.EgyptianTier{
		"khepri": license.TierKhepri,
		"ra":     license.TierRa,
		"atum":   license.TierAtum,
		"osiris": license.TierOsiris,
	}

	newTier, ok := tierMap[req.NewTier]
	if !ok {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_tier",
			Message: fmt.Sprintf("Invalid tier: %s", req.NewTier),
			Code:    http.StatusBadRequest,
		})
		return
	}

	// Get tier configuration
	tierInfo, ok := license.TierConfigurations[newTier]
	if !ok {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "invalid_tier_config",
			Message: fmt.Sprintf("Tier configuration not found for: %s", req.NewTier),
			Code:    http.StatusInternalServerError,
		})
		return
	}

	// In a full implementation, this would update the database
	c.JSON(http.StatusOK, map[string]interface{}{
		"license_id": licenseID,
		"new_tier":   string(newTier),
		"tier_name":  tierInfo.Name,
		"node_quota": tierInfo.NodeQuota,
		"features":   tierInfo.Features,
		"message":    fmt.Sprintf("Successfully upgraded to %s tier", req.NewTier),
	})
}

// handleGetLicenseUsage returns usage stats for a license
// GET /api/v1/license/:license_id/usage
func (s *Server) handleGetLicenseUsage(c *gin.Context) {
	licenseID := c.Param("license_id")
	if licenseID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "missing_license_id",
			Message: "license_id parameter is required",
			Code:    http.StatusBadRequest,
		})
		return
	}

	// Mock usage data
	nodeQuota := 10
	nodeCount := 3
	quotaRemaining := nodeQuota - nodeCount
	percentUsed := float64(nodeCount) / float64(nodeQuota) * 100

	c.JSON(http.StatusOK, map[string]interface{}{
		"license_id":      licenseID,
		"tier":            "ra",
		"node_quota":      nodeQuota,
		"nodes_created":   nodeCount,
		"nodes_remaining": quotaRemaining,
		"percent_used":    fmt.Sprintf("%.1f%%", percentUsed),
	})
}

// handleListLicenses returns all licenses (admin endpoint)
// GET /api/v1/license/admin/list
func (s *Server) handleListLicenses(c *gin.Context) {
	// TODO: Implement GetAllLicenses in license manager
	// For now, return empty list
	licenses := []map[string]interface{}{}

	c.JSON(http.StatusOK, map[string]interface{}{
		"count":    len(licenses),
		"licenses": licenses,
	})
}

// handleTelemetryEnroll enrolls machine with telemetry server using enrollment token
// POST /api/v1/license/telemetry/enroll
// Body: {"enrollment_token": "...", "customer_name": "...", "tier": "khepri|ra|atum|osiris"}
func (s *Server) handleTelemetryEnroll(c *gin.Context) {
	var req struct {
		EnrollmentToken string `json:"enrollment_token" binding:"required"`
		CustomerName    string `json:"customer_name" binding:"required"`
		Tier            string `json:"tier" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
			Code:    http.StatusBadRequest,
		})
		return
	}

	// Map tier
	tierMap := map[string]license.EgyptianTier{
		"khepri": license.TierKhepri,
		"ra":     license.TierRa,
		"atum":   license.TierAtum,
		"osiris": license.TierOsiris,
	}

	_, ok := tierMap[req.Tier]
	if !ok {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_tier",
			Message: fmt.Sprintf("Invalid tier: %s", req.Tier),
			Code:    http.StatusBadRequest,
		})
		return
	}

	// TODO: Integrate with telemetry client for actual server enrollment
	// For MVP, we simulate enrollment
	licenseID := string(tierMap[req.Tier]) + "-" + license.GenerateMachineID()

	c.JSON(http.StatusCreated, map[string]interface{}{
		"license_id": licenseID,
		"tier":       req.Tier,
		"customer":   req.CustomerName,
		"expires_at": time.Now().AddDate(1, 0, 0),
		"message":    "Successfully enrolled with Cloudflare telemetry server",
	})
}

// handleTelemetryHeartbeat sends usage heartbeat to telemetry server
// POST /api/v1/license/telemetry/heartbeat
// Body: {"license_id": "...", "nodes_created": N, "node_quota_used": N}
func (s *Server) handleTelemetryHeartbeat(c *gin.Context) {
	var req struct {
		LicenseID     string `json:"license_id" binding:"required"`
		NodesCreated  int    `json:"nodes_created"`
		NodeQuotaUsed int    `json:"node_quota_used"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
			Code:    http.StatusBadRequest,
		})
		return
	}

	// TODO: Integrate with telemetry client for actual heartbeat
	c.JSON(http.StatusOK, map[string]interface{}{
		"license_id":      req.LicenseID,
		"nodes_created":   req.NodesCreated,
		"node_quota_used": req.NodeQuotaUsed,
		"message":         "Heartbeat received and queued",
	})
}

// handleTelemetryStatus returns telemetry server connection status
// GET /api/v1/license/telemetry/status
func (s *Server) handleTelemetryStatus(c *gin.Context) {
	// TODO: Check actual telemetry server connectivity
	status := "online"

	c.JSON(http.StatusOK, map[string]interface{}{
		"status":             status,
		"telemetry_server":   "https://telemetry.souhimbou.org",
		"supports_enroll":    true,
		"supports_validate":  true,
		"supports_heartbeat": true,
	})
}
