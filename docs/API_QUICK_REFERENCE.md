# Khepra Protocol - API Quick Reference

**Version:** 1.0
**Date:** 2026-01-04
**Package:** `pkg/adinkra`

---

## Core API Functions

### Key Generation

#### 1. Random Key Generation (Standard Mode)
```go
func GenerateHybridKeyPair(purpose string, expirationMonths int) (*HybridKeyPair, error)
```

**Purpose:** Generate a new triple-layer key pair with random entropy
**Parameters:**
- `purpose` - Key purpose description (e.g., "signing", "encryption")
- `expirationMonths` - Key validity period in months

**Returns:** `*HybridKeyPair` with all three crypto layers

**Example:**
```go
import "github.com/yourusername/khepra-protocol/pkg/adinkra"

// Generate keys valid for 12 months
keys, err := adinkra.GenerateHybridKeyPair("document-signing", 12)
if err != nil {
    log.Fatal(err)
}
defer keys.DestroyPrivateKeys() // Clean up when done
```

---

#### 2. Deterministic Key Generation (Ghost Identity Mode)
```go
func GenerateHybridKeyPairFromSeed(seed []byte, purpose string) (*HybridKeyPair, error)
```

**Purpose:** Generate deterministic keys from a seed (password-derived)
**Parameters:**
- `seed` - 64-byte seed (derive from password using Argon2id)
- `purpose` - Key purpose description

**Returns:** `*HybridKeyPair` - same seed always produces same keys

**Example (Ghost Identity Pattern):**
```go
import (
    "golang.org/x/crypto/argon2"
    "github.com/yourusername/khepra-protocol/pkg/adinkra"
)

// Derive seed from password
password := []byte("my-secure-passphrase-2024")
salt := []byte("user@example.com") // Use unique salt per user
seed := argon2.IDKey(password, salt, 1, 64*1024, 4, 64)

// Generate deterministic keys
keys, err := adinkra.GenerateHybridKeyPairFromSeed(seed, "ghost-identity")
if err != nil {
    log.Fatal(err)
}

// Keys are ALWAYS the same for this password+salt combination
// No key storage required - just remember the password!
```

---

### Signing & Verification

#### 3. Sign Data (Triple-Layer Signatures)
```go
func (kp *HybridKeyPair) SignArtifact(data []byte) (*SecureEnvelope, error)
```

**Purpose:** Create triple-layer digital signature
**Returns:** `*SecureEnvelope` containing:
- Khepra-PQC signature (2420 bytes)
- Dilithium3 signature (3293 bytes)
- ECDSA P-384 signature (~96 bytes)
- Metadata (timestamp, KeyID, version)

**Example:**
```go
message := []byte("Critical system update v2.1.0")

// Sign with all three layers
envelope, err := keys.SignArtifact(message)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Signed envelope: %d bytes\n", len(envelope.Serialize()))
```

---

#### 4. Verify Signatures
```go
func VerifyArtifact(envelope *SecureEnvelope, publicKeys *HybridKeyPair) error
```

**Purpose:** Verify all three signature layers
**Returns:** `nil` if ALL layers verify successfully, `error` otherwise

**Example:**
```go
// Verify signature (all 3 layers must pass)
err = adinkra.VerifyArtifact(envelope, keys)
if err != nil {
    log.Fatalf("Signature verification failed: %v", err)
}

fmt.Println("✅ All three signature layers verified!")
fmt.Println("  - Khepra-PQC: ✅")
fmt.Println("  - Dilithium3: ✅")
fmt.Println("  - ECDSA P-384: ✅")
```

---

### Encryption & Decryption

#### 5. Encrypt Data (Triple-Layer Encryption)
```go
func EncryptForRecipient(data []byte, recipientKeys *HybridKeyPair) (*SecureEnvelope, error)
```

**Purpose:** Encrypt data using triple-layer encryption
**Encryption Layers:**
1. AES-256-GCM (symmetric encryption of data)
2. Kyber1024 KEM (quantum-resistant key encapsulation)
3. ECIES P-384 (classical key encapsulation, fallback)

**Example:**
```go
plaintext := []byte("Secret intelligence report: Project Khepra status")

// Encrypt for recipient
encrypted, err := adinkra.EncryptForRecipient(plaintext, recipientKeys)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Encrypted: %d bytes → %d bytes\n", len(plaintext), len(encrypted.Serialize()))
```

---

#### 6. Decrypt Data
```go
func DecryptEnvelope(envelope *SecureEnvelope, recipientKeys *HybridKeyPair) ([]byte, error)
```

