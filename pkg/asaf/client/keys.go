// pkg/asaf/client/keys.go — agent identity key provisioning.
//
// asaf-daemon trusts exactly one ML-DSA-65 public key (loaded once at
// startup via --agent-pubkey). This is the client-side counterpart: load
// the existing keypair if one exists, else generate a fresh one and write
// both halves to disk — raw bytes, no PEM, matching pkg/asaf/daemon/keys.go's
// LoadPrivateKey/LoadPublicKey format exactly.
//
// The operator is responsible for getting the generated public key to
// wherever asaf-daemon's --agent-pubkey flag points (e.g. /etc/asaf/agent.pub)
// — this package does not assume it can write to that path itself, since on
// a real install the daemon and this client may run as different users with
// different filesystem access (daemon: root via systemd; serve: an
// unprivileged container user). See ProvisionAgentKeys's return value.
package client

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
)

// ProvisionedKeys holds the loaded or freshly-generated agent identity.
type ProvisionedKeys struct {
	PrivKey []byte
	PubKey  []byte
	// PubKeyPath is where the public half was written (or already existed).
	// Copy this file to the path asaf-daemon's --agent-pubkey expects if
	// it's not already the same path (e.g. shared volume in Docker Compose).
	PubKeyPath string
	// Generated is true if a new keypair was created this call, false if an
	// existing one was loaded. Callers may want to log this distinction —
	// a freshly generated key means any previously-paired daemon now has a
	// stale --agent-pubkey and needs the new public key copied to it.
	Generated bool
}

// ProvisionAgentKeys loads the agent keypair from privKeyPath/pubKeyPath,
// generating and persisting a new ML-DSA-65 (Dilithium3) keypair if no
// private key file exists yet. Private key is written 0600, public 0644
// (matching pkg/asaf/daemon/keys.go's checkKeyPerms expectations on non-Windows).
func ProvisionAgentKeys(privKeyPath, pubKeyPath string) (*ProvisionedKeys, error) {
	if priv, err := os.ReadFile(privKeyPath); err == nil {
		if len(priv) == 0 {
			return nil, fmt.Errorf("client: private key file %s exists but is empty", privKeyPath)
		}
		pub, err := os.ReadFile(pubKeyPath)
		if err != nil {
			return nil, fmt.Errorf("client: private key exists at %s but matching public key missing at %s: %w",
				privKeyPath, pubKeyPath, err)
		}
		return &ProvisionedKeys{PrivKey: priv, PubKey: pub, PubKeyPath: pubKeyPath, Generated: false}, nil
	} else if !os.IsNotExist(err) {
		return nil, fmt.Errorf("client: read private key %s: %w", privKeyPath, err)
	}

	pub, priv, err := adinkra.GenerateDilithiumKey()
	if err != nil {
		return nil, fmt.Errorf("client: generate agent keypair: %w", err)
	}

	for _, dir := range []string{filepath.Dir(privKeyPath), filepath.Dir(pubKeyPath)} {
		if dir != "." {
			if err := os.MkdirAll(dir, 0700); err != nil {
				return nil, fmt.Errorf("client: create key directory %s: %w", dir, err)
			}
		}
	}
	if err := writeKeyFile(privKeyPath, priv, 0600); err != nil {
		return nil, err
	}
	if err := writeKeyFile(pubKeyPath, pub, 0644); err != nil {
		return nil, err
	}

	return &ProvisionedKeys{PrivKey: priv, PubKey: pub, PubKeyPath: pubKeyPath, Generated: true}, nil
}

func writeKeyFile(path string, data []byte, perm os.FileMode) error {
	if err := os.WriteFile(path, data, perm); err != nil {
		return fmt.Errorf("client: write key file %s: %w", path, err)
	}
	return nil
}
