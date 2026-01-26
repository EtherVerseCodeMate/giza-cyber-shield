package ir

import (
	"testing"
	"time"
)

// MockStore implements dag.Store for testing
type MockStore struct {
	nodes []interface{}
}

func (m *MockStore) Add(node interface{}, parents []string) error {
	m.nodes = append(m.nodes, node)
	return nil
}

func (m *MockStore) Get(id string) (interface{}, error) {
	return nil, nil
}

func (m *MockStore) All() []interface{} {
	return m.nodes
}

func (m *MockStore) Close() error {
	return nil
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
	store := &MockStore{}
	mgr := NewManager(store)

	// Create a test private key (32 bytes for signing)
	privKey := make([]byte, 32)
	for i := range privKey {
		privKey[i] = byte(i)
	}

	incident, err := mgr.CreateIncident(
		"Test Incident",
		"A test security incident",
		SevHigh,
		"malware",
		privKey,
	)

	if err != nil {
		t.Fatalf("CreateIncident failed: %v", err)
	}

	if incident == nil {
		t.Fatal("expected non-nil incident")
	}

	if incident.ID == "" {
		t.Error("expected non-empty incident ID")
	}

	if incident.Title != "Test Incident" {
		t.Errorf("expected title 'Test Incident', got '%s'", incident.Title)
	}

	if incident.Severity != SevHigh {
		t.Errorf("expected severity HIGH, got %s", incident.Severity)
	}

	if incident.Status != StatusOpen {
		t.Errorf("expected status OPEN, got %s", incident.Status)
	}

	if len(incident.Events) != 1 {
		t.Error("expected initial event to be added")
	}

	// Verify DAG node was added
	if len(store.nodes) != 1 {
		t.Errorf("expected 1 node in store, got %d", len(store.nodes))
	}
}

func TestManager_AddIOC(t *testing.T) {
	store := &MockStore{}
	mgr := NewManager(store)

	privKey := make([]byte, 32)

	incident, _ := mgr.CreateIncident("Test", "Desc", SevMedium, "phishing", privKey)

	err := mgr.AddIOC(incident, "url", "http://malicious.com", "Phishing URL", privKey)
	if err != nil {
		t.Fatalf("AddIOC failed: %v", err)
	}

	if len(incident.IOCs) != 1 {
		t.Errorf("expected 1 IOC, got %d", len(incident.IOCs))
	}

	ioc := incident.IOCs[0]
	if ioc.Type != "url" {
		t.Errorf("expected IOC type 'url', got '%s'", ioc.Type)
	}

	if ioc.Value != "http://malicious.com" {
		t.Errorf("expected IOC value 'http://malicious.com', got '%s'", ioc.Value)
	}

	// Should have added an event
	if len(incident.Events) != 2 {
		t.Error("expected event to be added for IOC")
	}
}

func TestManager_UpdateStatus(t *testing.T) {
	store := &MockStore{}
	mgr := NewManager(store)

	privKey := make([]byte, 32)

	incident, _ := mgr.CreateIncident("Test", "Desc", SevCritical, "ransomware", privKey)

	err := mgr.UpdateStatus(incident, StatusContained, "Threat has been isolated", privKey)
	if err != nil {
		t.Fatalf("UpdateStatus failed: %v", err)
	}

	if incident.Status != StatusContained {
		t.Errorf("expected status CONTAINED, got %s", incident.Status)
	}

	// Should have added an event
	hasStatusEvent := false
	for _, event := range incident.Events {
		if event.Message != "" && event.Actor == "AGI" {
			hasStatusEvent = true
			break
		}
	}

	if !hasStatusEvent {
		t.Error("expected status change event to be added")
	}
}

func TestIncidentLifecycle(t *testing.T) {
	store := &MockStore{}
	mgr := NewManager(store)

	privKey := make([]byte, 32)

	// 1. Create incident
	incident, _ := mgr.CreateIncident(
		"Ransomware Attack",
		"Detected ransomware encryption activity",
		SevCritical,
		"ransomware",
		privKey,
	)

	// 2. Add IOCs
	mgr.AddIOC(incident, "hash", "abc123def456", "Ransomware executable", privKey)
	mgr.AddIOC(incident, "ip", "10.0.0.100", "Infected host", privKey)

	// 3. Update status through lifecycle
	mgr.UpdateStatus(incident, StatusInProgress, "Investigation started", privKey)
	mgr.UpdateStatus(incident, StatusContained, "Host isolated from network", privKey)
	mgr.UpdateStatus(incident, StatusClosed, "Incident resolved", privKey)

	// Verify final state
	if incident.Status != StatusClosed {
		t.Errorf("expected final status CLOSED, got %s", incident.Status)
	}

	if len(incident.IOCs) != 2 {
		t.Errorf("expected 2 IOCs, got %d", len(incident.IOCs))
	}

	// Should have multiple events (1 create + 2 IOC + 3 status)
	expectedEvents := 6
	if len(incident.Events) != expectedEvents {
		t.Errorf("expected %d events, got %d", expectedEvents, len(incident.Events))
	}
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
