package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/cloudflare/circl/sign/mldsa/mldsa65"
)

// enrollmentRecord is written to the DAG directory as a tamper-evident
// installation record. The daemon signs a proper DAG node on first startup;
// this serves as the installation-time audit trail.
type enrollmentRecord struct {
	Type             string `json:"type"`
	AgentID          string `json:"agent_id"`         // hex-encoded public key
	InstalledAt      string `json:"installed_at"`      // RFC3339
	InstallerVersion string `json:"installer_version"`
	LicenseTier      string `json:"license_tier"`
}

// generateAndEnrollKey generates an ML-DSA-65 keypair for the newly installed
// desktop instance, writes the keys to dataDir/keys/, writes the public key
// to dataDir/daemon/agent.pub (the daemon's trusted-agent store), and records
// the enrollment as a JSON node in dataDir/dag/.
//
// Returns the hex-encoded public key (used as the AgentID) on success.
func generateAndEnrollKey(dataDir string, log func(string)) (string, error) {
	// 1. Generate ML-DSA-65 keypair
	log("  Generating ML-DSA-65 keypair (CRYSTALS-Dilithium3)…")
	pub, priv, err := mldsa65.GenerateKey(rand.Reader)
	if err != nil {
		return "", fmt.Errorf("mldsa65.GenerateKey: %w", err)
	}

	privBytes, err := priv.MarshalBinary()
	if err != nil {
		return "", fmt.Errorf("marshal private key: %w", err)
	}
	pubBytes, err := pub.MarshalBinary()
	if err != nil {
		return "", fmt.Errorf("marshal public key: %w", err)
	}

	agentID := hex.EncodeToString(pubBytes)

	// 2. Write private key (mode 0600 — owner read/write only)
	keysDir := filepath.Join(dataDir, "keys")
	if err := os.MkdirAll(keysDir, 0700); err != nil {
		return "", fmt.Errorf("create keys dir: %w", err)
	}
	privPath := filepath.Join(keysDir, "instance.key")
	if err := os.WriteFile(privPath, []byte(hex.EncodeToString(privBytes)), 0600); err != nil {
		return "", fmt.Errorf("write private key %s: %w", privPath, err)
	}
	log(fmt.Sprintf("  Private key: %s (mode 0600)", privPath))

	// 3. Write public key alongside private key
	pubPath := filepath.Join(keysDir, "instance.pub")
	if err := os.WriteFile(pubPath, []byte(agentID), 0644); err != nil {
		return "", fmt.Errorf("write public key: %w", err)
	}

	// 4. Write public key to daemon's trusted-agent store
	// The daemon reads --agent-pubkey pointing to this file (or directory of .pub files
	// for multi-identity Enterprise deployments).
	daemonKeyDir := filepath.Join(dataDir, "daemon")
	if err := os.MkdirAll(daemonKeyDir, 0750); err != nil {
		return "", fmt.Errorf("create daemon key dir: %w", err)
	}
	agentPubPath := filepath.Join(daemonKeyDir, "agent.pub")
	if err := os.WriteFile(agentPubPath, []byte(agentID), 0644); err != nil {
		return "", fmt.Errorf("write agent.pub: %w", err)
	}
	log(fmt.Sprintf("  Agent public key enrolled: %s", agentPubPath))

	// 5. Record enrollment as a DAG node (unsigned; daemon signs on first start)
	dagDir := filepath.Join(dataDir, "dag")
	if err := os.MkdirAll(dagDir, 0750); err != nil {
		return "", fmt.Errorf("create dag dir: %w", err)
	}
	record := enrollmentRecord{
		Type:             "enrollment",
		AgentID:          agentID,
		InstalledAt:      time.Now().UTC().Format(time.RFC3339),
		InstallerVersion: AppVersion,
		LicenseTier:      "community", // updated by app on first license check
	}
	nodeJSON, err := json.MarshalIndent(record, "", "  ")
	if err != nil {
		return agentID, fmt.Errorf("marshal enrollment record: %w", err)
	}
	nodePath := filepath.Join(dagDir,
		fmt.Sprintf("enrollment-%s.json", time.Now().UTC().Format("20060102-150405")))
	if err := os.WriteFile(nodePath, nodeJSON, 0640); err != nil {
		return agentID, fmt.Errorf("write enrollment DAG node: %w", err)
	}
	log(fmt.Sprintf("  Enrollment DAG node: %s", nodePath))

	// Zero the private key bytes in memory before returning
	for i := range privBytes {
		privBytes[i] = 0
	}

	return agentID, nil
}
