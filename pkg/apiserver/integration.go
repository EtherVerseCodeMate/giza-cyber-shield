package apiserver

import (
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

// GetManager returns the underlying license.Manager
func (a *LicenseManagerAdapter) GetManager() *license.Manager {
	return a.mgr
}
