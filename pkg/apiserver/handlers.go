package apiserver

import (
	"fmt"
	"net/http"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/stig"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// handleHealth returns the health status of the API server
func (s *Server) handleHealth(c *gin.Context) {
	uptime := time.Since(s.startTime).Seconds()

	dagNodeCount := 0
	if s.dagStore != nil {
		dagNodeCount = s.dagStore.NodeCount()
	}

	licenseStatus := "unknown"
	if s.licMgr != nil {
		if valid, _ := s.licMgr.IsValid(); valid {
			licenseStatus = "valid"
		} else {
			licenseStatus = "invalid"
		}
	}

	components := map[string]string{
		"dag_store":       "healthy",
		"license_manager": "healthy",
		"websocket_hub":   "healthy",
	}

	response := HealthResponse{
		Status:     "healthy",
		Version:    s.version,
		Uptime:     uptime,
		DAGNodes:   dagNodeCount,
		License:    licenseStatus,
		Components: components,
		Timestamp:  time.Now(),
	}

	c.JSON(http.StatusOK, response)
}

// handleTriggerScan triggers a new security scan
func (s *Server) handleTriggerScan(c *gin.Context) {
	var req ScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
			Code:    http.StatusBadRequest,
		})
		return
	}

	// Generate scan ID
	scanID := uuid.New().String()
	queuedAt := time.Now()
	estimatedCompletion := queuedAt.Add(5 * time.Minute)

	// TODO: Integrate with actual scan engine
	// For now, just return queued response

	response := ScanResponse{
		ScanID:       scanID,
		Status:       "queued",
		TargetURL:    req.TargetURL,
		ScanType:     req.ScanType,
		QueuedAt:     queuedAt,
		EstimatedAt:  estimatedCompletion,
		WebSocketURL: fmt.Sprintf("wss://%s/ws/scans", c.Request.Host),
	}

	// Broadcast scan queued event via WebSocket
	if s.wsHub != nil {
		s.wsHub.BroadcastScanUpdate(map[string]interface{}{
			"scan_id":    scanID,
			"status":     "queued",
			"target_url": req.TargetURL,
			"scan_type":  req.ScanType,
			"queued_at":  queuedAt,
		})
	}

	c.JSON(http.StatusAccepted, response)
}

// handleGetScanStatus returns the status of a specific scan
func (s *Server) handleGetScanStatus(c *gin.Context) {
	scanID := c.Param("id")

	// TODO: Integrate with actual scan storage
	// For now, return mock data
	response := ScanStatus{
		ScanID:   scanID,
		Status:   "completed",
		Progress: 1.0,
		Results: map[string]interface{}{
			"vulnerabilities_found": 3,
			"crypto_issues":         1,
			"stig_violations":       2,
		},
	}

	c.JSON(http.StatusOK, response)
}

// handleGetDAGNodes returns all DAG nodes or filtered nodes
func (s *Server) handleGetDAGNodes(c *gin.Context) {
	if s.dagStore == nil {
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:   "dag_unavailable",
			Message: "DAG store not initialized",
			Code:    http.StatusServiceUnavailable,
		})
		return
	}

	nodes := s.dagStore.All()

	response := DAGGraphResponse{
		Nodes:       nodes,
		TotalNodes:  len(nodes),
		LastUpdated: time.Now(),
	}

	if len(nodes) > 0 {
		response.LatestNode = nodes[len(nodes)-1].NodeID
		// Assume first nodes are roots for this MVP
		response.RootNodes = []string{nodes[0].NodeID}
	}

	c.JSON(http.StatusOK, response)
}

// handleSTIGValidation performs STIG compliance validation
func (s *Server) handleSTIGValidation(c *gin.Context) {
	var req STIGValidationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
			Code:    http.StatusBadRequest,
		})
		return
	}

	// TODO: Integrate with actual STIG validation engine
	// For now, return mock response
	validationID := uuid.New().String()

	results := []STIGCheckResult{
		{
			ControlID:   "RHEL-09-010001",
			Title:       "Operating system must enforce password complexity",
			Severity:    "high",
			Status:      "pass",
			Finding:     "Password complexity is properly configured",
			Remediation: "",
		},
		{
			ControlID:   "RHEL-09-010002",
			Title:       "Operating system must enforce minimum password length",
			Severity:    "medium",
			Status:      "fail",
			Finding:     "Minimum password length is 8, should be 15",
			Remediation: "Set minlen=15 in /etc/security/pwquality.conf",
		},
	}

	passed := 0
	failed := 0
	for _, result := range results {
		if result.Status == "pass" {
			passed++
		} else if result.Status == "fail" {
			failed++
		}
	}

	response := STIGValidationResponse{
		ValidationID:  validationID,
		STIGVersion:   req.STIGVersion,
		TargetHost:    req.TargetHost,
		TotalChecks:   len(results),
		Passed:        passed,
		Failed:        failed,
		NotApplicable: 0,
		Score:         float64(passed) / float64(len(results)) * 100,
		Results:       results,
		Timestamp:     time.Now(),
	}

	c.JSON(http.StatusOK, response)
}

