// Weak crypto for security purposes - should FAIL validation.
package hashing

import (
	"crypto/md5"
	"crypto/sha1"
	"fmt"
)

// HashPasswordUnsafe uses MD5 to hash a password - WEAK.
func HashPasswordUnsafe(pw string) string {
	h := md5.New()
	h.Write([]byte(pw))
	return fmt.Sprintf("%x", h.Sum(nil))
}

// SignUnsafe uses SHA-1 for signatures - WEAK.
func SignUnsafe(data []byte) []byte {
	s := sha1.New()
	s.Write(data)
	return s.Sum(nil)
}
