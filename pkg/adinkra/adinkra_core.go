package adinkra

import (
	"crypto/rand"
	"crypto/sha256"
	"fmt"

	"github.com/cloudflare/circl/kem/kyber/kyber1024"
	"github.com/cloudflare/circl/sign/mldsa/mldsa65"
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

// GenerateDilithiumKey generates a ML-DSA-65 (Dilithium3) key pair.
func GenerateDilithiumKey() ([]byte, []byte, error) {
	pk, sk, err := mldsa65.GenerateKey(rand.Reader)
	if err != nil {
		return nil, nil, err
	}

	pkBytes := make([]byte, mldsa65.PublicKeySize)
	skBytes := make([]byte, mldsa65.PrivateKeySize)
	pk.Pack((*[mldsa65.PublicKeySize]byte)(pkBytes))
	sk.Pack((*[mldsa65.PrivateKeySize]byte)(skBytes))

	return pkBytes, skBytes, nil
}

// Sign signs a message using a ML-DSA-65 private key.
func Sign(skBytes []byte, msg []byte) ([]byte, error) {
	if len(skBytes) != mldsa65.PrivateKeySize {
		return nil, fmt.Errorf("invalid private key size: expected %d, got %d", mldsa65.PrivateKeySize, len(skBytes))
	}
	var sk mldsa65.PrivateKey
	sk.Unpack((*[mldsa65.PrivateKeySize]byte)(skBytes))

	sig := make([]byte, mldsa65.SignatureSize)
	mldsa65.SignTo(&sk, msg, nil, false, sig)
	return sig, nil
}

// Verify verifies a ML-DSA-65 signature.
func Verify(pkBytes []byte, msg []byte, sig []byte) (bool, error) {
	if len(pkBytes) != mldsa65.PublicKeySize {
		return false, fmt.Errorf("invalid public key size: expected %d, got %d", mldsa65.PublicKeySize, len(pkBytes))
	}
	var pk mldsa65.PublicKey
	pk.Unpack((*[mldsa65.PublicKeySize]byte)(pkBytes))
	return mldsa65.Verify(&pk, msg, nil, sig), nil
}

// Kuntinkantan (Do not be arrogant): Bends the reality of the detailed message
// into a riddle that only the Okyeame (Linguist) can unravel.
// Uses Kyber-1024 for the heavy lifting of the spirit, and the Merkaba Engine (White Box) for the weaving.
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

	// 2. Weave the Pattern (Merkaba White Box Encryption)
	// The sharedSpirit becomes the Seed for the Sacred Geometry.
	mk := NewMerkaba(sharedSpirit)

	// Cast the Veil (Seal with Sacred Alphabet)
	sealedLattice, err := mk.Seal(message)
	if err != nil {
		return nil, fmt.Errorf("the weaver refused the thread: %v", err)
	}
	wovenMatter := []byte(sealedLattice)

	// 3. The Final Artifact: [Capsule (Clay) | WovenMatter (Sacred Lattice)]
	// We concatenate them for transport across the void.
	// Note: No nonce is passed; randomness is derived deterministically from the SharedSpirit
	// via the ChaosEngine (Tree of Life walk), making it a true White Box implementation.
	artifact := make([]byte, 0, len(cypher)+len(wovenMatter))
	artifact = append(artifact, cypher...)
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
	wovenMatter := artifact[capsuleSize:]

	// 2. Break the Clay (Decapsulate)
	sk, err := kyber1024.Scheme().UnmarshalBinaryPrivateKey(okyeamePriv)
	if err != nil {
		return nil, fmt.Errorf("the hand does not fit the glove: %v", err)
	}

	sharedSpirit, err := kyber1024.Scheme().Decapsulate(sk, clay)
	if err != nil {
		return nil, fmt.Errorf("the spirit has fled: %v", err)
	}

	// 3. Unweave the Pattern (Merkaba White Box Decryption)
	mk := NewMerkaba(sharedSpirit)

	plaintext, err := mk.Unseal(string(wovenMatter))
	if err != nil {
		return nil, fmt.Errorf("the weave is tangled (auth failed): %v", err)
	}

	return plaintext, nil
}

// Khepra Lattice Alphabet (Void-Compatible Base16)

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
