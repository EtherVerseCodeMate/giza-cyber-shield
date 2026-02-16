# PQC Architecture Integration Plan
**Khepra Protocol - Comprehensive Post-Quantum Security**

**Date**: 2026-02-16
**Status**: 🟡 IN PROGRESS
**Scope**: Integrate PQC data protection across entire security architecture

---

## Executive Summary

The Khepra Protocol has **complete PQC data protection infrastructure** implemented in `pkg/license/pqc_data_protection.go` and `pkg/license/pqc_signing.go`. This integration plan extends that protection to:

1. **Polymorphic API Engine** (Schema Engine) - Sign schemas, encrypt registry
2. **Mitochondrial API** (DEMARC API Server) - Replace JWT signing, protect scan results
3. **DMZ (Khepra Secure Gateway)** - Already has PQC verification (Layer 2), extend to all layers
4. **Database Layer** - Encrypt sensitive data before Supabase storage
5. **Frontend** - Decrypt protected data, verify signatures

**Current PQC Coverage**:
- ✅ License signing/verification (ML-DSA-65 + Kyber-1024 + AES-256-GCM + Lattice)
- ✅ Data protection for all contexts (at rest, in transit, in use, audit, telemetry, backup, archive)
- ✅ PQC signature verification in Gateway Layer 2 (line 279-297, layer2_auth.go)
- ✅ DAG node encryption (AES-256-GCM + Dilithium-3)
- ✅ STIG cache encryption (AES-256-GCM + HMAC + 30-day rotation)

**Gaps to Address**:
- ⏳ JWT token signing (currently HMAC-SHA256, target ML-DSA-65)
- ⏳ Scan results signing (currently unsigned)
- ⏳ Schema registry encryption (currently in-memory)
- ⏳ Telemetry encryption (currently plain JSON)
- ⏳ API response encryption (currently HTTPS only)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      KHEPRA PROTOCOL SECURITY STACK                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌────────────────┐     ┌────────────────┐     ┌────────────────┐      │
│  │   Polymorphic  │────▶│  Mitochondrial │────▶│  Supabase DB   │      │
│  │  Schema Engine │     │    DEMARC API  │     │  (Encrypted)   │      │
│  │  (Validation)  │     │  (JWT/Scan)    │     │                │      │
│  └────────────────┘     └────────────────┘     └────────────────┘      │
│         │                       │                       │                │
│         │ ML-DSA-65            │ ML-DSA-65            │ AES-256-GCM    │
│         │ Signatures           │ Signed Results       │ + Kyber        │
│         ▼                       ▼                       ▼                │
│  ┌────────────────────────────────────────────────────────────┐        │
│  │            KHEPRA SECURE GATEWAY (DMZ - 4 Layers)           │        │
│  ├────────────────────────────────────────────────────────────┤        │
│  │ L1: Firewall (WAF, IP Reputation, Rate Limit)              │        │
│  │ L2: Auth (mTLS, API Keys, PQC Signature Verification) ✅    │        │
│  │ L3: Anomaly Detection (ML-Powered Behavioral Analysis)      │        │
│  │ L4: Rate Limiting & Audit (Identity-Based Controls)         │        │
│  └────────────────────────────────────────────────────────────┘        │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

**4-Layer PQC Protection**:
```
┌───────────────────────────────────────────────────────┐
│ Layer 1: Adinkhepra Lattice (Spectral Fingerprint)   │
│ Layer 2: AES-256-GCM (Fast Bulk Encryption)          │
│ Layer 3: Kyber-1024 KEM (PQC Key Exchange)           │
│ Layer 4: ML-DSA-65 (Integrity + Authenticity)        │
└───────────────────────────────────────────────────────┘
```

---

## Integration Priorities

### CRITICAL (Week 1)

#### 1. JWT Token Signing (apiserver/token.go)
**Current**: HMAC-SHA256
**Target**: ML-DSA-65 signatures

