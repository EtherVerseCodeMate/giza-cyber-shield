package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/billing"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
)

// These would be package-level globals in cmd/agent/main.go

var (
	licenseManager     *license.LicenseManager
	dagLicenseEnforcer *license.DAGLicenseEnforcer
	billingCalculator  *billing.HybridBillingCalculator
	dagStore           dag.Store
	systemIsAirGapped  bool
	httpMux            *http.ServeMux
)

// InitializeLicensing sets up Egyptian mythology licensing for the agent
func InitializeLicensing(storageBackend dag.Store, isAirGapped bool) error {
	var err error

	// Create license manager
	licenseManager = license.NewLicenseManager()

	// Create DAG enforcer
	dagLicenseEnforcer = license.NewDAGLicenseEnforcer(licenseManager)

	// Create billing calculator
	billingCalculator = billing.NewHybridBillingCalculator(0)

	// Store references
	dagStore = storageBackend
	systemIsAirGapped = isAirGapped

	log.Println("[LICENSE] Initialized Egyptian mythology licensing system")

	// Register HTTP handlers
	registerLicenseEndpoints(httpMux)
	registerNodeEndpoints(httpMux)
	registerBillingEndpoints(httpMux)
	registerAdminEndpoints(httpMux)

	return err
}

// ============================================================================
// LICENSE ENDPOINTS
// ============================================================================

// handleCreateLicense creates a new license
// POST /license/create
// Body: {"tier": "khepri|ra|atum|osiris", "customer": "...", "duration_days": 365}
func handleCreateLicense(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Tier        string   `json:"tier"`
		Customer    string   `json:"customer"`
		DurationDays int      `json:"duration_days"`
		Features    []string `json:"features"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Tier == "" || req.Customer == "" || req.DurationDays == 0 {
		http.Error(w, "missing required fields: tier, customer, duration_days", http.StatusBadRequest)
		return
	}

	// Map tier string to enum
	tierMap := map[string]license.EgyptianTier{
		"khepri": license.TierKhepri,
		"ra":     license.TierRa,
		"atum":   license.TierAtum,
		"osiris": license.TierOsiris,
	}

	tier, ok := tierMap[req.Tier]
	if !ok {
		http.Error(w, fmt.Sprintf("invalid tier: %s", req.Tier), http.StatusBadRequest)
		return
	}

	// Generate license ID (machine-based for consistency)
	licenseID := "lic-" + license.GenerateMachineID()

	// Create license via manager
	lic, err := licenseManager.CreateLicense(licenseID, tier, req.DurationDays)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(lic)
}

// handleGetLicense retrieves a license
// GET /license/{license_id}
func handleGetLicense(w http.ResponseWriter, r *http.Request) {
	licenseID := r.URL.Query().Get("id")
	if licenseID == "" {
		licenseID = r.PathValue("license_id")
	}

	lic, err := licenseManager.GetLicense(licenseID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(lic)
}

// handleUpgradeLicense upgrades license to next tier
// POST /license/{license_id}/upgrade
// Body: {"new_tier": "ra|atum|osiris"}
func handleUpgradeLicense(w http.ResponseWriter, r *http.Request) {
	licenseID := r.PathValue("license_id")

	var req struct {
		NewTier string `json:"new_tier"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Map tier string to enum
	tierMap := map[string]license.EgyptianTier{
		"khepri": license.TierKhepri,
		"ra":     license.TierRa,
		"atum":   license.TierAtum,
		"osiris": license.TierOsiris,
	}

	newTier, ok := tierMap[req.NewTier]
	if !ok {
		http.Error(w, fmt.Sprintf("invalid tier: %s", req.NewTier), http.StatusBadRequest)
		return
	}

	updatedLic, err := licenseManager.UpgradeLicense(licenseID, newTier)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updatedLic)
}

