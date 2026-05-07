// Package license — qkd_distribution.go implements the Kyber-KEM wrapped
// air-gap license distribution protocol.
//
// Distribution flow (no server required, works in SCIFs):
//
//  Client:                           Master Authority (air-gapped):
//   1. adinkhepra license request    → request.json
//      (generates Kyber-1024 keypair, signs request with device Dilithium key)
//
//   2. Transfer request.json          → email, Signal, or physical media
//
//   3.                                  adinkhepra-master issue request.json
//      (KEM-encapsulates license with client Kyber pubkey, Dilithium-signs)
//                                    → license.capsule
//
//   4. Transfer license.capsule       → back to client
//
//   5. adinkhepra license install license.capsule
//      (Kyber-decapsulates, verifies Dilithium sig, writes license.adinkhepra)
//
// Security properties:
//   - Forward secrecy: each request uses a fresh ephemeral Kyber keypair
//   - Authenticity: request signed by device's Dilithium key
//   - Confidentiality: capsule only openable by client's ephemeral private key
//   - Integrity: capsule Dilithium-signed by master authority
//   - Device binding: license inside capsule carries device fingerprint
package license

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/audit"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/fingerprint"
	"github.com/google/uuid"
)

// ─── Request Bundle ───────────────────────────────────────────────────────────

// LicenseRequest is the client-generated bundle sent to the master authority.
// It contains the device fingerprint, an ephemeral Kyber-1024 public key for
// license capsule delivery, and a Dilithium signature proving device authenticity.
type LicenseRequest struct {
	RequestID       string    `json:"request_id"`
	DeviceID        string    `json:"device_id"`
	Tenant          string    `json:"tenant"`
	RequestedTier   string    `json:"requested_tier"`
	KyberPublicKey  []byte    `json:"kyber_public_key"`  // 1568 bytes
	RequestNonce    []byte    `json:"request_nonce"`     // 32 bytes, prevents replay
	Timestamp       time.Time `json:"timestamp"`
	DeviceSignature []byte    `json:"device_signature"`  // ML-DSA-65 over canonical fields
	DevicePubKey    []byte    `json:"device_pub_key"`    // Client's ML-DSA-65 public key
}

// Bytes returns the canonical JSON of the signable request fields.
func (r *LicenseRequest) Bytes() ([]byte, error) {
	return json.Marshal(map[string]interface{}{
		"request_id":      r.RequestID,
		"device_id":       r.DeviceID,
		"tenant":          r.Tenant,
		"requested_tier":  r.RequestedTier,
		"kyber_public_key": base64.StdEncoding.EncodeToString(r.KyberPublicKey),
		"request_nonce":   base64.StdEncoding.EncodeToString(r.RequestNonce),
		"timestamp":       r.Timestamp.UTC().Format(time.RFC3339),
	})
}

// ─── License Capsule ──────────────────────────────────────────────────────────

// LicenseCapsule is the master-authority-issued encrypted license bundle.
// Structure: [KyberCapsule(1568) | AES-256-GCM(license JSON)] with ML-DSA-65 wrapper sig.
type LicenseCapsule struct {
	CapsuleID        string    `json:"capsule_id"`
	DeviceID         string    `json:"device_id"`
	RequestID        string    `json:"request_id"`
	KyberCiphertext  []byte    `json:"kyber_ciphertext"`   // 1568 bytes
	EncryptedLicense []byte    `json:"encrypted_license"`  // AES-256-GCM(nonce+ciphertext)
	IssuedAt         time.Time `json:"issued_at"`
	// ML-DSA-65 signature over canonical fields (excluding Signature itself)
	Signature      []byte `json:"signature"`
	SignerPublicKey []byte `json:"signer_public_key"`
}

// Bytes returns the canonical JSON of the signable capsule fields.
func (c *LicenseCapsule) Bytes() ([]byte, error) {
	return json.Marshal(map[string]interface{}{
		"capsule_id":        c.CapsuleID,
		"device_id":         c.DeviceID,
		"request_id":        c.RequestID,
		"kyber_ciphertext":  base64.StdEncoding.EncodeToString(c.KyberCiphertext),
		"encrypted_license": base64.StdEncoding.EncodeToString(c.EncryptedLicense),
		"issued_at":         c.IssuedAt.UTC().Format(time.RFC3339),
	})
}

