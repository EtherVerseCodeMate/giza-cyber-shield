package agi

import (
	"testing"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
)

func TestNewEngine(t *testing.T) {
	mem := dag.NewMemory()
	e := NewEngine(mem)

	if e.Status != "Initialized" {
		t.Errorf("Expected status Initialized, got %s", e.Status)
	}

	if e.Objective != ObjectiveAuditor {
		t.Errorf("Expected objective %s, got %s", ObjectiveAuditor, e.Objective)
	}

	if len(e.pubKey) == 0 || len(e.privKey) == 0 {
		t.Error("Expected keys to be generated")
	}
}

func TestGetState(t *testing.T) {
	mem := dag.NewMemory()
	e := NewEngine(mem)

	state := e.GetState()
	if state["mode"] != "KASA-Hybrid-v2" {
		t.Errorf("Expected mode KASA-Hybrid-v2, got %s", state["mode"])
	}
}
