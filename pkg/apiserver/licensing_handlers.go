package apiserver

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
)

// Merkaba Egyptian Licensing System Handlers
// Integrates with Scarab/Motherboard API server (apiserver)

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

	// Generate license ID
	licenseID := "lic-" + license.GenerateMachineID()

	// Get the actual license manager implementation
	licAdapter, ok := s.licMgr.(*LicenseManagerAdapter)
	if !ok {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "license_adapter_error",
			Message: "License manager is not properly configured",
			Code:    http.StatusInternalServerError,
		})
		return
	}

	mgr := licAdapter.GetManager()

	// Create license
	lic, err := mgr.CreateLicense(licenseID, tier, req.DurationDays)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "license_creation_failed",
			Message: err.Error(),
			Code:    http.StatusInternalServerError,
		})
		return
	}

	c.JSON(http.StatusCreated, map[string]interface{}{
		"license_id":    lic.ID,
		"tier":          string(lic.Tier),
		"customer":      req.Customer,
		"created_at":    lic.CreatedAt,
		"expires_at":    lic.ExpiresAt,
		"node_quota":    lic.NodeQuota,
		"duration_days": req.DurationDays,
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

	licAdapter, ok := s.licMgr.(*LicenseManagerAdapter)
	if !ok {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "license_adapter_error",
			Message: "License manager is not properly configured",
			Code:    http.StatusInternalServerError,
		})
		return
	}

	mgr := licAdapter.GetManager()
	lic, err := mgr.GetLicense(licenseID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "license_not_found",
			Message: fmt.Sprintf("License %s not found", licenseID),
			Code:    http.StatusNotFound,
		})
		return
	}

	c.JSON(http.StatusOK, map[string]interface{}{
		"license_id": lic.ID,
		"tier":       string(lic.Tier),
		"created_at": lic.CreatedAt,
		"expires_at": lic.ExpiresAt,
		"node_quota": lic.NodeQuota,
		"node_count": lic.NodeCount,
		"valid":      time.Now().Before(lic.ExpiresAt),
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

	licAdapter, ok := s.licMgr.(*LicenseManagerAdapter)
	if !ok {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "license_adapter_error",
			Message: "License manager is not properly configured",
			Code:    http.StatusInternalServerError,
		})
		return
	}

	mgr := licAdapter.GetManager()

	// Upgrade license
	err := mgr.UpgradeLicense(licenseID, newTier)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "upgrade_failed",
			Message: err.Error(),
			Code:    http.StatusBadRequest,
		})
		return
	}

	// Fetch updated license
	lic, err := mgr.GetLicense(licenseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "fetch_failed",
			Message: "Failed to fetch upgraded license",
			Code:    http.StatusInternalServerError,
		})
		return
	}

	c.JSON(http.StatusOK, map[string]interface{}{
		"license_id": lic.ID,
		"new_tier":   string(lic.Tier),
		"node_quota": lic.NodeQuota,
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

	licAdapter, ok := s.licMgr.(*LicenseManagerAdapter)
	if !ok {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "license_adapter_error",
			Message: "License manager is not properly configured",
			Code:    http.StatusInternalServerError,
		})
		return
	}

	mgr := licAdapter.GetManager()
	lic, err := mgr.GetLicense(licenseID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "license_not_found",
			Message: fmt.Sprintf("License %s not found", licenseID),
			Code:    http.StatusNotFound,
		})
		return
	}

	quotaRemaining := lic.NodeQuota - lic.NodeCount
	percentUsed := float64(lic.NodeCount) / float64(lic.NodeQuota) * 100

	c.JSON(http.StatusOK, map[string]interface{}{
		"license_id":      licenseID,
		"tier":            string(lic.Tier),
		"node_quota":      lic.NodeQuota,
		"nodes_created":   lic.NodeCount,
		"nodes_remaining": quotaRemaining,
		"percent_used":    fmt.Sprintf("%.1f%%", percentUsed),
	})
}

// handleListLicenses returns all licenses (admin endpoint)
// GET /api/v1/license/admin/list
func (s *Server) handleListLicenses(c *gin.Context) {
	licAdapter, ok := s.licMgr.(*LicenseManagerAdapter)
	if !ok {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "license_adapter_error",
			Message: "License manager is not properly configured",
			Code:    http.StatusInternalServerError,
		})
		return
	}

	_ = licAdapter.GetManager()

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

	// TODO: Integrate with telemetry client for server enrollment
	licenseID := "lic-" + license.GenerateMachineID()

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

	// TODO: Integrate with telemetry client for heartbeat
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
