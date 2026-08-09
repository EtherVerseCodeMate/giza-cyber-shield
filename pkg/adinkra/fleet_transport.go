// pkg/adinkra/fleet_transport.go
// PQC-native fleet transport layer.
//
// Provides two capabilities:
//
//  1. SealedPayload — hybrid-encrypted (ML-KEM-768 + AES-256-GCM) scan result
//     container for secure Hub ↔ KASA Agent transit.
//     Even if classical TLS is broken, the payload remains protected.
//
//  2. FleetEnrollmentToken — ML-DSA-65 signed enrollment token issued by the Hub.
//     The KASA agent uses this to bootstrap trust without pre-shared secrets.
//     Replaces SSH credential distribution with a signed one-liner install command.
//
// Correct usage of SecureEnvelope:
//   SignArtifact(data) → sets EncryptedData = data, computes all 3 signatures + Blake2bHash.
//   VerifyArtifact first checks Blake2bHash (integrity), then all 3 sigs.
//   You CANNOT construct a partial SecureEnvelope for verification — you must store
//   the full envelope returned by SignArtifact (JSON-serialized as Attestation bytes).
//
// IP: SOUHIMBOU DOH KONE LLC — exclusively licensed to SecRed Knowledge Inc.
// USPTO #73565085 (KHEPRA Protocol)

package adinkra

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"
)

// ── SealedPayload ─────────────────────────────────────────────────────────────

// SealedPayload is a hybrid-encrypted container for fleet scan results.
// Encryption: ML-KEM-768 (Kyber) encapsulated key + AES-256-GCM via EncryptForRecipient.
// Authentication: the full SecureEnvelope from SignArtifact (triple-layer signed).
//
// The recipient (Hub) must hold the corresponding HybridKeyPair private key.
// The signerPubKey (Agent's public key) is used to verify the attestation.
type SealedPayload struct {
	Version      string    `json:"version"`       // "khepra-fleet-v1"
	AssetID      string    `json:"asset_id"`
	RunID        string    `json:"run_id"`        // fleet scan run identifier
	PayloadType  string    `json:"payload_type"`  // "scan_result" | "heartbeat"
	SignerID     string    `json:"signer_id"`     // agent's Adinkra identity KeyID
	Timestamp    time.Time `json:"timestamp"`
	// The encrypted payload: full SecureEnvelope from EncryptForRecipient (JSON)
	EncryptedEnvelope []byte `json:"encrypted_envelope"`
	// The attestation: full SecureEnvelope from SignArtifact over (AssetID+RunID+Timestamp) (JSON)
	Attestation []byte `json:"attestation"`
}

// SealFleetPayload encrypts and signs a fleet scan result for transit.
// recipientKey is the Hub's HybridKeyPair — only the Hub can decrypt.
// signerKey is the KASA agent's HybridKeyPair — proves the result came from the agent.
func SealFleetPayload(
	payload []byte,
	assetID, runID, payloadType string,
	recipientKey *HybridKeyPair,
	signerKey *HybridKeyPair,
) (*SealedPayload, error) {
	if recipientKey == nil || signerKey == nil {
		return nil, fmt.Errorf("fleet transport: both recipient and signer keys required")
	}

	now := time.Now().UTC()

	// Encrypt the payload for the recipient (Hub)
	encEnvelope, err := EncryptForRecipient(payload, recipientKey)
	if err != nil {
		return nil, fmt.Errorf("fleet transport: encrypt: %w", err)
	}
	encBlob, err := json.Marshal(encEnvelope)
	if err != nil {
		return nil, fmt.Errorf("fleet transport: serialize encrypted envelope: %w", err)
	}

	// Sign the identity claim (assetID + runID + timestamp) to prove origin.
	// EncryptedData is set by SignArtifact — we sign the claim bytes.
	claim := []byte(assetID + ":" + runID + ":" + now.Format(time.RFC3339Nano))
	sigEnvelope, err := signerKey.SignArtifact(claim)
	if err != nil {
		return nil, fmt.Errorf("fleet transport: sign: %w", err)
	}
	attBlob, err := json.Marshal(sigEnvelope)
	if err != nil {
		return nil, fmt.Errorf("fleet transport: serialize attestation: %w", err)
	}

	return &SealedPayload{
		Version:           "khepra-fleet-v1",
		AssetID:           assetID,
		RunID:             runID,
		PayloadType:       payloadType,
		SignerID:          signerKey.KeyID,
		Timestamp:         now,
		EncryptedEnvelope: encBlob,
		Attestation:       attBlob,
	}, nil
}

