package apiserver

import (
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
			Data:         node.items,
			Parents:      node.Parents,
			PQCSignature: node.Signature,
			Verified:     node.Signature != "",
		}
	}

	return response
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

	// For local authentication, the API key is the Machine ID
	// This ensures that only requests from this specific installation are accepted
	// In production, the gateway would proxy and validate with a central server
	machineID := a.mgr.GetMachineID()
	if apiKey == machineID {
		return true, nil
	}

	// For development/MVP: allow "khepra-dev-key"
	if apiKey == "khepra-dev-key" {
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
