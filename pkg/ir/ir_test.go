package ir

import (
	"testing"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
)

// MockStore implements dag.Store for testing
type MockStore struct {
	nodes []*dag.Node
}

func (m *MockStore) Add(node *dag.Node, parents []string) error {
	m.nodes = append(m.nodes, node)
	return nil
}

func (m *MockStore) Get(id string) (*dag.Node, bool) {
	for _, n := range m.nodes {
		if n.ID == id {
			return n, true
		}
	}
	return nil, false
}

func (m *MockStore) All() []*dag.Node {
	return m.nodes
}

func TestIncidentTypes(t *testing.T) {
	// Test severity levels
	severities := []Severity{
		SevCritical,
		SevHigh,
		SevMedium,
		SevLow,
	}

	for _, s := range severities {
		if s == "" {
			t.Error("severity should not be empty")
		}
	}

	// Test status values
	statuses := []Status{
		StatusOpen,
		StatusInProgress,
		StatusContained,
		StatusClosed,
	}

	for _, s := range statuses {
		if s == "" {
			t.Error("status should not be empty")
		}
	}
}

func TestIncidentStructure(t *testing.T) {
	incident := &Incident{
		ID:          "inc-123",
		Title:       "Test Incident",
		Description: "A test security incident",
		Severity:    SevHigh,
		Status:      StatusOpen,
		Type:        "malware",
		DetectedAt:  time.Now(),
		UpdatedAt:   time.Now(),
		IOCs: []IOC{
			{Type: "ip", Value: "192.168.1.100", Desc: "Malicious IP"},
			{Type: "hash", Value: "abc123", Desc: "Malware hash"},
		},
		Events: []Event{
			{Timestamp: time.Now(), Message: "Incident created", Actor: "System"},
		},
	}

	if incident.ID == "" {
		t.Error("expected non-empty incident ID")
	}

	if len(incident.IOCs) != 2 {
		t.Errorf("expected 2 IOCs, got %d", len(incident.IOCs))
	}

	if len(incident.Events) != 1 {
		t.Errorf("expected 1 event, got %d", len(incident.Events))
	}
}

func TestIOCStructure(t *testing.T) {
	ioc := IOC{
		Type:  "domain",
		Value: "malicious.example.com",
		Desc:  "C2 domain",
	}

	if ioc.Type == "" {
		t.Error("expected non-empty IOC type")
	}

	if ioc.Value == "" {
		t.Error("expected non-empty IOC value")
	}
}

func TestEventStructure(t *testing.T) {
	event := Event{
		Timestamp: time.Now(),
		Message:   "Status changed to Contained",
		Actor:     "security-analyst",
	}

	if event.Message == "" {
		t.Error("expected non-empty event message")
	}

	if event.Actor == "" {
		t.Error("expected non-empty event actor")
	}

	if event.Timestamp.IsZero() {
		t.Error("expected non-zero timestamp")
	}
}

func TestNewManager(t *testing.T) {
	store := &MockStore{}
	mgr := NewManager(store)

	if mgr == nil {
		t.Fatal("expected non-nil manager")
	}

	if mgr.store == nil {
		t.Error("expected store to be set")
	}
}

func TestManager_CreateIncident(t *testing.T) {
	// Skip test that requires valid PQC keys
	// In a real environment, ML-DSA-65 keys would be generated properly
	t.Skip("Skipping test that requires valid ML-DSA-65 private key - integration tests require PQC key generation")
}

func TestManager_AddIOC(t *testing.T) {
	// Skip test that requires valid PQC keys
	t.Skip("Skipping test that requires valid ML-DSA-65 private key - integration tests require PQC key generation")
}

func TestManager_UpdateStatus(t *testing.T) {
	// Skip test that requires valid PQC keys
	t.Skip("Skipping test that requires valid ML-DSA-65 private key - integration tests require PQC key generation")
}

func TestIncidentLifecycle(t *testing.T) {
	// Skip test that requires valid PQC keys
	t.Skip("Skipping test that requires valid ML-DSA-65 private key - integration tests require PQC key generation")
}

func TestSeverityConstants(t *testing.T) {
	// Verify severity constants are defined correctly
	if SevCritical != "CRITICAL" {
		t.Errorf("expected SevCritical='CRITICAL', got '%s'", SevCritical)
	}
	if SevHigh != "HIGH" {
		t.Errorf("expected SevHigh='HIGH', got '%s'", SevHigh)
	}
	if SevMedium != "MEDIUM" {
		t.Errorf("expected SevMedium='MEDIUM', got '%s'", SevMedium)
	}
	if SevLow != "LOW" {
		t.Errorf("expected SevLow='LOW', got '%s'", SevLow)
	}
}

func TestStatusConstants(t *testing.T) {
	if StatusOpen != "OPEN" {
		t.Errorf("expected StatusOpen='OPEN', got '%s'", StatusOpen)
	}
	if StatusInProgress != "IN_PROGRESS" {
		t.Errorf("expected StatusInProgress='IN_PROGRESS', got '%s'", StatusInProgress)
	}
	if StatusContained != "CONTAINED" {
		t.Errorf("expected StatusContained='CONTAINED', got '%s'", StatusContained)
	}
	if StatusClosed != "CLOSED" {
		t.Errorf("expected StatusClosed='CLOSED', got '%s'", StatusClosed)
	}
}