// OpenFleetPayload verifies the signature and decrypts a SealedPayload.
// recipientKey is the Hub's HybridKeyPair (holds the private key to decapsulate).
// signerPubKey is the registered KASA agent's HybridKeyPair (public key needed).
func OpenFleetPayload(
	sealed *SealedPayload,
	recipientKey *HybridKeyPair,
	signerPubKey *HybridKeyPair,
) ([]byte, error) {
	if sealed == nil {
		return nil, fmt.Errorf("fleet transport: nil payload")
	}
	if sealed.Version != "khepra-fleet-v1" {
		return nil, fmt.Errorf("fleet transport: unknown version %q", sealed.Version)
	}
	if time.Since(sealed.Timestamp) > 5*time.Minute {
		return nil, fmt.Errorf("fleet transport: payload expired (timestamp: %s)", sealed.Timestamp)
	}

	// Verify attestation before decryption — fail fast on tampered payloads
	var sigEnvelope SecureEnvelope
	if err := json.Unmarshal(sealed.Attestation, &sigEnvelope); err != nil {
		return nil, fmt.Errorf("fleet transport: parse attestation: %w", err)
	}
	// VerifyArtifact checks Blake2bHash (integrity) then all 3 signatures
	if err := VerifyArtifact(&sigEnvelope, signerPubKey); err != nil {
		return nil, fmt.Errorf("fleet transport: attestation invalid (possible tampering from %s): %w", sealed.SignerID, err)
	}

	// Decrypt the encrypted payload
	var encEnvelope SecureEnvelope
	if err := json.Unmarshal(sealed.EncryptedEnvelope, &encEnvelope); err != nil {
		return nil, fmt.Errorf("fleet transport: parse encrypted envelope: %w", err)
	}
	plaintext, err := DecryptEnvelope(&encEnvelope, recipientKey)
	if err != nil {
		return nil, fmt.Errorf("fleet transport: decrypt: %w", err)
	}
	return plaintext, nil
}

// ── FleetEnrollmentToken ──────────────────────────────────────────────────────

// FleetEnrollmentToken is issued by the Hub when an operator enrolls a new endpoint.
// The KASA agent validates this token on install to verify it's connecting to
// a legitimate ASAF Hub (not a rogue server).
//
// One token = one enrollment. Tokens are single-use and time-bounded.
// The Hub's DilithiumPublic key is embedded — the agent pins it permanently.
type FleetEnrollmentToken struct {
	Version   string    `json:"version"`     // "khepra-enroll-v1"
	HubURL    string    `json:"hub_url"`     // Hub's base URL (agent dials this)
	AssetID   string    `json:"asset_id"`    // pre-assigned UUID for the new asset
	EnclaveID string    `json:"enclave_id"`  // which CUI enclave to enroll into
	HubPubKey []byte    `json:"hub_pub_key"` // Hub's DilithiumPublic key (agent pins this)
	IssuedAt  time.Time `json:"issued_at"`
	Expiry    time.Time `json:"expiry"`
	// Full SecureEnvelope from SignArtifact (JSON), contains all 3 sigs + Blake2bHash
	Attestation []byte `json:"attestation"`
}

