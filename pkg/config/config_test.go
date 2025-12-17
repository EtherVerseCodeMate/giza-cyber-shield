package config

import (
	"os"
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	// Ensure clean env
	os.Unsetenv("KHEPRA_USER")

	cfg := Load()
	if cfg.Username != "khepra" {
		t.Errorf("Expected default username 'khepra', got '%s'", cfg.Username)
	}
}

func TestLoadEnvOverride(t *testing.T) {
	os.Setenv("KHEPRA_USER", "testuser")
	defer os.Unsetenv("KHEPRA_USER")

	cfg := Load()
	if cfg.Username != "testuser" {
		t.Errorf("Expected username 'testuser', got '%s'", cfg.Username)
	}
}
