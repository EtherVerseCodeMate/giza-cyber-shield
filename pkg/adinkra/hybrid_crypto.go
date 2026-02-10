package adinkra

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha512"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math/big"
	"time"

	"github.com/cloudflare/circl/kem/kyber/kyber1024"
	"github.com/cloudflare/circl/sign/dilithium/mode3"
	"golang.org/x/crypto/blake2b"
)

// ============================================================================
// KHEPRA HYBRID CRYPTOGRAPHY ENGINE
// Triple-Layer Defense: Khepra-PQC + CRYSTALS (Dilithium/Kyber) + Classical (ECDSA/ECDH)
// ============================================================================

const (
	ErrDilithiumKeygen = "dilithium keygen failed: %w"

	// Adinkhepra-PQC Parameters (Your proprietary lattice scheme)
	AdinkhepraPQCSecurityLevel = 256 // bits
	AdinkhepraPQCModulus       = 8380417
	AdinkhepraLatticeRank      = 8
	AdinkhepraPQCSignatureSize = 2420 // bytes

	// CRYSTALS-Dilithium3 (NIST ML-DSA)
	DilithiumPublicKeySize  = 1952
	DilithiumPrivateKeySize = 4000
	DilithiumSignatureSize  = 3293

	// CRYSTALS-Kyber1024 (NIST ML-KEM)
	KyberPublicKeySize    = 1568
	KyberPrivateKeySize   = 3168
	KyberCiphertextSize   = 1568
	KyberSharedSecretSize = 32

	// Classical Algorithms
	ECDSACurve           = "P-384" // 192-bit security level
	ECDHSharedSecretSize = 48      // P-384 output

	// Hybrid Envelope Structure
	EnvelopeVersion = 2 // v2 = Triple-Layer
)

// ============================================================================
// DATA STRUCTURES
// ============================================================================

// HybridKeyPair represents the complete key bundle for all three layers
type HybridKeyPair struct {
	// Layer 1: Adinkhepra-PQC (Proprietary)
	AdinkhepraPQCPublic  *AdinkhepraPQCPublicKey
	AdinkhepraPQCPrivate *AdinkhepraPQCPrivateKey

	// Layer 2: CRYSTALS (NIST Standardized)
	DilithiumPublic  []byte // Signing
	DilithiumPrivate []byte
	KyberPublic      []byte // Encryption
	KyberPrivate     []byte

	// Layer 3: Classical (Fallback/Compatibility)
	ECDSAPublic  *ecdsa.PublicKey
	ECDSAPrivate *ecdsa.PrivateKey

	// Metadata
	Symbol     string
	KeyID      string
	Created    time.Time
	Purpose    string // "operator", "agent", "sovereign"
	Expiration time.Time
}

// AdinkhepraPQCPublicKey - Your proprietary post-quantum scheme
type AdinkhepraPQCPublicKey struct {
	LatticeVectors [][]int64 // Rank x Dimension matrix
	Seed           [32]byte  // For parameter derivation
	SecurityLevel  int
}

// AdinkhepraPQCPrivateKey - Corresponding private key
type AdinkhepraPQCPrivateKey struct {
	ShortVectors [][]int64 // Short basis for lattice
	Seed         [32]byte
}

// SecureEnvelope - The encrypted + signed artifact container
type SecureEnvelope struct {
	Version   int
	Timestamp int64

	// Triple-Layer Signatures (concatenated)
	SignatureKhepra    []byte
	SignatureDilithium []byte
	SignatureECDSA     []byte

	// Triple-Layer Encryption
	EncryptedData   []byte
	KyberCiphertext []byte // Encrypted session key
	ECDHCiphertext  []byte // Backup encrypted session key

	// Key Identifiers
	SignerKeyID    string
	RecipientKeyID string

	// Integrity
	Blake2bHash [64]byte
}

// ============================================================================
// KEY GENERATION (Entropy-Hardened)
// ============================================================================

