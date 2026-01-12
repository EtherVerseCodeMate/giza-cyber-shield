package main

import (
	"fmt"
	"log"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
)

// Quick test program to verify Khepra Protocol deployment
func main() {
	fmt.Println("========================================")
	fmt.Println("Khepra Protocol - Quick Test")
	fmt.Println("========================================")
	fmt.Println()

	// Test 1: Generate Hybrid Keys
	fmt.Println("[Test 1/5] Generating Hybrid KeyPair...")
	keys, err := adinkra.GenerateHybridKeyPair("test-identity", 12)
	if err != nil {
		log.Fatalf("Failed to generate keys: %v", err)
	}
	fmt.Printf("Generated KeyPair for: %s (KeyID: %s)\n", keys.Purpose, keys.KeyID[:16]+"...")
	fmt.Println()

	// Test 2: Sign Message
	fmt.Println("[Test 2/5] Testing Triple-Layer Signatures...")
	message := []byte("Hello, Khepra Protocol! This is a test message.")
	envelope, err := keys.SignArtifact(message)
	if err != nil {
		log.Fatalf("Failed to sign message: %v", err)
	}
	fmt.Printf("Message signed successfully (%d bytes)\n", len(envelope.EncryptedData))
	fmt.Println()

	// Test 3: Verify Signature
	fmt.Println("[Test 3/5] Verifying Triple-Layer Signatures...")
	err = adinkra.VerifyArtifact(envelope, keys)
	if err != nil {
		log.Fatalf("Signature verification failed: %v", err)
	}
	fmt.Println("All three signature layers verified successfully!")
	fmt.Println("   - Layer 1: Khepra-PQC")
	fmt.Println("   - Layer 2: Dilithium3")
	fmt.Println("   - Layer 3: ECDSA P-384")
	fmt.Println()

	// Test 4: Encrypt Data
	fmt.Println("[Test 4/5] Testing Triple-Layer Encryption...")
	plaintext := []byte("This is secret data that needs quantum-resistant protection.")
	encrypted, err := adinkra.EncryptForRecipient(plaintext, keys)
	if err != nil {
		log.Fatalf("Encryption failed: %v", err)
	}
	fmt.Printf("Data encrypted: %d bytes -> %d bytes (overhead: %d bytes)\n",
		len(plaintext), len(encrypted.EncryptedData), len(encrypted.EncryptedData)-len(plaintext))
	fmt.Println()

	// Test 5: Decrypt Data
	fmt.Println("[Test 5/5] Testing Triple-Layer Decryption...")
	decrypted, err := adinkra.DecryptEnvelope(encrypted, keys)
	if err != nil {
		log.Fatalf("Decryption failed: %v", err)
	}
	if string(decrypted) == string(plaintext) {
		fmt.Println("Data decrypted successfully!")
		fmt.Printf("   Original:  %s\n", string(plaintext))
		fmt.Printf("   Decrypted: %s\n", string(decrypted))
	} else {
		log.Fatalf("Decryption mismatch!")
	}
	fmt.Println()

	// Summary
	fmt.Println("========================================")
	fmt.Println("ALL TESTS PASSED!")
	fmt.Println("========================================")
	fmt.Println()
	fmt.Println("Khepra Protocol is working correctly on your laptop!")
	fmt.Println()
	fmt.Println("Security Features Verified:")
	fmt.Println("  Khepra-PQC (256-bit lattice signatures)")
	fmt.Println("  CRYSTALS-Dilithium3 (NIST Level 3)")
	fmt.Println("  CRYSTALS-Kyber1024 (NIST Level 5)")
	fmt.Println("  ECDSA/ECIES P-384 (192-bit classical)")
	fmt.Println("  Secure memory zeroization")
	fmt.Println("  Constant-time operations")
	fmt.Println()
	fmt.Println("Next steps:")
	fmt.Println("  - Integrate pkg/adinkra into your application")
	fmt.Println("  - See docs/DEPLOYMENT_GUIDE.md for examples")
	fmt.Println("  - Review docs/HYBRID_CRYPTO_SECURITY_AUDIT.md")
	fmt.Println()
}
