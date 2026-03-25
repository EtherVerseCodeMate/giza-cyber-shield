# ESI Features - Tweaked Code Implementation Plan
 
**Purpose:** Technical roadmap for implementing ESI-required features, optimized for the AdinKhepra architecture and DoD operational realities (Air-Gap, PQC, OT/ICS).
 
**Status:** Planning Phase (Refined)
**Target Completion:** Q3 2026
 
---
 
## Implementation Priority Matrix (Refined)
 
### P0 - Critical (Mission Essential)
1. **Full NIST 800-171 Implementation (110 controls)**: Complete the gap from 4 to 110.
2. **Sub-Second Vuln Registry (CVE/CISA KEV)**: Replace slow JSON loading with SQLite/Binary cache to fix 120s timeout.
3. **Enterprise Licensing Engine**: Support ESA models with organization-wide license pools.
4. **Air-Gapped Evidence Portability**: Standardized, PQC-signed evidence tarballs for offline audit transfer.
 
### P1 - High (Enterprise Scalability)
5. **Lattice-Secured Tenant Isolation**: Leverage `pkg/kms` triple-layer encryption for DoD component data separation (beyond standard RLS).
6. **RMF Authorization Accelerator**: Automated Step 1-6 with eMASS-ready artifact generation.
7. **ESI Government Portal**: Single Point of Contact (SPOC) dashboard for GSA/ESA management.
 
### P2 - Medium (Strategic differentiator)
8. **Passive OT/ICS Discovery Foundation**: Scaffold Modbus/DNP3 protocol parsers in `pkg/scanner/ot`.
9. **FedRAMP+ / Cloud SRG Module**: IL4/IL5 determination and control validation.
10. **Iron Bank Hardening Manifests**: Hardening scripts for all new ESI packages/containers.
 
---
 
## New Package Structure (Tweaked)
 
```
/pkg/
├── compliance/
│   ├── nist80171/          # NIST 800-171 (P0)
│   │   ├── access_control.go
│   │   ├── ...
│   │   └── portability.go      # NEW: Offline tarball evidence signatures
│   │
│   ├── rmf/                # RMF Automation (P1)
│   │   ├── categorization.go
│   │   └── artifacts/
│   │       └── emass_sync.go   # NEW: eMASS JSON/API bridge
│   │
│   └── gsa/                # GSA Schedule Validator (P0)
│
├── esi/
│   ├── tenant/             # Multi-tenant (P1)
│   │   ├── manager.go
│   │   └── lattice_iso.go      # NEW: kms-based cryptographic isolation
│   │
│   └── licensing/          # ESA Licensing (P0)
│
├── intel/
│   └── registry/           # NEW: Optimized Vulnerability Store (P0)
│       ├── sqlite_store.go     # Replaces 322k JSON files
│       └── kcv_ingest.go       # CISA KEV prioritized loader
│
└── scanner/
    └── ot/                 # NEW: OT/ICS Foundation (P2)
        ├── modbus.go           # Basic function code parser
        └── dnp3.go             # Basic outstation discovery
```
 
---
 
## Key Intelligent Tweaks
 
### 1. Performance: The "Vulnerability Registry" (P0)
Instead of loading 322,369 JSON files into memory (causing your current 120s timeout), we will implement `pkg/intel/registry/sqlite_store.go`.
- **Inference:** A production DoD deployment cannot hang for 2 minutes on startup.
- **Tweak:** Pre-process MITRE/CISA/NVD data into a 200MB binary SQLite file embedded or side-loaded in the container.
 
### 2. Security: "Lattice-Secured Isolation" (P1)
Standard database RLS (Row-Level Security) is often insufficient for high-assurance DoD multi-tenancy.
- **Inference:** The "Lattice Cipher" in `pkg/kms/root.go` is your "unfair advantage".
- **Tweak:** Encrypt per-tenant data with keys derived from a lattice-obfuscated tenant seed. If the "Army" database is breached, the "Navy" data remains cryptographically opaque even if they share the same SQL server.
 
### 3. Readiness: "Evidence Portability" (P0)
Federal auditors often work in disconnected environments.
- **Inference:** A web dashboard isn't enough; you need a "physical" deliverable.
- **Tweak:** Implement `pkg/compliance/nist80171/portability.go` to generate a `khepra_audit_[TENANT]_[DATE].tar.gz.khepra` file which is triple-encrypted and PQC-signed for manual transfer between enclaves.
 
### 4. Market: "OT/ICS Foundation" (P1/P2)
Your pitch deck claims OT-aware validation, but the engine is currently IT-only.
- **Inference:** Technical due diligence will catch this gap.
- **Tweak:** Scaffold `pkg/scanner/ot/modbus.go`. Even if it only detects "Function Code 43" (Read Device ID), it proves the architecture is "OT-Ready" and moves it out of the "Vaporware" risk category.
 
---
 
## Immediate 90-Day Implementation Sprint
 
1. **Month 1: Performance & P0 Foundation**
   - Build `pkg/intel/registry` (SQLite CVE Store).
   - Implement first 30 NIST 800-171 controls in `pkg/compliance/nist80171`.
   - Connect `CMMCDashboard.tsx` to the new Registry API (No mock data!).
 
2. **Month 2: Licensing & Isolation**
   - Implement `pkg/esi/licensing` (ESA Contract Logic).
   - Implement `pkg/esi/tenant/lattice_iso.go` (Cryptographic tenant isolation).
   - Build TCO Calculator Frontend component.
 
3. **Month 3: GSA/RMF Scaffolding**
   - Implement `pkg/compliance/gsa/schedule70_validator.go`.
   - Scaffold `pkg/compliance/rmf` (Step 1-2).
   - Generate initial "Ordering Guide" PDF artifact from code.
 
---
 
**Confidence Justification:** By addressing the CVE timeout and OT/ICS gap first, we build a foundation that passes technical diligence while satisfying the GSA/ESI paperwork requirements.
