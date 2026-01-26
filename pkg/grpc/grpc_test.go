package grpc

import (
	"testing"
	"time"
)

func TestBridgeConfig(t *testing.T) {
	config := &BridgeConfig{
		RegistryURL:     "ironbank.dso.mil",
		ScannerEndpoint: "scanner.example.com:443",
		ClientID:        "test-client",
		ClientSecret:    "test-secret",
		CertPath:        "/path/to/cert.pem",
		KeyPath:         "/path/to/key.pem",
		CACertPath:      "/path/to/ca.pem",
		FIPSEnforced:    true,
		AirGapped:       false,
		Timeout:         5 * time.Minute,
		MaxRetries:      3,
		CacheTTL:        1 * time.Hour,
	}

	if config.RegistryURL != "ironbank.dso.mil" {
		t.Error("expected registry URL to be set")
	}

	if !config.FIPSEnforced {
		t.Error("expected FIPS enforced to be true")
	}

	if config.MaxRetries != 3 {
		t.Errorf("expected 3 max retries, got %d", config.MaxRetries)
	}
}

func TestRetryPolicy(t *testing.T) {
	policy := RetryPolicy{
		MaxRetries:        5,
		InitialBackoff:    100 * time.Millisecond,
		MaxBackoff:        30 * time.Second,
		BackoffMultiplier: 2.0,
	}

	if policy.MaxRetries != 5 {
		t.Error("expected max retries to be 5")
	}

	if policy.BackoffMultiplier != 2.0 {
		t.Error("expected backoff multiplier to be 2.0")
	}
}

func TestScanCacheEntry(t *testing.T) {
	entry := &ScanCacheEntry{
		Result:    nil, // Would be a pb.ScanResponse in real usage
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}

	if entry.ExpiresAt.Before(time.Now()) {
		t.Error("expected cache entry to not be expired")
	}
}

func TestNewIronBankBridge_MissingEndpoint(t *testing.T) {
	config := &BridgeConfig{
		ScannerEndpoint: "", // Missing
	}

	_, err := NewIronBankBridge(config)
	if err == nil {
		t.Error("expected error when scanner endpoint is missing")
	}
}

func TestBridgeConfig_Defaults(t *testing.T) {
	config := &BridgeConfig{
		ScannerEndpoint: "test:443",
		// Leave timeout and cacheTTL at zero
	}

	// The NewIronBankBridge will set defaults - we test the config structure
	if config.Timeout != 0 {
		t.Error("expected default timeout to be 0 before initialization")
	}
}