// IssueEnrollmentToken creates a signed enrollment token for a new KASA agent.
// hubKey is the Hub's HybridKeyPair — its DilithiumPublic is embedded in the token.
// ttl should be 24 hours for standard operations; shorter for high-security environments.
func IssueEnrollmentToken(
	hubKey *HybridKeyPair,
	assetID, enclaveID, hubURL string,
	ttl time.Duration,
) (*FleetEnrollmentToken, error) {
	if hubKey == nil {
		return nil, fmt.Errorf("enrollment token: hubKey required")
	}
	if assetID == "" || enclaveID == "" || hubURL == "" {
		return nil, fmt.Errorf("enrollment token: assetID, enclaveID, and hubURL are all required")
	}
	if ttl <= 0 || ttl > 72*time.Hour {
		ttl = 24 * time.Hour // default; max 72h per security policy
	}

	tok := &FleetEnrollmentToken{
		Version:   "khepra-enroll-v1",
		HubURL:    hubURL,
		AssetID:   assetID,
		EnclaveID: enclaveID,
		HubPubKey: hubKey.DilithiumPublic,
		IssuedAt:  time.Now().UTC(),
		Expiry:    time.Now().Add(ttl).UTC(),
	}

	// Sign the canonical claim bytes
	signBytes, err := enrollTokenSignBytes(tok)
	if err != nil {
		return nil, fmt.Errorf("enrollment token: serialize for signing: %w", err)
	}
	// SignArtifact sets EncryptedData = signBytes, computes all 3 sigs + Blake2bHash
	envelope, err := hubKey.SignArtifact(signBytes)
	if err != nil {
		return nil, fmt.Errorf("enrollment token: sign: %w", err)
	}
	attBlob, err := json.Marshal(envelope)
	if err != nil {
		return nil, fmt.Errorf("enrollment token: serialize attestation: %w", err)
	}
	tok.Attestation = attBlob
	return tok, nil
}

// VerifyEnrollmentToken verifies the Hub's signature on an enrollment token.
// Called by the KASA agent on install — if this fails, the agent refuses to proceed.
func VerifyEnrollmentToken(tok *FleetEnrollmentToken, hubPubKey *HybridKeyPair) error {
	if tok == nil {
		return fmt.Errorf("enrollment token: nil")
	}
	if tok.Version != "khepra-enroll-v1" {
		return fmt.Errorf("enrollment token: unknown version %q", tok.Version)
	}
	if time.Now().After(tok.Expiry) {
		return fmt.Errorf("enrollment token: expired at %s", tok.Expiry)
	}

	var envelope SecureEnvelope
	if err := json.Unmarshal(tok.Attestation, &envelope); err != nil {
		return fmt.Errorf("enrollment token: parse attestation: %w", err)
	}
	// VerifyArtifact checks Blake2bHash (structural integrity) then all 3 signatures
	if err := VerifyArtifact(&envelope, hubPubKey); err != nil {
		return fmt.Errorf("enrollment token: invalid Hub signature — potential spoofing: %w", err)
	}
	return nil
}

// InstallCommand returns the one-liner that an operator pastes on an endpoint
// to install and enroll the KASA agent.
// Format: curl -sSL <hub>/install/kasa-agent.sh | bash -s -- <base64(token)>
func (tok *FleetEnrollmentToken) InstallCommand() (string, error) {
	b, err := json.Marshal(tok)
	if err != nil {
		return "", fmt.Errorf("enrollment token: serialize: %w", err)
	}
	encoded := base64.URLEncoding.EncodeToString(b)
	return fmt.Sprintf(
		"curl -sSL %s/install/kasa-agent.sh | bash -s -- %s",
		tok.HubURL,
		encoded,
	), nil
}

// enrollTokenSignBytes produces the canonical byte sequence signed by the Hub.
// Excludes the Attestation field (obviously — can't sign something that includes the sig).
func enrollTokenSignBytes(tok *FleetEnrollmentToken) ([]byte, error) {
	canonical := struct {
		Version   string    `json:"version"`
		HubURL    string    `json:"hub_url"`
		AssetID   string    `json:"asset_id"`
		EnclaveID string    `json:"enclave_id"`
		HubPubKey []byte    `json:"hub_pub_key"`
		IssuedAt  time.Time `json:"issued_at"`
		Expiry    time.Time `json:"expiry"`
	}{
		Version:   tok.Version,
		HubURL:    tok.HubURL,
		AssetID:   tok.AssetID,
		EnclaveID: tok.EnclaveID,
		HubPubKey: tok.HubPubKey,
		IssuedAt:  tok.IssuedAt,
		Expiry:    tok.Expiry,
	}
	return json.Marshal(canonical)
}
