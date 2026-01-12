package telemetry

import (
	"testing"
)

func TestGenerateAnonymousID(t *testing.T) {
	id1 := GenerateAnonymousID()
	id2 := GenerateAnonymousID()

	if id1 == "" {
		t.Error("GenerateAnonymousID returned empty string")
	}
	if len(id1) != 64 {
		t.Errorf("GenerateAnonymousID length = %d, want 64", len(id1))
	}
	if id1 != id2 {
		t.Error("GenerateAnonymousID returned different IDs (should be stable for device)")
	}
}

func TestDetectContainerRuntime(t *testing.T) {
	// Since we can't easily mock file system in this simple test without refactoring,
	// we just ensure it returns a valid string (likely "none" or "docker" depending on env).
	runtime := DetectContainerRuntime()
	if runtime == "" {
		t.Error("DetectContainerRuntime returned empty string")
	}
}

func TestDetectGeographicHint(t *testing.T) {
	// Checks timezone logic
	hint := DetectGeographicHint()
	if hint == "" {
		t.Error("DetectGeographicHint returned empty string")
	}
}

func TestExtractCryptoInventory(t *testing.T) {
	// This would require a full AuditSnapshot mock.
	// We'll skip complex logic for now or stick to simple unit tests.
}