// GenerateHybridKeyPair creates a new triple-layer key bundle
func GenerateHybridKeyPair(purpose string, symbol string, expirationMonths int) (*HybridKeyPair, error) {
	// CRITICAL: Use hardware RNG or fail
	entropy := make([]byte, 64)
	if _, err := io.ReadFull(rand.Reader, entropy); err != nil {
		return nil, fmt.Errorf("FATAL: insufficient entropy for key generation: %w", err)
	}

	// Verify entropy quality (basic statistical test)
	if !verifyEntropyQuality(entropy) {
		return nil, errors.New("FATAL: entropy failed quality check")
	}

	keyPair := &HybridKeyPair{
		KeyID:      generateKeyID(entropy),
		Created:    time.Now(),
		Purpose:    purpose,
		Expiration: time.Now().AddDate(0, expirationMonths, 0),
	}

	keyPair.Symbol = symbol

	// Layer 1: Adinkhepra-PQC (Your proprietary scheme)
	kPub, kPriv, err := generateAdinkhepraPQCKeys(entropy[:32], symbol)
	if err != nil {
		return nil, fmt.Errorf("adinkhepra-pqc keygen failed: %w", err)
	}
	keyPair.AdinkhepraPQCPublic = kPub
	keyPair.AdinkhepraPQCPrivate = kPriv

	// Layer 2: CRYSTALS-Dilithium3 (Signing)
	dPub, dPriv, err := generateDilithiumKeys(entropy[32:])
	if err != nil {
		return nil, fmt.Errorf(ErrDilithiumKeygen, err)
	}
	keyPair.DilithiumPublic = dPub
	keyPair.DilithiumPrivate = dPriv

	// Layer 2: CRYSTALS-Kyber1024 (Encryption)
	kyPub, kyPriv, err := generateKyberKeys(entropy)
	if err != nil {
		return nil, fmt.Errorf("kyber keygen failed: %w", err)
	}
	keyPair.KyberPublic = kyPub
	keyPair.KyberPrivate = kyPriv

	// Layer 3: ECDSA P-384 (Classical fallback)
	ecPriv, err := ecdsa.GenerateKey(elliptic.P384(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("ecdsa keygen failed: %w", err)
	}
	keyPair.ECDSAPrivate = ecPriv
	keyPair.ECDSAPublic = &ecPriv.PublicKey

	// Final validation: Ensure all keys are properly initialized
	if err := ValidateKeyPairIntegrity(keyPair); err != nil {
		return nil, fmt.Errorf("key pair validation failed: %w", err)
	}

	return keyPair, nil
}

// GenerateHybridKeyPairFromSeed creates a deterministic key pair from a 64-byte seed.
// Used for "Ghost Identities" (Password-Derived Keys).
func GenerateHybridKeyPairFromSeed(seed []byte, purpose string, symbol string) (*HybridKeyPair, error) {
	if len(seed) < 64 {
		return nil, errors.New("seed too short (must be 64 bytes)")
	}

	keyPair := &HybridKeyPair{
		KeyID:      generateKeyID(seed),
		Created:    time.Now(),
		Purpose:    purpose,
		Expiration: time.Now().AddDate(99, 0, 0), // Ghost keys are effectively eternal until password changes
	}

	keyPair.Symbol = symbol

	// Layer 1: Adinkhepra-PQC (Proprietary)
	// Currently use the first 32 bytes of seed directly, or verify usage in impl
	kPub, kPriv, err := generateAdinkhepraPQCKeys(seed[:32], symbol)
	if err != nil {
		return nil, fmt.Errorf("adinkhepra-pqc keygen failed: %w", err)
	}
	keyPair.AdinkhepraPQCPublic = kPub
	keyPair.AdinkhepraPQCPrivate = kPriv

	// Layer 2: CRYSTALS-Dilithium3 (Signing)
	// Note: Actual impl might need randomness, use rng
	dPub, dPriv, err := generateDilithiumKeys(seed[32:])
	if err != nil {
		return nil, fmt.Errorf(ErrDilithiumKeygen, err)
	}
	keyPair.DilithiumPublic = dPub
	keyPair.DilithiumPrivate = dPriv

	// Layer 2: CRYSTALS-Kyber1024 (Encryption)
	// Use deterministic seed derivation for Kyber
	kyberSeed := make([]byte, 64)
	copy(kyberSeed, seed) // Use original seed
	// Mix with purpose for domain separation
	for i, b := range []byte("KYBER-KEYGEN") {
		if i < len(kyberSeed) {
			kyberSeed[i] ^= b
		}
	}
	kyPub, kyPriv, err := generateKyberKeys(kyberSeed)
	if err != nil {
		return nil, fmt.Errorf("kyber keygen failed: %w", err)
	}
	keyPair.KyberPublic = kyPub
	keyPair.KyberPrivate = kyPriv

	// Layer 3: ECDSA P-384 (Classical fallback)
	// Deterministically derive a private scalar from the seed and compute public key.
	ecdsaSeed := make([]byte, 64)
	copy(ecdsaSeed, seed)
	// Mix with purpose for domain separation
	for i, b := range []byte("ECDSA-KEYGEN") {
		if i < len(ecdsaSeed) {
			ecdsaSeed[i] ^= b
		}
	}
	ecPriv, err := deterministicECDSAPrivateKeyFromSeed(ecdsaSeed)
	if err != nil {
		return nil, fmt.Errorf("ecdsa keygen failed: %w", err)
	}
	keyPair.ECDSAPrivate = ecPriv
	keyPair.ECDSAPublic = &ecPriv.PublicKey

	// Final validation: Ensure all keys are properly initialized
	if err := ValidateKeyPairIntegrity(keyPair); err != nil {
		return nil, fmt.Errorf("key pair validation failed: %w", err)
	}

	return keyPair, nil
}

// ============================================================================
// TRIPLE-LAYER SIGNING
// ============================================================================

// SignArtifact applies all three signature algorithms to the data
func (kp *HybridKeyPair) SignArtifact(data []byte) (*SecureEnvelope, error) {
	// Validate inputs
	if err := ValidateKeyPairIntegrity(kp); err != nil {
		return nil, fmt.Errorf("invalid key pair: %w", err)
	}
	if err := SanitizeInputData(data, 100*1024*1024); err != nil { // Max 100MB
		return nil, fmt.Errorf("invalid input data: %w", err)
	}
	if kp.isExpired() {
		return nil, errors.New("key pair expired")
	}

	// Compute canonical hash (domain separation)
	msgHash := computeCanonicalHash(data, "KHEPRA-ARTIFACT-V2")

	envelope := &SecureEnvelope{
		Version:     EnvelopeVersion,
		Timestamp:   time.Now().Unix(),
		SignerKeyID: kp.KeyID,
	}

	// Layer 1: Adinkhepra-PQC Signature (Proprietary)
	adinkhepraSlg, err := signAdinkhepraPQC(kp.AdinkhepraPQCPrivate, msgHash)
	if err != nil {
		return nil, fmt.Errorf("adinkhepra-pqc signing failed: %w", err)
	}
	envelope.SignatureKhepra = adinkhepraSlg

	// Layer 2: CRYSTALS-Dilithium3 (NIST)
	dilithiumSig, err := signDilithium(kp.DilithiumPrivate, msgHash)
	if err != nil {
		return nil, fmt.Errorf("dilithium signing failed: %w", err)
	}
	envelope.SignatureDilithium = dilithiumSig

	// Layer 3: ECDSA P-384 (Classical)
	ecdsaSig, err := signECDSA(kp.ECDSAPrivate, msgHash)
	if err != nil {
		return nil, fmt.Errorf("ecdsa signing failed: %w", err)
	}
	envelope.SignatureECDSA = ecdsaSig

	// Store original data (will be encrypted separately if needed)
	envelope.EncryptedData = data

	// Integrity seal
	envelope.Blake2bHash = computeBlake2bHash(envelope)

	return envelope, nil
}

// VerifyArtifact validates all three signature layers
func VerifyArtifact(envelope *SecureEnvelope, publicKeys *HybridKeyPair) error {
	if envelope.Version != EnvelopeVersion {
		return errors.New("unsupported envelope version")
	}

	// Verify integrity first
	expectedHash := computeBlake2bHash(envelope)
	if envelope.Blake2bHash != expectedHash {
		return errors.New("envelope integrity check failed")
	}

	msgHash := computeCanonicalHash(envelope.EncryptedData, "KHEPRA-ARTIFACT-V2")

	// Verify all three layers (ALL must pass)
	if err := verifyAdinkhepraPQC(publicKeys.AdinkhepraPQCPublic, msgHash, envelope.SignatureKhepra); err != nil {
		return fmt.Errorf("adinkhepra-pqc verification failed: %w", err)
	}

	if err := verifyDilithium(publicKeys.DilithiumPublic, msgHash, envelope.SignatureDilithium); err != nil {
		return fmt.Errorf("dilithium verification failed: %w", err)
	}

	if err := verifyECDSA(publicKeys.ECDSAPublic, msgHash, envelope.SignatureECDSA); err != nil {
		return fmt.Errorf("ecdsa verification failed: %w", err)
	}

	return nil
}

// ============================================================================
// TRIPLE-LAYER ENCRYPTION (Encryption-in-Layers)
// ============================================================================

// EncryptForRecipient encrypts data using all three key encapsulation mechanisms
func EncryptForRecipient(data []byte, recipientKeys *HybridKeyPair) (*SecureEnvelope, error) {
	// Generate ephemeral session key
	sessionKey := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, sessionKey); err != nil {
		return nil, err
	}

	envelope := &SecureEnvelope{
		Version:        EnvelopeVersion,
		Timestamp:      time.Now().Unix(),
		RecipientKeyID: recipientKeys.KeyID,
	}

	// Layer 1: Encrypt session key with Kyber1024
	kyberCiphertext, err := encryptKyber(recipientKeys.KyberPublic, sessionKey)
	if err != nil {
		return nil, fmt.Errorf("kyber encryption failed: %w", err)
	}
	envelope.KyberCiphertext = kyberCiphertext

	// Layer 2: Encrypt session key with ECDH P-384 (backup)
	ecdhCiphertext, err := encryptECDH(recipientKeys.ECDSAPublic, sessionKey)
	if err != nil {
		return nil, fmt.Errorf("ecdh encryption failed: %w", err)
	}
	envelope.ECDHCiphertext = ecdhCiphertext

	// Layer 3: Encrypt actual data with session key (AES-256-GCM)
	encryptedData, err := encryptAESGCM(sessionKey, data)
	if err != nil {
		return nil, fmt.Errorf("aes-gcm encryption failed: %w", err)
	}
	envelope.EncryptedData = encryptedData

	envelope.Blake2bHash = computeBlake2bHash(envelope)

	return envelope, nil
}

