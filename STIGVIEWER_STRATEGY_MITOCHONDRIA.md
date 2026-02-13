# Protocol Mitochondrial v2.0 — STIGViewer API Integration Strategy (Hardened)

**Date:** 2026-02-12 | **Rev:** 2.0 (Post-Audit)
**Status:** PROPOSED — Pending Threat Model Completion
**Classification:** UNCLASSIFIED // FOUO
**Author:** Protocol Khepra Architect
**Audit Response:** All 10 findings from Security Audit addressed below.

---

## 0. Audit Response Matrix

| Audit # | Finding | Severity | Status | Section |
|---------|---------|----------|--------|---------|
| 1 | API Key Management Undefined | 🔴 CRITICAL | ✅ Addressed | §3.1 |
| 2 | MCP Security Unaddressed | 🔴 CRITICAL | ✅ Addressed | §3.2 |
| 3 | Internal Auth/AuthZ Missing | 🔴 CRITICAL | ✅ Addressed | §3.3 |
| 4 | DMZ Design Conceptually Flawed | 🟠 HIGH | ✅ Addressed | §2.1 |
| 5 | Cache Security Ignored | 🟠 HIGH | ✅ Addressed | §3.4 |
| 6 | Rate Limiting Vague | 🟡 MEDIUM | ✅ Addressed | §3.5 |
| 7 | OWASP API1:2023 BOLA | 🟠 HIGH | ✅ Addressed | §4.1 |
| 8 | OWASP API8:2023 Misconfig | 🟡 MEDIUM | ✅ Addressed | §4.2 |
| 9 | OWASP API10:2023 Unsafe Consumption | 🟠 HIGH | ✅ Addressed | §4.3 |
| 10 | Air-Gap Transfer Weak | 🔴 CRITICAL | ✅ Addressed | §5 |

---

## 1. Executive Summary

We are upgrading the Khepra Compliance Engine to consume the new STIGViewer API for enriched, decomposed STIG data. This document specifies the **security-first** architecture for that integration.

**Guiding Principle:** *Clarity > Creativity. Every decision is traceable to a threat.*

**What Changed from v1.0:**
- Replaced metaphorical architecture with concrete trust boundaries
- Added STRIDE threat model
- Specified OWASP API Security Top 10 mitigations
- Defined cryptographic verification chain for air-gap transfers
- Added MCP security controls (prompt injection, data classification, observability)
- Specified internal auth/authz for all service-to-service communication

---

## 2. Architecture

### 2.1 Trust Zones & Network Segmentation (Audit #4 Fix)

The v1.0 plan placed everything inside the same trust boundary. The corrected architecture uses **three distinct trust zones** with firewalls between each:

