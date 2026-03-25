# ASAF — Agentic Security Attestation Framework

[![Patent Pending](https://img.shields.io/badge/PATENT-PENDING-blue?style=for-the-badge)](docs/PATENT_APPLICATION_UPDATED.md)
[![NouchiX / Sacred Knowledge Inc](https://img.shields.io/badge/BY-NouchiX-gold?style=for-the-badge)](https://nouchix.com)
[![ADINKHEPRA Certified](https://img.shields.io/badge/ADINKHEPRA-POST--QUANTUM_CERTIFIED-cyan?style=for-the-badge)](#certification)

**By NouchiX (Sacred Knowledge Inc) — Compliance you can defend in an audit.**

---

## The Problem

Defense contractors and regulated teams are judged on **evidence**, not intentions. CMMC, NIST 800-171, and STIG work fails in the same places: **missing logs**, weak **traceability**, and packages assessors cannot rely on under time pressure.

Agent and AI platforms add new exposed surfaces (gateways, integrations, credentials). That is a **category risk** — but the buyer’s urgent question is still: *“Will this pass scrutiny when someone asks for proof?”*

---

## What ASAF Does (MVP 1.0)

ASAF turns scans and configuration into **assessor-oriented outputs**: exposure signals, control-oriented findings, and **ADINKHEPRA** cryptographic attestation when you certify.

```
asaf scan --target <host>
```

| Output | What it means for buyers |
|--------|---------------------------|
| **Readiness scan** | Real probes (e.g. agent-style ports, HTTPS) plus guidance framed for **C3PAO / ISSM** intake. |
| **Compliance mapping** | STIG / NIST / CMMC-oriented checks where applicable — structured for evidence packages, not slide decks. |
| **ADINKHEPRA certificate** | Tamper-evident attestation (PQC-aligned signing) — **the seal** enterprises display after they pass. |

**Lead with pain removal:** evidence and audit readiness. Agent/AI coverage is included; it is not the only story.

---

## Agent & NemoClaw (secondary)

AI agent gateways (e.g. OpenClaw-class surfaces) and **NVIDIA NemoClaw / OpenShell** are supported as **profiles** when you need them. NemoClaw remains **alpha** per NVIDIA; ASAF’s job is independent **configuration and evidence** proof — not vendor marketing.

---

## Pricing

| Plan | Price | What You Get |
|------|-------|-------------|
| **Free** | $0 | Scan any target. Get exposure report. |
| **Certify** | $99/mo | Full compliance audit + ADINKHEPRA badge. Shareable PDF. |
| **Enterprise** | $499/mo | Continuous monitoring + attestation API + team seats. |

[Start free — no credit card required →](https://app.nouchix.com)

---

## Quick Start

**Install:**
```bash
curl -sSL https://get.nouchix.com/asaf | sh
```

**Scan an AI agent deployment:**
```bash
asaf scan --target 192.168.1.100
asaf scan --target mycompany.internal --port 18789
```

**Get certified:**
```bash
asaf certify --target mycompany.internal --out report.pdf
```

**Run the dashboard:**
```bash
make build && make run-agent
# Dashboard: http://localhost:3000
# API: http://localhost:45444
```

---

## Why It Works

ASAF uses three technical layers under the hood:

- **Scanner** — Detects exposed agent gateways, fingerprints auth modes, maps integrations and blast radius
- **Compliance Engine** — 36,000+ STIG/NIST/CMMC control mappings applied automatically, no manual checklist
- **ADINKHEPRA Attestation** — Post-quantum cryptographic signatures (NIST Dilithium/Kyber) bind findings to a tamper-proof certificate — mathematical proof, not a PDF checklist

The certificate is the **seal** buyers show after evidence checks out. Scanners find issues; ASAF binds posture to a verifiable, PQC-aligned attestation when you certify.

---

## NemoClaw profile (optional)

When your scope includes agent gateways, ASAF can audit **NVIDIA NemoClaw** / OpenShell-style deployments (alpha per vendor docs). Use this as a **profile**, not the default headline.

```bash
# Discover and audit a NemoClaw deployment
asaf scan --target <host> --port 18789

# Certify a NemoClaw deployment with ADINKHEPRA attestation
asaf certify --target <host> --profile nemoclaw --out nemoclaw-cert.pdf
```

ASAF's NemoClaw audit checks all four OpenShell policy domains:

| Check | Domain | What ASAF Verifies |
|-------|--------|-------------------|
| NMC-001 | Inference | `blueprint.yaml` present with inference profiles |
| NMC-002 | Filesystem | OpenShell sandbox policy file exists |
| NMC-003 | Filesystem | Policy restricted to `/sandbox` and `/tmp` only |
| NMC-004 | Network | No wildcard allow-all egress rules |
| NMC-005 | Process | Privilege escalation and syscall hardening configured |
| NMC-006 | Inference | Inference provider configured (nvidia-nim / vllm) |
| NMC-007 | Credentials | NVIDIA API key not stored in plaintext |
| NMC-008 | Filesystem | Config directory not world-readable |
| NMC-009 | Process | Static policy domains not marked hot-reloadable |

**Why this matters:** OpenShell enforces runtime guardrails; ASAF produces **structured evidence** and optional **ADINKHEPRA** attestation so assessors can trace claims to configuration and scan results.

---

## Certification

The **ADINKHEPRA badge** is the standard enterprises earn by passing an ASAF audit.

It is:
- Cryptographically signed (post-quantum, NIST-aligned)
- Timestamped and immutable
- Revocable if posture degrades
- Shareable with auditors, customers, and insurers

Think SOC2 — but automated, continuous, and specific to agentic AI.

---

## Tech Stack

- **Go** — Core engine, CLI, attestation
- **Next.js / React / TypeScript** — Dashboard
- **Cloudflare CIRCL** — Post-quantum cryptography (Dilithium, Kyber)
- **SQLite** — Attestation store
- **Supabase** — Auth and org management

---

## Build

```bash
make build          # Standard build
make secure-build   # Hardened static binaries (recommended)
npm install && npm run dev  # Frontend
```

---

## API

```bash
curl http://localhost:45444/healthz
curl -X POST http://localhost:45444/attest/new
curl http://localhost:45444/dag/state
```

---

## About

Built by **Souhimbou Doh Kone** (skone@alumni.albany.edu)
Company: **NouchiX / Sacred Knowledge Inc**
Patent: Pending

> "The agentic AI era is here. The security layer for it wasn't — until now."
