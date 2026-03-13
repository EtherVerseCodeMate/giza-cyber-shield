# Trust Boundary Manifest

This document defines every trust boundary in the ADINKHEPRA system, the
authentication/authorization mechanism at each boundary, and the current
implementation status. Use this as the source of truth for threat modeling
and IronBank security review packages.

---

## System Map

```
 ┌─────────────────────────────────────────────────────────────┐
 │  External World                                              │
 │  (Internet, User Browser, CLI operator, Stripe, Supabase)   │
 └─────────────────┬───────────────────────────────────────────┘
                   │  BOUNDARY 1: Public Internet → API Gateway
                   ▼
 ┌─────────────────────────────────────────────────────────────┐
 │  cmd/apiserver  "The Motherboard"                           │
 │  cmd/gateway    HTTP/gRPC bridge                            │
 └──────┬──────────────────┬────────────────┬─────────────────┘
        │ BOUNDARY 2       │ BOUNDARY 3     │ BOUNDARY 4
        ▼                  ▼                ▼
 ┌────────────┐   ┌───────────────┐  ┌───────────────────┐
 │ cmd/agent  │   │ services/     │  │ pkg/scanner/      │
 │ (KASA AGI) │   │ ml_anomaly    │  │ crawler.go        │
 │            │   │ (SouHimBou)   │  │ (SpiderFoot wrap) │
 └─────┬──────┘   └───────┬───────┘  └─────────┬─────────┘
       │                  │                     │ BOUNDARY 5
       │                  │                     ▼
       │                  │           ┌───────────────────┐
       │                  │           │ tools/spiderfoot  │
       │                  │           │ (subprocess, OSINT│
       │                  │           │  → public APIs)   │
       │                  │           └───────────────────┘
       │ BOUNDARY 6       │ BOUNDARY 7
       ▼                  ▼
 ┌──────────────────────────────────────────────────────────┐
 │  pkg/dag  (immutable audit chain, local disk / Supabase) │
 └──────────────────────────────────────────────────────────┘
       │ BOUNDARY 8
       ▼
 ┌──────────────────────────────────────────────────────────┐
 │  adinkhepra-telemetry-server (Cloudflare Worker)         │
 │  License validation, anonymous telemetry beacons         │
 └──────────────────────────────────────────────────────────┘
```

---

## Boundary Details

### Boundary 1 — Public Internet → API Gateway

**Entry points:** `cmd/apiserver` (REST), `cmd/gateway` (HTTP/gRPC)

**Inbound actors:**
- End users (browser, `adinkhepra` CLI)
- Stripe webhook (license events)
- Supabase Auth (JWT callback)
- WorkOS (SAML callback)

**Authentication mechanism:**
- ML-DSA-65 PQC tokens for CLI operators (`pkg/auth`)
- Supabase JWT for web session users
- SAML/OIDC via WorkOS for SSO tenants
- HMAC-SHA256 for Stripe webhook signature verification

**Authorization mechanism:**
- Egyptian tier + Sephirot scope check on every protected route
- `pkg/rbac` enforces per-tenant role membership

**Current status:** ✅ Implemented
**Gaps:** CORS policy is `*` (open) in `cmd/apiserver/main.go` — should be locked to
known origins before production.

---

### Boundary 2 — Motherboard → KASA Agent (Go AGI)

**Entry points:** `cmd/agent` REST endpoints (`/agi/chat`, `/agi/scan`, `/dag/add`)

**Authentication mechanism:** Internal API key (shared secret via environment variable)

**Current status:** ⚠️ Partial — API key auth is referenced but mTLS is not implemented.
The agent listens on a local port; it is not network-isolated by default.

**Required:** mTLS with a service identity cert issued by the internal KMS
(`pkg/kms`). See `docs/mtls-requirements.md`.

---

### Boundary 3 — Motherboard → SouHimBou ML Service (Python)

**Entry points:** `services/ml_anomaly/api.py` FastAPI endpoints
(`/predict`, `/train`, `/chat`, `/ws/anomalies`)

**Authentication mechanism:** Internal API key only (no mTLS)

**Current status:** ⚠️ Not hardened — HTTP with shared secret. SouHimBou processes
raw scan data and can trigger autonomous response actions. This boundary is
**high-risk** if the ML service is compromised.

**Required:** mTLS, input schema validation on all endpoints, response size limits,
rate limiting on `/train` (retraining is expensive and a DoS vector).

---

### Boundary 4 — Motherboard → Scanner / Crawler