**Implementation**:
```go
// pkg/apiserver/jwt_pqc.go
func GeneratePQCJWT(userID string, keys *license.ProtectionKeys) (string, error) {
    claims := JWTClaims{
        UserID:    userID,
        IssuedAt:  time.Now().Unix(),
        ExpiresAt: time.Now().Add(24 * time.Hour).Unix(),
    }

    // Serialize claims to JSON
    claimsJSON, _ := json.Marshal(claims)

    // Sign with ML-DSA-65
    signature, err := adinkra.Sign(keys.DilithiumPrivateKey, claimsJSON)
    if err != nil {
        return "", err
    }

    // Return base64(claims).base64(signature)
    token := base64.URLEncoding.EncodeToString(claimsJSON) + "." +
             base64.URLEncoding.EncodeToString(signature)
    return token, nil
}

func VerifyPQCJWT(token string, keys *license.ProtectionKeys) (*JWTClaims, error) {
    // Parse token
    parts := strings.Split(token, ".")
    claimsJSON, _ := base64.URLEncoding.DecodeString(parts[0])
    signature, _ := base64.URLEncoding.DecodeString(parts[1])

    // Verify signature
    valid, err := adinkra.Verify(keys.DilithiumPublicKey, claimsJSON, signature)
    if err != nil || !valid {
        return nil, errors.New("invalid JWT signature")
    }

    // Parse claims
    var claims JWTClaims
    json.Unmarshal(claimsJSON, &claims)

    // Check expiration
    if time.Now().Unix() > claims.ExpiresAt {
        return nil, errors.New("token expired")
    }

    return &claims, nil
}
```

**Files to Create**:
- `pkg/apiserver/jwt_pqc.go` - PQC JWT implementation
- `pkg/apiserver/jwt_pqc_test.go` - Comprehensive tests

**Migration Strategy**:
1. Add feature flag `USE_PQC_JWT` (default: false)
2. Support both HMAC and ML-DSA-65 during transition
3. Log JWT type for monitoring
4. Gradual rollout: internal → staging → production

---

#### 2. Scan Results Protection (apiserver/handlers.go)
**Current**: Plain JSON storage
**Target**: Signed + encrypted scan results

**Implementation**:
```go
// pkg/apiserver/scan_protection.go
func ProtectScanResult(scanResult *ScanResult, keys *license.ProtectionKeys) (*license.ProtectedData, error) {
    return license.ProtectData(
        scanResult,
        "scan_result",
        license.ContextAtRest,
        keys,
        nil,  // No recipient (internal storage)
        time.Now().Add(90 * 24 * time.Hour), // 90-day retention
    )
}

func UnprotectScanResult(protected *license.ProtectedData, keys *license.ProtectionKeys) (*ScanResult, error) {
    plaintext, err := license.UnprotectData(protected, keys, nil)
    if err != nil {
        return nil, err
    }

    // Convert map to ScanResult
    resultJSON, _ := json.Marshal(plaintext)
    var scanResult ScanResult
    json.Unmarshal(resultJSON, &scanResult)

    return &scanResult, nil
}
```

**Modification Required**:
- `pkg/apiserver/handlers.go` → `TriggerScanHandler()` - Encrypt before storage
- `pkg/apiserver/handlers.go` → `GetScanStatusHandler()` - Decrypt before returning
- Add `protected_scan_results` table in Supabase with columns:
  - `scan_id` (TEXT, primary key)
  - `encrypted_data` (BYTEA)
  - `nonce` (BYTEA)
  - `aead_tag` (BYTEA)
  - `kyber_capsule` (BYTEA, nullable)
  - `dilithium_signature` (BYTEA)
  - `lattice_hash` (TEXT)
  - `created_at` (TIMESTAMPTZ)
  - `expires_at` (TIMESTAMPTZ)

---

#### 3. Schema Registry Encryption (gateway/schema_engine.go)
**Current**: In-memory `map[string]Schema`
**Target**: Encrypted schemas in Supabase