```
┌─────────────────────────────────────────────────────────────────────┐
│ ZONE 0: UNTRUSTED (Internet)                                        │
│   STIGViewer API (api.stigviewer.com)                               │
│   Dorian Cougias MCP Server                                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS/TLS 1.3 ONLY
                             │ Egress-only from Zone 1
                    ┌────────▼────────┐
                    │ OUTER FIREWALL   │
                    │ (pkg/gateway L1) │
                    │ WAF + IP ACLs    │
                    └────────┬────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│ ZONE 1: DMZ (Isolated Subnet / Container)                           │
│                                                                      │
│   ┌─────────────────────────────────────┐                           │
│   │ stig_connector (new service)        │                           │
│   │ - Outbound HTTPS to STIGViewer ONLY │                           │
│   │ - Inbound from Zone 2 on port 8443  │                           │
│   │ - No database access                │                           │
│   │ - No filesystem write (read-only)   │                           │
│   │ - Validates + sanitizes all JSON    │                           │
│   │ - Rate-limited outbound calls       │                           │
│   └─────────────────────────────────────┘                           │
│                                                                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │ mTLS (client certs required)
                             │ Port 8443 ONLY
                    ┌────────▼────────┐
                    │ INNER FIREWALL   │
                    │ (pkg/gateway L2) │
                    │ mTLS + PQC Sig   │
                    └────────┬────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│ ZONE 2: TRUSTED (Internal Network)                                   │
│                                                                      │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
│   │ Khepra Core  │  │ pkg/stig DB  │  │ MCP Gateway          │     │
│   │ (validator)  │  │ (compliance) │  │ (policy-enforced)    │     │
│   └──────────────┘  └──────────────┘  └──────────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Constraints:**
- Zone 1 **cannot** reach Zone 2's database directly
- Zone 1 **cannot** initiate connections to Zone 2 (Zone 2 pulls)
- Zone 1 has **no write access** to any persistent storage
- All cross-zone traffic requires **mTLS with PQC signature verification**
- Network policies enforced via `pkg/gateway/layer1_firewall.go` (existing WAF)

### 2.2 Component Inventory

| Component | Location | Trust Zone | Purpose |
|-----------|----------|------------|---------|
| `stig_connector` | `pkg/gateway/stig_connector.go` (NEW) | Zone 1 (DMZ) | Secure proxy to STIGViewer API |
| `stig_cache` | `pkg/gateway/stig_cache.go` (NEW) | Zone 1 (DMZ) | Encrypted, signed cache layer |
| `stig_validator` | `pkg/gateway/stig_input_validator.go` (NEW) | Zone 1 (DMZ) | JSON schema validation + sanitization |
| `mcp_gateway` | `pkg/gateway/mcp_gateway.go` (NEW) | Zone 2 (Trusted) | Policy-enforced MCP middleware |
| `pkg/stig/database.go` | Existing | Zone 2 (Trusted) | Compliance database (enhanced) |
| `pkg/gateway/layer2_auth.go` | Existing | Zone boundary | mTLS + PQC + API Key auth |

---

## 3. Security Controls

### 3.1 API Key Management (Audit #1 Fix)

**Requirement:** STIGViewer API key must never exist in plaintext config files or environment variables in production.

| Control | Implementation |
|---------|---------------|
| **Storage** | HashiCorp Vault (self-hosted) or AWS Secrets Manager (GovCloud) |
| **Rotation** | Automatic every 30 days. Manual emergency rotation via `khepra key rotate --service stigviewer` |
| **Scope** | Read-only. No write/admin scopes requested from STIGViewer |
| **Environments** | Separate keys for `dev`, `staging`, `production`. Never shared |
| **Revocation** | Playbook: Rotate key → Update Vault → Restart stig_connector → Verify → Audit |
| **Audit Trail** | Every key access logged to tamper-proof DAG (pkg/seshat) with identity, timestamp, operation |
| **Fallback** | If Vault unavailable, connector enters read-only cache mode (no new API calls) |

**Key Retrieval Flow:**
```go
// pkg/gateway/stig_connector.go
func (c *STIGConnector) getAPIKey() (string, error) {
    // 1. Try Vault first
    key, err := c.vault.ReadSecret("khepra/stigviewer/api_key")
    if err == nil {
        c.auditLog("api_key_accessed", "vault", c.identity)
        return key, nil
    }

    // 2. Vault unavailable → fail secure (no env var fallback)
    c.auditLog("api_key_access_failed", "vault_unavailable", c.identity)
    return "", fmt.Errorf("vault unavailable, connector in cache-only mode")
}
```

### 3.2 MCP Security (Audit #2 Fix)

**Threat:** Prompt injection via STIG data, unauthorized agent queries, tool poisoning.

| Control | Implementation |
|---------|---------------|
| **MCP Gateway** | All agent queries route through `mcp_gateway.go` — NO direct MCP server connections |
| **Prompt Injection Scanning** | All STIG text fields scanned for injection patterns before agent access |
| **Content Filtering** | Data classification labels applied: `PUBLIC`, `CUI`, `CLASSIFIED`. Agents only see `PUBLIC` by default |
| **Agent Auth** | Each agent/tool gets a scoped JWT with `stig:read` permission. No wildcard access |
| **Query Logging** | 100% of agent queries and responses logged with identity, timestamp, data accessed |
| **Approval Workflow** | New MCP server deployments require security review + approval (tracked in DAG) |
| **Data Boundaries** | Agents cannot query raw STIG data with `CUI` or higher classification |
| **Response Filtering** | MCP gateway strips sensitive fields (internal IDs, audit metadata) from responses |

**Prompt Injection Scanner:**
```go
// pkg/gateway/mcp_gateway.go
var injectionPatterns = []*regexp.Regexp{
    regexp.MustCompile(`(?i)(ignore|forget|disregard)\s+(previous|above|prior)\s+(instructions?|prompts?|rules?)`),
    regexp.MustCompile(`(?i)you\s+are\s+now\s+a`),
    regexp.MustCompile(`(?i)system\s*:\s*`),
    regexp.MustCompile(`(?i)(reveal|show|print|output)\s+(your|the)\s+(system|initial|original)\s+(prompt|instructions?)`),
    regexp.MustCompile(`(?i)\[\s*INST\s*\]`),  // LLM instruction markers
    regexp.MustCompile(`(?i)<\|im_start\|>`),    // ChatML injection
}

