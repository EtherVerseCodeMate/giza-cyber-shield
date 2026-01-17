package ir

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/lorentz"
)

// Manager handles the lifecycle of incidents
type Manager struct {
	store dag.Store
}

// NewManager creates a new Incident Manager
func NewManager(store dag.Store) *Manager {
	return &Manager{store: store}
}

// CreateIncident initializes a new incident and logs it to the DAG
func (m *Manager) CreateIncident(title, desc string, severity Severity, iType string, privKey []byte) (*Incident, error) {
	incident := &Incident{
		ID:          fmt.Sprintf("inc-%d", time.Now().Unix()),
		Title:       title,
		Description: desc,
		Severity:    severity,
		Status:      StatusOpen,
		Type:        iType,
		DetectedAt:  time.Now(),
		UpdatedAt:   time.Now(),
		Timeline: []Event{
			{
				Timestamp: time.Now(),
				Message:   fmt.Sprintf("Incident Created: %s", title),
				Actor:     "System",
			},
		},
	}

	// Persist to DAG
	if err := m.logToDAG(incident, "incident_created", privKey); err != nil {
		return nil, err
	}

	return incident, nil
}

// AddIOC adds an Indicator of Compromise to an incident
func (m *Manager) AddIOC(incident *Incident, iocType, value, desc string, privKey []byte) error {
	ioc := IOC{Type: iocType, Value: value, Desc: desc}
	incident.IOCs = append(incident.IOCs, ioc)
	incident.UpdatedAt = time.Now()
	
	// Add event
	incident.Events = append(incident.Events, Event{
		Timestamp: time.Now(),
		Message:   fmt.Sprintf("IOC Added: %s (%s)", value, iocType),
		Actor:     "AGI",
	})

	return m.logToDAG(incident, "incident_updated", privKey)
}

// UpdateStatus changes the status of an incident
func (m *Manager) UpdateStatus(incident *Incident, status Status, msg string, privKey []byte) error {
	incident.Status = status
	incident.UpdatedAt = time.Now()
	incident.Events = append(incident.Events, Event{
		Timestamp: time.Now(),
		Message:   fmt.Sprintf("Status Changed to %s: %s", status, msg),
		Actor:     "AGI",
	})

	return m.logToDAG(incident, "incident_status_change", privKey)
}

// logToDAG serializes the incident and writes a signed node to the DAG
func (m *Manager) logToDAG(inc *Incident, action string, privKey []byte) error {
	data, err := json.Marshal(inc)
	if err != nil {
		return err
	}

	node := dag.Node{
		Action: action,
		Symbol: "Sankofa", // "Go back and get it" - Learn from the past
		Time:   lorentz.StampNow(),
		PQC: map[string]string{
			"incident_id": inc.ID,
			"severity":    string(inc.Severity),
			"type":        inc.Type,
			"status":      string(inc.Status),
			"version":     "1.0",
		},
	}
	// We could embed the full JSON in the PQC map or as a separate payload field if Node supported it.
	// For now, we'll stringify it into a "payload" key, though that's heavy.
	// Better pattern: The Node IS the record.
	// But `pkg/dag` structure is rigid. Let's use PQC map for critical metadata and rely on file persistence for full body if needed.
	// Actually, `pkg/dag/persistence.go` just dumps the node.
	// We'll stick to critical metadata in PQC for the chain, and maybe extended data elsewhere?
	// For this MVP, let's put the essential fields in PQC and assume the "title" is enough context.
	node.PQC["title"] = inc.Title
	
	// Sign and Add
	if err := node.Sign(privKey); err != nil {
		return err
	}
	return m.store.Add(&node, []string{})
}
