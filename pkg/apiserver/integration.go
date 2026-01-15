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

// LicenseManagerAdapter adapts the license.Manager to the LicenseManager interface
type LicenseManagerAdapter struct {
	mgr *license.Manager
}

// NewLicenseManagerAdapter creates a new license manager adapter
func NewLicenseManagerAdapter(mgr *license.Manager) *LicenseManagerAdapter {
	return &LicenseManagerAdapter{mgr: mgr}
}

// IsValid checks if the license is valid
func (a *LicenseManagerAdapter) IsValid() (bool, error) {
	// Check if license has been validated
	tier := a.mgr.GetTier()
	valid := tier != "" && tier != "community"
	return valid, nil
}

// ValidateAPIKey validates an API key (using machine ID for now)
func (a *LicenseManagerAdapter) ValidateAPIKey(apiKey string) (bool, error) {
	// For now, accept the machine ID as a valid API key
	// In production, this should validate against the license server
	machineID := a.mgr.GetMachineID()
	if apiKey == machineID {
		return true, nil
	}

	// Also check if it's a valid tier with features
	tier := a.mgr.GetTier()
	if tier != "" && tier != "community" {
		// If license is valid, accept any API key (permissive for MVP)
		return true, nil
	}

	return false, nil
}

// GetManager returns the underlying license Manager
func (a *LicenseManagerAdapter) GetManager() *license.Manager {
	return a.mgr
}
