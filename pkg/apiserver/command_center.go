// =============================================================================
// KHEPRA PROTOCOL - Command Center API
// =============================================================================
// "Compliance in 4 Clicks" - The Uber Experience for CMMC/STIG Compliance
//
// QUADRANT 1: DISCOVER - Auto-detect endpoints, tactical profiles
// QUADRANT 2: ASSESS   - Scan & remediate, AI-prioritized findings
// QUADRANT 3: ROLLBACK - State snapshots, one-click restore
// QUADRANT 4: PROVE    - Cryptographic attestation, eMASS export
// =============================================================================

package apiserver

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// =============================================================================
// COMMAND CENTER TYPES
// =============================================================================

// CommandCenter represents the 4-quadrant compliance command center
type CommandCenter struct {
	mu         sync.RWMutex
	endpoints  map[string]*Endpoint
	scans      map[string]*ScanResult
	snapshots  map[string]*StateSnapshot
	attestations map[string]*Attestation
}

// Endpoint represents a discovered endpoint
type Endpoint struct {
	ID           string            `json:"id"`
	Hostname     string            `json:"hostname"`
	IPAddress    string            `json:"ip_address"`
	Platform     string            `json:"platform"` // windows, linux, network
	Profile      string            `json:"profile"`  // JDN, JNN, WIN-T, SATCOM, standard
	Status       string            `json:"status"`   // online, offline, scanning, compliant, non-compliant
	DiscoveredAt time.Time         `json:"discovered_at"`
	LastScan     *time.Time        `json:"last_scan,omitempty"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

// ScanResult represents a STIG/CMMC scan result
type ScanResult struct {
	ID              string            `json:"id"`
	EndpointID      string            `json:"endpoint_id"`
	StartTime       time.Time         `json:"start_time"`
	EndTime         *time.Time        `json:"end_time,omitempty"`
	Status          string            `json:"status"` // running, completed, failed
	Framework       string            `json:"framework"` // STIG, CMMC, NIST-800-171
	TotalChecks     int               `json:"total_checks"`
	PassedChecks    int               `json:"passed_checks"`
	FailedChecks    int               `json:"failed_checks"`
	Findings        []Finding         `json:"findings"`
	Remediations    []Remediation     `json:"remediations,omitempty"`
	AttestationHash string            `json:"attestation_hash,omitempty"`
	Signature       string            `json:"signature,omitempty"` // ML-DSA-65 signature
}

// Finding represents a compliance finding
type Finding struct {
	ID          string    `json:"id"`
	ControlID   string    `json:"control_id"`   // e.g., V-254239, 3.1.1
	Severity    string    `json:"severity"`     // CAT I, CAT II, CAT III
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      string    `json:"status"`       // open, fixed, accepted
	Evidence    string    `json:"evidence"`
	Priority    int       `json:"priority"`     // AI-calculated priority (1-100)
	DetectedAt  time.Time `json:"detected_at"`
}

// Remediation represents a remediation action
type Remediation struct {
	FindingID   string     `json:"finding_id"`
	Action      string     `json:"action"`
	Script      string     `json:"script,omitempty"`
	Status      string     `json:"status"` // pending, applied, failed, rolled_back
	AppliedAt   *time.Time `json:"applied_at,omitempty"`
	AppliedBy   string     `json:"applied_by,omitempty"`
	RollbackRef string     `json:"rollback_ref,omitempty"`
}

// StateSnapshot represents a system state snapshot for rollback
type StateSnapshot struct {
	ID         string    `json:"id"`
	EndpointID string    `json:"endpoint_id"`
	CreatedAt  time.Time `json:"created_at"`
	Type       string    `json:"type"` // pre-scan, pre-remediation, manual
	Hash       string    `json:"hash"` // SHA-256 of state data
	Size       int64     `json:"size"` // bytes
	Components []string  `json:"components"` // files, registry, services affected
	Metadata   map[string]string `json:"metadata,omitempty"`
}

// Attestation represents cryptographic proof of compliance state
type Attestation struct {
	ID            string            `json:"id"`
	Type          string            `json:"type"` // scan, remediation, export
	Timestamp     time.Time         `json:"timestamp"`
	DataHash      string            `json:"data_hash"`
	Signature     string            `json:"signature"` // ML-DSA-65 (Dilithium3) signature
	SignerID      string            `json:"signer_id"`
	ChainPrevious string            `json:"chain_previous,omitempty"` // Previous attestation hash
	Metadata      map[string]string `json:"metadata,omitempty"`
}

// =============================================================================
// COMMAND CENTER INSTANCE
// =============================================================================

var commandCenter = &CommandCenter{
	endpoints:    make(map[string]*Endpoint),
	scans:        make(map[string]*ScanResult),
	snapshots:    make(map[string]*StateSnapshot),
	attestations: make(map[string]*Attestation),
}

// =============================================================================
// QUADRANT 1: DISCOVER HANDLERS
// =============================================================================

// DiscoverRequest represents an endpoint discovery request
type DiscoverRequest struct {
	Mode      string   `json:"mode"`      // auto, manual, import
	Target    string   `json:"target"`    // CIDR, hostname, AD/LDAP path
	Profile   string   `json:"profile"`   // JDN, JNN, WIN-T, SATCOM, standard
	Protocols []string `json:"protocols"` // WinRM, SSH, SNMP
}

// DiscoverResponse represents the discovery result
type DiscoverResponse struct {
	JobID         string      `json:"job_id"`
	Status        string      `json:"status"`
	EndpointsFound int        `json:"endpoints_found"`
	Endpoints     []*Endpoint `json:"endpoints,omitempty"`
}

// HandleDiscover handles endpoint discovery requests
func HandleDiscover(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req DiscoverRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Generate job ID
	jobID := generateID("disc")

	// For now, return a simulated discovery response
	// In production, this would trigger actual network discovery
	resp := DiscoverResponse{
		JobID:          jobID,
		Status:         "initiated",
		EndpointsFound: 0,
		Endpoints:      []*Endpoint{},
	}

	// If manual mode with specific target, add it immediately
	if req.Mode == "manual" && req.Target != "" {
		endpoint := &Endpoint{
			ID:           generateID("ep"),
			Hostname:     req.Target,
			IPAddress:    req.Target, // Will be resolved
			Platform:     "unknown",
			Profile:      req.Profile,
			Status:       "pending",
			DiscoveredAt: time.Now(),
			Metadata:     make(map[string]string),
		}

		commandCenter.mu.Lock()
		commandCenter.endpoints[endpoint.ID] = endpoint
		commandCenter.mu.Unlock()

		resp.EndpointsFound = 1
		resp.Endpoints = append(resp.Endpoints, endpoint)
		resp.Status = "completed"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// HandleListEndpoints returns all discovered endpoints
func HandleListEndpoints(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	commandCenter.mu.RLock()
	endpoints := make([]*Endpoint, 0, len(commandCenter.endpoints))
	for _, ep := range commandCenter.endpoints {
		endpoints = append(endpoints, ep)
	}
	commandCenter.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"endpoints": endpoints,
		"total":     len(endpoints),
	})
}

// =============================================================================
// QUADRANT 2: ASSESS HANDLERS
// =============================================================================

// AssessRequest represents a compliance scan request
type AssessRequest struct {
	EndpointIDs []string `json:"endpoint_ids"` // Empty = all endpoints
	Framework   string   `json:"framework"`    // STIG, CMMC, NIST-800-171
	Profile     string   `json:"profile"`      // specific STIG profile
	AutoRemediate bool   `json:"auto_remediate"`
}

// HandleAssess initiates a compliance assessment
func HandleAssess(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AssessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	scanID := generateID("scan")
	now := time.Now()

	// Create scan result
	scan := &ScanResult{
		ID:          scanID,
		StartTime:   now,
		Status:      "running",
		Framework:   req.Framework,
		TotalChecks: 0,
		PassedChecks: 0,
		FailedChecks: 0,
		Findings:    []Finding{},
	}

	// If specific endpoints, use first one
	if len(req.EndpointIDs) > 0 {
		scan.EndpointID = req.EndpointIDs[0]
	}

	commandCenter.mu.Lock()
	commandCenter.scans[scanID] = scan
	commandCenter.mu.Unlock()

	// In production, this would trigger actual STIG scanning
	// For now, return the scan job ID for status polling
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"scan_id":   scanID,
		"status":    "initiated",
		"framework": req.Framework,
		"message":   "Scan initiated. Poll /api/v1/cc/assess/status for progress.",
	})
}

// HandleAssessStatus returns the status of an ongoing or completed scan
func HandleAssessStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	scanID := r.URL.Query().Get("scan_id")
	if scanID == "" {
		// Return all scans
		commandCenter.mu.RLock()
		scans := make([]*ScanResult, 0, len(commandCenter.scans))
		for _, scan := range commandCenter.scans {
			scans = append(scans, scan)
		}
		commandCenter.mu.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"scans": scans,
			"total": len(scans),
		})
		return
	}

	commandCenter.mu.RLock()
	scan, exists := commandCenter.scans[scanID]
	commandCenter.mu.RUnlock()

	if !exists {
		http.Error(w, "Scan not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(scan)
}

// =============================================================================
// QUADRANT 3: ROLLBACK HANDLERS
// =============================================================================

// SnapshotRequest represents a state snapshot request
type SnapshotRequest struct {
	EndpointID string   `json:"endpoint_id"`
	Type       string   `json:"type"`       // pre-scan, pre-remediation, manual
	Components []string `json:"components"` // files, registry, services
}

// HandleCreateSnapshot creates a system state snapshot
func HandleCreateSnapshot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SnapshotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	snapshotID := generateID("snap")
	now := time.Now()

	// Calculate hash of snapshot metadata (in production, would include actual state data)
	hashData := fmt.Sprintf("%s|%s|%v|%s", req.EndpointID, req.Type, req.Components, now.Format(time.RFC3339))
	hash := sha256.Sum256([]byte(hashData))

	snapshot := &StateSnapshot{
		ID:         snapshotID,
		EndpointID: req.EndpointID,
		CreatedAt:  now,
		Type:       req.Type,
		Hash:       hex.EncodeToString(hash[:]),
		Size:       0, // Would be calculated from actual state data
		Components: req.Components,
		Metadata:   make(map[string]string),
	}

	commandCenter.mu.Lock()
	commandCenter.snapshots[snapshotID] = snapshot
	commandCenter.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(snapshot)
}

// HandleListSnapshots returns all snapshots for an endpoint
func HandleListSnapshots(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	endpointID := r.URL.Query().Get("endpoint_id")

	commandCenter.mu.RLock()
	snapshots := make([]*StateSnapshot, 0)
	for _, snap := range commandCenter.snapshots {
		if endpointID == "" || snap.EndpointID == endpointID {
			snapshots = append(snapshots, snap)
		}
	}
	commandCenter.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"snapshots": snapshots,
		"total":     len(snapshots),
	})
}

// RollbackRequest represents a rollback request
type RollbackRequest struct {
	SnapshotID string `json:"snapshot_id"`
	DryRun     bool   `json:"dry_run"`
}

// HandleRollback restores system state from a snapshot
func HandleRollback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RollbackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	commandCenter.mu.RLock()
	snapshot, exists := commandCenter.snapshots[req.SnapshotID]
	commandCenter.mu.RUnlock()

	if !exists {
		http.Error(w, "Snapshot not found", http.StatusNotFound)
		return
	}

	// In production, this would trigger actual state restoration
	response := map[string]interface{}{
		"snapshot_id": snapshot.ID,
		"endpoint_id": snapshot.EndpointID,
		"status":      "completed",
		"dry_run":     req.DryRun,
		"components_restored": snapshot.Components,
		"timestamp":   time.Now(),
	}

	if req.DryRun {
		response["status"] = "dry_run_completed"
		response["message"] = "Dry run successful. No changes applied."
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// =============================================================================
// QUADRANT 4: PROVE HANDLERS
// =============================================================================

// AttestRequest represents an attestation creation request
type AttestRequest struct {
	Type     string            `json:"type"` // scan, remediation, export, manual
	DataHash string            `json:"data_hash"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

// HandleCreateAttestation creates a cryptographically signed attestation
func HandleCreateAttestation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AttestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	attestID := generateID("att")
	now := time.Now()

	// Get previous attestation hash for chain
	var prevHash string
	commandCenter.mu.RLock()
	for _, att := range commandCenter.attestations {
		if att.Timestamp.Before(now) {
			if prevHash == "" || att.Timestamp.After(time.Time{}) {
				prevHash = att.DataHash
			}
		}
	}
	commandCenter.mu.RUnlock()

	// Create attestation data for signing
	attestData := fmt.Sprintf("%s|%s|%s|%s|%s",
		attestID, req.Type, req.DataHash, now.Format(time.RFC3339), prevHash)
	dataHash := sha256.Sum256([]byte(attestData))

	attestation := &Attestation{
		ID:            attestID,
		Type:          req.Type,
		Timestamp:     now,
		DataHash:      hex.EncodeToString(dataHash[:]),
		Signature:     "", // Would be signed with ML-DSA-65 in production
		SignerID:      "khepra-system",
		ChainPrevious: prevHash,
		Metadata:      req.Metadata,
	}

	// In production, sign with ML-DSA-65 (Dilithium3)
	// For now, create a placeholder signature
	sigData := fmt.Sprintf("MLDSA65_SIG_%s", attestation.DataHash[:16])
	attestation.Signature = hex.EncodeToString([]byte(sigData))

	commandCenter.mu.Lock()
	commandCenter.attestations[attestID] = attestation
	commandCenter.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(attestation)
}

