# Data Classification Policy
**Organisation**: NouchiX SecRed Knowledge Inc.  
**Document ID**: DCP-001 | **Version**: 1.0 | **SOC 2**: C1.1, CC6.7, PI1.5  
**Owner**: CISO | **Effective**: 2026-06-01 | **Review**: Annual

---

## Classification Levels

| Level | Label | Definition | Examples |
|-------|-------|-----------|---------|
| **L1 — SECRET** | `[SECRET]` | Irreplaceable cryptographic material; compromise causes catastrophic, unrecoverable harm | PQC private keys (ML-DSA-65, ML-KEM-1024), `master_seed.sealed`, `adinkhepra_master_dilithium`, `khepra_master.pub` signing key material |
| **L2 — CONFIDENTIAL** | `[CONFIDENTIAL]` | Customer PII, credentials, or business-sensitive data; disclosure causes significant harm | Customer email/PII, Supabase auth tokens, API keys, license keys, `cloudflare.key`, `cloudflare.pem`, SMTP credentials |
| **L3 — INTERNAL** | `[INTERNAL]` | Internal operational data; disclosure causes reputational or competitive harm | Audit logs, scan results, compliance reports, source code, internal docs, `leaks.json`, `zscan_result.json` |
| **L4 — PUBLIC** | `[PUBLIC]` | Information approved for public release; no harm if disclosed | `README.md`, public API docs, `SECURITY.md`, open-source package manifests |

---

## Controls by Classification Level

| Control | L1 SECRET | L2 CONFIDENTIAL | L3 INTERNAL | L4 PUBLIC |
|---------|-----------|----------------|-------------|----------|
| Encryption at rest | AES-256-GCM + hardware seal | AES-256-GCM | AES-256-GCM (where stored) | Not required |
| Encryption in transit | mTLS + PQC | TLS 1.2+ | TLS 1.2+ | TLS recommended |
| Access control | CISO + ISSO only; MFA required | Role-based (admin/operator); MFA required | Authenticated employees | Public |
| Logging | Full DAG audit trail | Full DAG audit trail | Standard logging | — |
| Backup | Encrypted, offline copy | Encrypted backup | Encrypted backup | Not required |
| Retention | Indefinite (key material) | 3 years | 1 year hot / 3 years cold | N/A |
| Disposal | Hardware destruction / NIST 800-88 Purge | NIST 800-88 Clear or Purge | NIST 800-88 Clear | Standard delete |

---

## Data Asset Inventory

| Asset | Classification | Location | Owner | Encryption | Last Reviewed |
|-------|--------------|---------|-------|-----------|-------------|
| ML-DSA-65 private key | L1 SECRET | `adinkhepra_master_dilithium` | CISO | AES-256-GCM sealed | 2026-05-22 |
| ML-KEM-1024 private key | L1 SECRET | `adinkhepra_master_kyber` | CISO | AES-256-GCM sealed | 2026-05-22 |
| Master seed | L1 SECRET | `master_seed.sealed` | CISO | HMAC-SHA512 sealed | 2026-05-22 |
| Cloudflare TLS private key | L1 SECRET | `cloudflare.key` | Engineering | File system (restrict perms) | 2026-05-22 |
| Customer auth tokens (Supabase) | L2 CONFIDENTIAL | Supabase DB | Engineering | Supabase AES-256 | 2026-05-22 |
| API / license keys | L2 CONFIDENTIAL | `pkg/license/`, Supabase | Engineering | Hashed (bcrypt/SHA-256) | 2026-05-22 |
| Scan results / audit logs | L3 INTERNAL | DAG store, R2/S3 backup | Engineering | AES-256-GCM | 2026-05-22 |
| SBOM outputs | L3 INTERNAL | `pkg/sbom/`, CI artifacts | Engineering | Standard | 2026-05-22 |
| Public documentation | L4 PUBLIC | GitHub, docs/ | CISO | Not required | 2026-05-22 |

---

## Disposal Procedure

| Classification | Method | Verification |
|--------------|--------|-------------|
| L1 SECRET | Cryptographic erasure (overwrite key) + NIST 800-88 Purge of storage media | CISO written sign-off |
| L2 CONFIDENTIAL | NIST 800-88 Clear (overwrite) for cloud volumes; certified destruction for physical media | ISSO sign-off |
| L3 INTERNAL | Standard secure delete; log retention per schedule | Engineering confirmation |
| L4 PUBLIC | Standard delete | None required |

Cloud volume disposal: before decommissioning any Fly.io volume or S3/R2 bucket containing L1/L2 data, run `pkg/drbc`'s secure-wipe function and obtain written confirmation from the cloud provider that the underlying storage is zeroed.