// ─── Ephemeral Kyber Session ──────────────────────────────────────────────────

// EphemeralKyberSession holds the client's one-time Kyber keypair for one
// license request/install cycle. Discard after InstallLicenseCapsule succeeds.
type EphemeralKyberSession struct {
	PublicKey  []byte `json:"kyber_public_key"`
	privateKey []byte // never serialised
}

// newEphemeralKyberSession generates a fresh Kyber-1024 keypair.
func newEphemeralKyberSession() (*EphemeralKyberSession, error) {
	pk, sk, err := adinkra.GenerateKyberKey()
	if err != nil {
		return nil, fmt.Errorf("QKD: ephemeral Kyber keygen: %w", err)
	}
	return &EphemeralKyberSession{PublicKey: pk, privateKey: sk}, nil
}

// ─── Client Side ──────────────────────────────────────────────────────────────

// GenerateLicenseRequestBundle creates a signed LicenseRequest for delivery to the
// master authority. The returned EphemeralKyberSession MUST be saved securely until
// InstallLicenseCapsule is called — it is the only way to open the returned capsule.
//
// The request is signed with a fresh ephemeral Dilithium key. The master authority
// uses this to verify the request came from a real AdinKhepra installation.
func GenerateLicenseRequestBundle(tenant, tier string) (*LicenseRequest, *EphemeralKyberSession, error) {
	// Collect device fingerprint for stable DeviceID
	fp, err := fingerprint.CollectDeviceFingerprint()
	if err != nil {
		return nil, nil, fmt.Errorf("QKD request: device fingerprint: %w", err)
	}
	deviceID := GenerateDeviceID(fp)

	// Generate ephemeral Kyber keypair for this request
	session, err := newEphemeralKyberSession()
	if err != nil {
		return nil, nil, err
	}

	// Generate nonce (anti-replay)
	nonce := make([]byte, 32)
	if _, err := rand.Read(nonce); err != nil {
		return nil, nil, fmt.Errorf("QKD request: nonce: %w", err)
	}

	// Generate ephemeral Dilithium keypair to sign this request
	devPK, devSK, err := adinkra.GenerateDilithiumKey()
	if err != nil {
		return nil, nil, fmt.Errorf("QKD request: device signing key: %w", err)
	}

	req := &LicenseRequest{
		RequestID:      uuid.New().String(),
		DeviceID:       deviceID,
		Tenant:         tenant,
		RequestedTier:  tier,
		KyberPublicKey: session.PublicKey,
		RequestNonce:   nonce,
		Timestamp:      time.Now().UTC(),
		DevicePubKey:   devPK,
	}

	payload, err := req.Bytes()
	if err != nil {
		return nil, nil, fmt.Errorf("QKD request: marshal: %w", err)
	}

	sig, err := adinkra.Sign(devSK, payload)
	if err != nil {
		return nil, nil, fmt.Errorf("QKD request: sign: %w", err)
	}
	req.DeviceSignature = sig

	return req, session, nil
}

// SaveLicenseRequest serialises a LicenseRequest to a JSON file for transfer.
func SaveLicenseRequest(req *LicenseRequest, path string) error {
	data, err := json.MarshalIndent(req, "", "  ")
	if err != nil {
		return fmt.Errorf("QKD: marshal request: %w", err)
	}
	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("QKD: write request file: %w", err)
	}
	return nil
}

// LoadLicenseRequest reads a LicenseRequest from a JSON file.
func LoadLicenseRequest(path string) (*LicenseRequest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("QKD: read request file: %w", err)
	}
	var req LicenseRequest
	if err := json.Unmarshal(data, &req); err != nil {
		return nil, fmt.Errorf("QKD: parse request: %w", err)
	}
	return &req, nil
}

// ─── Master Authority Side (air-gapped) ──────────────────────────────────────

