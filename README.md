# ADINKHEPRA Protocol (ASAF) — Advisory Attestation Engine
[![Patent Pending](https://img.shields.io/badge/PATENT-PENDING-blue?style=for-the-badge)](docs/PATENT_APPLICATION_UPDATED.md) [![Status: PROPRIETARY](https://img.shields.io/badge/STATUS-PROPRIETARY_INTERNAL_TOOL-red?style=for-the-badge)](docs/ENTERPRISE_OFFER_STRATEGY.md)

**Agentic Security Attestation Framework** | *Adinkra-Based Post-Quantum Cryptography*

## From Compliance Theater to Causal Reality

> **Philosophy:** Most security assessments rely on checklists and "best practices"—subjective frameworks that often miss the structural reality of your system. Khepra moves from **opinion to mathematical proof**, using post-quantum cryptography, directed acyclic graphs (DAGs), and threat intelligence fusion to create **verifiable security postures** instead of compliance theater.
# ADINKHEPRA Protocol (ASAF) — Advisory Attestation Engine

[![Patent Pending](https://img.shields.io/badge/PATENT-PENDING-blue?style=for-the-badge)](docs/PATENT_APPLICATION_UPDATED.md) [![Status: PROPRIETARY](https://img.shields.io/badge/STATUS-PROPRIETARY_INTERNAL_TOOL-red?style=for-the-badge)](docs/ENTERPRISE_OFFER_STRATEGY.md)

**Agentic Security Attestation Framework** — Adinkra-based post-quantum attestation and causal risk modeling.

Overview
--------

ADINKHEPRA (Khepra) is a proprietary advisory-grade attestation engine built to move security assessments from checklist-driven "compliance theater" to verifiable, causality-aware proofs. It combines post-quantum cryptography, DAG-based causal graphs, threat-intel fusion, and native compliance automation to produce client-verifiable evidence of security posture and event lineage.

Key capabilities
----------------
- Post-Quantum Cryptography: NIST-aligned schemes (Dilithium/Kyber via Cloudflare CIRCL) for quantum-safe attestations.
- Causal Risk Graphs: Directed acyclic graphs (DAGs) model causes, propagations, and remediation paths instead of isolated findings.
- Threat Intelligence Fusion: Correlates CISA KEV, MITRE ATT&CK, and external scan sources (Shodan/Censys) for context-aware risk scoring.
- Native Compliance Engine: STIG-style enforcement and mapping without external agents.
- Disaster Recovery & Archival (DRBC): Cryptographically-bound recovery and archival workflows.

Project structure & languages
----------------------------
- Backend & tooling: Go (core binaries under `cmd/`, see `go.mod` and `Makefile`).
- Frontend / Dashboard: Next.js / React / TypeScript + Tailwind (see `package.json`).
- Orchestration: Python helper runner `adinkhepra.py` for local validation and convenience commands.
- Docs & demos: Extensive materials under `docs/` and `demo/` for pilots and executive briefings.

Build & run (quick)
-------------------
Build Go binaries:

```bash
make build
```

Secure, static builds (recommended for distribution):

```bash
make secure-build
```

Run the agent locally (default port 45444):

```bash
make run-agent
# or using the Python runner
python adinkhepra.py agent
```

Frontend (development):

```bash
cd web || true
npm i
npm run dev
```

Smoke test / validate full stack (unit tests + CLI PQC + agent API):

```bash
python adinkhepra.py validate
```

API examples
------------
Replace `127.0.0.1` with your server IP as appropriate:

```bash
curl -s http://127.0.0.1:45444/healthz | jq
curl -s -X POST http://127.0.0.1:45444/attest/new | jq
curl -s -X POST http://127.0.0.1:45444/dag/add -d '{"action":"Initialize perimeter","symbol":"Eban"}' | jq
curl -s http://127.0.0.1:45444/dag/state | jq
```

Documentation highlights
-----------------------
- Architecture: `docs/architecture/CAUSAL_REALITY_ANALYSIS.md` and `docs/architecture/IMPLEMENTATION_ROADMAP.md`.
- Executive materials & pilots: `docs/consulting/` (pilot summary, demo scripts, deployment playbook).
- Patent & research: `docs/PATENT_APPLICATION_UPDATED.md` and `docs/internal/` (intel reports).

Security & sensitive artifacts
------------------------------
This repository contains generated keys, snapshots, and sealed artifacts (for example: `khepra_master.pub`, `master_seed.sealed`, `khepra_v0.0_genesis.kpkg`). Treat these as sensitive — do not expose them publicly. Use the secure-build targets and FIPS mode (`make fips-build`) when producing production binaries.

Who is this for
----------------
This codebase is designed for internal advisory teams and pilot customers who require cryptographic, auditable evidence of security posture and remediation causality. It is not currently packaged or licensed for general resale.

Contact & authorship
--------------------
Author: Souhimbou Doh Kone — skone@alumni.albany.edu
Repository: git@github.com:EtherVerseCodeMate/giza-cyber-shield.git

Next steps (suggested)
-----------------------
- Run `make build` and `python adinkhepra.py validate` to verify local environment.
- Inspect `cmd/` entry points: `cmd/adinkhepra`, `cmd/agent`, `cmd/khepra-daemon`, `cmd/sonar` for service responsibilities.
- Review `docs/consulting/` for demo choreography and deployment playbooks.

License & status
----------------
This project is proprietary internal tooling. See `docs/ENTERPRISE_OFFER_STRATEGY.md` for the licensing and deployment model.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
