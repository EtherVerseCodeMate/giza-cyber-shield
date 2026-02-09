package apiserver

import (
	"fmt"
	"net/http"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	msgLicenseIDRequired = "license_id parameter is required"
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

	// Generate license ID (e.g. atum-machineid)
	licenseID := string(tier) + "-" + uuid.New().String()[:8]

	// Create real license via manager
	lic, err := s.licMgr.CreateLicense(licenseID, tier, req.DurationDays)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "license_creation_failed",
			Message: err.Error(),
			Code:    http.StatusInternalServerError,
		})
		return
	}

	c.JSON(http.StatusCreated, lic)
}

// handleGetLicense retrieves a license by ID
// GET /api/v1/license/:license_id
func (s *Server) handleGetLicense(c *gin.Context) {
	licenseID := c.Param("license_id")
	if licenseID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "missing_license_id",
			Message: msgLicenseIDRequired,
			Code:    http.StatusBadRequest,
		})
		return
	}

	lic, err := s.licMgr.GetLicense(licenseID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "license_not_found",
			Message: err.Error(),
			Code:    http.StatusNotFound,
		})
		return
	}

	c.JSON(http.StatusOK, lic)
}

// handleUpgradeLicense upgrades a license to a higher tier
// POST /api/v1/license/:license_id/upgrade
// Body: {"new_tier": "ra|atum|osiris"}
func (s *Server) handleUpgradeLicense(c *gin.Context) {
	licenseID := c.Param("license_id")
	if licenseID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "missing_license_id",
			Message: msgLicenseIDRequired,
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

	// Perform upgrade via manager
	err := s.licMgr.UpgradeLicense(licenseID, newTier)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "upgrade_failed",
			Message: err.Error(),
			Code:    http.StatusInternalServerError,
		})
		return
	}

	// Return updated license
	lic, _ := s.licMgr.GetLicense(licenseID)
	c.JSON(http.StatusOK, lic)
}

// handleGetLicenseUsage returns usage stats for a license
// GET /api/v1/license/:license_id/usage
func (s *Server) handleGetLicenseUsage(c *gin.Context) {
	licenseID := c.Param("license_id")
	if licenseID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "missing_license_id",
			Message: msgLicenseIDRequired,
			Code:    http.StatusBadRequest,
		})
		return
	}

	lic, err := s.licMgr.GetLicense(licenseID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "license_not_found",
			Message: err.Error(),
			Code:    http.StatusNotFound,
		})
		return
	}

	c.JSON(http.StatusOK, map[string]interface{}{
		"license_id":      lic.ID,
		"tier":            lic.Tier,
		"node_quota":      lic.NodeQuota,
		"nodes_created":   lic.NodeCount,
		"nodes_remaining": lic.NodeQuota - lic.NodeCount,
		"percent_used":    fmt.Sprintf("%.1f%%", float64(lic.NodeCount)/float64(lic.NodeQuota)*100),
		"expires_at":      lic.ExpiresAt,
	})
}

// handleListLicenses returns all licenses (admin endpoint)
// GET /api/v1/license/admin/list
func (s *Server) handleListLicenses(c *gin.Context) {
	licenses := s.licMgr.GetAllLicenses()

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

	resp, err := s.licMgr.Register(req.EnrollmentToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "enrollment_failed",
			Message: err.Error(),
			Code:    http.StatusInternalServerError,
		})
		return
	}

	c.JSON(http.StatusOK, resp)
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

	resp, err := s.licMgr.Heartbeat()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "heartbeat_failed",
			Message: err.Error(),
			Code:    http.StatusInternalServerError,
		})
		return
	}

	c.JSON(http.StatusOK, resp)
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