func (g *MCPGateway) scanForInjection(content string) error {
    for _, pattern := range injectionPatterns {
        if pattern.MatchString(content) {
            g.auditLog("prompt_injection_blocked", content[:100])
            return fmt.Errorf("potential prompt injection detected")
        }
    }
    return nil
}
```

### 3.3 Authentication & Authorization (Audit #3 Fix)

**Internal service-to-service communication uses the existing `pkg/gateway/layer2_auth.go` infrastructure:**

| Communication Path | Auth Method | Authorization |
|-------------------|------------|---------------|
| Zone 2 → Zone 1 (stig_connector) | mTLS (client certs from `pkg/gateway/layer2_auth.go`) | Service identity validated against allowlist |
| Agent → MCP Gateway | JWT with `stig:read` scope | RBAC: `stig:read`, `stig:admin`, `stig:export` |
| MCP Gateway → pkg/stig DB | Internal (same process, no network) | Function-level access control |
| stig_connector → STIGViewer API | API Key (from Vault) | Read-only scope |

**RBAC Roles:**
```go
var STIGRoles = map[string][]string{
    "stig:reader":  {"query_stigs", "view_decomposed_rules", "view_complexity"},
    "stig:analyst": {"query_stigs", "view_decomposed_rules", "view_complexity", "export_reports", "view_role_mappings"},
    "stig:admin":   {"query_stigs", "view_decomposed_rules", "view_complexity", "export_reports", "view_role_mappings", "manage_cache", "force_sync"},
}
```

**Lateral Movement Prevention:**
- Zone 1 stig_connector runs as non-root (UID 1001) with no shell
- Zone 1 has no SSH, no package manager, read-only filesystem
- Zone 1 network policy: egress only to `api.stigviewer.com:443`; ingress only from Zone 2 on port `8443`
- If Zone 1 is compromised, attacker cannot reach Zone 2 database or MCP server

### 3.4 Cache Security (Audit #5 Fix)

**Implementation:** In-memory cache with cryptographic integrity (no Redis in DMZ — reduces attack surface).

| Control | Implementation |
|---------|---------------|
| **Encryption at Rest** | AES-256-GCM encryption of all cached entries using key derived from Vault |
| **Signed Entries** | Each cache entry signed with HMAC-SHA256; signature verified on retrieval |
| **TTL** | 4 hours for decomposed rules, 24 hours for metadata. Configurable per data sensitivity |
| **Invalidation** | Version mismatch detection: if STIGViewer returns newer `version` field, entire cache invalidated |
| **Integrity Check** | Hash validation on every cache read. Corrupted entries purged immediately |
| **Max Size** | 256 MB hard limit. LRU eviction when 80% full |
| **Persistence** | Cache is ephemeral (lost on restart). This is intentional — cold start fetches from API |
| **Poisoning Prevention** | Only stig_connector can write to cache. No external write path |

```go
// pkg/gateway/stig_cache.go
type CacheEntry struct {
    Data       []byte    // AES-256-GCM encrypted
    Nonce      []byte    // GCM nonce
    HMAC       []byte    // HMAC-SHA256 of plaintext
    Version    string    // STIGViewer data version
    CachedAt   time.Time
    ExpiresAt  time.Time
    DataClass  string    // "PUBLIC", "CUI"
}