**Purpose:** Decrypt data using recipient's private keys
**Returns:** Original plaintext

**Example:**
```go
// Decrypt using recipient's private keys
decrypted, err := adinkra.DecryptEnvelope(encrypted, recipientKeys)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Decrypted: %s\n", string(decrypted))
```

---

## Data Structures

### HybridKeyPair
```go
type HybridKeyPair struct {
    // Khepra-PQC (Layer 1)
    KhepraPQCPublic  *KhepraPQCPublicKey
    KhepraPQCPrivate *KhepraPQCPrivateKey

    // NIST PQC (Layer 2)
    DilithiumPublic  []byte  // 2592 bytes
    DilithiumPrivate []byte  // 4000 bytes
    KyberPublic      []byte  // 1568 bytes
    KyberPrivate     []byte  // 3168 bytes

    // Classical (Layer 3)
    ECDSAPublic      *ecdsa.PublicKey
    ECDSAPrivate     *ecdsa.PrivateKey

    // Metadata
    KeyID            string
    CreatedAt        time.Time
    ExpiresAt        time.Time
    Purpose          string
}
```

### SecureEnvelope
```go
type SecureEnvelope struct {
    Version          uint32
    Timestamp        int64
    EncryptedData    []byte
    KhepraPQCSig     []byte    // 2420 bytes
    DilithiumSig     []byte    // 3293 bytes
    ECDSASig         []byte    // ~96 bytes
    SenderKeyID      string
    Purpose          string
}
```

---

## Security Best Practices

### 1. Key Lifecycle Management

**Always destroy keys when done:**
```go
keys, _ := adinkra.GenerateHybridKeyPair("test", 12)
defer keys.DestroyPrivateKeys()  // Securely zeroize memory
```

### 2. Ghost Identity Pattern (Stateless)

**For maximum security, use password-derived keys:**
```go
import "golang.org/x/crypto/argon2"

// Derive seed from high-entropy passphrase
password := []byte("correct horse battery staple 2024")
salt := []byte("alice@sovereign.com")

// Argon2id parameters: time=1, memory=64MB, threads=4, keyLen=64
seed := argon2.IDKey(password, salt, 1, 64*1024, 4, 64)

// Generate keys (deterministic, no storage needed)
keys, _ := adinkra.GenerateHybridKeyPairFromSeed(seed, "ghost")

// Keys regenerate identically next time with same password
```

**Advantages:**
- 🔒 No key files to secure/backup
- 🗑️ Stateless - keys vanish when program exits
- 🏳️ Sovereign - you control the passphrase

### 3. Verification Policy

**All three layers MUST verify:**
```go
err := adinkra.VerifyArtifact(envelope, publicKeys)
if err != nil {
    // ANY layer failure = TOTAL FAILURE
    // Do NOT accept partially-verified signatures
    log.Fatal("Signature rejected:", err)
}
```

### 4. Error Handling

**Always check errors - crypto failures are critical:**
```go
envelope, err := keys.SignArtifact(data)
if err != nil {
    log.Fatalf("CRITICAL: Signing failed: %v", err)
}

err = adinkra.VerifyArtifact(envelope, keys)
if err != nil {
    log.Fatalf("CRITICAL: Verification failed: %v", err)
}
```

---

## Complete Example: End-to-End Workflow

