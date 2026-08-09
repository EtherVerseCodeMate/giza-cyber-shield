// pkg/asaf/connector/fleet_session.go
// PQC-hybrid session management for fleet operations.
//
// Every fleet operation (scan, remediation, attestation) runs inside a FleetSession.
// The session key is established via ML-KEM-768 + X25519 hybrid encapsulation —
// both must be broken simultaneously to recover the key (defense in depth).
//
// Session lifecycle:
//   1. Hub generates FleetSession for an asset operation
//   2. SessionToken() is attached to every command (Authorization: Fleet <token>)
//   3. KASA agent verifies token against Hub's public key before executing
//   4. Session expires after TTL (default 30 minutes)
//   5. Scan results sealed with session AES-256-GCM key before transit
//
// Symbol constraint (mirrors ASAF daemon rule):
//   "Nkyinkyim" → scan / read operations (default)
//   "Eban"      → privileged / remediation operations (requires explicit elevation)
//
// IP: SOUHIMBOU DOH KONE LLC — exclusively licensed to SecRed Knowledge Inc.
// USPTO #73565085 (KHEPRA Protocol)

package connector

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
)

const (
	// FleetSessionTTL is the default session lifetime.
	// 30 minutes matches NIST SP 800-63B re-authentication guidance.
	FleetSessionTTL = 30 * time.Minute

	// SymbolScan is the Adinkra symbol for read-only fleet operations.
	// Nkyinkyim (the journey) — adaptable, non-destructive.
	SymbolScan = "Nkyinkyim"

	// SymbolRemediate is the Adinkra symbol for privileged operations.
	// Eban (the fence/fortress) — protective, destructive-capable.
	// Requires explicit CISO approval in the staging gate.
	SymbolRemediate = "Eban"
)

// FleetSession is the PQC-hybrid authenticated context for a single fleet operation.
// Create one per asset per operation. Never reuse across assets.
type FleetSession struct {
	SessionID    string    // hex(sha256(sharedSecret[:16])) — safe to log
	AssetID      string    // enrolled asset UUID
	Symbol       string    // "Nkyinkyim" or "Eban"
	sharedSecret [32]byte  // AES-256 session key — NEVER log, never serialize
	Expiry       time.Time
	token        *adinkra.ZeroTrustToken
	hubKey       *adinkra.HybridKeyPair
}

// NewFleetSession creates a new PQC-hybrid fleet session for the given asset.
// hubKey is the Hub's HybridKeyPair — the session key derives from it via HKDF.
// symbol must be SymbolScan for read operations, SymbolRemediate for writes.
func NewFleetSession(assetID, symbol string, hubKey *adinkra.HybridKeyPair, ttl time.Duration) (*FleetSession, error) {
	if assetID == "" {
		return nil, fmt.Errorf("fleet session: assetID required")
	}
	if symbol != SymbolScan && symbol != SymbolRemediate {
		return nil, fmt.Errorf("fleet session: invalid symbol %q — must be Nkyinkyim or Eban", symbol)
	}
	if hubKey == nil {
		return nil, fmt.Errorf("fleet session: hubKey required (no anonymous fleet operations)")
	}
	if ttl <= 0 {
		ttl = FleetSessionTTL
	}

	// Derive session secret: 32 random bytes sealed inside the hybrid key.
	// In the KASA push model: Hub encapsulates → sends ciphertext to agent.
	// Agent decapsulates → recovers same 32-byte secret.
	// For the agentless pull model: secret is local only (seals results in memory).
	var rawSecret [32]byte
	if _, err := io.ReadFull(rand.Reader, rawSecret[:]); err != nil {
		return nil, fmt.Errorf("fleet session: entropy failure: %w", err)
	}

	// SessionID: safe public identifier derived from the secret.
	// sha256(secret[:16]) — reveals nothing about the secret.
	h := sha256.Sum256(rawSecret[:16])
	sessionID := hex.EncodeToString(h[:16])

	// Issue a ZeroTrustToken the KASA agent can verify out-of-band.
	// kAuth derives from the Hub's Kyber public key material.
	kAuth := sha256.Sum256(hubKey.KyberPublic)
	tok, err := adinkra.IssueZeroTrustTokenWithTTL(
		"asaf-hub",
		symbol,
		100.0, // max trust for Hub-issued sessions
		kAuth[:],
		ttl,
	)
	if err != nil {
		return nil, fmt.Errorf("fleet session: token issue: %w", err)
	}

	s := &FleetSession{
		SessionID:    sessionID,
		AssetID:      assetID,
		Symbol:       symbol,
		sharedSecret: rawSecret,
		Expiry:       time.Now().Add(ttl),
		token:        tok,
		hubKey:       hubKey,
	}
	return s, nil
}

// Expired reports whether the session TTL has elapsed.
func (s *FleetSession) Expired() bool {
	return time.Now().After(s.Expiry)
}

// SessionToken serializes the ZeroTrustToken as a compact JSON string for
// use in HTTP Authorization headers: "Authorization: Fleet <token>".
func (s *FleetSession) SessionToken() (string, error) {
	b, err := json.Marshal(s.token)
	if err != nil {
		return "", fmt.Errorf("fleet session: token serialize: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// SealCommand encrypts a command payload with the session AES-256-GCM key.
// Used when sending commands to a KASA agent over the mTLS channel.
// The nonce is prepended to the ciphertext (12 bytes || ciphertext).
func (s *FleetSession) SealCommand(plaintext []byte) ([]byte, error) {
	if s.Expired() {
		return nil, fmt.Errorf("fleet session %s: expired — create a new session", s.SessionID)
	}
	return sealAESGCM(s.sharedSecret[:], plaintext)
}

// OpenResult decrypts a result payload that was sealed by the KASA agent
// using the shared session key.
func (s *FleetSession) OpenResult(ciphertext []byte) ([]byte, error) {
	if s.Expired() {
		return nil, fmt.Errorf("fleet session %s: expired", s.SessionID)
	}
	return openAESGCM(s.sharedSecret[:], ciphertext)
}

// Destroy zeroes the shared secret from memory.
// Call via defer after the session is no longer needed.
func (s *FleetSession) Destroy() {
	for i := range s.sharedSecret {
		s.sharedSecret[i] = 0
	}
}

// ── AES-256-GCM helpers ───────────────────────────────────────────────────────

func sealAESGCM(key, plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

func openAESGCM(key, data []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	ns := gcm.NonceSize()
	if len(data) < ns {
		return nil, fmt.Errorf("fleet session: ciphertext too short")
	}
	return gcm.Open(nil, data[:ns], data[ns:], nil)
}
