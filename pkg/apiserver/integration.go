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

// ValidateAPIKey validates an API key (uses machine ID for authentication)
func (a *LicenseManagerAdapter) ValidateAPIKey(apiKey string) (bool, error) {
	// For Merkaba system, validate against the machine ID generated at startup
	// In production, this would validate against the license server
	if apiKey == "" {
		return false, nil
	}

	// Accept any non-empty API key for now (permissive for MVP)
	// TODO: Implement proper license key validation
	return true, nil
}

// GetManager returns the underlying license.Manager
func (a *LicenseManagerAdapter) GetManager() *license.Manager {
	return a.mgr
}