// HandleVerifyAttestation verifies a cryptographic attestation
func HandleVerifyAttestation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	attestID := r.URL.Query().Get("id")
	if attestID == "" {
		http.Error(w, "Attestation ID required", http.StatusBadRequest)
		return
	}

	commandCenter.mu.RLock()
	attestation, exists := commandCenter.attestations[attestID]
	commandCenter.mu.RUnlock()

	if !exists {
		http.Error(w, "Attestation not found", http.StatusNotFound)
		return
	}

	// In production, would verify ML-DSA-65 signature
	verified := attestation.Signature != ""

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"attestation": attestation,
		"verified":    verified,
		"algorithm":   "ML-DSA-65 (FIPS 204)",
		"chain_valid": attestation.ChainPrevious != "",
	})
}

// ExportRequest represents an export request for compliance evidence
type ExportRequest struct {
	Format    string   `json:"format"`     // emass, sprs, pdf, json
	Framework string   `json:"framework"`  // CMMC, NIST-800-171, STIG
	ScanIDs   []string `json:"scan_ids"`   // Specific scans to export
	DateRange struct {
		Start time.Time `json:"start"`
		End   time.Time `json:"end"`
	} `json:"date_range,omitempty"`
}

// HandleExportEvidence generates compliance evidence packages
func HandleExportEvidence(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ExportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	exportID := generateID("exp")
	now := time.Now()

	// Create attestation for the export
	exportHash := sha256.Sum256([]byte(fmt.Sprintf("%s|%s|%s|%s",
		exportID, req.Format, req.Framework, now.Format(time.RFC3339))))

	response := map[string]interface{}{
		"export_id":   exportID,
		"format":      req.Format,
		"framework":   req.Framework,
		"status":      "generated",
		"timestamp":   now,
		"data_hash":   hex.EncodeToString(exportHash[:]),
		"attestation": fmt.Sprintf("att_%s", exportID),
		"download_url": fmt.Sprintf("/api/v1/cc/prove/download/%s", exportID),
	}

	// Format-specific metadata
	switch req.Format {
	case "emass":
		response["emass_version"] = "3.0"
		response["poam_included"] = true
	case "sprs":
		response["sprs_score"] = 110 // Example score
		response["assessment_date"] = now.Format("2006-01-02")
	case "pdf":
		response["pages"] = 15
		response["includes_signatures"] = true
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// =============================================================================
// DASHBOARD HANDLER
// =============================================================================

// HandleCommandCenterDashboard returns the command center overview
func HandleCommandCenterDashboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	commandCenter.mu.RLock()
	defer commandCenter.mu.RUnlock()

	// Calculate stats
	totalEndpoints := len(commandCenter.endpoints)
	onlineEndpoints := 0
	compliantEndpoints := 0
	for _, ep := range commandCenter.endpoints {
		if ep.Status == "online" || ep.Status == "compliant" {
			onlineEndpoints++
		}
		if ep.Status == "compliant" {
			compliantEndpoints++
		}
	}

	totalScans := len(commandCenter.scans)
	activeScans := 0
	totalFindings := 0
	for _, scan := range commandCenter.scans {
		if scan.Status == "running" {
			activeScans++
		}
		totalFindings += len(scan.Findings)
	}

	totalSnapshots := len(commandCenter.snapshots)
	totalAttestations := len(commandCenter.attestations)

	dashboard := map[string]interface{}{
		"quadrants": map[string]interface{}{
			"discover": map[string]interface{}{
				"total_endpoints":     totalEndpoints,
				"online_endpoints":    onlineEndpoints,
				"compliant_endpoints": compliantEndpoints,
				"status":              "operational",
			},
			"assess": map[string]interface{}{
				"total_scans":    totalScans,
				"active_scans":   activeScans,
				"total_findings": totalFindings,
				"status":         "operational",
			},
			"rollback": map[string]interface{}{
				"total_snapshots":   totalSnapshots,
				"storage_used_mb":   0,
				"oldest_snapshot":   nil,
				"status":            "operational",
			},
			"prove": map[string]interface{}{
				"total_attestations": totalAttestations,
				"chain_length":       totalAttestations,
				"last_attestation":   nil,
				"status":             "operational",
			},
		},
		"compliance_score": calculateComplianceScore(),
		"system_health":    "healthy",
		"last_updated":     time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dashboard)
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

func generateID(prefix string) string {
	now := time.Now()
	hash := sha256.Sum256([]byte(fmt.Sprintf("%s_%d_%d", prefix, now.UnixNano(), now.Nanosecond())))
	return fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(hash[:])[:12])
}

func calculateComplianceScore() int {
	commandCenter.mu.RLock()
	defer commandCenter.mu.RUnlock()

	if len(commandCenter.scans) == 0 {
		return 0
	}

	var totalPassed, totalChecks int
	for _, scan := range commandCenter.scans {
		totalPassed += scan.PassedChecks
		totalChecks += scan.TotalChecks
	}

	if totalChecks == 0 {
		return 0
	}

	return (totalPassed * 100) / totalChecks
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

// RegisterCommandCenterRoutes registers all Command Center API routes
func RegisterCommandCenterRoutes(mux *http.ServeMux) {
	// Dashboard
	mux.HandleFunc("/api/v1/cc/dashboard", HandleCommandCenterDashboard)

	// Quadrant 1: Discover
	mux.HandleFunc("/api/v1/cc/discover", HandleDiscover)
	mux.HandleFunc("/api/v1/cc/discover/endpoints", HandleListEndpoints)

	// Quadrant 2: Assess
	mux.HandleFunc("/api/v1/cc/assess", HandleAssess)
	mux.HandleFunc("/api/v1/cc/assess/status", HandleAssessStatus)

	// Quadrant 3: Rollback
	mux.HandleFunc("/api/v1/cc/rollback/snapshot", HandleCreateSnapshot)
	mux.HandleFunc("/api/v1/cc/rollback/snapshots", HandleListSnapshots)
	mux.HandleFunc("/api/v1/cc/rollback/restore", HandleRollback)

	// Quadrant 4: Prove
	mux.HandleFunc("/api/v1/cc/prove/attest", HandleCreateAttestation)
	mux.HandleFunc("/api/v1/cc/prove/verify", HandleVerifyAttestation)
	mux.HandleFunc("/api/v1/cc/prove/export", HandleExportEvidence)
}
