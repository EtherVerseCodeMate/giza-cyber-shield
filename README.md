# ASAF — Agentic Security Attestation Framework

[![Patent Pending](https://img.shields.io/badge/PATENT-PENDING-blue?style=for-the-badge)](docs/PATENT_APPLICATION_UPDATED.md)
[![NouchiX / Sacred Knowledge Inc](https://img.shields.io/badge/BY-NouchiX-gold?style=for-the-badge)](https://nouchix.com)
[![ADINKHEPRA Certified](https://img.shields.io/badge/ADINKHEPRA-POST--QUANTUM_CERTIFIED-cyan?style=for-the-badge)](#certification)
[![FIPS 140-3](https://img.shields.io/badge/FIPS-140--3_BoringCrypto-green?style=for-the-badge)](#build)
[![CodeQL](https://img.shields.io/badge/CodeQL-PASSING-brightgreen?style=for-the-badge)](#build)

**By NouchiX (Sacred Knowledge Inc) — Compliance you can defend in an audit.**

---

## The Problem

Defense contractors and regulated teams are judged on **evidence**, not intentions. CMMC,
NIST 800-171, and STIG work fails in the same places: **missing logs**, weak **traceability**,
and packages assessors cannot rely on under time pressure.

AI agent platforms add new exposed surfaces (MCP gateways, tool-call pipelines, credentials).
That is a **category risk** — but the buyer's urgent question is still:
*"Will this pass scrutiny when someone asks for proof?"*

---

## What ASAF Does

ASAF converts AI agent activity and infrastructure configuration into **assessor-oriented
outputs**: exposure signals, control-oriented findings, and **ADINKHEPRA** cryptographic
attestation when you certify.

```bash
asaf scan --target <host>
```

| Output | What it means for buyers |
|--------|--------------------------|
| **Readiness scan** | Real probes (agent-style ports, HTTPS, MCP endpoints) plus guidance framed for **C3PAO / ISSM** intake |
| **Compliance mapping** | 36,195 STIG / NIST / CMMC control mappings applied automatically — structured for evidence packages, not slide decks |
| **ADINKHEPRA certificate** | Tamper-evident PQC attestation (ML-DSA-65 / Dilithium) — **the seal** enterprises display after they pass |

---

## Deployment Profiles

ASAF ships in two distinct profiles. Choose the one that matches your compliance posture.

| | **Profile A — SaaS** | **Profile B — Sovereign** |
|-|----------------------|--------------------------|
| **Hosting** | Managed cloud (`adinkhepra.com`) | Your infrastructure (Docker Compose / bare-metal) |
| **Auth** | Supabase (cloud-managed) | On-premise SQLite — no external auth calls |
| **Data egress** | Cloud-hosted dashboard | Zero external calls — fully air-gap capable |
| **Compliance posture** | SMB / developer self-serve | DIB / CMMC / FedRAMP / air-gapped |
| **Sovereign claim** | ❌ Not applicable | ✅ On your metal, no cloud, no token meter |
| **FIPS 140-3 binary** | ❌ Standard build | ✅ `GOEXPERIMENT=boringcrypto` — BoringCrypto |
| **Pricing** | `$0 / $99 / $499 /mo` → [adinkhepra.com](https://app.nouchix.com) | `$25K – $250K / year` flat annual → [contact sales](mailto:skone@alumni.albany.edu) |
| **Target buyer** | Developer / security engineer | Prime contractor, DIB, C3PAO, enterprise |

> **If you are a DIB contractor, prime, or C3PAO evaluator: use Profile B.**
> Profile A does not satisfy CUI handling, DFARS 252.204-7021, or CMMC Level 2 requirements.

---

## Pricing

### Profile A — SaaS (`adinkhepra.com`)

| Plan | Price | What You Get |
|------|-------|--------------|
| **Free** | $0 | Scan any target. Get exposure report. No credit card. |
| **Certify** | $99 / mo | Full compliance audit + ADINKHEPRA badge. Shareable PDF. |
| **Enterprise SaaS** | $499 / mo | Continuous monitoring + attestation API + team seats. |

[Start free — no credit card required →](https://app.nouchix.com)

### Profile B — Sovereign (Enterprise / DIB)

| Tier | Price | Scope |
|------|-------|-------|
| **Pilot** | $25,000 / year | Single environment. On-premise binary. Godfather Report. |
| **Program** | $75,000 / year | Multi-environment. DAG provenance. STIG/CMMC evidence package. |
| **Enterprise** | $150,000–$250,000 / year | Unlimited environments. AWS Marketplace. Custom SLAs. |

[Request a pilot → skone@alumni.albany.edu](mailto:skone@alumni.albany.edu)

> Flat annual license. No per-seat fees. No cloud dependency in the Go binary.
> AWS Marketplace listing available for GovCloud procurement vehicles.

---

## Quick Start

### Profile A — Cloud (fastest path to a demo)

```bash
curl -sSL https://get.nouchix.com/asaf | sh
asaf scan --target <host>
asaf certify --target <host> --out report.pdf
```

### Profile B — Sovereign (on your metal)

```bash
# 1. Pull the signed binary (no source required)
curl -sSL https://get.nouchix.com/asaf-sovereign | sh

# 2. Generate your PQC keys (ML-DSA-65 + Kyber)
./bin/adinkhepra keygen -out ./keys/node -comment "my-environment"

# 3. Run a signed MCP tool call scan
./bin/adinkhepra scan --target <host> --sign --key ./keys/node

# 4. Export CMMC evidence package
./bin/adinkhepra report --godfather --out godfather_report.pdf
```

**Five-minute demo:** PQC-signed `tools/list` call, DAG write, attestation node — no license key
required, no cloud, no telemetry.

---

## Why It Works

ASAF uses three technical layers:

- **Scanner** — Detects exposed agent gateways, fingerprints auth modes, maps MCP tool-call
  surfaces and blast radius
- **Compliance Engine** — 36,195 STIG / NIST / CMMC control mappings applied automatically,
  no manual checklist
- **ADINKHEPRA Attestation** — Post-quantum cryptographic signatures (ML-DSA-65 / Dilithium +
  Kyber) bind findings to a tamper-proof DAG — mathematical proof, not a PDF checklist

The certificate is the **seal** buyers show after evidence checks out. Scanners find issues;
ASAF binds posture to a verifiable, PQC-aligned attestation when you certify.

---

## Tech Stack

| Layer | Profile A (SaaS) | Profile B (Sovereign) |
|-------|------------------|-----------------------|
| **Core engine** | Go (FIPS 140-3 BoringCrypto) | Go (FIPS 140-3 BoringCrypto) |
| **Crypto** | Cloudflare CIRCL — ML-DSA-65, Kyber | Cloudflare CIRCL — ML-DSA-65, Kyber |
| **Attestation store** | SQLite + Supabase | SQLite only — no external DB |
| **Auth** | Supabase (cloud-managed) | On-premise — no Supabase dependency |
| **Dashboard** | Next.js / Vercel | Optional — not required for sovereign binary |
| **License validation** | `nouchix.com` (Cloudflare Worker) | Offline-capable — `KHEPRA_LICENSE_SERVER` env var |

---

## Build

```bash
# Standard build (Profile A / development)
make build

# FIPS 140-3 sovereign build (Profile B)
make secure-build
# Equivalent: GOEXPERIMENT=boringcrypto CGO_ENABLED=1 go build -mod=vendor ./...

# Validate the full suite (unit + integration + resilience + ASAF smoke)
python adinkhepra.py validate

# Validate without live agent (CI environments)
python adinkhepra.py validate --skip-asaf-smoke
```

---

## API

```bash
curl http://localhost:45444/healthz
curl -X POST http://localhost:45444/dag/add -d '{"action":"test","symbol":"Adinkra","parent_ids":[]}'
curl http://localhost:45444/dag/state
```

---

## Certification

The **ADINKHEPRA badge** is the standard enterprises earn by passing an ASAF audit.

It is:
- Cryptographically signed (post-quantum, ML-DSA-65 — NIST FIPS 204 aligned)
- Timestamped and DAG-anchored — tamper-evident provenance chain
- Revocable if posture degrades
- Shareable with auditors, C3PAOs, customers, and cyber insurers

Think SOC 2 — but automated, continuous, and specific to agentic AI and MCP tool-call surfaces.

---

## NemoClaw Profile (optional)

When your scope includes NVIDIA NemoClaw / OpenShell-style agent gateways, ASAF audits all
four OpenShell policy domains:

| Check | Domain | What ASAF Verifies |
|-------|--------|--------------------|
| NMC-001 | Inference | `blueprint.yaml` present with inference profiles |
| NMC-002 | Filesystem | OpenShell sandbox policy file exists |
| NMC-003 | Filesystem | Policy restricted to `/sandbox` and `/tmp` only |
| NMC-004 | Network | No wildcard allow-all egress rules |
| NMC-005 | Process | Privilege escalation and syscall hardening configured |
| NMC-006 | Inference | Inference provider configured (nvidia-nim / vllm) |
| NMC-007 | Credentials | NVIDIA API key not stored in plaintext |
| NMC-008 | Filesystem | Config directory not world-readable |
| NMC-009 | Process | Static policy domains not marked hot-reloadable |

```bash
asaf scan --target <host> --port 18789 --profile nemoclaw
asaf certify --target <host> --profile nemoclaw --out nemoclaw-cert.pdf
```

---

## About

Built by **Souhimbou Doh Kone** (skone@alumni.albany.edu)  
Company: **NouchiX / Sacred Knowledge Inc**  
Patent: Pending

> "The agentic AI era is here. The security layer for it wasn't — until now."
