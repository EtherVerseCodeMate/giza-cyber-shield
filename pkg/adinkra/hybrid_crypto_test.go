package adinkra

import (
	"bytes"
	"encoding/hex"
	"testing"
)

func TestGhostIdentityDeterminism(t *testing.T) {
	// "Ghost Identity" Property:
	// A 64-byte seed must produce the EXACT same keys every time.
	seedPhrase := "KHEPRA-PROTOCOL-TOP-SECRET-GHOST-IDENTITY-SEED-MASTER-2026"
	// Pad to 64 bytes
	seed := make([]byte, 64)
	copy(seed, []byte(seedPhrase))

	// 1. Generate First Identity
	id1, err := GenerateHybridKeyPairFromSeed(seed, "sovereign")
	if err != nil {
		t.Fatalf("Failed to generate ID1: %v", err)
	}

	// 2. Generate Second Identity (Same Seed)
	id2, err := GenerateHybridKeyPairFromSeed(seed, "sovereign")
	if err != nil {
		t.Fatalf("Failed to generate ID2: %v", err)
	}

	// 3. Compare Keys (Must match exactly)
	if !bytes.Equal(id1.DilithiumPublic, id2.DilithiumPublic) {
		t.Error("Dilithium Public Keys do not match! (Determinism Broken)")
	}
	if !bytes.Equal(id1.KyberPublic, id2.KyberPublic) {
		t.Error("Kyber Public Keys do not match! (Determinism Broken)")
	}
	if !bytes.Equal(id1.ECDSAPublic.X.Bytes(), id2.ECDSAPublic.X.Bytes()) ||
		!bytes.Equal(id1.ECDSAPublic.Y.Bytes(), id2.ECDSAPublic.Y.Bytes()) {
		t.Error("ECDSA Keys do not match! (Determinism Broken)")
	}

	t.Log("SUCCESS: Ghost Identity verified. Same seed produces identical PQC keys.")
}

func TestHybridCryptoFlow(t *testing.T) {
	// Generate Keys
	seed := make([]byte, 64)
	copy(seed, []byte("TEST-SEED-FOR-FLOW-VERIFICATION"))

	sender, err := GenerateHybridKeyPairFromSeed(seed, "sender")
	if err != nil {
		t.Fatalf("KeyGen failed: %v", err)
	}

	recipient, err := GenerateHybridKeyPairFromSeed(seed, "recipient") // Sending to self for test
	if err != nil {
		t.Fatalf("KeyGen failed: %v", err)
	}

	message := []byte("ATTACK AT DAWN - SECTOR 7")

	// 1. Test Signing (Dilithium + others)
	envelope, err := sender.SignArtifact(message)
	if err != nil {
		t.Fatalf("SignArtifact failed: %v", err)
	}

	// 2. Test Verification
	if err := VerifyArtifact(envelope, sender); err != nil {
		t.Errorf("VerifyArtifact failed: %v", err)
	}

	// 3. Test Encryption (Kyber + others)
	// Note: We need a different function for pure encryption if we aren't using the envelope?
	// 'SignArtifact' only signs. 'EncryptForRecipient' is what we need.

	encEnvelope, err := EncryptForRecipient(message, recipient)
	if err != nil {
		t.Fatalf("EncryptForRecipient failed: %v", err)
	}

	// 4. Test Decryption
	decrypted, err := DecryptEnvelope(encEnvelope, recipient)
	if err != nil {
		t.Fatalf("DecryptEnvelope failed: %v", err)
	}

	if !bytes.Equal(message, decrypted) {
		t.Errorf("Decryption mismatch!\nGot:  %s\nWant: %s", decrypted, message)
	}

	t.Log("SUCCESS: Hybrid PQC Sign/Verify and Encrypt/Decrypt functional.")
}

func TestChaosEngineReader(t *testing.T) {
	// Verify our ChaosEngine satisfies io.Reader and produces output
	entropy := uint64(0xDEADBEEF)
	chaos := NewChaosEngine(entropy)

	buf := make([]byte, 32)
	n, err := chaos.Read(buf)
	if err != nil {
		t.Fatalf("ChaosEngine.Read failed: %v", err)
	}
	if n != 32 {
		t.Errorf("Expected 32 bytes, got %d", n)
	}

	if bytes.Equal(buf, make([]byte, 32)) {
		t.Error("ChaosEngine produced all zeros!")
	}

	t.Logf("Chaos Dump: %s", hex.EncodeToString(buf))
}
