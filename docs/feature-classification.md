# Feature Classification: Core / Advanced / Labs

This document makes the implicit tier structure of the codebase explicit.
The Egyptian tier names (Khepri, Ra, Atum, Osiris) govern runtime authorization.
This classification governs **development priority, documentation depth, and
support commitments**.

---

## Tiers Defined

| Classification | Definition |
|---|---|
| **Core** | Production-ready, fully tested, supported at all tiers. The product's identity — if this breaks, everything breaks. |
| **Advanced** | Fully functional but requires configuration or elevated tier. Tested, supported at Hunter+. |
| **Labs** | Working prototype or early feature. No SLA. May change without notice. Ra+ only. |
| **Experimental** | Proof of concept or placeholder. No guarantees. Not customer-facing. |

---

## Core Features

These ship at every tier and are the basis of the ADINKHEPRA brand promise.

| Feature | Package(s) | Entry point |
|---|---|---|
| Vulnerability scan | `pkg/sonar`, `cmd/sonar` | `sonar` binary |
| STIG compliance scan | `pkg/stig`, `pkg/stigs`, `cmd/stig-test` | `adinkhepra stig` |
| NIST 800-53 / CMMC mapping | `pkg/compliance` | `adinkhepra compliance` |
| ADINKHEPRA attestation badge | `pkg/attest` | `adinkhepra attest` |
| PQC key generation (community) | `pkg/adinkra` | `adinkhepra keygen` |
| Hybrid encryption (Kyber + AES) | `pkg/adinkra` | `adinkhepra kuntinkantan` / `sankofa` |
| DAG audit trail | `pkg/dag` | Internal — all commands |
| License validation | `pkg/license` | Internal — all commands |
| CLI interface | `cmd/adinkhepra` | `adinkhepra` |
| SBOM generation | `pkg/sbom` | `adinkhepra sbom` |
| File Integrity Monitoring | `pkg/fim` | `adinkhepra fim` |

---

## Advanced Features

Fully functional, require Hunter tier or above. Documented and supported.

| Feature | Package(s) | Entry point | Min tier |
|---|---|---|---|
| OSINT / asset enumeration (SpiderFoot) | `pkg/scanner/crawler.go` | `adinkhepra arsenal crawler` | Hunter (Ra) |
| Threat intelligence enrichment | `pkg/intel` | `adinkhepra intel` | Hunter (Ra) |
| Risk scoring and causal analysis | `pkg/risk` | Internal | Hunter (Ra) |
| Incident response orchestration | `pkg/ir` | Internal | Hunter (Ra) |
| Vulnerability database tracking | `pkg/vuln` | Internal | Hunter (Ra) |
| Fingerprinting & enumeration | `pkg/fingerprint`, `pkg/enumerate` | Internal | Hunter (Ra) |
| Remote execution (WinRM / SSH) | `pkg/remote` | Internal | Hunter (Ra) |
| Packet analysis (Wireshark JSON) | `pkg/packet` | Internal | Hunter (Ra) |
| PQC Auth Gateway (ML-DSA-65 tokens) | `pkg/auth` | Internal — API server | Hive (Atum) |
| SSO / SAML / WorkOS | `pkg/auth` | `/auth/callback` route | Hive (Atum) |
| RBAC | `pkg/rbac` | Internal — all API routes | Hive (Atum) |
| Multi-tenant client portal | `src/pages/ClientPortal.tsx` | `/clients/:org_id` | Hive (Atum) |
| SCADA / ICS security | `pkg/adinkra/scada_ics.go` | Internal | Pharaoh (Osiris) |
| Air-gapped offline license | `pkg/license` | Internal | Pharaoh (Osiris) |
| IronBank / FIPS deployment | `Dockerfile.ironbank`, `Dockerfile.fips` | Build artifact | Pharaoh (Osiris) |

---

## Labs Features

Working but evolving. No backwards compatibility guarantee. Not in SLA.

| Feature | Package(s) | Status note |
|---|---|---|
| ML anomaly detection (SouHimBou) | `services/ml_anomaly/` | FastAPI + PyTorch. Windows path dependency removed (Mar 2026). Needs mTLS hardening before production. |
| KASA / SouHimBou AGI bridge | `pkg/agi`, `cmd/agent` | Two-AI orchestration (Go KASA + Python SouHimBou). Works but threat model incomplete. |
| MCP integration | `cmd/khepra-mcp`, `pkg/mcp` | Model Context Protocol server. Early. |
| Phantom network node | `cmd/phantom-node`, `pkg/phantom` | Decentralized deployment node. Architecture solid; operational docs missing. |
| Lorentz force-field analysis | `pkg/lorentz` | Network topology analysis. Research-grade. |
| DRBC / Scorpion encryption | `pkg/drbc`, `pkg/scorpion` | Deterministic randomness-based container. Non-standard; needs external review. |
| Adversarial defense | `services/ml_anomaly/adversarial_defense.py` | Anti-adversarial ML. Research-grade. |
| NLP query interface (`/chat`) | `services/ml_anomaly/api.py` | Natural language scan queries. Depends on Ollama. |

---

## Experimental / Placeholder

These exist in the codebase but have no functional implementation or are
explicitly not customer-facing.

| Feature | Package(s) | Status |
|---|---|---|
| tnok TOTP port gating | `pkg/tnok/` | **Empty directory.** See decision below. |
| Ouroboros self-healing loop | `pkg/ouroboros` | Partially scaffolded. |
| NHI (Network Health Indicator) | `pkg/nhi` | Scaffolded. |
| ZScan zero-trust scanning | `pkg/zscan` | Scaffolded. |

### Decision required: tnok

`pkg/tnok/` is an empty placeholder. The concept — TOTP port gating that makes
services invisible to network scans until a rolling 6-digit code is presented —
is directly relevant to zero-trust perimeter defense and would fill a gap in the
product.

**Options:**
1. **Implement in Go** — write a `tnokd`-style server and `tnok` client in
   `pkg/tnok/`. No Python dependency chain, no Dependabot surface. The
   `pkg/adinkra` crypto primitives already provide the TOTP and packet
   manipulation building blocks.
2. **Adopt ainfosec/tnok as a tool** — same pattern as SpiderFoot: vendor it
   in `tools/tnok/`, wrap it in `pkg/scanner/` or a new `cmd/khepra-tnok/`.
   Manageable Dependabot surface (scapy, pyotp, cryptography — all
   well-maintained). Run Dependabot auto-merge for patch updates.
3. **Remove the placeholder** — delete `pkg/tnok/` and document the decision.

**Recommendation:** Option 1 (Go implementation). The concept is a strong
zero-trust differentiator; a Go-native version eliminates the Python
dependency surface entirely and integrates cleanly with `pkg/adinkra` PQC.

---

## Classification Change Process

To promote a feature from Labs to Advanced, it must:
- Have a trust boundary entry in `docs/trust-boundary-manifest.md`
- Have ≥1 integration test
- Have been reviewed for the OWASP top 10 at its input boundaries
- Have documentation in `docs/`

To promote from Advanced to Core, it must additionally:
- Have ≥80% unit test coverage in its package
- Have been included in an IronBank build without failing the STIG scan
- Have a changelog entry