**Implementation**:
```go
// pkg/gateway/schema_protection.go
func (se *SchemaEngine) ProtectSchema(schema *Schema, keys *license.ProtectionKeys) (*license.ProtectedData, error) {
    return license.ProtectData(
        schema,
        "api_schema",
        license.ContextAtRest,
        keys,
        nil,
        time.Time{}, // Schemas don't expire
    )
}

func (se *SchemaEngine) SaveSchemaToRegistry(schemaID string, schema *Schema, keys *license.ProtectionKeys) error {
    // Protect schema
    protected, err := se.ProtectSchema(schema, keys)
    if err != nil {
        return err
    }

    // Serialize to JSON
    protectedJSON, _ := json.Marshal(protected)

    // Store in Supabase
    supabase.From("api_schemas").Upsert(map[string]interface{}{
        "schema_id": schemaID,
        "encrypted_schema": protectedJSON,
        "created_at": time.Now(),
    })

    return nil
}

func (se *SchemaEngine) LoadSchemaFromRegistry(schemaID string, keys *license.ProtectionKeys) (*Schema, error) {
    // Fetch from Supabase
    var result struct {
        EncryptedSchema json.RawMessage `json:"encrypted_schema"`
    }
    err := supabase.From("api_schemas").
        Select("encrypted_schema").
        Eq("schema_id", schemaID).
        Single().
        ExecuteTo(&result)
    if err != nil {
        return nil, err
    }

    // Deserialize ProtectedData
    var protected license.ProtectedData
    json.Unmarshal(result.EncryptedSchema, &protected)

    // Unprotect schema
    plaintext, err := license.UnprotectData(&protected, keys, nil)
    if err != nil {
        return nil, err
    }

    // Convert to Schema
    schemaJSON, _ := json.Marshal(plaintext)
    var schema Schema
    json.Unmarshal(schemaJSON, &schema)

    return &schema, nil
}
```

**Supabase Migration Required**:
```sql
-- Create api_schemas table
CREATE TABLE IF NOT EXISTS api_schemas (
    schema_id TEXT PRIMARY KEY,
    encrypted_schema JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_schemas_created_at ON api_schemas(created_at);
```

---

### HIGH (Week 2)

#### 4. Telemetry Encryption (apiserver/telemetry_handlers.go)
**Current**: Plain JSON to telemetry server
**Target**: Encrypted telemetry with recipient key

**Implementation**:
```go
// pkg/apiserver/telemetry_protection.go
func ProtectTelemetryData(telemetryData interface{}, keys *license.ProtectionKeys, recipientKyberPubKey []byte) (*license.ProtectedData, error) {
    return license.ProtectTelemetry(
        telemetryData,
        keys,
        recipientKyberPubKey, // Telemetry collector's public key
    )
}

func SendEncryptedTelemetry(telemetryData interface{}, telemetryServerURL string, keys *license.ProtectionKeys, recipientKey []byte) error {
    // Protect telemetry
    protected, err := ProtectTelemetryData(telemetryData, keys, recipientKey)
    if err != nil {
        return err
    }

    // Export to JSON
    protectedJSON, _ := license.ExportProtectedData(protected)

    // Send via HTTP POST
    resp, err := http.Post(
        telemetryServerURL+"/ingest",
        "application/json",
        strings.NewReader(protectedJSON),
    )
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    return nil
}
```

**Configuration**:
- Add `TELEMETRY_RECIPIENT_PUBLIC_KEY` environment variable (Kyber-1024 public key, base64-encoded)
- Telemetry server must have corresponding Kyber private key to decrypt

---

#### 5. Audit Log Chain-of-Custody (gateway/layer4_control.go)
**Current**: Audit logs to stdout/file/DAG/telemetry
**Target**: Encrypted, signed, immutable audit chain

**Implementation**:
```go
// pkg/gateway/audit_protection.go
type AuditEntry struct {
    Timestamp    time.Time              `json:"timestamp"`
    Action       string                 `json:"action"`
    Actor        string                 `json:"actor"`
    Resource     string                 `json:"resource"`
    Result       string                 `json:"result"`
    Metadata     map[string]interface{} `json:"metadata"`
    PrevHash     string                 `json:"prev_hash"` // Hash of previous audit entry
    CurrentHash  string                 `json:"current_hash"`
}

func (ctrl *ControlLayer) ProtectAuditEntry(entry *AuditEntry, keys *license.ProtectionKeys) (*license.ProtectedData, error) {
    // Compute current hash (SHA-256 of entry JSON)
    entryJSON, _ := json.Marshal(entry)
    currentHash := sha256.Sum256(entryJSON)
    entry.CurrentHash = hex.EncodeToString(currentHash[:])

    // Protect with permanent retention
    return license.ProtectAuditLog(entry, keys)
}

func (ctrl *ControlLayer) AppendToAuditChain(entry *AuditEntry, keys *license.ProtectionKeys) error {
    // Get previous audit entry hash
    prevHash, err := ctrl.getLastAuditHash()
    if err != nil {
        prevHash = "genesis" // First entry
    }
    entry.PrevHash = prevHash

    // Protect audit entry
    protected, err := ctrl.ProtectAuditEntry(entry, keys)
    if err != nil {
        return err
    }

    // Store in immutable audit table
    protectedJSON, _ := json.Marshal(protected)
    supabase.From("audit_chain").Insert(map[string]interface{}{
        "audit_id": entry.CurrentHash,
        "protected_entry": protectedJSON,
        "created_at": entry.Timestamp,
    })

    return nil
}
```

