package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/agi"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/config"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
)

func TestDagAdd(t *testing.T) {
	// Setup
	cfg := config.Load()
	store := dag.NewMemory()
	arch := agi.NewEngine(store)
	s := &server{cfg: cfg, store: store, agi: arch}

	// Create Request
	payload := map[string]interface{}{
		"action":     "test-action",
		"symbol":     "TestSymbol",
		"parent_ids": []string{},
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/dag/add", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	// Execute
	s.dagAdd(w, req)

	// Assert
	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200 OK, got %d", resp.StatusCode)
		// debug body
		t.Logf("Response Body: %s", w.Body.String())
	}

	var n dag.Node
	if err := json.NewDecoder(w.Body).Decode(&n); err != nil {
		t.Fatal(err)
	}

	if n.Action != "test-action" {
		t.Errorf("Expected action test-action, got %s", n.Action)
	}
	if n.ID == "" {
		t.Error("Expected Node ID to be set (by content hash)")
	}
}

func TestHealth(t *testing.T) {
	cfg := config.Load()
	s := &server{cfg: cfg}

	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()

	s.health(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 OK, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if ok, exists := resp["ok"]; !exists || ok != true {
		t.Error("Expected ok: true")
	}
}