// handleGenerateERT generates an Evidence Recording Token
func (s *Server) handleGenerateERT(c *gin.Context) {
	var req ERTRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
			Code:    http.StatusBadRequest,
		})
		return
	}

	// TODO: Integrate with actual ERT generation and PQC signing
	// For now, return mock response
	tokenID := uuid.New().String()
	dagNodeID := uuid.New().String()

	response := ERTResponse{
		TokenID:      tokenID,
		EventType:    req.EventType,
		PQCSignature: "mock_ml_dsa_65_signature",
		DAGNodeID:    dagNodeID,
		IssuedAt:     time.Now(),
		VerifyURL:    fmt.Sprintf("https://%s/api/v1/ert/verify/%s", c.Request.Host, tokenID),
	}

	// Broadcast DAG update via WebSocket
	if s.wsHub != nil {
		s.wsHub.BroadcastDAGUpdate(map[string]interface{}{
			"node_id":   dagNodeID,
			"type":      "ert",
			"token_id":  tokenID,
			"timestamp": time.Now(),
		})
	}

	c.JSON(http.StatusCreated, response)
}

// handleGetLicenseStatus returns the current license status
func (s *Server) handleGetLicenseStatus(c *gin.Context) {
	if s.licMgr == nil {
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:   "license_unavailable",
			Message: "License manager not initialized",
			Code:    http.StatusServiceUnavailable,
		})
		return
	}

	response := s.licMgr.GetStatus()
	c.JSON(http.StatusOK, response)
}

// handleListScans returns a list of all scans
func (s *Server) handleListScans(c *gin.Context) {
	// Get pagination parameters
	page := c.DefaultQuery("page", "1")
	pageSize := c.DefaultQuery("page_size", "20")
	status := c.Query("status")

	_ = page
	_ = pageSize
	_ = status

	// TODO: Implement actual scan listing from database
	scans := []ScanResponse{}

	c.JSON(http.StatusOK, gin.H{
		"scans": scans,
		"total": len(scans),
		"page":  page,
	})
}

// handleCMMCAudit performs a full CMMC Level 2 audit (110 controls)
func (s *Server) handleCMMCAudit(c *gin.Context) {
	// Initialize STIG/CMMC validator
	validator := stig.NewValidator("/") // Target root for full system audit

	// Perform validation
	report, err := validator.Validate()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Extract CMMC results
	cmmcResults, ok := report.Results["CMMC-3.0-L3"]
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "CMMC framework results not found in report"})
		return
	}

	c.JSON(http.StatusOK, cmmcResults)
}

// handleSTIGRemediation triggers automated fixes for non-compliant controls
func (s *Server) handleSTIGRemediation(c *gin.Context) {
	var req STIGRemediationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: err.Error(),
			Code:    http.StatusBadRequest,
		})
		return
	}

	// Initialize the remediation engine
	checker := stig.NewSystemChecker()
	remediator := stig.NewRemediator(checker)

	// Link Selection: Decide if this is local or across the DEMARC
	if req.TargetHost != "localhost" && req.TargetHost != "" && s.agentMgr != nil {
		remediator.SetLink(&stig.DEMARCLink{
			MachineID: req.TargetHost,
			Manager:   s.agentMgr,
		})
	}

	batchID := uuid.New().String()

	results := []RemediationResult{}
	successCount := 0

	for _, controlID := range req.ControlIDs {
		res, err := remediator.Remediate(controlID)

		status := "failed"
		command := ""
		output := ""
		if err == nil {
			if res.Status == "Success" {
				status = "success"
				successCount++
			} else if res.Status == "Requires Manual Intervention" {
				status = "requires_manual"
			}
			command = res.Command
			output = res.Output
		} else {
			output = err.Error()
		}

		results = append(results, RemediationResult{
			ControlID: controlID,
			Status:    status,
			Command:   command,
			Output:    output,
			Timestamp: time.Now(),
		})
	}

	status := "completed"
	if successCount == 0 && len(req.ControlIDs) > 0 {
		status = "failed"
	} else if successCount < len(req.ControlIDs) {
		status = "partial"
	}

	response := STIGRemediationResponse{
		BatchID:   batchID,
		Results:   results,
		Summary:   fmt.Sprintf("Successfully remediated %d of %d requested controls.", successCount, len(req.ControlIDs)),
		Status:    status,
		Timestamp: time.Now(),
	}

	c.JSON(http.StatusOK, response)
}
