package adinkra

import (
	"crypto/rand"
	"fmt"

	"github.com/cloudflare/circl/kem/kyber/kyber1024"
	"github.com/cloudflare/circl/sign/dilithium/mode3"
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