// DecryptEnvelope attempts decryption using available keys (tries both layers)
func DecryptEnvelope(envelope *SecureEnvelope, recipientKeys *HybridKeyPair) ([]byte, error) {
	// Try Kyber first (PQC-primary)
	sessionKey, err := decryptKyber(recipientKeys.KyberPrivate, envelope.KyberCiphertext)
	if err != nil {
		// Fallback to ECDH (classical backup)
		sessionKey, err = decryptECDH(recipientKeys.ECDSAPrivate, envelope.ECDHCiphertext)
		if err != nil {
			return nil, errors.New("failed to decrypt session key with both Kyber and ECDH")
		}
	}

	// Decrypt actual data
	plaintext, err := decryptAESGCM(sessionKey, envelope.EncryptedData)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt data: %w", err)
	}

	return plaintext, nil
}

// ============================================================================
// HELPER FUNCTIONS (Stubs for full implementation)
// ============================================================================

func verifyEntropyQuality(entropy []byte) bool {
	// Statistical test: Check for minimal bit entropy
	// In production: Use NIST SP 800-90B health tests
	ones := 0
	for _, b := range entropy {
		ones += countOnes(b)
	}
	ratio := float64(ones) / float64(len(entropy)*8)
	return ratio > 0.4 && ratio < 0.6 // Rough balance check
}

