package adinkra

import (
	"bytes"
	"testing"

	"github.com/cloudflare/circl/kem/kyber/kyber1024"
	"github.com/cloudflare/circl/kem/kyber/kyber512"
	"github.com/cloudflare/circl/kem/kyber/kyber768"
)

func TestTierForSymbol(t *testing.T) {
	cases := map[string]string{
		"Eban":       "kyber512",
		"Fawohodie":  "kyber768",
		"Nkyinkyim":  "kyber1024",
		"Dwennimmen": "kyber1024",
		"Unknown":    "kyber1024", // fallback
	}
	for symbol, want := range cases {
		if got := TierForSymbol(symbol); got != want {
			t.Errorf("TierForSymbol(%q) = %q, want %q", symbol, got, want)
		}
	}
}

func TestGenerateKyberKeyForSymbol_Sizes(t *testing.T) {
	cases := []struct {
		symbol       string
		wantPKSize   int
		wantSKSize   int
		wantTierName string
	}{
		{"Eban", kyber512.Scheme().PublicKeySize(), kyber512.Scheme().PrivateKeySize(), "kyber512"},
		{"Fawohodie", kyber768.Scheme().PublicKeySize(), kyber768.Scheme().PrivateKeySize(), "kyber768"},
		{"Nkyinkyim", kyber1024.Scheme().PublicKeySize(), kyber1024.Scheme().PrivateKeySize(), "kyber1024"},
		{"Dwennimmen", kyber1024.Scheme().PublicKeySize(), kyber1024.Scheme().PrivateKeySize(), "kyber1024"},
	}

	for _, tc := range cases {
		t.Run(tc.symbol, func(t *testing.T) {
			pk, sk, tier, err := GenerateKyberKeyForSymbol(tc.symbol)
			if err != nil {
				t.Fatalf("GenerateKyberKeyForSymbol(%q) error: %v", tc.symbol, err)
			}
			if tier != tc.wantTierName {
				t.Errorf("tier = %q, want %q", tier, tc.wantTierName)
			}
			if len(pk) != tc.wantPKSize {
				t.Errorf("public key size = %d, want %d", len(pk), tc.wantPKSize)
			}
			if len(sk) != tc.wantSKSize {
				t.Errorf("private key size = %d, want %d", len(sk), tc.wantSKSize)
			}
		})
	}
}

func TestKyberEncapsulateDecapsulateForSymbol_RoundTrip(t *testing.T) {
	for symbol := range SymbolTier {
		t.Run(symbol, func(t *testing.T) {
			pk, sk, _, err := GenerateKyberKeyForSymbol(symbol)
			if err != nil {
				t.Fatalf("keygen failed: %v", err)
			}

			artifact, ss1, err := KyberEncapsulateForSymbol(pk, symbol)
			if err != nil {
				t.Fatalf("encapsulate failed: %v", err)
			}

			ss2, err := KyberDecapsulateForSymbol(sk, artifact)
			if err != nil {
				t.Fatalf("decapsulate failed: %v", err)
			}

			if !bytes.Equal(ss1, ss2) {
				t.Errorf("shared secret mismatch: encapsulated %x, decapsulated %x", ss1, ss2)
			}
		})
	}
}

func TestKyberDecapsulateForSymbol_WrongTierTagFails(t *testing.T) {
	pk, _, _, err := GenerateKyberKeyForSymbol("Eban") // kyber512
	if err != nil {
		t.Fatalf("keygen failed: %v", err)
	}
	_, skWrongTier, _, err := GenerateKyberKeyForSymbol("Nkyinkyim") // kyber1024
	if err != nil {
		t.Fatalf("keygen failed: %v", err)
	}

	artifact, _, err := KyberEncapsulateForSymbol(pk, "Eban")
	if err != nil {
		t.Fatalf("encapsulate failed: %v", err)
	}

	// Decapsulating with a kyber1024 private key against a kyber512-tagged
	// artifact must fail cleanly (wrong key size for the scheme the tag
	// selects), not silently produce a bogus shared secret.
	if _, err := KyberDecapsulateForSymbol(skWrongTier, artifact); err == nil {
		t.Error("expected decapsulation to fail when private key tier doesn't match artifact tag, got nil error")
	}
}

func TestKyberDecapsulateForSymbol_UnrecognizedTagFails(t *testing.T) {
	_, sk, _, err := GenerateKyberKeyForSymbol("Eban")
	if err != nil {
		t.Fatalf("keygen failed: %v", err)
	}
	garbage := append([]byte{0xFF}, make([]byte, 32)...)
	if _, err := KyberDecapsulateForSymbol(sk, garbage); err == nil {
		t.Error("expected error for unrecognized tier tag 0xFF, got nil")
	}
}

func TestGenerateKyberKey_LegacyUnchanged(t *testing.T) {
	// Regression: the original unparameterized GenerateKyberKey() must keep
	// producing Kyber1024-sized keys, unaffected by the new symbol-aware
	// tier selection added alongside it.
	pk, sk, err := GenerateKyberKey()
	if err != nil {
		t.Fatalf("GenerateKyberKey() error: %v", err)
	}
	if len(pk) != kyber1024.Scheme().PublicKeySize() {
		t.Errorf("legacy public key size = %d, want %d", len(pk), kyber1024.Scheme().PublicKeySize())
	}
	if len(sk) != kyber1024.Scheme().PrivateKeySize() {
		t.Errorf("legacy private key size = %d, want %d", len(sk), kyber1024.Scheme().PrivateKeySize())
	}

	// KyberEncapsulate/KyberDecapsulate (the original, non-tiered functions)
	// must also still round-trip correctly, untouched by this change.
	ct, ss1, err := KyberEncapsulate(pk)
	if err != nil {
		t.Fatalf("KyberEncapsulate error: %v", err)
	}
	ss2, err := KyberDecapsulate(sk, ct)
	if err != nil {
		t.Fatalf("KyberDecapsulate error: %v", err)
	}
	if !bytes.Equal(ss1, ss2) {
		t.Error("legacy KyberEncapsulate/KyberDecapsulate shared secret mismatch")
	}
}