**Entry points:** `pkg/scanner/crawler.go` (subprocess execution)

**Authentication mechanism:** None — subprocess launched by the Go process. The
subprocess inherits the process environment.

**Current status:** ⚠️ No boundary — SpiderFoot runs as a child process with the
same privileges as the parent. Output is written to disk and PQC-signed before
ingestion.

**Required:** Drop privileges before launching SpiderFoot subprocess. Validate and
sanitize `target` input before constructing the command (`exec.Command` is safe
against shell injection but the target value should be validated as a valid
hostname/IP/CIDR before use).

---

### Boundary 5 — SpiderFoot → External APIs / Internet

**Entry points:** SpiderFoot modules making outbound HTTP calls to public APIs

**Authentication mechanism:** API keys per module (stored in SpiderFoot config)

**Current status:** ✅ Module set restricted to approved list (see
`docs/spiderfoot-module-manifest.md`). `SF_EXTRA_MODULES` env var controls opt-in.

**Required for IL6:** Each outbound connection must appear in the connection
authorization table of the IronBank submission. Use the approved module list as
the source of truth.

---

### Boundary 6 — Agent → DAG (Audit Chain)

**Entry points:** `pkg/dag` — append-only node chain, local disk or Supabase backend

**Authentication mechanism:** Every DAG node is PQC-signed (ML-DSA-65) with the
service's private key (`keys/id_dilithium`). Nodes cannot be modified after insertion;
insertion of an unsigned node fails validation.

**Current status:** ✅ Implemented — DAG integrity is enforced cryptographically.

**Gap:** Private key storage is file-based (`keys/id_dilithium`). For IL5+, this
key must live in a hardware HSM or the KMS root ceremony (`pkg/kms`).

---

### Boundary 7 — ML Service → DAG / Supabase

**Entry points:** `services/ml_anomaly/supabase_mcp.py`

**Authentication mechanism:** Supabase service role key (environment variable)

**Current status:** ⚠️ Supabase key is a long-lived secret with elevated privileges.
Should be rotated and scoped to minimum required tables.

---

### Boundary 8 — Internal Services → Telemetry Server (Cloudflare Worker)

**Entry points:** `adinkhepra-telemetry-server` — `/beacon`, `/license/validate`,
`/license/heartbeat`

**Authentication mechanism:**
- Telemetry beacons: ML-DSA-65 signature on payload (anti-spoofing)
- License operations: HMAC-SHA256 machine ID binding
- Admin routes: JWT with short expiry

**Current status:** ✅ Implemented — Cloudflare Worker enforces rate limiting
(100 beacons/device/hour) and signature verification before any DB write.

**Note:** Admin credentials for the telemetry server must be rotated before
production launch. The `/admin/change-password` endpoint is publicly reachable.

---

## Risk Register

| # | Boundary | Risk | Severity | Status |
|---|---|---|---|---|
| R-01 | 1 | CORS `*` allows cross-origin requests from any domain | Medium | Open |
| R-02 | 2 | Agent–Motherboard uses shared secret, no mTLS | High | Open |
| R-03 | 3 | ML service has no mTLS; compromise enables autonomous action | Critical | Open |
| R-04 | 4 | SpiderFoot subprocess inherits parent privileges | Medium | Open |
| R-05 | 4 | `target` input to SpiderFoot not validated before use | Medium | Open |
| R-06 | 6 | DAG signing key is file-based (not HSM-backed) | High | Open |
| R-07 | 7 | Supabase service role key is long-lived and broad-scoped | Medium | Open |
| R-08 | 8 | Telemetry admin endpoint publicly reachable | Low | Open |

---

## Remediation Priority

1. **R-03** (Critical) — Add mTLS to the ML service boundary before any
   production deployment. The ML service can trigger autonomous response actions.
2. **R-02** (High) — Add mTLS to the agent boundary. See `docs/mtls-requirements.md`.
3. **R-06** (High) — Move DAG signing key to KMS root ceremony before IL5+.
4. **R-05** (Medium) — Add target input validation in `pkg/scanner/crawler.go`.
5. **R-01** (Medium) — Lock CORS to known origins in `cmd/apiserver/main.go`.
6. **R-04** (Medium) — Drop subprocess privileges (Linux: `setuid`/capability drop).
7. **R-07** (Medium) — Rotate Supabase key; scope to minimum tables.
8. **R-08** (Low) — Put telemetry admin endpoints behind IP allowlist or VPN.
