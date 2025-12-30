package audit

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
)

// SealWithPQC signs the audit snapshot with Dilithium3 for non-repudiation.
// This ensures the snapshot cannot be tampered with and provides cryptographic proof of origin.
func (a *AuditSnapshot) SealWithPQC(privateKey, publicKey []byte) error {
	// Serialize the snapshot without the signature field
	tempSig := a.PQCSignature
	a.PQCSignature = nil

	data, err := json.Marshal(a)
	if err != nil {
		a.PQCSignature = tempSig
		return fmt.Errorf("failed to serialize snapshot: %v", err)
	}

	// Sign the data
	signature, err := adinkra.Sign(privateKey, data)
	if err != nil {
		a.PQCSignature = tempSig
		return fmt.Errorf("failed to sign snapshot: %v", err)
	}

	// Attach the signature
	a.PQCSignature = &PQCSignature{
		Algorithm:  "Dilithium3",
		PublicKey:  base64.StdEncoding.EncodeToString(publicKey),
		Signature:  base64.StdEncoding.EncodeToString(signature),
		SignedAt:   time.Now().UTC(),
		SignedBy:   a.DeviceFingerprint.CompositeHash, // Bind to device
	}

	return nil
}

// VerifyPQC verifies the Dilithium3 signature on the audit snapshot.
// Returns true if the signature is valid and the snapshot has not been tampered with.
func (a *AuditSnapshot) VerifyPQC() (bool, error) {
	if a.PQCSignature == nil {
		return false, fmt.Errorf("snapshot is not signed")
	}

	// Decode the public key and signature
	publicKey, err := base64.StdEncoding.DecodeString(a.PQCSignature.PublicKey)
	if err != nil {
		return false, fmt.Errorf("invalid public key encoding: %v", err)
	}

	signature, err := base64.StdEncoding.DecodeString(a.PQCSignature.Signature)
	if err != nil {
		return false, fmt.Errorf("invalid signature encoding: %v", err)
	}

	// Serialize the snapshot without the signature field
	tempSig := a.PQCSignature
	a.PQCSignature = nil

	data, err := json.Marshal(a)
	if err != nil {
		a.PQCSignature = tempSig
		return false, fmt.Errorf("failed to serialize snapshot: %v", err)
	}

	// Restore the signature
	a.PQCSignature = tempSig

	// Verify the signature
	return adinkra.Verify(publicKey, data, signature)
}