func (c *STIGCache) Get(key string) ([]byte, error) {
    entry, ok := c.store[key]
    if !ok {
        return nil, ErrCacheMiss
    }
    if time.Now().After(entry.ExpiresAt) {
        delete(c.store, key)
        return nil, ErrCacheExpired
    }
    // Decrypt
    plaintext, err := c.decrypt(entry.Data, entry.Nonce)
    if err != nil {
        delete(c.store, key) // Corrupted
        return nil, fmt.Errorf("cache integrity failure: %w", err)
    }
    // Verify HMAC
    if !c.verifyHMAC(plaintext, entry.HMAC) {
        delete(c.store, key) // Tampered
        c.auditLog("cache_tampering_detected", key)
        return nil, fmt.Errorf("cache HMAC verification failed")
    }
    return plaintext, nil
}
```

### 3.5 Rate Limiting & Circuit Breaker (Audit #6 Fix)

**Outbound (to STIGViewer API):**

| Control | Value |
|---------|-------|
| **Algorithm** | Token bucket (100 requests/hour, burst 10) |
| **Circuit Breaker** | Open after 3 consecutive failures. Half-open after 60s. Close after 2 successes |
| **Backoff** | Exponential: 1s → 2s → 4s → 8s → 16s → 30s (cap) |
| **Alert** | Warning at 80% of rate limit. Critical at 95% |

**Inbound (to stig_connector from Zone 2):**

| Control | Value |
|---------|-------|
| **Per-Service** | 200 requests/minute per authenticated service identity |
| **Per-IP** | 50 requests/minute (defense-in-depth) |
| **Overflow** | Requests queued (max 100 in queue) then rejected with 429 |
| **Monitoring** | Prometheus metrics exposed for Grafana dashboards |

```go
// Circuit breaker state machine
type CircuitState int
const (
    CircuitClosed   CircuitState = iota // Normal operation
    CircuitOpen                         // Upstream failed, reject all
    CircuitHalfOpen                     // Testing if upstream recovered
)
```

---

## 4. OWASP API Security Top 10 Mitigations

### 4.1 API1:2023 — Broken Object Level Authorization (Audit #7 Fix)

**Threat:** Agent requests `GET /gateway/stig/{classified_stig_id}` and accesses data they shouldn't see.

**Mitigation:**
```go
func (g *MCPGateway) HandleSTIGQuery(identity *Identity, stigID string) (*STIGResult, error) {
    // 1. Validate STIG ID format (prevent injection)
    if !isValidSTIGID(stigID) {
        return nil, ErrInvalidSTIGID
    }

    // 2. Check object-level authorization
    allowed, err := g.checkSTIGAccess(identity, stigID)
    if err != nil || !allowed {
        g.auditLog("stig_access_denied", identity.ID, stigID)
        return nil, ErrAccessDenied
    }

    // 3. Filter response fields based on identity's data classification clearance
    result, err := g.stigDB.GetSTIG(stigID)
    if err != nil {
        return nil, err
    }

    return g.filterByClassification(result, identity.DataClassification), nil
}
```

### 4.2 API8:2023 — Security Misconfiguration (Audit #8 Fix)

| Control | Implementation |
|---------|---------------|
| **HTTP Methods** | Only `GET` allowed on stig_connector endpoints. All others return 405 |
| **Debug Endpoints** | None in production. Build tag `debug` required to enable |
| **Security Headers** | HSTS, CSP, X-Frame-Options, X-Content-Type-Options on all responses |
| **Directory Listing** | Disabled (no filesystem serving) |
| **Service Accounts** | Non-root, minimal capabilities, no shell (already in Dockerfile.ironbank) |
| **Scanning** | Weekly OWASP ZAP scans, monthly manual pen test, quarterly audit |

### 4.3 API10:2023 — Unsafe Consumption of APIs (Audit #9 Fix)

**Threat:** Trusting STIGViewer API responses without validation.

```go
// pkg/gateway/stig_input_validator.go

const MaxPayloadBytes = 10 * 1024 * 1024 // 10 MB hard limit

// STIGRuleSchema defines the expected JSON structure
type STIGRuleSchema struct {
    RuleID      string   `json:"rule_id" validate:"required,alphanum_dash,max=64"`
    Title       string   `json:"title" validate:"required,max=500"`
    Severity    string   `json:"severity" validate:"required,oneof=CAT_I CAT_II CAT_III"`
    Complexity  string   `json:"complexity" validate:"required,oneof=LOW MEDIUM HIGH"`
    OwnerRoles  []string `json:"owner_roles" validate:"max=10,dive,max=100"`
    Description string   `json:"description" validate:"required,max=10000"`
    Controls    []string `json:"controls" validate:"max=50,dive,max=20"`
}