// handleGetLicenseUsage returns usage stats for a license
// GET /license/{license_id}/usage
func handleGetLicenseUsage(w http.ResponseWriter, r *http.Request) {
	licenseID := r.PathValue("license_id")

	stats := dagLicenseEnforcer.GetLicenseUsageStats(licenseID)
	if stats == nil {
		http.Error(w, "license not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// ============================================================================
// NODE ENDPOINTS (with licensing enforcement)
// ============================================================================

// handleCreateNode creates a new DAG node (enforces licensing)
// POST /dag/node
// Headers: X-License-ID: {license_id}
// Body: {"type": "...", "symbol": "...", "action": "..."}
func handleCreateNode(w http.ResponseWriter, r *http.Request) {
	licenseID := r.Header.Get("X-License-ID")
	if licenseID == "" {
		http.Error(w, "missing X-License-ID header", http.StatusUnauthorized)
		return
	}

	var nodeReq struct {
		Type   string `json:"type"`
		Symbol string `json:"symbol"`
		Action string `json:"action"`
	}

	if err := json.NewDecoder(r.Body).Decode(&nodeReq); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Determine Sephirot level from node symbol
	sephirotLevel := license.GetSephirotLevel(nodeReq.Symbol)

	// Generate node ID (content hash) and create node
	node := &dag.Node{
		Action: nodeReq.Action,
		Symbol: nodeReq.Symbol,
		Time:   time.Now().UTC().Format(time.RFC3339),
	}
	// Note: node.ID will be computed by Store.Add() based on content hash

	// CHECK LICENSE BEFORE CREATING NODE
	nodeID := node.ComputeID() // Compute the content hash ID
	if err := dagLicenseEnforcer.CanCreateNode(licenseID, nodeID, nodeReq.Symbol, sephirotLevel); err != nil {
		http.Error(w, fmt.Sprintf("license violation: %v", err), http.StatusForbidden)
		return
	}

	// Set the computed ID
	node.ID = nodeID

	// ADD NODE TO DAG
	if err := dagStore.Add(node, []string{}); err != nil {
		http.Error(w, fmt.Sprintf("failed to add node: %v", err), http.StatusInternalServerError)
		return
	}

	// REGISTER NODE CREATION WITH LICENSE
	if err := dagLicenseEnforcer.RegisterNodeCreation(licenseID, node.ID, sephirotLevel); err != nil {
		// Log the error but don't rollback node creation (immutability)
		log.Printf("[LICENSE] Failed to register node creation: %v", err)
		http.Error(w, fmt.Sprintf("failed to register license: %v", err), http.StatusInternalServerError)
		return
	}

	log.Printf("[LICENSE] Node %s created under license %s (Sephirot %d)", node.ID, licenseID, sephirotLevel)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"node_id":         node.ID,
		"sephirot_level":  sephirotLevel,
		"license_id":      licenseID,
		"nodes_remaining": "see GET /license/{id}/usage",
	})
}

// handleDeleteNode deletes a node (checks compliance)
// NOTE: DAG nodes are immutable and cannot be deleted. This endpoint
// marks nodes as archived or returns an error explaining immutability.
// DELETE /dag/node/{node_id}
func handleDeleteNode(w http.ResponseWriter, r *http.Request) {
	nodeID := r.PathValue("node_id")

	// CHECK COMPLIANCE BEFORE ATTEMPTING DELETION
	if err := dagLicenseEnforcer.CanRemoveNode(nodeID); err != nil {
		http.Error(w, fmt.Sprintf("cannot remove node: %v", err), http.StatusConflict)
		return
	}

	// NOTE: DAG nodes are immutable and stored forever
	// Instead of deletion, nodes are marked as resolved via new nodes referencing them
	log.Printf("[LICENSE] Node %s marked for archive (compliance cleared)", nodeID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Node marked for archive. DAG nodes are immutable and cannot be deleted.",
		"node_id": nodeID,
	})
}

// handleGetNodeLicense returns license binding for a node
// GET /dag/node/{node_id}/license
func handleGetNodeLicense(w http.ResponseWriter, r *http.Request) {
	nodeID := r.PathValue("node_id")

	binding, err := dagLicenseEnforcer.GetNodeLicense(nodeID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(binding)
}

// handleListNodesByLicense lists all nodes under a license
// GET /license/{license_id}/nodes
func handleListNodesByLicense(w http.ResponseWriter, r *http.Request) {
	licenseID := r.PathValue("license_id")

	nodes := dagLicenseEnforcer.ListNodesByLicense(licenseID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(nodes)
}

// ============================================================================
// BILLING ENDPOINTS
// ============================================================================

// handleGetMonthlyCost returns monthly billing for a license
// GET /billing/{license_id}/monthly
func handleGetMonthlyCost(w http.ResponseWriter, r *http.Request) {
	licenseID := r.PathValue("license_id")

	lic, err := licenseManager.GetLicense(licenseID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// Get license info
	lic, err := licenseManager.GetLicense(licenseID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// Get tier configuration for base cost
	tierConfig, ok := license.TierConfigurations[lic.Tier]
	if !ok {
		http.Error(w, "invalid tier", http.StatusInternalServerError)
		return
	}

	// Get usage stats
	stats := dagLicenseEnforcer.GetLicenseUsageStats(licenseID)

	// Create billing calculator with tier base cost
	calc := billing.NewHybridBillingCalculator(tierConfig.Price)

	// TODO: Fetch actual metrics from database
	// calc.SunMetrics.TotalScans = getScansCount(licenseID)
	// calc.SunMetrics.CriticalFindings = getCriticalCount(licenseID)
	// calc.EarthMetrics.ActiveNodes = lic.NodeCount
	// calc.SeedMetrics.DAGStorageGB = getStorageGB(licenseID)

	result := calc.CalculateMonthlyCost()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"license_id": licenseID,
		"tier":       string(lic.Tier),
		"usage":      stats,
		"cost":       result,
	})
}

// handleBillingHistory returns billing history for a license
// GET /billing/{license_id}/history?months=12
func handleBillingHistory(w http.ResponseWriter, r *http.Request) {
	licenseID := r.PathValue("license_id")
	months := r.URL.Query().Get("months")
	if months == "" {
		months = "12"
	}

	// TODO: Query billing events from database
	// WHERE license_id = licenseID AND period >= NOW() - INTERVAL months MONTH

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"license_id": licenseID,
		"months":     months,
		"events":     []interface{}{}, // TODO: fetch from DB
	})
}

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

