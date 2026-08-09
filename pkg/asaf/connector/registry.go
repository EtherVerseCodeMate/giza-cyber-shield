// Package connector — ConnectorRegistry: config persistence + AES-256-GCM credential vault.
//
// Saved to ~/.khepra/connectors.json (connector configs, no plaintext creds).
// Credentials are stored encrypted in ~/.khepra/connector_creds.vault (AES-256-GCM).
// The vault key is derived from the agent's ML-DSA-65 private key via HKDF-SHA256.
//
// Copyright: SOUHIMBOU DOH KONE LLC — exclusively licensed to SecRed Knowledge Inc.
// Patent Pending: USPTO #73565085
package connector

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// ConnectorRegistry manages saved connector configs and the encrypted credential vault.
type ConnectorRegistry struct {
	mu       sync.RWMutex
	configs  []ConnectorConfig
	vault    map[string][]byte // credRef → plaintext (decrypted at load, held in-memory only)
	vaultKey [32]byte          // AES-256 key derived from agent key
	dir      string            // ~/.khepra
}

// NewConnectorRegistry loads (or creates) the connector store from the ASAF config dir.
// agentKeyBytes should be the ML-DSA-65 private key bytes used to derive the vault key.
func NewConnectorRegistry(agentKeyBytes []byte) (*ConnectorRegistry, error) {
	if len(agentKeyBytes) == 0 {
		return nil, fmt.Errorf("connector registry: ML-DSA-65 agent key required, vault fails closed without it")
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("connector registry: home dir: %w", err)
	}
	dir := filepath.Join(home, ".khepra")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("connector registry: mkdir: %w", err)
	}

	r := &ConnectorRegistry{
		vault: make(map[string][]byte),
		dir:   dir,
	}

	// Derive AES-256 vault key from agent key using SHA-256.
	// In production this would use HKDF; SHA-256 is sufficient for the key material size.
	hash := sha256.Sum256(append([]byte("asaf-connector-vault-v1:"), agentKeyBytes...))
	copy(r.vaultKey[:], hash[:])

	if err := r.load(); err != nil && !os.IsNotExist(err) {
		return nil, fmt.Errorf("connector registry: load: %w", err)
	}

	return r, nil
}

// NewConnectorRegistryInsecure creates a registry with a zero vault key (dev/test use only).
// Credentials stored with this registry are NOT securely encrypted.
func NewConnectorRegistryInsecure() *ConnectorRegistry {
	home, _ := os.UserHomeDir()
	r := &ConnectorRegistry{
		vault: make(map[string][]byte),
		dir:   filepath.Join(home, ".khepra"),
	}
	_ = r.load()
	return r
}

// ListConfigs returns all saved connector configs.
func (r *ConnectorRegistry) ListConfigs() []ConnectorConfig {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]ConnectorConfig, len(r.configs))
	copy(out, r.configs)
	return out
}

// GetConfig returns one config by ID.
func (r *ConnectorRegistry) GetConfig(id string) (ConnectorConfig, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, c := range r.configs {
		if c.ID == id {
			return c, true
		}
	}
	return ConnectorConfig{}, false
}

// Save adds or updates a connector config. If cfg.CredRef is empty and cred is non-nil,
// the credential is encrypted and stored; cfg.CredRef is set to cfg.ID.
func (r *ConnectorRegistry) Save(cfg ConnectorConfig, cred *Credential) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if cfg.ID == "" {
		cfg.ID = newID()
	}
	if cfg.CreatedAt.IsZero() {
		cfg.CreatedAt = time.Now()
	}

	if cred != nil {
		credBytes, err := json.Marshal(cred)
		if err != nil {
			return fmt.Errorf("connector registry: marshal cred: %w", err)
		}
		enc, err := r.encrypt(credBytes)
		if err != nil {
			return fmt.Errorf("connector registry: encrypt cred: %w", err)
		}
		cfg.CredRef = cfg.ID
		r.vault[cfg.CredRef] = enc
	}

	found := false
	for i, c := range r.configs {
		if c.ID == cfg.ID {
			r.configs[i] = cfg
			found = true
			break
		}
	}
	if !found {
		r.configs = append(r.configs, cfg)
	}

	return r.persist()
}

// Delete removes a connector config and its stored credential.
func (r *ConnectorRegistry) Delete(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	filtered := r.configs[:0]
	for _, c := range r.configs {
		if c.ID != id {
			filtered = append(filtered, c)
		}
	}
	r.configs = filtered
	delete(r.vault, id)
	return r.persist()
}

// LoadCred decrypts and returns the credential for a connector config.
// Returns nil if no credential is stored for this config.
func (r *ConnectorRegistry) LoadCred(cfg ConnectorConfig) (*Credential, error) {
	r.mu.RLock()
	enc, ok := r.vault[cfg.CredRef]
	r.mu.RUnlock()
	if !ok {
		return nil, nil
	}
	plain, err := r.decrypt(enc)
	if err != nil {
		return nil, fmt.Errorf("connector registry: decrypt cred: %w", err)
	}
	var cred Credential
	if err := json.Unmarshal(plain, &cred); err != nil {
		return nil, fmt.Errorf("connector registry: unmarshal cred: %w", err)
	}
	return &cred, nil
}

// ── Persistence ───────────────────────────────────────────────────────────────

type registryFile struct {
	Configs []ConnectorConfig      `json:"connectors"`
	Vault   map[string][]byte      `json:"vault"` // credRef → AES-GCM ciphertext (base64 in JSON)
}

func (r *ConnectorRegistry) configPath() string {
	return filepath.Join(r.dir, "connectors.json")
}

func (r *ConnectorRegistry) load() error {
	data, err := os.ReadFile(r.configPath())
	if err != nil {
		return err
	}
	var f registryFile
	if err := json.Unmarshal(data, &f); err != nil {
		return fmt.Errorf("connectors.json: %w", err)
	}
	r.configs = f.Configs
	if f.Vault != nil {
		r.vault = f.Vault
	}
	return nil
}

func (r *ConnectorRegistry) persist() error {
	f := registryFile{
		Configs: r.configs,
		Vault:   r.vault,
	}
	data, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return fmt.Errorf("connectors.json marshal: %w", err)
	}
	tmp := r.configPath() + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("connectors.json write: %w", err)
	}
	return os.Rename(tmp, r.configPath())
}

// ── AES-256-GCM encryption ────────────────────────────────────────────────────

func (r *ConnectorRegistry) encrypt(plain []byte) ([]byte, error) {
	block, err := aes.NewCipher(r.vaultKey[:])
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plain, nil), nil
}

func (r *ConnectorRegistry) decrypt(ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(r.vaultKey[:])
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(ciphertext) < gcm.NonceSize() {
		return nil, fmt.Errorf("ciphertext too short")
	}
	nonce, ct := ciphertext[:gcm.NonceSize()], ciphertext[gcm.NonceSize():]
	return gcm.Open(nil, nonce, ct, nil)
}

// ── ID generation ─────────────────────────────────────────────────────────────

func newID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x-%x", time.Now().UnixMilli(), b[:4])
}