**Supabase Migration**:
```sql
-- Create audit_chain table (immutable)
CREATE TABLE IF NOT EXISTS audit_chain (
    audit_id TEXT PRIMARY KEY,  -- Current hash
    protected_entry JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

-- Index for chain traversal
CREATE INDEX idx_audit_chain_created_at ON audit_chain(created_at);

-- Prevent updates/deletes (immutable)
CREATE RULE no_update_audit_chain AS ON UPDATE TO audit_chain DO INSTEAD NOTHING;
CREATE RULE no_delete_audit_chain AS ON DELETE TO audit_chain DO INSTEAD NOTHING;
```

---

### MEDIUM (Week 3-4)

#### 6. API Response Encryption (gateway/main.go)
**Current**: HTTPS only
**Target**: End-to-end encryption with client's public key

**Implementation**:
```go
// Middleware: Encrypt responses for clients that provide X-Khepra-Public-Key header
func PQCResponseEncryptionMiddleware(keys *license.ProtectionKeys) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Check if client provided public key
            clientPubKeyHex := r.Header.Get("X-Khepra-Public-Key")
            if clientPubKeyHex == "" {
                // No encryption requested
                next.ServeHTTP(w, r)
                return
            }

            // Decode client's Kyber public key
            clientPubKey, err := hex.DecodeString(clientPubKeyHex)
            if err != nil {
                http.Error(w, "Invalid public key", http.StatusBadRequest)
                return
            }

            // Capture response
            recorder := httptest.NewRecorder()
            next.ServeHTTP(recorder, r)

            // Protect response data
            protected, err := license.ProtectForTransit(
                recorder.Body.Bytes(),
                "api_response",
                keys,
                clientPubKey,
            )
            if err != nil {
                http.Error(w, "Encryption failed", http.StatusInternalServerError)
                return
            }

            // Export and send
            protectedJSON, _ := license.ExportProtectedData(protected)
            w.Header().Set("Content-Type", "application/json")
            w.Header().Set("X-Khepra-Encrypted", "true")
            w.WriteHeader(recorder.Code)
            w.Write([]byte(protectedJSON))
        })
    }
}
```

---

## Implementation Checklist

### Week 1: Critical Path
- [ ] Create `pkg/apiserver/jwt_pqc.go` - PQC JWT implementation
- [ ] Create `pkg/apiserver/jwt_pqc_test.go` - JWT tests
- [ ] Create `pkg/apiserver/scan_protection.go` - Scan result protection
- [ ] Create Supabase migration for `protected_scan_results` table
- [ ] Modify `apiserver/handlers.go` to use scan protection
- [ ] Create `pkg/gateway/schema_protection.go` - Schema encryption
- [ ] Create Supabase migration for `api_schemas` table
- [ ] Modify `schema_engine.go` to use protected schemas

### Week 2: High Priority
- [ ] Create `pkg/apiserver/telemetry_protection.go` - Telemetry encryption
- [ ] Configure `TELEMETRY_RECIPIENT_PUBLIC_KEY` environment variable
- [ ] Create `pkg/gateway/audit_protection.go` - Audit chain
- [ ] Create Supabase migration for `audit_chain` table
- [ ] Modify `layer4_control.go` to use audit protection

### Week 3-4: Medium Priority
- [ ] Implement PQC response encryption middleware
- [ ] Add client-side decryption support (TypeScript/WASM)
- [ ] Migrate certificate infrastructure to hybrid RSA/Dilithium
- [ ] Performance benchmarking and optimization

