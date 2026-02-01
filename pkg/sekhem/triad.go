package sekhem

import (
	"fmt"
	"log"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/agi"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
)

// DeploymentMode represents the deployment mode
type DeploymentMode string

const (
	ModeEdge      DeploymentMode = "edge"      // Edge Mode (Duat Realm only)
	ModeHybrid    DeploymentMode = "hybrid"    // Hybrid Mode (Duat + Aaru Realms)
	ModeSovereign DeploymentMode = "sovereign" // Sovereign Mode (All three realms, air-gapped)
	ModeIronBank  DeploymentMode = "ironbank"  // Iron Bank Mode (All three realms, DoD compliance)
)

// SekhemTriad represents the three-fold power structure
// Sekhem (Egyptian): Power, might, divine authority
type SekhemTriad struct {
	Mode      DeploymentMode
	DuatRealm *DuatRealm // Foundational defense (Edge Mode)
	AaruRealm *AaruRealm // Harmonious coordination (Hybrid Mode)
	AtenRealm *AtenRealm // Supreme orchestration (Sovereign/Iron Bank Mode)
}

// NewSekhemTriad creates the three-fold structure
func NewSekhemTriad(kasa *agi.Engine, dagStore dag.Store, mode DeploymentMode) (*SekhemTriad, error) {
	triad := &SekhemTriad{
		Mode: mode,
	}

	// Always create Duat Realm (foundational)
	triad.DuatRealm = NewDuatRealm(kasa, dagStore)

	// Create Aaru Realm for Hybrid, Sovereign, and Iron Bank modes
	if mode == ModeHybrid || mode == ModeSovereign || mode == ModeIronBank {
		aaru, err := NewAaruRealm(kasa, dagStore)
		if err != nil {
			return nil, fmt.Errorf("failed to create Aaru Realm: %w", err)
		}
		triad.AaruRealm = aaru
	}

	// Create Aten Realm for Sovereign and Iron Bank modes
	if mode == ModeSovereign || mode == ModeIronBank {
		airGapped := (mode == ModeSovereign) // Sovereign mode is air-gapped
		aten, err := NewAtenRealm(kasa, dagStore, airGapped)
		if err != nil {
			return nil, fmt.Errorf("failed to create Aten Realm: %w", err)
		}
		triad.AtenRealm = aten
	}

	return triad, nil
}

// Harmonize aligns all active realms
func (st *SekhemTriad) Harmonize() error {
	log.Printf("[Sekhem] Harmonizing the Triad (Mode: %s)...", st.Mode)

	// Awaken Duat Realm (foundational) - always active
	if err := st.DuatRealm.Awaken(); err != nil {
		return fmt.Errorf("failed to awaken Duat Realm: %w", err)
	}

	// Awaken Aaru Realm (intermediate) - if present
	if st.AaruRealm != nil {
		if err := st.AaruRealm.Awaken(); err != nil {
			return fmt.Errorf("failed to awaken Aaru Realm: %w", err)
		}
	}

	// Awaken Aten Realm (centralized) - if present
	if st.AtenRealm != nil {
		if err := st.AtenRealm.Awaken(); err != nil {
			return fmt.Errorf("failed to awaken Aten Realm: %w", err)
		}
	}

	log.Printf("[Sekhem] Triad harmonized - %d realms active", st.GetActiveRealmCount())

	return nil
}

// Stop halts all realms
func (st *SekhemTriad) Stop() {
	log.Printf("[Sekhem] Stopping the Triad...")

	if st.DuatRealm != nil {
		st.DuatRealm.Stop()
	}

	if st.AaruRealm != nil {
		st.AaruRealm.Sleep()
	}

	if st.AtenRealm != nil {
		st.AtenRealm.Sleep()
	}

	log.Printf("[Sekhem] Triad stopped")
}

// GetActiveRealmCount returns the number of active realms
func (st *SekhemTriad) GetActiveRealmCount() int {
	count := 0
	if st.DuatRealm != nil {
		count++
	}
	if st.AaruRealm != nil {
		count++
	}
	if st.AtenRealm != nil {
		count++
	}
	return count
}

// GetMode returns the current deployment mode
func (st *SekhemTriad) GetMode() DeploymentMode {
	return st.Mode
}
