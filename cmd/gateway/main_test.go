package main

import (
	"os"
	"testing"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/gateway"
)

func TestLoadConfig_NoFile(t *testing.T) {
	// When no config file, should return defaults
	cfg := loadConfig("")

	if cfg == nil {
		t.Fatal("expected non-nil config")
	}

	// Should have default values
	if cfg.ListenAddr == "" {
		t.Error("expected default listen address")
	}
}

func TestLoadConfig_InvalidFile(t *testing.T) {
	// When config file doesn't exist, should return defaults
	cfg := loadConfig("/nonexistent/config.json")

	if cfg == nil {
		t.Fatal("expected non-nil config from fallback")
	}
}

func TestLoadConfig_ValidFile(t *testing.T) {
	// Create temporary config file
	tmpFile, err := os.CreateTemp("", "gateway-config-*.json")
	if err != nil {
		t.Skipf("could not create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())

	// Write valid JSON config
	configJSON := `{
		"listen_addr": ":9443",
		"read_timeout": "60s",
		"write_timeout": "60s"
	}`
	tmpFile.WriteString(configJSON)
	tmpFile.Close()

	cfg := loadConfig(tmpFile.Name())

	if cfg == nil {
		t.Fatal("expected non-nil config")
	}

	if cfg.ListenAddr != ":9443" {
		t.Errorf("expected listen addr ':9443', got '%s'", cfg.ListenAddr)
	}
}

func TestCreateUpstreamHandler(t *testing.T) {
	handler := createUpstreamHandler()

	if handler == nil {
		t.Fatal("expected non-nil handler")
	}
}

func TestDefaultConfig(t *testing.T) {
	cfg := gateway.DefaultConfig()

	if cfg == nil {
		t.Fatal("expected non-nil default config")
	}

	if cfg.ListenAddr == "" {
		t.Error("expected non-empty listen address")
	}

	if cfg.ReadTimeout == 0 {
		t.Error("expected non-zero read timeout")
	}
}

func TestPrintBanner(t *testing.T) {
	// Verify doesn't panic
	printBanner()
}
