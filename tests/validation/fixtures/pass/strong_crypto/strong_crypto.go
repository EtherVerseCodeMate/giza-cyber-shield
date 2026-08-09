// Strong crypto (stdlib only) - should PASS validation.
package hashing

import (
	"crypto/hmac"
	"crypto/sha256"
)

// SignHMAC uses HMAC-SHA256 for message authentication.
func SignHMAC(key, data []byte) []byte {
	m := hmac.New(sha256.New, key)
	m.Write(data)
	return m.Sum(nil)
}

// Checksum uses SHA-256 for integrity.
func Checksum(data []byte) [32]byte {
	return sha256.Sum256(data)
}