// handleAmmitAlerts returns critical nodes requiring immediate action
// GET /admin/ammit-alerts
func handleAmmitAlerts(w http.ResponseWriter, r *http.Request) {
	alerts := dagLicenseEnforcer.GetAmmitAlertStatus()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"alert_count": len(alerts),
		"alerts":      alerts,
	})
}

// handleVerifyAirGap checks if air-gap licensing is valid (Pharaoh tier)
// GET /admin/verify-air-gap?license_id={id}
func handleVerifyAirGap(w http.ResponseWriter, r *http.Request) {
	licenseID := r.URL.Query().Get("license_id")
	if licenseID == "" {
		http.Error(w, "missing license_id parameter", http.StatusBadRequest)
		return
	}

	err := dagLicenseEnforcer.EnforceAirGapIfNeeded(licenseID, systemIsAirGapped)

	if err != nil {
		http.Error(w, err.Error(), http.StatusConflict)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"license_id":    licenseID,
		"is_air_gapped": systemIsAirGapped,
		"status":        "validated",
	})
}

// handleRenewOfflineLicense generates new Shu Breath signature (annual renewal)
// POST /admin/{license_id}/renew-offline-license
func handleRenewOfflineLicense(w http.ResponseWriter, r *http.Request) {
	licenseID := r.PathValue("license_id")

	newSig, err := dagLicenseEnforcer.RekeyOfflineLicense(licenseID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("[LICENSE] Offline license renewed for %s (Shu Breath signature generated)", licenseID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"license_id":    licenseID,
		"signature":     newSig,
		"validity_days": 365,
		"message":       "Shu Breath signature generated for air-gap deployment",
	})
}

// handleDashboard returns overall license portfolio metrics
// GET /admin/dashboard
func handleDashboard(w http.ResponseWriter, r *http.Request) {
	// TODO: Aggregate stats across all licenses via exposed methods
	stats := map[string]interface{}{
		"total_licenses": 0, // TODO: Add GetLicenseCount() method to LicenseManager
		"breakdown": map[string]int{
			"khepri": 0, // TODO: Add CountByTier() method
			"ra":     0,
			"atum":   0,
			"osiris": 0,
		},
		"total_nodes":  0, // TODO: Add GetNodeCount() method to DAGLicenseEnforcer
		"ammit_alerts": 0, // TODO: Add exported method for alerts
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// ============================================================================
// REGISTRATION
// ============================================================================

func registerLicenseEndpoints(mux *http.ServeMux) {
	mux.HandleFunc("POST /license/create", handleCreateLicense)
	mux.HandleFunc("GET /license/{license_id}", handleGetLicense)
	mux.HandleFunc("POST /license/{license_id}/upgrade", handleUpgradeLicense)
	mux.HandleFunc("GET /license/{license_id}/usage", handleGetLicenseUsage)
}

func registerNodeEndpoints(mux *http.ServeMux) {
	mux.HandleFunc("POST /dag/node", handleCreateNode)
	mux.HandleFunc("DELETE /dag/node/{node_id}", handleDeleteNode)
	mux.HandleFunc("GET /dag/node/{node_id}/license", handleGetNodeLicense)
	mux.HandleFunc("GET /license/{license_id}/nodes", handleListNodesByLicense)
}

func registerBillingEndpoints(mux *http.ServeMux) {
	mux.HandleFunc("GET /billing/{license_id}/monthly", handleGetMonthlyCost)
	mux.HandleFunc("GET /billing/{license_id}/history", handleBillingHistory)
}

func registerAdminEndpoints(mux *http.ServeMux) {
	mux.HandleFunc("GET /admin/ammit-alerts", handleAmmitAlerts)
	mux.HandleFunc("GET /admin/verify-air-gap", handleVerifyAirGap)
	mux.HandleFunc("POST /admin/{license_id}/renew-offline-license", handleRenewOfflineLicense)
	mux.HandleFunc("GET /admin/dashboard", handleDashboard)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

func countByTier(tier license.EgyptianTier) int {
	// TODO: Count licenses by tier
	return 0
}