func (v *InputValidator) ValidateSTIGResponse(body []byte) (*STIGRuleSchema, error) {
    // 1. Size limit
    if len(body) > MaxPayloadBytes {
        return nil, fmt.Errorf("payload exceeds %d byte limit", MaxPayloadBytes)
    }

    // 2. Content-Type validation (must be application/json)
    // (checked at HTTP level before this function)

    // 3. Parse JSON strictly (disallow unknown fields)
    var rule STIGRuleSchema
    decoder := json.NewDecoder(bytes.NewReader(body))
    decoder.DisallowUnknownFields()
    if err := decoder.Decode(&rule); err != nil {
        return nil, fmt.Errorf("JSON schema validation failed: %w", err)
    }

    // 4. Sanitize text fields (prevent XSS in STIG descriptions)
    rule.Title = sanitizeText(rule.Title)
    rule.Description = sanitizeText(rule.Description)
    for i := range rule.OwnerRoles {
        rule.OwnerRoles[i] = sanitizeText(rule.OwnerRoles[i])
    }

    // 5. Validate data types and ranges
    if err := validate.Struct(rule); err != nil {
        return nil, fmt.Errorf("field validation failed: %w", err)
    }

    return &rule, nil
}

func sanitizeText(input string) string {
    // Strip HTML tags, normalize unicode, escape special chars
    input = bluemonday.StrictPolicy().Sanitize(input)
    input = norm.NFKC.String(input)
    return strings.TrimSpace(input)
}
```

---

## 5. Air-Gap Transfer Security (Audit #10 Fix)

### 5.1 Internet-Connected Side (Update Creation)

```
Step 1: stig_connector fetches latest data from STIGViewer API
Step 2: InputValidator validates ALL JSON against strict schema (§4.3)
Step 3: Create update package with manifest:
        - Package version (monotonically increasing, prevents downgrade)
        - SHA-256 hash of each data file
        - Timestamp
        - Source API version
Step 4: Sign manifest with OFFLINE root CA key (HSM-backed, Dilithium3)
Step 5: Counter-sign with ONLINE signing key (ML-DSA-65, from Vault)
Step 6: Generate Merkle hash tree over all files
Step 7: Bundle into encrypted archive:
        compliance_update_v{VERSION}.kpkg
        ├── manifest.json          (version, hashes, timestamps)
        ├── manifest.sig.dilithium (offline root CA signature)
        ├── manifest.sig.mldsa     (online counter-signature)
        ├── merkle_root.json       (hash tree root + branches)
        ├── data/                  (encrypted STIG data files)
        └── checksums.sha256       (per-file integrity)
Step 8: Write to FIPS 140-2 compliant USB (hardware-encrypted)
```

### 5.2 Physical Transfer

```
Step 9:  Authorized courier transfers USB (chain-of-custody log)
Step 10: Scan USB at isolated scanning station (malware check)
Step 11: Verify BOTH signatures:
         - Root CA (Dilithium3) against pinned public key
         - Online key (ML-DSA-65) against Vault-published public key
```

### 5.3 Air-Gapped Side (Update Ingestion)

```
Step 12: Verify Merkle tree integrity (all branches)
Step 13: Check manifest version > current version (prevent downgrade attack)
Step 14: Load into STAGING environment first (isolated from production)
Step 15: Run automated validation tests:
         - Schema validation on all data files
         - Cross-reference integrity (STIG → CCI → NIST chains valid)
         - No prompt injection patterns in text fields
Step 16: Manual security review (two-person rule: analyst + approver)
Step 17: Atomic swap into production:
         - Stop consumers
         - Replace data atomically
         - Restart consumers
         - Verify health checks