func countOnes(b byte) int {
	count := 0
	for i := 0; i < 8; i++ {
		if b&(1<<i) != 0 {
			count++
		}
	}
	return count
}

func generateKeyID(entropy []byte) string {
	hash := sha512.Sum512(entropy)
	return fmt.Sprintf("KHEPRA-%X", hash[:8])
}

func computeCanonicalHash(data []byte, domain string) []byte {
	hasher, _ := blake2b.New512(nil)
	hasher.Write([]byte(domain))
	hasher.Write(data)
	return hasher.Sum(nil)
}

func computeBlake2bHash(envelope *SecureEnvelope) [64]byte {
	hasher, _ := blake2b.New512(nil)
	binary.Write(hasher, binary.BigEndian, envelope.Version)
	binary.Write(hasher, binary.BigEndian, envelope.Timestamp)
	hasher.Write(envelope.SignatureKhepra)
	hasher.Write(envelope.SignatureDilithium)
	hasher.Write(envelope.SignatureECDSA)
	hasher.Write(envelope.EncryptedData)
	var hash [64]byte
	copy(hash[:], hasher.Sum(nil))
	return hash
}

func (kp *HybridKeyPair) isExpired() bool {
	return time.Now().After(kp.Expiration)
}

// deterministicECDSAPrivateKeyFromSeed derives an ECDSA P-384 private key deterministically
// from a seed using SHA-512 keyed expansion. Ensures the same seed -> same key.
func deterministicECDSAPrivateKeyFromSeed(seed []byte) (*ecdsa.PrivateKey, error) {
	curve := elliptic.P384()
	n := curve.Params().N

	// Try expanding seed with a counter until we get a non-zero scalar < N
	var d *big.Int
	for ctr := uint32(0); ctr < 1000; ctr++ {
		ctrBytes := make([]byte, 4)
		binary.BigEndian.PutUint32(ctrBytes, ctr)
		combined := append(seed, ctrBytes...)
		h := sha512.Sum512(combined)
		d = new(big.Int).SetBytes(h[:])
		d.Mod(d, n)
		if d.Sign() != 0 {
			break
		}
	}

	if d == nil || d.Sign() == 0 {
		return nil, errors.New("failed to derive ECDSA private scalar from seed")
	}

	priv := &ecdsa.PrivateKey{}
	priv.PublicKey.Curve = curve
	priv.D = d
	priv.PublicKey.X, priv.PublicKey.Y = curve.ScalarBaseMult(d.Bytes())
	return priv, nil
}