// IssueLicenseCapsule creates a KEM-encrypted license capsule for the given request.
// Called on the air-gapped master authority machine.
//
// Process:
//  1. Verify request signature (proves request came from real AdinKhepra binary)
//  2. Create the KhepraLicense for the device
//  3. KEM-encapsulate with client's Kyber public key → shared secret
//  4. AES-256-GCM encrypt the license using the shared secret
//  5. ML-DSA-65 sign the entire capsule with the master authority key
func (sla *SovereignLicenseAuthority) IssueLicenseCapsule(req *LicenseRequest, ttl time.Duration) (*LicenseCapsule, error) {
	if req == nil {
		return nil, errors.New("QKD: request is nil")
	}

	// ── Step 1: Verify request signature ────────────────────────────────────
	payload, err := req.Bytes()
	if err != nil {
		return nil, fmt.Errorf("QKD: marshal request for verify: %w", err)
	}
	valid, err := adinkra.Verify(req.DevicePubKey, payload, req.DeviceSignature)
	if err != nil {
		return nil, fmt.Errorf("QKD: request signature error: %w", err)
	}
	if !valid {
		return nil, errors.New("QKD: request signature INVALID — possible forgery")
	}

	// ── Step 2: Issue the KhepraLicense ─────────────────────────────────────
	lic, err := sla.IssueLicense(req.DeviceID, req.Tenant, req.RequestedTier, ttl)
	if err != nil {
		return nil, fmt.Errorf("QKD: issue license: %w", err)
	}

	licBytes, err := json.Marshal(lic)
	if err != nil {
		return nil, fmt.Errorf("QKD: marshal license: %w", err)
	}

	// ── Step 3: KEM-encapsulate with client's Kyber public key ───────────────
	ciphertext, sharedSecret, err := adinkra.KyberEncapsulate(req.KyberPublicKey)
	if err != nil {
		return nil, fmt.Errorf("QKD: Kyber encapsulate: %w", err)
	}

	// ── Step 4: AES-256-GCM encrypt license using shared secret ─────────────
	// Derive 32-byte AES key from shared secret via SHA-256
	aesKey := sha256.Sum256(sharedSecret)
	block, err := aes.NewCipher(aesKey[:])
	if err != nil {
		return nil, fmt.Errorf("QKD: AES cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("QKD: GCM: %w", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("QKD: nonce: %w", err)
	}
	encLic := gcm.Seal(nonce, nonce, licBytes, nil)

	// ── Step 5: ML-DSA-65 sign the capsule ───────────────────────────────────
	capsule := &LicenseCapsule{
		CapsuleID:        uuid.New().String(),
		DeviceID:         req.DeviceID,
		RequestID:        req.RequestID,
		KyberCiphertext:  ciphertext,
		EncryptedLicense: encLic,
		IssuedAt:         time.Now().UTC(),
		SignerPublicKey:  sla.PublicKey,
	}

	capsulePayload, err := capsule.Bytes()
	if err != nil {
		return nil, fmt.Errorf("QKD: marshal capsule for signing: %w", err)
	}
	sig, err := adinkra.Sign(sla.PrivateKey, capsulePayload)
	if err != nil {
		return nil, fmt.Errorf("QKD: sign capsule: %w", err)
	}
	capsule.Signature = sig

	return capsule, nil
}

// SaveLicenseCapsule serialises a LicenseCapsule to a JSON file for transfer back to client.
func SaveLicenseCapsule(capsule *LicenseCapsule, path string) error {
	data, err := json.MarshalIndent(capsule, "", "  ")
	if err != nil {
		return fmt.Errorf("QKD: marshal capsule: %w", err)
	}
	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("QKD: write capsule file: %w", err)
	}
	return nil
}

// LoadLicenseCapsule reads a LicenseCapsule from a JSON file.
func LoadLicenseCapsule(path string) (*LicenseCapsule, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("QKD: read capsule file: %w", err)
	}
	var capsule LicenseCapsule
	if err := json.Unmarshal(data, &capsule); err != nil {
		return nil, fmt.Errorf("QKD: parse capsule: %w", err)
	}
	return &capsule, nil
}

// ─── Client Side — Install ────────────────────────────────────────────────────

