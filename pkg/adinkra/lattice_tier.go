package adinkra

import (
	"fmt"

	"github.com/cloudflare/circl/kem"
	"github.com/cloudflare/circl/kem/kyber/kyber1024"
	"github.com/cloudflare/circl/kem/kyber/kyber512"
	"github.com/cloudflare/circl/kem/kyber/kyber768"
)

// SymbolTier maps each Adinkra symbol to the ML-KEM/Kyber parameter tier the
// patent's own table (§5.2.3) assigns it. CIRCL only ships three fixed
// parameter sets (Kyber512/768/1024, i.e. ML-KEM-512/768/1024) — there is no
// way to derive an arbitrary lattice dimension n from this library, so
// "symbol-conditional lattice parameters" means selecting among these three
// fixed tiers per symbol, not deriving an arbitrary (n, q) pair.
var SymbolTier = map[string]string{
	"Eban":       "kyber512",
	"Fawohodie":  "kyber768",
	"Nkyinkyim":  "kyber1024",
	"Dwennimmen": "kyber1024",
}

// tierByte is the 1-byte artifact tag identifying which Kyber tier produced
// a given key/ciphertext. Values are stable and must never be reassigned
// once artifacts using them exist.
const (
	tierByteKyber512  byte = 0x00
	tierByteKyber768  byte = 0x01
	tierByteKyber1024 byte = 0x02
)

// schemeForTier resolves a tier name ("kyber512"/"kyber768"/"kyber1024") to
// its CIRCL kem.Scheme implementation. All three tiers satisfy the same
// kem.Scheme interface (vendor/github.com/cloudflare/circl/kem/kem.go),
// which is what makes a single tier-parameterized code path possible instead
// of three duplicated concrete-type call sites.
func schemeForTier(tier string) (kem.Scheme, byte, error) {
	switch tier {
	case "kyber512":
		return kyber512.Scheme(), tierByteKyber512, nil
	case "kyber768":
		return kyber768.Scheme(), tierByteKyber768, nil
	case "kyber1024":
		return kyber1024.Scheme(), tierByteKyber1024, nil
	default:
		return nil, 0, fmt.Errorf("unknown Kyber tier: %q", tier)
	}
}

// schemeForTierByte resolves a 1-byte artifact tag back to its kem.Scheme.
func schemeForTierByte(b byte) (kem.Scheme, error) {
	switch b {
	case tierByteKyber512:
		return kyber512.Scheme(), nil
	case tierByteKyber768:
		return kyber768.Scheme(), nil
	case tierByteKyber1024:
		return kyber1024.Scheme(), nil
	default:
		return nil, fmt.Errorf("unrecognized Kyber tier byte: 0x%02x", b)
	}
}

// TierForSymbol returns the Kyber tier name for an Adinkra symbol, falling
// back to "kyber1024" (the historical fixed default) for any symbol not in
// SymbolTier so callers never silently get an empty tier.
func TierForSymbol(symbol string) string {
	if tier, ok := SymbolTier[symbol]; ok {
		return tier
	}
	return "kyber1024"
}

// GenerateKyberKeyForSymbol generates a Kyber key pair sized to the tier the
// given Adinkra symbol maps to (patent §5.2.3). Unlike GenerateKyberKey,
// which is left unchanged for backward compatibility, this always ties key
// size to the symbol's documented tier.
func GenerateKyberKeyForSymbol(symbol string) (pkBytes, skBytes []byte, tier string, err error) {
	tier = TierForSymbol(symbol)
	scheme, _, err := schemeForTier(tier)
	if err != nil {
		return nil, nil, "", err
	}

	pk, sk, err := scheme.GenerateKeyPair()
	if err != nil {
		return nil, nil, "", fmt.Errorf("keygen failed for tier %s: %w", tier, err)
	}

	pkBytes, err = pk.MarshalBinary()
	if err != nil {
		return nil, nil, "", fmt.Errorf("marshal public key failed for tier %s: %w", tier, err)
	}
	skBytes, err = sk.MarshalBinary()
	if err != nil {
		return nil, nil, "", fmt.Errorf("marshal private key failed for tier %s: %w", tier, err)
	}

	return pkBytes, skBytes, tier, nil
}

// KyberEncapsulateForSymbol encapsulates a fresh shared secret against a
// symbol-tiered public key. The returned artifact is self-describing: a
// 1-byte tier tag followed by the tier-appropriate ciphertext, so
// KyberDecapsulateForSymbol can recover the correct scheme without the
// caller having to track which tier a given key pair used. This is the
// minimal header needed to make tier selection actually decodable; Phase 2
// extends this same header with a symbol tag and Phase 3 with a nonce,
// designed together rather than as three incompatible migrations.
func KyberEncapsulateForSymbol(pubKeyBytes []byte, symbol string) (artifact, sharedSecret []byte, err error) {
	tier := TierForSymbol(symbol)
	scheme, tag, err := schemeForTier(tier)
	if err != nil {
		return nil, nil, err
	}

	pk, err := scheme.UnmarshalBinaryPublicKey(pubKeyBytes)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse %s public key: %w", tier, err)
	}

	ct, ss, err := scheme.Encapsulate(pk)
	if err != nil {
		return nil, nil, fmt.Errorf("%s encapsulation failed: %w", tier, err)
	}

	artifact = make([]byte, 0, 1+len(ct))
	artifact = append(artifact, tag)
	artifact = append(artifact, ct...)
	return artifact, ss, nil
}

// KyberDecapsulateForSymbol recovers the shared secret from an artifact
// produced by KyberEncapsulateForSymbol, using the leading tier tag to
// select the matching scheme before decapsulating.
func KyberDecapsulateForSymbol(privKeyBytes []byte, artifact []byte) (sharedSecret []byte, err error) {
	if len(artifact) < 1 {
		return nil, fmt.Errorf("artifact too short to contain a tier tag")
	}

	scheme, err := schemeForTierByte(artifact[0])
	if err != nil {
		return nil, err
	}
	ciphertext := artifact[1:]

	sk, err := scheme.UnmarshalBinaryPrivateKey(privKeyBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key for tag 0x%02x: %w", artifact[0], err)
	}

	ss, err := scheme.Decapsulate(sk, ciphertext)
	if err != nil {
		return nil, fmt.Errorf("decapsulation failed for tag 0x%02x: %w", artifact[0], err)
	}
	return ss, nil
}