// ADINKHEPRA-PQC LATTICE-BASED SIGNATURES (Production Implementation)
// ============================================================================

// Adinkhepra-PQC: Production lattice-based post-quantum signatures
// Implementation in khepra_pqc.go using Merkaba geometry & Adinkra algebra

func generateAdinkhepraPQCKeys(seed []byte, symbol string) (*AdinkhepraPQCPublicKey, *AdinkhepraPQCPrivateKey, error) {
	return GenerateAdinkhepraPQCKeyPair(seed, symbol)
}

func signAdinkhepraPQC(priv *AdinkhepraPQCPrivateKey, msgHash []byte) ([]byte, error) {
	return SignAdinkhepraPQC(priv, msgHash)
}

func verifyAdinkhepraPQC(pub *AdinkhepraPQCPublicKey, msgHash, signature []byte) error {
	return VerifyAdinkhepraPQC(pub, msgHash, signature)
}

// CRYSTALS-Dilithium (Using Cloudflare CIRCL + Adinkra ChaosEngine)
func generateDilithiumKeys(seed []byte) ([]byte, []byte, error) {
	// 1. Initialize Adinkra ChaosEngine from seed
	// We need 8 bytes to seed the uint64 ChaosEngine.
	// We use the first 8 bytes of the provided seed slice.
	if len(seed) < 8 {
		return nil, nil, errors.New("insufficient seed length for Dilithium chaos (need 8+ bytes)")
	}
	chaosSeed := binary.BigEndian.Uint64(seed[:8])
	chaos := NewChaosEngine(chaosSeed)

	// 2. Generate Keypair using our custom entropy source
	pub, priv, err := mode3.GenerateKey(chaos)
	if err != nil {
		return nil, nil, fmt.Errorf("dilithium keygen failed: %w", err)
	}

	// 3. Serialize to bytes
	return pub.Bytes(), priv.Bytes(), nil
}

