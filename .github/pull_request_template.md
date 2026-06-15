## Khepra Protocol — Security Review Checklist

> OWASP SDLC Culture Phase | Mandatory for all PRs to `main`.
> Section A is always required. Complete sections B–F based on what changed.

---

### A. All PRs — Required

- [ ] `go build ./...` passes locally — no compilation errors
- [ ] `go vet ./...` passes — no static analysis warnings
- [ ] No hardcoded credentials, tokens, keys, or secrets in any file (TruffleHog blocks)
- [ ] Log statements use `%q` format for any user-controlled strings — never `%s` or `%v`
- [ ] Error messages returned to callers don't expose internal file paths, stack traces, or system details
- [ ] New files do not contain PII, internal network topology, or classified data

---

### B. Go API / HTTP Handlers

*Applies to: `cmd/webhook/`, `pkg/mcp/router.go`, `pkg/api/`, `pkg/gateway/`*

- [ ] `middleware.SecureHeaders()` is applied at the HTTP server entry point
- [ ] All `POST`/`PUT`/`DELETE` endpoints require authentication (JWT or mTLS — no unauthenticated writes)
- [ ] User-supplied URL parameters validated for type, length, and allowed value set
- [ ] File paths from user input go through `filepath.Clean()` + `strings.HasPrefix(cleaned, allowedBaseDir)` confinement
- [ ] JSON request bodies decoded with `io.LimitReader` to cap size
- [ ] Rate limiting applied (MCP CIDR gate, DEMARC layer)
- [ ] OWASP API Top 10 — check the risks relevant to your handler:
  - [ ] API1 BOLA: resource IDs validated against authenticated identity
  - [ ] API4 Resource: size limits + rate limits in place
  - [ ] API5 Function Auth: admin-level actions require elevated role check

---

### C. PQC Cryptographic Code

*Applies to: `pkg/adinkra/`, `pkg/license/`, `pkg/pqc/`, any crypto primitives*

- [ ] `crypto/rand` used for all randomness — never `math/rand`
- [ ] No MD5, SHA-1, RC4, DES, or 3DES for security purposes
- [ ] PQC algorithm used is NIST-standardized: ML-KEM (Kyber) = FIPS 203, ML-DSA (Dilithium) = FIPS 204
- [ ] Private keys never logged, serialized to disk unencrypted, or embedded in binary
- [ ] Key derivation uses HKDF or PBKDF2 — never raw hash

---

### D. File System / Archive Operations

*Applies to: any `os.Open`, `os.Create`, `filepath.Join`, zip/tar extraction*

- [ ] All file paths from external input use `filepath.Clean()` + base directory confinement
- [ ] Zip/tar extraction checked for path traversal ("Zip Slip"): reject entries where `filepath.Join(dest, entry) `doesn't start with `dest`
- [ ] Temp files use `os.CreateTemp()` — never predictable `/tmp/fixed-name` paths
- [ ] Files created with `0600` or stricter permissions — never `0777`

---

### E. MCP Tool Implementation

*Applies to: `pkg/mcp/tools/`, `server.json` tool definitions*

- [ ] Tool is added to `server.json` with correct schema (input validation enforced at spec level)
- [ ] Tool classification set correctly: `read-only`, `sandboxed`, or `destructive`
- [ ] Destructive tools implement `ConfirmationGate` pattern
- [ ] Tool output does not reflect raw user input into response (prevents prompt injection)
- [ ] Tool respects MCP transport security — relies on `MCPTransportGuard` for audit

---

### F. Dependency / go.mod Changes

- [ ] `go mod verify` passes (checksums match `go.sum`)
- [ ] New dependency does not introduce a transitive Go vulnerability (check govulncheck output in CI)
- [ ] New dependency license is compatible with proprietary license (GPL-licensed packages prohibited)
- [ ] New dependency is actively maintained (checked for last release and CVE history)
- [ ] `vendor/` updated if applicable (`go mod vendor`)

---

### Reviewer Sign-Off (before approving)

- [ ] CodeQL / Trivy / TruffleHog CI gates are green
- [ ] No new unauthenticated endpoints without explicit documented justification
- [ ] Crypto changes reviewed by a second engineer with PQC knowledge
- [ ] If SECURITY.md / CMMC controls were affected — compliance team notified

---

**References**
- [OWASP Proactive Controls](https://owasp.org/www-project-proactive-controls/)
- [OWASP API Security Top 10](https://owasp.org/API-Security/)
- [OWASP Go Secure Coding Practices](https://github.com/OWASP/Go-SCP)
- [OWASP Cheat Sheet: Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [NIST FIPS 203 — ML-KEM](https://csrc.nist.gov/pubs/fips/203/final)
- [NIST FIPS 204 — ML-DSA](https://csrc.nist.gov/pubs/fips/204/final)
- [ASVS Level 2 Requirements](https://owasp.org/www-project-application-security-verification-standard/)