### Testing
- [ ] Integration tests for PQC JWT flow
- [ ] End-to-end tests for encrypted scan results
- [ ] Schema registry load tests
- [ ] Telemetry encryption tests
- [ ] Audit chain verification tests

---

## Key Management Strategy

### Key Storage
- **Production**: HashiCorp Vault (already referenced in config)
- **Development**: Local filesystem (`~/.khepra/keys/`)
- **Rotation**: Automated 90-day rotation cycle

### Key Types
| Key Type | Algorithm | Size | Purpose | Rotation |
|----------|-----------|------|---------|----------|
| Root CA | ML-DSA-65 | 4032B (priv) | License signing | 1 year |
| API Server | ML-DSA-65 | 4032B (priv) | JWT signing | 90 days |
| Gateway | Kyber-1024 | 3168B (priv) | Transit encryption | 90 days |
| Telemetry | Kyber-1024 | 3168B (priv) | Telemetry decryption | 90 days |

### Key Distribution
```
Vault (Root)
  ├─ API Server Keys (JWT signing)
  ├─ Gateway Keys (Transit encryption)
  ├─ Schema Registry Keys (Schema encryption)
  └─ Telemetry Keys (Telemetry encryption)
```

---

## Security Guarantees

### Post-Quantum Security
- **ML-DSA-65**: NIST PQC standard (security level 3)
- **Kyber-1024**: NIST PQC standard (security level 5)
- **Adinkhepra Lattice**: Proprietary obfuscation layer

### Defense-in-Depth
- All 4 layers must be compromised to forge data
- Signature verification prevents tampering
- Expiration enforcement prevents replay attacks
- Forward secrecy via ephemeral Kyber keys

### Compliance Alignment
- ✅ CMMC L1/L2 (encrypted data at rest/transit, audit logs)
- ✅ FedRAMP Moderate (PQC for government systems)
- ✅ NIST SP 800-208/209 (quantum-resistant cryptography)
- ✅ FIPS 140-2 (AES-256-GCM validated implementation)

---

## Performance Impact

### Expected Overhead
- **JWT Signing**: +5ms per token (ML-DSA-65 vs HMAC-SHA256)
- **JWT Verification**: +3ms per request
- **Scan Result Encryption**: +20ms per scan (one-time)
- **Schema Encryption**: +15ms per schema update (rare)
- **Telemetry Encryption**: +10ms per telemetry batch
- **Audit Log Encryption**: +15ms per audit entry

### Mitigation Strategies
- **Caching**: Cache verified JWT tokens for 5 minutes
- **Batching**: Batch telemetry encryption (10 entries per batch)
- **Parallelization**: Encrypt scan results asynchronously
- **Hardware Acceleration**: Use AVX2/AVX-512 for AES-GCM

---

## Rollout Strategy

### Phase 1: Internal Testing (Week 1)
- Deploy to internal test environment
- Enable PQC JWT with feature flag
- Monitor performance metrics
- Verify signature validation

### Phase 2: Staging (Week 2)
- Deploy to staging environment
- Enable all PQC protections
- Load testing (1000 req/sec)
- Security audit

### Phase 3: Production Rollout (Week 3-4)
- Gradual rollout: 10% → 50% → 100%
- Monitor error rates and latency
- A/B testing for performance comparison
- Full cutover after 72 hours

---

## Success Metrics

- [ ] **Zero JWT forgery**: All JWT signatures validated with ML-DSA-65
- [ ] **100% scan results protected**: All scan results encrypted + signed
- [ ] **Schema integrity**: All schemas signed and tamper-proof
- [ ] **Telemetry confidentiality**: All telemetry encrypted before leaving DMZ
- [ ] **Audit immutability**: Audit chain verified via cryptographic hashes
- [ ] **Performance SLA**: <50ms overhead for 95th percentile requests
- [ ] **Test Coverage**: 100% for all PQC integration code

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-16 | 1.0 | Initial integration plan |

---

**Status**: 🟡 IN PROGRESS - Week 1 implementation starting
**Next Review**: 2026-02-23 (end of Week 1)