func signDilithium(priv, msgHash []byte) ([]byte, error) {
	// 1. Load Private Key
	if len(priv) != mode3.PrivateKeySize {
		return nil, errors.New("invalid private key size")
	}
	var buf [mode3.PrivateKeySize]byte
	copy(buf[:], priv)
	sk := &mode3.PrivateKey{}
	sk.Unpack(&buf)

	// 2. Sign the message hash
	sig := make([]byte, mode3.SignatureSize)
	mode3.SignTo(sk, msgHash, sig)
	return sig, nil
}

func verifyDilithium(pub, msgHash, signature []byte) error {
	// 1. Load Public Key
	if len(pub) != mode3.PublicKeySize {
		return errors.New("invalid public key size")
	}
	var buf [mode3.PublicKeySize]byte
	copy(buf[:], pub)
	pk := &mode3.PublicKey{}
	pk.Unpack(&buf)

	// 2. Verify
	if !mode3.Verify(pk, msgHash, signature) {
		return errors.New("dilithium signature invalid")
	}
	return nil
}

// CRYSTALS-Kyber (Using Cloudflare CIRCL + Adinkra ChaosEngine)
func generateKyberKeys(seed []byte) ([]byte, []byte, error) {
	if len(seed) < 8 {
		return nil, nil, errors.New("insufficient seed length for Kyber chaos")
	}
	chaosSeed := binary.BigEndian.Uint64(seed[:8])
	chaos := NewChaosEngine(chaosSeed)

	// Generate 64 bytes of deterministic randomness for NewKeyFromSeed
	kyberseed := make([]byte, 64)
	chaos.Read(kyberseed)

	pub, priv := kyber1024.NewKeyFromSeed(kyberseed)

	pubBuf := make([]byte, kyber1024.PublicKeySize)
	privBuf := make([]byte, kyber1024.PrivateKeySize)

	pub.Pack(pubBuf)
	priv.Pack(privBuf)

	return pubBuf, privBuf, nil
}

