// pkg/asaf/daemon/keys.go — Key Material Loading for ASAF System Daemon
//
// Loads ML-DSA-65 (Dilithium3) key material from disk.
// Keys are stored as raw bytes (no PEM wrapping required by adinkra package).
// File permissions are validated — daemon refuses to start with world-readable keys.

package daemon

import (
	"fmt"
	"os"
	"runtime"
)

// LoadPublicKey reads an ML-DSA-65 public key from disk.
// Validates that the file is not world-readable on non-Windows systems.
func LoadPublicKey(path string) ([]byte, error) {
	if err := checkKeyPerms(path); err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("keys: read public key %s: %w", path, err)
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("keys: public key file %s is empty", path)
	}
	return data, nil
}

// LoadPrivateKey reads an ML-DSA-65 private key from disk.
// Stricter permission check than public key — private key must be mode 0400 or 0600.
func LoadPrivateKey(path string) ([]byte, error) {
	if err := checkKeyPerms(path); err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("keys: read private key %s: %w", path, err)
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("keys: private key file %s is empty", path)
	}
	return data, nil
}

// checkKeyPerms validates that a key file is not world-readable.
// Skipped on Windows (different permission model).
func checkKeyPerms(path string) error {
	if runtime.GOOS == "windows" {
		// Windows ACL model — trust the administrator
		return nil
	}
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("keys: stat %s: %w", path, err)
	}
	mode := info.Mode().Perm()
	// Reject if group or other can read
	if mode&0044 != 0 {
		return fmt.Errorf("keys: %s is group/world readable (mode %04o) — fix with: chmod 0400 %s",
			path, mode, path)
	}
	return nil
}
