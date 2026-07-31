package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"io"

	"golang.org/x/crypto/argon2"
)

const (
	// Argon2id parameters
	time    = 1
	memory  = 64 * 1024
	threads = 4
	keyLen  = 32
	saltLen = 16
)

// EncryptKey derives an AES-GCM key from the passphrase using Argon2id,
// and encrypts the rawKey. It returns the combined salt + nonce + ciphertext.
func EncryptKey(rawKey []byte, passphrase string) ([]byte, error) {
	salt := make([]byte, saltLen)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return nil, err
	}

	key := argon2.IDKey([]byte(passphrase), salt, time, memory, threads, keyLen)

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

	ciphertext := gcm.Seal(nil, nonce, rawKey, nil)

	// Format: [salt (16)] + [nonce (12)] + [ciphertext]
	out := make([]byte, 0, len(salt)+len(nonce)+len(ciphertext))
	out = append(out, salt...)
	out = append(out, nonce...)
	out = append(out, ciphertext...)

	return out, nil
}

// DecryptKey extracts the salt and nonce, derives the key using the passphrase,
// and decrypts the ciphertext.
func DecryptKey(data []byte, passphrase string) ([]byte, error) {
	blockLen := 12 // typical GCM nonce size
	if len(data) < saltLen+blockLen {
		return nil, errors.New("invalid encrypted data size")
	}

	salt := data[:saltLen]
	nonce := data[saltLen : saltLen+blockLen]
	ciphertext := data[saltLen+blockLen:]

	key := argon2.IDKey([]byte(passphrase), salt, time, memory, threads, keyLen)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, errors.New("authentication failed: incorrect passphrase")
	}

	return plaintext, nil
}
