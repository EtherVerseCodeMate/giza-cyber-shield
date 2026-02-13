package apiserver

import (
	"log"
	"os"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
)

// DAGStoreAdapter adapts the PersistentMemory DAG to the DAGStore interface
type DAGStoreAdapter struct {
	pm *dag.PersistentMemory
}

// NewDAGStoreAdapter creates a new DAG store adapter
func NewDAGStoreAdapter(pm *dag.PersistentMemory) *DAGStoreAdapter {
	return &DAGStoreAdapter{pm: pm}
}

// NodeCount returns the number of nodes in the DAG
func (a *DAGStoreAdapter) NodeCount() int {
	nodes := a.pm.All()
	return len(nodes)
}

// All returns all nodes in the DAG mapped to Response objects
func (a *DAGStoreAdapter) All() []DAGNodeResponse {
	nodes := a.pm.All()
	response := make([]DAGNodeResponse, len(nodes))

	for i, node := range nodes {
		// Parse timestamp
		ts, err := time.Parse(time.RFC3339, node.Time)
		if err != nil {
			ts = time.Now()
		}

		response[i] = DAGNodeResponse{
			NodeID:       node.ID,
			Type:         node.Action,
			Timestamp:    ts,
			Data:         node.GetData(),
			Parents:      node.Parents,
			PQCSignature: node.Signature,
			Verified:     node.Signature != "",
		}
	}

	return response
}

// Add adds a new node to the DAG
func (a *DAGStoreAdapter) Add(nodeID string, action string, parents []string, pqc map[string]string) error {
	node := &dag.Node{
		ID:      nodeID,
		Action:  action,
		Time:    time.Now().Format(time.RFC3339),
		Parents: parents,
		PQC:     pqc,
	}

	return a.pm.Add(node, parents)
}

// GetPersistentMemory returns the underlying PersistentMemory
func (a *DAGStoreAdapter) GetPersistentMemory() *dag.PersistentMemory {
	return a.pm
}

// LicenseManagerAdapter adapts the license.Manager (Merkaba Egyptian system) to the apiserver's LicenseManager interface
type LicenseManagerAdapter struct {
	mgr *license.Manager
}

// NewLicenseManagerAdapter creates a new license manager adapter for Merkaba system
func NewLicenseManagerAdapter(mgr *license.Manager) *LicenseManagerAdapter {
	return &LicenseManagerAdapter{mgr: mgr}
}

// IsValid checks if the license system is functional
func (a *LicenseManagerAdapter) IsValid() (bool, error) {
	// The Merkaba licensing system is always valid if initialized
	// Check if any licenses exist or if system is ready
	return a.mgr != nil, nil
}

// ValidateAPIKey validates an API key (uses machine ID for local authentication)
func (a *LicenseManagerAdapter) ValidateAPIKey(apiKey string) (bool, error) {
	if apiKey == "" {
		return false, nil
	}

	// Primary auth: Machine ID-based authentication
	// Only requests from this specific installation are accepted
	machineID := a.mgr.GetMachineID()
	if apiKey == machineID {
		return true, nil
	}

	// Dev mode: ONLY available when KHEPRA_DEV_MODE=true is explicitly set
	// This MUST NEVER be set in production deployments
	if os.Getenv("KHEPRA_DEV_MODE") == "true" {
		log.Printf("[SECURITY][CRITICAL] ⚠️  Dev-mode API key authentication used. " +
			"KHEPRA_DEV_MODE is enabled — this MUST be disabled in production!")
		return true, nil
	}

	return false, nil
}

// GetStatus returns the current license status
func (a *LicenseManagerAdapter) GetStatus() LicenseStatus {
	full := a.mgr.GetFullStatus()

	// Parse dates
	issued, _ := time.Parse(time.RFC3339, full.IssuedAt)
	expires, _ := time.Parse(time.RFC3339, full.ExpiresAt)

	return LicenseStatus{
		MachineID:     a.mgr.GetMachineID(),
		Organization:  full.Organization,
		LicenseTier:   full.LicenseTier,
		Features:      full.Features,
		IssuedAt:      issued,
		ExpiresAt:     expires,
		IsValid:       full.Valid,
		DaysRemaining: calculateDaysRemaining(expires),
		Revoked:       full.Error == "revoked",
	}
}

func calculateDaysRemaining(expires time.Time) int {
	if expires.IsZero() {
		return 0
	}
	days := int(time.Until(expires).Hours() / 24)
	if days < 0 {
		return 0
	}
	return days
}

// GetManager returns the underlying license.Manager
func (a *LicenseManagerAdapter) GetManager() *license.Manager {
	return a.mgr
}

// CreateLicense creates a new Egyptian tier license
func (a *LicenseManagerAdapter) CreateLicense(id string, tier license.EgyptianTier, days int) (*license.License, error) {
	return a.mgr.CreateLicense(id, tier, days)
}

// GetLicense retrieves a license by ID
func (a *LicenseManagerAdapter) GetLicense(id string) (*license.License, error) {
	return a.mgr.GetLicense(id)
}

// GetAllLicenses returns all managed licenses
func (a *LicenseManagerAdapter) GetAllLicenses() []*license.License {
	return a.mgr.GetAllLicenses()
}

// UpgradeLicense upgrades a license to a higher tier
func (a *LicenseManagerAdapter) UpgradeLicense(id string, newTier license.EgyptianTier) error {
	return a.mgr.UpgradeLicense(id, newTier)
}

// Register registers the machine with a token
func (a *LicenseManagerAdapter) Register(token string) (*license.RegisterResponse, error) {
	return a.mgr.Register(token)
}

// Heartbeat sends a heartbeat to the telemetry server
func (a *LicenseManagerAdapter) Heartbeat() (*license.HeartbeatResponse, error) {
	return a.mgr.Heartbeat()
}

// GetFullStatus returns the full validation response from the manager
func (a *LicenseManagerAdapter) GetFullStatus() *license.ValidateResponse {
	return a.mgr.GetFullStatus()
}

// GetMachineID returns the machine identity string
func (a *LicenseManagerAdapter) GetMachineID() string {
	return a.mgr.GetMachineID()
}