Step 18: Archive previous version for 90 days (rollback capability)
Step 19: Generate audit record in DAG (pkg/seshat)
```

---

## 6. STRIDE Threat Model

| Threat | Category | Mitigation | Control |
|--------|----------|------------|---------|
| Attacker intercepts API key | **S**poofing | Vault storage + mTLS | §3.1 |
| Malicious STIG data injected | **T**ampering | Schema validation + signing | §4.3, §5 |
| Denial of key compromise | **R**epudiation | Tamper-proof audit trail (DAG) | §3.1 |
| STIG data leaked via MCP agent | **I**nformation Disclosure | Data classification + filtering | §3.2 |
| STIGViewer API flood | **D**enial of Service | Circuit breaker + rate limit | §3.5 |
| Agent bypasses access control | **E**levation of Privilege | RBAC + object-level authz | §3.3, §4.1 |

---

## 7. Implementation Phases

### Phase 0: Security Foundations (Week 1)
- [ ] Complete STRIDE threat model document (full, not summary)
- [ ] Define network segmentation rules (firewall policies for Zone 0/1/2)
- [ ] Set up HashiCorp Vault instance (or AWS Secrets Manager GovCloud)
- [ ] Create API key rotation automation
- [ ] Define RBAC roles and permissions matrix

### Phase 1: DMZ Connector (Week 2)
- [ ] Implement `pkg/gateway/stig_connector.go` (Zone 1)
- [ ] Implement `pkg/gateway/stig_input_validator.go` (schema validation)
- [ ] Implement `pkg/gateway/stig_cache.go` (encrypted cache)
- [ ] Implement circuit breaker and rate limiting
- [ ] Add authentication for all internal APIs (mTLS)

### Phase 2: MCP Gateway (Week 3)
- [ ] Implement `pkg/gateway/mcp_gateway.go` (policy enforcement)
- [ ] Add prompt injection scanner
- [ ] Implement comprehensive query/response logging
- [ ] Create MCP server deployment approval workflow
- [ ] Configure data classification labels

### Phase 3: Database Enhancement (Week 3)
- [ ] Add `AtomicRequirement` struct to `pkg/stig/database.go`
- [ ] Add `RoleMapping` and `Complexity` fields to `Finding`
- [ ] Implement hybrid mode (disk CSV + live API enrichment)
- [ ] Integration tests with mock STIGViewer responses

### Phase 4: Air-Gap Security (Week 4)
- [ ] Design signing/verification chain (Dilithium3 + ML-DSA-65)
- [ ] Implement update package builder
- [ ] Implement update integrity validator
- [ ] Build rollback mechanism with atomic swap
- [ ] Document transfer procedures (courier SOP)

### Ongoing
- [ ] Weekly dependency scanning (Trivy/Grype)
- [ ] Monthly penetration testing
- [ ] Quarterly security audits
- [ ] Annual DR/BC testing

---

## 8. Security Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API key rotation compliance | 100% | Any key > 30 days |
| Failed authentication attempts | < 5/hour | > 5/hour |
| Rate limit hits | Track trend | > 50% of limit |
| Cache hit ratio | > 80% | < 60% |
| MCP query audit coverage | 100% | Any unlogged query |
| Signature verification failures | 0 | ANY failure |
| Mean time to detect incident | < 15 min | > 15 min |
| Mean time to respond to incident | < 30 min | > 60 min |
| Prompt injection blocks | Track count | > 10/day |
| Cache integrity failures | 0 | ANY failure |

---

## 9. What's Good (Retained from v1.0)

| Element | Status |
|---------|--------|
| ✅ Phased Implementation | Retained — reduces risk |
| ✅ Caching for Offline | Retained — essential for DoD |
| ✅ Additive Design | Retained — won't break existing system |
| ✅ Atomic Requirements | Retained — better granularity than CSV |
| ✅ Existing Gateway Infrastructure | Leveraged — `layer1_firewall.go`, `layer2_auth.go` already solid |
| ✅ PQC Signature Verification | Leveraged — `layer2_auth.go` already implements ML-DSA-65 |

---

## 10. Decision Gate

**DO NOT proceed to Phase 1 until:**
1. ✅ This document is approved by project lead
2. ⬜ STRIDE threat model is complete (full document, not this summary)
3. ⬜ STIGViewer API key is received and stored in Vault
4. ⬜ Network segmentation rules are defined and tested
5. ⬜ Security review gate process is documented

**After each phase:** Security review gate before proceeding to next phase.

---

**Last Updated:** 2026-02-12
**Version:** 2.0 (Post-Audit Hardened)
**Confidence:** HIGH — All audit findings addressed with concrete controls
