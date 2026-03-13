# mTLS Requirements: Internal Service Chain

This document specifies what mutual TLS (mTLS) is, why it is required here,
which service pairs need it, and the implementation path using the KMS and
`pkg/adinkra` crypto already in the codebase.

---

## What mTLS Is (and Why API Keys Are Not Enough)

An API key is like a password written on a sticky note. Anyone who finds the note
can use it. If an attacker compromises the container running the ML service, they
get the API key and can impersonate any service.

mTLS is mutual authentication using certificates. Both sides of every connection
prove who they are with a cryptographic certificate before any data is exchanged.
Even if an attacker gets onto the network, they cannot talk to your services
without a valid certificate — and certificates are issued by your own Certificate
Authority (CA), not the internet.

For ADINKHEPRA, this matters because:
- The ML service (`SouHimBou`) can trigger **autonomous response actions**. A
  spoofed call to `/predict` or `/chat` with crafted input could manipulate
  remediation decisions.
- The KASA agent handles **DAG writes and license enforcement**. A spoofed
  `/dag/add` call could corrupt the audit trail.
- IronBank IL5+ submissions require documented and enforced network segmentation
  between services.

---

## Service Pairs That Require mTLS

| # | Client | Server | Current auth | Required |
|---|---|---|---|---|
| 1 | `cmd/apiserver` (Motherboard) | `cmd/agent` (KASA) | Shared API key | **mTLS** |
| 2 | `cmd/apiserver` (Motherboard) | `services/ml_anomaly` (SouHimBou) | Shared API key | **mTLS** |
| 3 | `cmd/agent` (KASA) | `services/ml_anomaly` (SouHimBou) | Shared API key | **mTLS** |
| 4 | `cmd/apiserver` | `pkg/dag` write path | No auth (in-process) | N/A (in-process) |
| 5 | `cmd/apiserver` | Telemetry server (Cloudflare) | HMAC + ML-DSA-65 | ✅ (TLS 1.3 via CF) |

---

## Certificate Architecture

Use a two-tier PKI rooted in the existing KMS (`pkg/kms`):

```
Root CA (offline, KMS root ceremony key)
    └── Intermediate CA (online, rotated quarterly)
            ├── apiserver.svc.adinkhepra.local
            ├── agent.svc.adinkhepra.local
            └── ml-anomaly.svc.adinkhepra.local
```

The `pkg/adinkra/csr.go` already implements CSR generation. The missing piece is
the CA signing step and the distribution of signed certs to containers at startup.

---

## Implementation Plan

### Step 1 — Generate service identity certificates

Use the root ceremony key (`pkg/kms`) to sign a short-lived certificate for each
service. Certificates should expire in 24 hours and be auto-rotated by a sidecar
or init container.

```bash
# Example using existing adinkhepra CLI (once csr.go is wired up):
adinkhepra keygen --type=service-cert --cn=apiserver.svc.adinkhepra.local \
  --ttl=24h --out=certs/apiserver/
```

### Step 2 — Configure Go services (apiserver, agent)

The `net/http` and gRPC transports both support mTLS natively via `tls.Config`:

```go
tlsConfig := &tls.Config{
    Certificates: []tls.Certificate{loadServiceCert("certs/apiserver/")},
    ClientAuth:   tls.RequireAndVerifyClientCert,
    ClientCAs:    loadInternalCA("certs/ca/"),
    MinVersion:   tls.VersionTLS13,
}
```

Mount the CA bundle and service cert/key as read-only volumes in the container.
Do not bake them into the image.

### Step 3 — Configure Python ML service

FastAPI with uvicorn supports mTLS via `--ssl-certfile`, `--ssl-keyfile`,
`--ssl-ca-certs`:

```bash
uvicorn services.ml_anomaly.api:app \
  --ssl-certfile /certs/ml-anomaly/cert.pem \
  --ssl-keyfile  /certs/ml-anomaly/key.pem \
  --ssl-ca-certs /certs/ca/ca.pem
```

The Python `httpx` client (already used in api.py) supports mTLS via:

```python
client = httpx.AsyncClient(
    cert=("/certs/ml-anomaly/cert.pem", "/certs/ml-anomaly/key.pem"),
    verify="/certs/ca/ca.pem"
)
```

### Step 4 — Docker Compose / Kubernetes

Mount certs as secrets, not environment variables or build-time args:

```yaml
# docker-compose.yml addition
services:
  ml-anomaly:
    volumes:
      - type: bind
        source: ./certs/ml-anomaly
        target: /certs/ml-anomaly
        read_only: true
      - type: bind
        source: ./certs/ca
        target: /certs/ca
        read_only: true
```

For Kubernetes, use cert-manager with a ClusterIssuer backed by the ADINKHEPRA
internal CA. Annotate each Pod with the appropriate certificate request.

---

## Minimum Viable Implementation (MVP Path)

If full PKI rotation is out of scope for the current sprint, implement a
hardened shared-secret scheme as an interim measure:

1. Replace env-var API keys with **per-request HMAC-SHA256 signatures** using
   a 256-bit secret (same pattern as `adinkhepra-telemetry-server/src/hmac-auth.js`).
2. Add request timestamp validation (reject requests older than 30 seconds) to
   prevent replay attacks.
3. Enforce TLS 1.3 on all internal listeners even if client cert validation is
   not yet required.

This buys time without the operational complexity of a full PKI, while closing
the most obvious attack vector (replay + credential theft).

---

## Acceptance Criteria

A service pair can be considered mTLS-complete when:

- [ ] Both sides present and verify certificates on every connection
- [ ] Certificate CN is validated against an allowlist (not just CA trust)
- [ ] TLS 1.3 minimum enforced (no negotiation to 1.2)
- [ ] Certificate expiry triggers service restart (not silent failure)
- [ ] The service-pair entry in `docs/trust-boundary-manifest.md` is updated
      from ⚠️ to ✅
- [ ] Integration test verifies that a connection with an invalid/expired cert
      is rejected with 401/403, not silently dropped
