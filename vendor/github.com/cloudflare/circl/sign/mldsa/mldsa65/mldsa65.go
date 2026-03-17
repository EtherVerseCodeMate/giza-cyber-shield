// Package mldsa65 implements ML-DSA-65 (NIST FIPS 204), vendored as a shim
// over the equivalent dilithium/mode3 implementation already present in vendor.
package mldsa65

import (
	"io"

	"github.com/cloudflare/circl/sign/dilithium/mode3"
)

// Key and signature sizes for ML-DSA-65.
const (
	PublicKeySize  = mode3.PublicKeySize
	PrivateKeySize = mode3.PrivateKeySize
	SignatureSize  = mode3.SignatureSize
)

// PublicKey is an ML-DSA-65 public key.
type PublicKey mode3.PublicKey

// PrivateKey is an ML-DSA-65 private key.
type PrivateKey mode3.PrivateKey

// GenerateKey generates a new ML-DSA-65 key pair.
func GenerateKey(rand io.Reader) (*PublicKey, *PrivateKey, error) {
	pk, sk, err := mode3.GenerateKey(rand)
	if err != nil {
		return nil, nil, err
	}
	return (*PublicKey)(pk), (*PrivateKey)(sk), nil
}

// Pack serialises the public key into buf.
func (pk *PublicKey) Pack(buf *[PublicKeySize]byte) {
	(*mode3.PublicKey)(pk).Pack(buf)
}

// Unpack deserialises the public key from buf.
func (pk *PublicKey) Unpack(buf *[PublicKeySize]byte) {
	(*mode3.PublicKey)(pk).Unpack(buf)
}

// Pack serialises the private key into buf.
func (sk *PrivateKey) Pack(buf *[PrivateKeySize]byte) {
	(*mode3.PrivateKey)(sk).Pack(buf)
}

// Unpack deserialises the private key from buf.
func (sk *PrivateKey) Unpack(buf *[PrivateKeySize]byte) {
	(*mode3.PrivateKey)(sk).Unpack(buf)
}

// SignTo signs msg with sk and writes the signature into sig.
// ctx and randomized are accepted for API compatibility and ignored.
func SignTo(sk *PrivateKey, msg, ctx []byte, randomized bool, sig []byte) {
	mode3.SignTo((*mode3.PrivateKey)(sk), msg, sig)
}

// Verify checks the signature of msg against pk.
// ctx is accepted for API compatibility and ignored.
func Verify(pk *PublicKey, msg, ctx []byte, sig []byte) bool {
	return mode3.Verify((*mode3.PublicKey)(pk), msg, sig)
}

// MarshalBinary encodes the public key to bytes.
func (pk *PublicKey) MarshalBinary() ([]byte, error) {
	return (*mode3.PublicKey)(pk).MarshalBinary()
}

// UnmarshalBinary decodes the public key from bytes.
func (pk *PublicKey) UnmarshalBinary(data []byte) error {
	return (*mode3.PublicKey)(pk).UnmarshalBinary(data)
}

// MarshalBinary encodes the private key to bytes.
func (sk *PrivateKey) MarshalBinary() ([]byte, error) {
	return (*mode3.PrivateKey)(sk).MarshalBinary()
}

// UnmarshalBinary decodes the private key from bytes.
func (sk *PrivateKey) UnmarshalBinary(data []byte) error {
	return (*mode3.PrivateKey)(sk).UnmarshalBinary(data)
}
