package adinkra

import (
	"crypto/rand"
	"crypto/sha256"
	"fmt"

	"github.com/cloudflare/circl/kem/kyber/kyber1024"
	"github.com/cloudflare/circl/sign/dilithium/mode3"
	"golang.org/x/crypto/chacha20poly1305"
)

// GenerateKyberKey generates a Kyber-1024 key pair.
func GenerateKyberKey() ([]byte, []byte, error) {
	pk, sk, err := kyber1024.GenerateKeyPair(rand.Reader)
	if err != nil {
		return nil, nil, err
	}

	pkBytes, _ := pk.MarshalBinary()
	skBytes, _ := sk.MarshalBinary()

	return pkBytes, skBytes, nil
}

// GenerateDilithiumKey generates a Dilithium3 key pair.
func GenerateDilithiumKey() ([]byte, []byte, error) {
	pk, sk, err := mode3.GenerateKey(rand.Reader)
	if err != nil {
		return nil, nil, err
	}

	pkBytes, _ := pk.MarshalBinary()
	skBytes, _ := sk.MarshalBinary()

	return pkBytes, skBytes, nil
}

// Sign signs a message using a Dilithium3 private key.
func Sign(skBytes []byte, msg []byte) ([]byte, error) {
	sk := mode3.PrivateKey{}
	if err := sk.UnmarshalBinary(skBytes); err != nil {
		return nil, fmt.Errorf("invalid private key: %v", err)
	}
	// mode3.SignTo writes signature to buffer
	var sig [mode3.SignatureSize]byte
	mode3.SignTo(&sk, msg, sig[:])
	return sig[:], nil
}

// Verify verifies a Dilithium3 signature.
func Verify(pkBytes []byte, msg []byte, sig []byte) (bool, error) {
	pk := mode3.PublicKey{}
	if err := pk.UnmarshalBinary(pkBytes); err != nil {
		return false, fmt.Errorf("invalid public key: %v", err)
	}
	return mode3.Verify(&pk, msg, sig), nil
}

// Kuntinkantan (Do not be arrogant): Bends the reality of the detailed message
// into a riddle that only the Okyeame (Linguist) can unravel.
// Uses Kyber-1024 for the heavy lifting of the spirit, and XChaCha20 for the weaving.
func Kuntinkantan(okyeamePub []byte, message []byte) ([]byte, error) {
	// 1. Summon the Sunsum (The Spirit/Ephemeral Key)
	// We use the entropy of the universe to forge a fleeting soul.
	pk, err := kyber1024.Scheme().UnmarshalBinaryPublicKey(okyeamePub)
	if err != nil {
		return nil, fmt.Errorf("the staff is broken: %v", err)
	}

	// Encapsulate the spirit.
	// 'cypher' is the clay vessel (capsule) holding the shared secret.
	// 'sharedSpirit' is the secret itself (the symmetric key).
	cypher, sharedSpirit, err := kyber1024.Scheme().Encapsulate(pk)
	if err != nil {
		return nil, fmt.Errorf("failed to bottle the spirit: %v", err)
	}

	// 2. Weave the Pattern (Symmetric Encryption)
	// The sharedSpirit is too raw; we must refine it into a 32-byte XChaCha20 key.
	// We use BLAKE2b to polish the spirit into a perfect gem.
	aead, err := chacha20poly1305.NewX(deriveKey(sharedSpirit))
	if err != nil {
		return nil, fmt.Errorf("the weaver refused the thread: %v", err)
	}

	// The Nonce (The moment in time). XChaCha20 needs 24 bytes of entropy.
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("time stands still: %v", err)
	}

	// 3. Cast the Veil
	// Seal the message.
	wovenMatter := aead.Seal(nil, nonce, message, nil)

	// 4. The Final Artifact: [Capsule (Clay) | Nonce (Time) | WovenMatter (Secret)]
	// We concatenate them for transport across the void.
	artifact := make([]byte, 0, len(cypher)+len(nonce)+len(wovenMatter))
	artifact = append(artifact, cypher...)
	artifact = append(artifact, nonce...)
	artifact = append(artifact, wovenMatter...)

	return artifact, nil
}

// Sankofa (Go back and get it): Retrieves the lost meaning from the artifact.
// Requires the private Okyeame (Private Key) to break the clay vessel.
func Sankofa(okyeamePriv []byte, artifact []byte) ([]byte, error) {
	// 1. Separate the Elements
	// We must know the geometry of the capsule to find where the clay ends.
	capsuleSize := kyber1024.Scheme().CiphertextSize()
	if len(artifact) < capsuleSize {
		return nil, fmt.Errorf("artifact is dust")
	}

	clay := artifact[:capsuleSize]
	remaining := artifact[capsuleSize:]

	// XChaCha20 Nonce is 24 bytes
	nonceSize := 24
	if len(remaining) < nonceSize {
		return nil, fmt.Errorf("artifact has no time")
	}

	nonce := remaining[:nonceSize]
	wovenMatter := remaining[nonceSize:]

	// 2. Break the Clay (Decapsulate)
	sk, err := kyber1024.Scheme().UnmarshalBinaryPrivateKey(okyeamePriv)
	if err != nil {
		return nil, fmt.Errorf("the hand does not fit the glove: %v", err)
	}

	sharedSpirit, err := kyber1024.Scheme().Decapsulate(sk, clay)
	if err != nil {
		return nil, fmt.Errorf("the spirit has fled: %v", err)
	}

	// 3. Unweave the Pattern
	aead, err := chacha20poly1305.NewX(deriveKey(sharedSpirit))
	if err != nil {
		return nil, err
	}

	plaintext, err := aead.Open(nil, nonce, wovenMatter, nil)
	if err != nil {
		return nil, fmt.Errorf("the weave is tangled (auth failed): %v", err)
	}

	return plaintext, nil
}

// deriveKey polishes the raw shared secret into a 32-byte key
func deriveKey(secret []byte) []byte {
	// Ideally use BLAKE2b or SHA3. For now, a simple SHA256 is the hammer.
	// Importing sha256 to keep it pure.
	h := sha256.Sum256(secret)
	return h[:]
}

// Khepra Lattice Alphabet (Void-Compatible Base16)
const adinkraAlphabet = "GYENAMKHPRSUTILO"

// Hash generates a Khepra-standard hash, encoded in the Khepra Lattice.
// This creates the immutable "DNA" of any artifact.
// It wraps SHA-256 but encodes it using the poetic alphabet to obfuscate the structure.
func Hash(data []byte) string {
	h := sha256.Sum256(data)
	hexStr := fmt.Sprintf("%x", h)

	// Transmute standard hex (0-9, a-f) to Khepra Lattice (G-O)
	// Map: 0->G, 1->Y, 2->E, 3->N, 4->A, 5->M, 6->K, 7->H, 8->P, 9->R, a->S, b->U, c->T, d->I, e->L, f->O
	// Note: hexStr from fmt '%x' is lowercase.
	mapping := map[rune]byte{
		'0': 'G', '1': 'Y', '2': 'E', '3': 'N', '4': 'A', '5': 'M', '6': 'K', '7': 'H',
		'8': 'P', '9': 'R', 'a': 'S', 'b': 'U', 'c': 'T', 'd': 'I', 'e': 'L', 'f': 'O',
	}

	out := make([]byte, len(hexStr))
	for i, r := range hexStr {
		if val, ok := mapping[r]; ok {
			out[i] = val
		} else {
			out[i] = byte(r) // Should not happen for sha256 hex output
		}
	}
	return string(out)
}