func encryptKyber(pubBytes, sessionKey []byte) ([]byte, error) {
	pub := &kyber1024.PublicKey{}
	if len(pubBytes) != kyber1024.PublicKeySize {
		return nil, errors.New("invalid kyber public key size")
	}
	pub.Unpack(pubBytes)

	// Encapsulate needs randomness too!
	// In strict mode, we should use ChaosEngine here too if we want full determinism (e.g. debugging),
	// but for ephemeral session keys, system randomness is acceptable usually.
	// HOWEVER, for consistency with the design, let's use a fresh ChaosEngine
	// derived from current time or just standard rand if not strictly needed.
	// The problem is we don't pass a seed here.
	// Let's use crypto/rand for encapsulation as it's ephemeral.
	// But `kyber1024.Encapsulate` takes a reader.

	ciphertext := make([]byte, kyber1024.CiphertextSize)
	sharedSecret := make([]byte, kyber1024.SharedKeySize)

	// Kyber-1024 (ML-KEM-1024) uses 32 bytes of randomness for encapsulation
	// Circl's EncapsulateTo takes this seed as []byte, not a reader.
	seed := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, seed); err != nil {
		return nil, fmt.Errorf("failed to generate kyber seed: %w", err)
	}

	// EncapsulateTo(ct, ss, seed)
	// Returns void (constant time, always succeeds)
	pub.EncapsulateTo(ciphertext, sharedSecret, seed)

	// CRITICAL: We need to use the sharedSecret to wrap the sessionKey!
	// Kyber gives us a Shared Secret (SS). We usually just XOR it or use it as a KEK.
	// But the interface says `encryptKyber(pub, sessionKey)`.
	// This implies we are encrypting the *sessionKey* with Kyber.
	// Kyber is a KEM, not a PKE. It generates a random shared secret.
	// We cannot "encrypt a specific message" directly with raw Kyber without a wrapper.
	// Standard KEM-DEM pattern:
	// 1. KEM generates (CT, SS).
	// 2. We use SS to encrypt the `sessionKey` (AEAD or XOR).
	// Let's implement that wrapper KEM-DEM logic.

	// XOR the KEM-SS with the actual SessionKey?
	// If SS is 32 bytes and SessionKey is 32 bytes, a simple one-time pad XOR is perfect
	// provided the SS is random (which it is).
	wrappedSessionKey := make([]byte, len(sessionKey))
	for i := 0; i < len(sessionKey); i++ {
		wrappedSessionKey[i] = sessionKey[i] ^ sharedSecret[i]
	}

	// We return CT + WrappedKey?
	// The `SecureEnvelope` struct has `KyberCiphertext []byte`.
	// We only have one field.
	// If we just return CT, the recipient creates SS', but how do they get `sessionKey`?
	// They would get SS' == SS.
	// If `encryptKyber` is supposed to return the "Encrypted Session Key",
	// it should probably return CT || WrappedSessionKey.
	// Let's check `KyberCiphertextSize` constant. It is 1568.
	// `kyber1024.CiphertextSize` is 1568.
	// So there is NO ROOM for the wrapped key in `KyberCiphertext` field if it's fixed size!

	// ARCHITECTURE ISSUE: KEM produces a SHARED SECRET, not an encrypted blob of your choice.
	// If `SecureEnvelope` expects to carry a specific `sessionKey` (AES key), we must
	// transport it.
	// OPTION A: Derive the AES key FROM the Kyber SS directly (discard the generated `sessionKey` rand).
	// OPTION B: Use Kyber SS to encrypt the `sessionKey` and append it.

	// Given the function signature `EncryptForRecipient` generates `sessionKey` first,
	// then calls `encryptKyber(pub, sessionKey)`.
	// This implies Option B. But `KyberCiphertext` in struct is likely fixed size?
	// Struct: `KyberCiphertext []byte` (slice). So it CAN grow.
	// 1568 (CT) + 32 (WrappedKey) = 1600 bytes.

	output := make([]byte, 0, len(ciphertext)+len(wrappedSessionKey))
	output = append(output, ciphertext...)
	output = append(output, wrappedSessionKey...)

	return output, nil
}

func decryptKyber(privBytes, blob []byte) ([]byte, error) {
	if len(blob) < kyber1024.CiphertextSize {
		return nil, errors.New("kyber blob too short")
	}

	// Split logic: CT || WrappedKey
	ciphertext := blob[:kyber1024.CiphertextSize]
	wrappedKey := blob[kyber1024.CiphertextSize:]

	priv := &kyber1024.PrivateKey{}
	priv.Unpack(privBytes)

	// Decapsulate to get Shared Secret
	sharedSecret := make([]byte, kyber1024.SharedKeySize)
	priv.DecapsulateTo(sharedSecret, ciphertext)

	// Unwrap the session key (XOR)
	// Note: Assuming wrappedKey length matches expected session key length (32)
	sessionKey := make([]byte, len(wrappedKey))
	for i := 0; i < len(wrappedKey); i++ {
		sessionKey[i] = wrappedKey[i] ^ sharedSecret[i%len(sharedSecret)]
	}

	return sessionKey, nil
}

// ECDSA/ECDH (Standard library - already correct)
func signECDSA(priv *ecdsa.PrivateKey, msgHash []byte) ([]byte, error) {
	return ecdsa.SignASN1(rand.Reader, priv, msgHash)
}

func verifyECDSA(pub *ecdsa.PublicKey, msgHash, signature []byte) error {
	if !ecdsa.VerifyASN1(pub, msgHash, signature) {
		return errors.New("ecdsa signature invalid")
	}
	return nil
}

// ECIES functions moved to ecies.go

// AES-256-GCM (Standard library)
// Uses the production-grade implementation from crypto_util.go
func encryptAESGCM(key, plaintext []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, errors.New("AES-256 requires 32-byte key")
	}
	return EncryptAESGCM(key, plaintext)
}

func decryptAESGCM(key, ciphertext []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, errors.New("AES-256 requires 32-byte key")
	}
	return DecryptAESGCM(key, ciphertext)
}
