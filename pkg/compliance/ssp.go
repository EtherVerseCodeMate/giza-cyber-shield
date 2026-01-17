package compliance

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/lorentz"
)

// ComplianceDomain represents a CMMC Domain (e.g., AC, AU, IR)
type ComplianceDomain string

const (
	DomainAC ComplianceDomain = "Access Control"
	DomainAU ComplianceDomain = "Audit and Accountability"
	DomainCM ComplianceDomain = "Configuration Management"
	DomainIA ComplianceDomain = "Identification and Authentication"
	DomainIR ComplianceDomain = "Incident Response"
	DomainMA ComplianceDomain = "Maintenance"
	DomainMP ComplianceDomain = "Media Protection"
	DomainPE ComplianceDomain = "Physical Protection"
	DomainPS ComplianceDomain = "Personnel Security"
	DomainRA ComplianceDomain = "Risk Assessment"
	DomainCA ComplianceDomain = "Security Assessment"
	DomainSC ComplianceDomain = "System and Communications Protection"
	DomainSI ComplianceDomain = "System and Information Integrity"
	DomainSR ComplianceDomain = "Supply Chain Risk Management"
)

// Control represents a single CMMC practice (e.g., AC.L2-3.1.1)
type Control struct {
	ID          string           `json:"id"`
	Domain      ComplianceDomain `json:"domain"`
	Description string           `json:"description"`
	Level       int              `json:"level"` // 1, 2, 3
}

// ControlImplementation tracks how a control is satisfied in the SSP
type ControlImplementation struct {
	ControlID   string `json:"control_id"`
	Status      string `json:"status"` // IMPLEMENTED, PLANNED, PARTIAL, N/A
	Narrative   string `json:"narrative"`
	EvidenceIDs []string `json:"evidence_ids"` // Links to DAG nodes verifying this
	LastAudited time.Time `json:"last_audited"`
}

// SystemSecurityPlan represents the digital SSP
type SystemSecurityPlan struct {
	SystemName      string                           `json:"system_name"`
	CAGECode        string                           `json:"cage_code"`
	SecurityOfficer string                           `json:"security_officer"` // ISSO
	Components      []SystemComponent                `json:"components"`
	Controls        map[string]ControlImplementation `json:"controls"`
	UpdatedAt       time.Time                        `json:"updated_at"`
}

type SystemComponent struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Type       string `json:"type"` // SERVER, ENDPOINT, NETWORK
	IsCUIAsset bool   `json:"is_cui_asset"`
}

// Manager handles the SSP
type Manager struct {
	store dag.Store
	SSP   *SystemSecurityPlan
}

// NewManager creates a new Compliance Manager with an empty SSP
func NewManager(store dag.Store) *Manager {
	return &Manager{
		store: store,
		SSP: &SystemSecurityPlan{
			SystemName: "Khepra Protected Enclave",
			Controls:   make(map[string]ControlImplementation),
			Components: []SystemComponent{},
		},
	}
}

// UpdateControl updates the implementation status of a specific control
func (m *Manager) UpdateControl(controlID, status, narrative string, privKey []byte) error {
	impl := ControlImplementation{
		ControlID:   controlID,
		Status:      status,
		Narrative:   narrative,
		LastAudited: time.Now(),
	}
	m.SSP.Controls[controlID] = impl
	m.SSP.UpdatedAt = time.Now()

	// Log to DAG
	return m.logControlUpdate(impl, privKey)
}

func (m *Manager) logControlUpdate(impl ControlImplementation, privKey []byte) error {
	data, _ := json.Marshal(impl) // Ignore error, simple struct

	node := dag.Node{
		Action: fmt.Sprintf("ssp-update:%s", impl.ControlID),
		Symbol: "Eban", // Fence/Protection
		Time:   lorentz.StampNow(),
		PQC: map[string]string{
			"control_id": impl.ControlID,
			"status":     impl.Status,
			"narrative":  impl.Narrative, // Truncate if too long in real impl
			"type":       "SSP_MODIFICATION",
		},
	}
	// Sign and Add
	if err := node.Sign(privKey); err != nil {
		return err
	}
	return m.store.Add(&node, []string{})
}