// InstallLicenseCapsule decapsulates, decrypts, and verifies a LicenseCapsule,
// then writes the resulting KhepraLicense to outputPath (e.g., "license.adinkhepra").
//
// Parameters:
//   - capsule:         the capsule received from master authority
//   - session:         the EphemeralKyberSession generated during GenerateLicenseRequestBundle
//   - masterPublicKey: ML-DSA-65 master public key (embedded in the binary)
//   - outputPath:      where to write the installed license file
func InstallLicenseCapsule(capsule *LicenseCapsule, session *EphemeralKyberSession, masterPublicKey []byte, outputPath string) (*KhepraLicense, error) {
	if capsule == nil {
		return nil, errors.New("QKD install: capsule is nil")
	}
	if session == nil {
		return nil, errors.New("QKD install: ephemeral session is nil — was it discarded?")
	}

	// ── Step 1: Verify capsule ML-DSA-65 signature ───────────────────────────
	capsulePayload, err := capsule.Bytes()
	if err != nil {
		return nil, fmt.Errorf("QKD install: marshal capsule: %w", err)
	}
	verifyKey := masterPublicKey
	if len(verifyKey) == 0 {
		verifyKey = capsule.SignerPublicKey
	}
	valid, err := adinkra.Verify(verifyKey, capsulePayload, capsule.Signature)
	if err != nil {
		return nil, fmt.Errorf("QKD install: capsule signature error: %w", err)
	}
	if !valid {
		return nil, errors.New("QKD install: capsule signature INVALID — do not trust this capsule")
	}

	// ── Step 2: Kyber decapsulate — recover shared secret ────────────────────
	sharedSecret, err := adinkra.KyberDecapsulate(session.privateKey, capsule.KyberCiphertext)
	if err != nil {
		return nil, fmt.Errorf("QKD install: Kyber decapsulate: %w", err)
	}

	// ── Step 3: AES-256-GCM decrypt the license ───────────────────────────────
	aesKey := sha256.Sum256(sharedSecret)
	block, err := aes.NewCipher(aesKey[:])
	if err != nil {
		return nil, fmt.Errorf("QKD install: AES cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("QKD install: GCM: %w", err)
	}
	if len(capsule.EncryptedLicense) < gcm.NonceSize() {
		return nil, errors.New("QKD install: encrypted license too short")
	}
	nonce := capsule.EncryptedLicense[:gcm.NonceSize()]
	ciphertext := capsule.EncryptedLicense[gcm.NonceSize():]
	licBytes, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("QKD install: AES-GCM decryption failed (authentication tag mismatch): %w", err)
	}

	// ── Step 4: Parse and verify the license ─────────────────────────────────
	var lic KhepraLicense
	if err := json.Unmarshal(licBytes, &lic); err != nil {
		return nil, fmt.Errorf("QKD install: parse license: %w", err)
	}

	// Run full sovereign verification (sig + device binding + expiry + CRL)
	if err := VerifySovereignLicense(&lic, masterPublicKey); err != nil {
		return nil, fmt.Errorf("QKD install: license verification failed: %w", err)
	}

	// ── Step 5: Write license file ────────────────────────────────────────────
	data, err := json.MarshalIndent(lic, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("QKD install: marshal license: %w", err)
	}
	if err := os.WriteFile(outputPath, data, 0600); err != nil {
		return nil, fmt.Errorf("QKD install: write license file: %w", err)
	}

	return &lic, nil
}

// LoadInstalledLicense reads a previously installed KhepraLicense from disk and
// verifies it without network access (offline-first).
func LoadInstalledLicense(path string, masterPublicKey []byte) (*KhepraLicense, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("QKD: read license file %s: %w", path, err)
	}
	var lic KhepraLicense
	if err := json.Unmarshal(data, &lic); err != nil {
		return nil, fmt.Errorf("QKD: parse license: %w", err)
	}
	if err := VerifySovereignLicense(&lic, masterPublicKey); err != nil {
		return nil, err
	}
	return &lic, nil
}

// DeviceFingerprintSummary returns a human-readable fingerprint summary
// for display in `adinkhepra license request`.
func DeviceFingerprintSummary() (string, audit.DeviceFingerprint, error) {
	fp, err := fingerprint.CollectDeviceFingerprint()
	if err != nil {
		return "", audit.DeviceFingerprint{}, fmt.Errorf("fingerprint: %w", err)
	}
	deviceID := GenerateDeviceID(fp)
	summary := fmt.Sprintf(
		"DeviceID  : %s\nMACs      : %v\nTPM       : %v (v%s)\nSpoofing  : %v",
		deviceID, fp.MACAddresses, fp.TPMPresent, fp.TPMVersion, fp.SpoofingIndicators,
	)
	return summary, fp, nil
}
