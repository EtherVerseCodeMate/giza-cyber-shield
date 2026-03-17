# ASAF — Agentic Security Attestation Framework

[![Patent Pending](https://img.shields.io/badge/PATENT-PENDING-blue?style=for-the-badge)](docs/PATENT_APPLICATION_UPDATED.md)
[![NouchiX / Sacred Knowledge Inc](https://img.shields.io/badge/BY-NouchiX-gold?style=for-the-badge)](https://nouchix.com)
[![ADINKHEPRA Certified](https://img.shields.io/badge/ADINKHEPRA-POST--QUANTUM_CERTIFIED-cyan?style=for-the-badge)](#certification)

**By NouchiX (Sacred Knowledge Inc) — We build agents that secure other agents.**

---

## The Problem

AI agent platforms are being deployed at extraordinary speed — and with extraordinary recklessness.

OpenClaw, the fastest-growing AI agent platform in recent memory, had **30,000+ instances exposed to the open internet** within 12 days of launch. Researchers confirmed remote code execution and full credential dumping against exposed deployments. Gartner called it "a dangerous preview of agentic AI — insecure by default."

This is not an OpenClaw problem. It is a **category problem**.

Every AI agent platform — OpenClaw, NVIDIA NemoClaw, custom MCP deployments, internal AI assistants with system access — carries the same structural risk: broad permissions, minimal guardrails, and no cryptographic proof of what it was doing or why.

**NVIDIA NemoClaw** (launched at GTC 2026) adds OpenShell sandboxing and YAML-based policy guardrails to OpenClaw deployments — a meaningful improvement. But NemoClaw is **alpha software**, and NVIDIA's own documentation states it "should not yet be considered production-ready." OpenShell enforces sandboxing; it does not issue proof that a deployment is correctly configured. That is ASAF's role.

Your CISO will ask: *"Is our AI agent deployment safe?"*

Without ASAF, you cannot answer that question with evidence — even if you've deployed NemoClaw.

---

## What ASAF Does

ASAF is the security layer for agentic AI. It scans, audits, and cryptographically certifies AI agent deployments so enterprises can say yes to agentic productivity without saying yes to unacceptable risk.

```
asaf scan --target <host>
```

Three outputs, every time:

| Output | What It Means |
|--------|---------------|
| **Exposure Report** | Is this agent gateway accessible? Auth mode? Integrations? Attack surface. |
| **Compliance Audit** | Does it meet enterprise security baselines? NIST, STIG, configuration hardening. |
| **ADINKHEPRA Certificate** | Cryptographic attestation. A verifiable, tamper-proof proof of security posture. |

The certificate is the product. Enterprises earn it. They display it. They renew it.

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

The certificate is the moat. Any scanner can find a vulnerability. Only ASAF can issue a verifiable, quantum-safe proof that an AI deployment is enterprise-grade.

---

## NVIDIA NemoClaw Support

ASAF natively scans and certifies **NVIDIA NemoClaw** deployments — the OpenShell-powered enterprise stack for OpenClaw AI agents.

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

**Why NemoClaw needs ASAF:** OpenShell enforces runtime guardrails. ASAF issues the cryptographic proof — a quantum-safe ADINKHEPRA certificate — that those guardrails are correctly configured. NemoClaw tells the agent what it can do. ASAF tells your CISO that the agent is safe to deploy.

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