```go
package main

import (
    "fmt"
    "log"

    "golang.org/x/crypto/argon2"
    "github.com/yourusername/khepra-protocol/pkg/adinkra"
)

func main() {
    // === ALICE: Generate Ghost Identity ===
    alicePassword := []byte("alice-secure-passphrase-2024")
    aliceSalt := []byte("alice@khepra.protocol")
    aliceSeed := argon2.IDKey(alicePassword, aliceSalt, 1, 64*1024, 4, 64)

    aliceKeys, err := adinkra.GenerateHybridKeyPairFromSeed(aliceSeed, "alice-ghost")
    if err != nil {
        log.Fatal(err)
    }
    defer aliceKeys.DestroyPrivateKeys()

    fmt.Printf("Alice KeyID: %s\n", aliceKeys.KeyID)

    // === BOB: Generate Ghost Identity ===
    bobPassword := []byte("bob-secure-passphrase-2024")
    bobSalt := []byte("bob@khepra.protocol")
    bobSeed := argon2.IDKey(bobPassword, bobSalt, 1, 64*1024, 4, 64)

    bobKeys, err := adinkra.GenerateHybridKeyPairFromSeed(bobSeed, "bob-ghost")
    if err != nil {
        log.Fatal(err)
    }
    defer bobKeys.DestroyPrivateKeys()

    fmt.Printf("Bob KeyID: %s\n", bobKeys.KeyID)

    // === ALICE: Sign a message ===
    message := []byte("Transfer 1000 BTC to Bob - signed by Alice")
    envelope, err := aliceKeys.SignArtifact(message)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("\n✅ Alice signed message (3 layers)")

    // === BOB: Verify Alice's signature ===
    err = adinkra.VerifyArtifact(envelope, aliceKeys)
    if err != nil {
        log.Fatalf("Signature verification failed: %v", err)
    }

    fmt.Println("✅ Bob verified Alice's signature")

    // === ALICE: Encrypt data for Bob ===
    secret := []byte("The treasure is buried at coordinates 40.7128°N, 74.0060°W")
    encrypted, err := adinkra.EncryptForRecipient(secret, bobKeys)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("\n✅ Alice encrypted message for Bob (%d bytes)\n", len(encrypted.EncryptedData))

    // === BOB: Decrypt Alice's message ===
    decrypted, err := adinkra.DecryptEnvelope(encrypted, bobKeys)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("✅ Bob decrypted: %s\n", string(decrypted))

    // === CLEANUP ===
    // Keys are automatically zeroized by defer statements
    fmt.Println("\n✅ All operations successful!")
    fmt.Println("   Ghost identities will vanish when program exits.")
    fmt.Println("   No key material stored on disk.")
}
```

**Run:**
```bash
go run example.go
```

**Expected Output:**
```
Alice KeyID: abc123...
Bob KeyID: def456...

✅ Alice signed message (3 layers)
✅ Bob verified Alice's signature

✅ Alice encrypted message for Bob (1753 bytes)
✅ Bob decrypted: The treasure is buried at coordinates 40.7128°N, 74.0060°W

✅ All operations successful!
   Ghost identities will vanish when program exits.
   No key material stored on disk.
```

---

## Low-Level API (Advanced)

For direct access to individual crypto layers:

### Khepra-PQC Only
```go
import "github.com/yourusername/khepra-protocol/pkg/adinkra"

pub, priv, _ := adinkra.GenerateKhepraPQCKeyPair(seed)
sig, _ := adinkra.SignKhepraPQC(priv, messageHash)
err := adinkra.VerifyKhepraPQC(pub, messageHash, sig)
```

### Dilithium Only
```go
pubBytes, privBytes, _ := generateDilithiumKeys(seed)
sig, _ := signDilithium(privBytes, messageHash)
err := verifyDilithium(pubBytes, messageHash, sig)
```

### Kyber Only
```go
pubBytes, privBytes, _ := generateKyberKeys(seed)
ciphertext, sharedSecret, _ := encryptKyber(pubBytes, sessionKey)
decryptedKey, _ := decryptKyber(privBytes, ciphertext)
```

---

## Testing

**Run comprehensive tests:**
```bash
go test ./pkg/adinkra/... -v
```

**Test specific functionality:**
```bash
go test ./pkg/adinkra -run TestHybridCryptoFlow -v
go test ./pkg/adinkra -run TestGhostIdentityDeterminism -v
```

---

## Performance Characteristics

| Operation | Time (ms) | Notes |
|-----------|-----------|-------|
| Key Generation (Random) | ~100 | Includes entropy gathering |
| Key Generation (Seed) | ~50 | Deterministic, no entropy needed |
| Sign (Triple-layer) | ~150 | Sum of all 3 layers |
| Verify (Triple-layer) | ~80 | Parallel verification possible |
| Encrypt | ~20 | Kyber + ECIES + AES-GCM |
| Decrypt | ~20 | Key decapsulation + AES-GCM |

**Hardware:** Intel Core i7, 16GB RAM (reference)

---

## Security Guarantees

**When ALL layers verify successfully:**

✅ **Post-Quantum Security:** Khepra-PQC (256-bit) + Dilithium3 (Level 3) + Kyber1024 (Level 5)
✅ **Classical Security:** ECDSA/ECIES P-384 (192-bit)
✅ **Timing Attack Resistance:** Constant-time operations throughout
✅ **OWASP Top 100 Protection:** Comprehensive input validation
✅ **Memory Safety:** Secure zeroization of all key material

**If ANY layer fails:** The entire signature/encryption is REJECTED (defense-in-depth)

---

**Last Updated:** 2026-01-04
**Package Version:** 1.0
**License:** See LICENSE file in repository
