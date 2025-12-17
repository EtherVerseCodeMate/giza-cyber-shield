package compliance

import (
	"testing"
)

func TestEngine(t *testing.T) {
	engine := NewEngine()
	if len(engine.Checks) == 0 {
		t.Error("Expected checks to be loaded")
	}

	results := engine.Run()
	if len(results) == 0 {
		t.Error("Expected results from Run")
	}

	foundCommon := false
	for _, r := range results {
		if r.Check.ID == "check_os_arch" {
			foundCommon = true
			if r.Status != StatusPass {
				t.Errorf("Expected check_os_arch to pass, got %s", r.Status)
			}
		}
	}

	if !foundCommon {
		t.Error("Expected to find check_os_arch result")
	}
}
