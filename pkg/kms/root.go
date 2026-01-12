package kms

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha512"

	//why is boringcrypto not imported here ?
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
)

// Tier0Result represents the output of a Root of Trust ceremony
type Tier0Result struct {
	// SealedArtifact is the "Poetically Obfuscated" string containing the triple-encrypted seed
	SealedArtifact string    `json:"sealed_artifact"`
	CreatedAt      time.Time `json:"created_at"`
	Fingerprint    string    `json:"fingerprint"`
	EntropySource  string    `json:"entropy_source"`
}

// BootstrapTier0 performs the Root of Trust ceremony
func BootstrapTier0(entropySource, password string) (*Tier0Result, error) {
	if password == "" {
		return nil, errors.New("master password required for Tier 0 ceremony")
	}

	// 1. Collect Entropy (Master Seed)
	seed := make([]byte, 64) // 512 bits
	if _, err := io.ReadFull(rand.Reader, seed); err != nil {
		return nil, fmt.Errorf("insufficient entropy: %w", err)
	}

	// 2. Compute Identity Fingerprint (SHA-512)
	hash := sha512.Sum512(seed)
	fingerprint := hex.EncodeToString(hash[:8])

	// 3. Triple Encrypt & Obfuscate
	sealed, err := tripleEncryptAndseal(seed, password)
	if err != nil {
		return nil, fmt.Errorf("sealing failed: %w", err)
	}

	result := &Tier0Result{
		SealedArtifact: sealed,
		CreatedAt:      time.Now().UTC(),
		Fingerprint:    fmt.Sprintf("KHEPRA-ROOT-%s", fingerprint),
		EntropySource:  entropySource,
	}

	return result, nil
}

// EncodeTier0 saves the result
func EncodeTier0(result *Tier0Result, path string) error {
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}

// LoadMasterSeed unlocks the Tier 0 seed using the password
func LoadMasterSeed(path, password string) ([]byte, error) {
	// 1. Read the sealed artifact
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var result Tier0Result
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("invalid artifact structure: %v", err)
	}

	// 2. Decode and Decrypt
	seed, err := tripleDecryptAndUnseal(result.SealedArtifact, password)
	if err != nil {
		return nil, fmt.Errorf("ACCESS DENIED: %v", err)
	}

	return seed, nil
}

// =============================================================================
// INTERNAL SECURITY LOGIC
// =============================================================================

// tripleEncryptAndseal applies 3 layers of AES-256-GCM with derived keys,
// then encodes using the "Khepra Lattice" alphabet (Poetic Obfuscation).
func tripleEncryptAndseal(plaintext []byte, password string) (string, error) {
	// Key Derivation: Chain SHA-512 to get 3 distinct 32-byte keys
	// Layer 1 Key
	h1 := sha512.Sum512([]byte(password + "KHEPRA_LAYER_1_SALT"))
	key1 := h1[:32]

	// Layer 2 Key
	h2 := sha512.Sum512([]byte(password + "KHEPRA_LAYER_2_SALT"))
	key2 := h2[:32]

	// Layer 3 Key
	h3 := sha512.Sum512([]byte(password + "KHEPRA_LAYER_3_SALT"))
	key3 := h3[:32]

	// Layer 1: Encrypt
	c1, err := aesGCMEncrypt(key1, plaintext)
	if err != nil {
		return "", err
	}

	// Layer 2: Encrypt
	c2, err := aesGCMEncrypt(key2, c1)
	if err != nil {
		return "", err
	}

	// Layer 3: Encrypt
	c3, err := aesGCMEncrypt(key3, c2)
	if err != nil {
		return "", err
	}

	// 4. Encapsulate in Sacred Encrypted Geometric Merkaba (AdinKhepra Lattice)
	// We use the full Layer 1 Hash (64 bytes) as the Geometry Seed.
	merkaba := adinkra.NewMerkaba(h1[:])
	return merkaba.Seal(c3)
}

// tripleDecryptAndUnseal reverses the process
func tripleDecryptAndUnseal(sealed string, password string) ([]byte, error) {
	// Re-derive Keys (WE NEED H1 FOR MERKABA SEED)
	h1 := sha512.Sum512([]byte(password + "KHEPRA_LAYER_1_SALT"))
	key1 := h1[:32]

	h2 := sha512.Sum512([]byte(password + "KHEPRA_LAYER_2_SALT"))
	key2 := h2[:32]

	h3 := sha512.Sum512([]byte(password + "KHEPRA_LAYER_3_SALT"))
	key3 := h3[:32]

	// 1. Unseal the Sacred Encrypted Geometric Merkaba
	merkaba := adinkra.NewMerkaba(h1[:])
	ciphertext3, err := merkaba.Unseal(sealed)
	if err != nil {
		return nil, fmt.Errorf("Merkaba lattice breach: %v", err)
	}

	// Layer 3: Decrypt
	c2, err := aesGCMDecrypt(key3, ciphertext3)
	if err != nil {
		return nil, errors.New("layer 3 breach failed")
	}

	// Layer 2: Decrypt
	c1, err := aesGCMDecrypt(key2, c2)
	if err != nil {
		return nil, errors.New("layer 2 breach failed")
	}

	// Layer 1: Decrypt
	seed, err := aesGCMDecrypt(key1, c1)
	if err != nil {
		return nil, errors.New("root layer breach failed")
	}

	return seed, nil
}

func aesGCMEncrypt(key, data []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
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

	// Seal: Nonce + Ciphertext + Tag
	return gcm.Seal(nonce, nonce, data, nil), nil
}

func aesGCMDecrypt(key, data []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return nil, errors.New("data too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	return gcm.Open(nil, nonce, ciphertext, nil)
}
