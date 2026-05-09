# Azure GovCloud & VPS CUI Deployment Assessment
## ASAF / SecRed Knowledge Inc. — AdinKhepra Protocol

**Classification:** CUI // SP-CMMC  
**Date:** 2026-05-09  
**Branch:** `claude/govcloud-cui-assessment-TSEnc`  
**Frameworks:** NIST SP 800-171 Rev 3 · CMMC Level 2 · FedRAMP High · DISA IL4

---

## Executive Summary

This assessment evaluates two deployment paths for processing Controlled Unclassified Information (CUI) with the ASAF platform:

| Path | Verdict | Confidence |
|------|---------|-----------|
| **Azure GovCloud** (customer tenant deployment) | **APPROVED — recommended path** | High |
| **Self-hosted VPS** (Hostinger, current) | **CONDITIONAL — significant remediation required** | High |

The critical architectural insight: **CUI never needs to touch the VPS.** ASAF can position the VPS as the compliance engine (scan runner, attestation signer, IP vault) while customer CUI data stays inside the customer's own Azure Government tenant. This is the correct sovereignty-tiered model.

---

## Part I: Azure GovCloud Deployment for CUI Customers

### 1.1 Eligibility & Access

The Microsoft Government Cloud eligibility intake (`usgovintake.embark.microsoft.com`) operates on a validation model with three customer categories:

| Category | Appropriate for ASAF? |
|----------|----------------------|
| US Federal, State, Local, or Tribal government entity | No — ASAF is a vendor, not a government entity |
| **Solution provider serving US federal/state/local/tribal entities** | **Yes — correct selection** |
| Customers handling government-controlled data | Applies to ASAF's end customers, not ASAF itself |

The "Solution provider" path grants access to:
- **Azure Government** (usgovcloud.azure.com) — FedRAMP High, DoD IL2/IL4
- **Azure Government Secret** — requires additional vetting (SECRET workloads only)

For CMMC L2 and CUI (not SECRET), **Azure Government (commercial GovCloud)** is the correct and sufficient tier.

### 1.2 Why Azure Government Is Suitable for CUI

Azure Government satisfies the cloud service provider requirements that CMMC Level 2 and NIST 800-171 impose on the infrastructure layer:

| Requirement | How Azure Gov Satisfies It |
|-------------|---------------------------|
| **Physical security** (NIST 03.10) | US-only data centers, GSA-compliant facilities, visitor escort procedures — inherited |
| **FIPS 140-2 validated crypto** | Azure Key Vault HSM tier is FIPS 140-2 Level 3; Storage AES-256 is FIPS 140-2 Level 1 |
| **Audit logging** (NIST 03.03) | Azure Monitor + Activity Log (immutable, 90-day minimum) |
| **Incident response SLA** | Microsoft MSRC with documented government SLA |
| **Media protection** (NIST 03.08) | Cryptographic erasure + physical destruction for storage media |
| **Supply chain** (NIST 03.17) | FedRAMP supply chain reviews; ISA/IEC 27001; SSPA vendor program |
| **Personnel screening** | PRIVA (personnel security) program for Azure Gov employees; US persons required for gov infrastructure roles |

**FedRAMP Marketplace listing:** Azure Government holds FedRAMP High Authorization (JAB P-ATO), which covers the full set of NIST 800-53 Rev 5 High baseline controls — a superset of NIST 800-171 Rev 3.

**DISA IL authorization:** Azure Government holds DISA IL2 for all services and IL4 for a validated subset (compute, storage, networking core). IL5 is available in Azure Government regions designated for DoD. For CMMC L2 CUI (which maps to IL4 sensitivity), the standard Azure Government region is sufficient.

### 1.3 Recommended Architecture: ASAF-Managed GovCloud Enclave

ASAF should offer customers a **dedicated Azure Government enclave** option. This means SecRed operates an Azure Government subscription on behalf of the customer, or deploys into the customer's existing Azure Government tenant.

```
Customer Azure Government Tenant (FedRAMP High)
├── Virtual Network (10.0.0.0/16)
│   ├── AKS Private Cluster — ASAF Container Suite
│   │   ├── asaf-scanner (khepra-daemon, sonar)
│   │   ├── asaf-api (apiserver, gateway)
│   │   ├── asaf-mcp (khepra-mcp)
│   │   └── asaf-compliance (stig-intelligence)
│   ├── Private Endpoints (Key Vault, Storage, PostgreSQL)
│   └── Azure Firewall + NSGs (boundary protection — NIST 03.13.01)
├── Azure Key Vault HSM (FIPS 140-2 L3) — PQC key material
├── Azure Database for PostgreSQL Flexible Server — CUI at rest (AES-256)
├── Azure Monitor Workspace + Sentinel — immutable audit log
├── Azure Defender for Cloud — continuous STIG/compliance scanning
└── Azure AD Government — MFA, RBAC, Conditional Access

SecRed VPS (Sovereign Tier — No CUI)
├── ASAF IP: adinkhepra binary, KASA engine, PQC key root
├── License authority + telemetry aggregation
└── Supabase cloud (compliance metadata, non-CUI)
```

**Data flow rule:** CUI data is generated, processed, and stored exclusively within the Azure Government boundary. ASAF's VPS receives only anonymized compliance signals and license telemetry — no CUI content.

### 1.4 Services to Provision

| Azure Gov Service | ASAF Use | NIST 800-171 Control |
|------------------|----------|---------------------|
| **AKS** (private cluster, FIPS nodes) | ASAF container runtime | 03.13, 03.04 |
| **Key Vault** (HSM tier) | PQC key storage; replaces YubiHSM for cloud | 03.13.10, 03.13.12 |
| **PostgreSQL Flexible Server** | CUI findings data, compliance state | 03.13.16 |
| **Azure Monitor + Log Analytics** | Immutable audit trail | 03.03.01, 03.03.02 |
| **Microsoft Sentinel** | SIEM/SOAR; incident detection | 03.06.01, 03.06.02 |
| **Defender for Cloud** | Continuous compliance scoring | 03.11, 03.12 |
| **Azure Firewall Premium** | Stateful packet inspection; IDS/IPS | 03.13.01, 03.14.06 |
| **Private DNS + Private Endpoints** | Eliminate public exposure of CUI services | 03.13.01 |
| **Azure AD Government** | MFA, Conditional Access, PIM | 03.05, 03.01 |
| **Azure Policy** | Guardrails (deny non-FIPS SKUs, enforce encryption) | 03.04.01 |
| **Azure Backup (GRS)** | Encrypted backup; CMMC SC.L2-3.13.2 | 03.08, 03.12 |

### 1.5 Intake Process — Next Steps

Based on the `usgovintake.embark.microsoft.com` screenshot:

1. **Select:** "Solution provider serving US federal, state, local or tribal government entities"
2. **Validation services to request:**
   - `Azure Government CSP` — required to resell/provision Azure Gov on behalf of customers
   - `General Validation` — establishes SecRed's eligibility as a gov solution provider
3. **Supporting information required:**
   - Contract/agreement with a government customer (DUNS, SAM.gov registration)
   - Description of the solution (ASAF compliance automation for CMMC L2)
   - Business contact and legal attestation (the form is a legally binding contract)
4. **Timeline:** 3–5 business days for standard validation; up to 10 days for CSP
5. **Post-approval:** Access to Azure Government portal + Azure Gov Marketplace

**SAM.gov prerequisite:** Ensure SecRed Knowledge Inc. has an active SAM.gov registration before submitting. This is the single most common rejection reason for solution provider validation.

### 1.6 SSP Impact: Inherited Controls

Once running on Azure Gov, the ASAF SSP's shared responsibility model shifts significantly. The following NIST 800-171 Rev 3 control families have **substantial Azure Gov inheritance**:

| Control Family | Inheritance Level | Action Required in ASAF SSP |
|---------------|------------------|----------------------------|
| **03.10 Physical Protection** | Full (Azure Gov data center) | Mark as "inherited"; cite Azure FedRAMP package |
| **03.08 Media Protection** | Full (Azure managed disks) | Mark sanitization/disposal as inherited |
| **03.13 System & Comms** | Partial (VNet/firewall is customer-configured) | Document ASAF-managed NSG/Firewall rules |
| **03.03 Audit & Accountability** | Partial (Azure Monitor collects; review cadence is customer) | Document log review procedures |
| **03.05 Identification & Auth** | Partial (Azure AD provides MFA; ASAF RBAC is customer) | Document ASAF role assignments |
| **03.11 Risk Assessment** | Minimal (Defender for Cloud signals; assessment is customer) | Full implementation required |

This inheritance substantially reduces the implementation burden for the `ASAF-GovCloud-SSP/` controls currently marked `planned` — particularly in 03.10, 03.08, and 03.13.

---

## Part II: Self-Hosted VPS (Hostinger) — CUI Assessment

### 2.1 The Threshold Question

Before examining controls, establish what "CUI processing" means for the VPS:

**Scenario A — VPS processes scan metadata only (CUI content never touches VPS)**
- ASAF engine runs scans; results are anonymized compliance signals
- CUI documents, configuration files, and sensitive system data stay on the customer's network
- VPS receives: scan scores, control status, timestamps, compliance percentages
- **Verdict: CUI-adjacent, NOT CUI-processing — lower bar to clear**

**Scenario B — VPS processes actual CUI content (configuration baselines, vulnerability details, system inventories)**
- ASAF receives raw STIG scan output with system identifiers, IP addresses, detailed findings
- VPS stores or transmits CUI-classified artifacts
- **Verdict: CUI-processing — full NIST 800-171 infrastructure compliance required**

The `data_class TEXT DEFAULT 'PUBLIC'` field in `20260227_mcp_agent_tables.sql` indicates the system is designed to handle CUI-marked data. **Assume Scenario B** for this assessment.

### 2.2 What the Codebase Already Provides (Compliant)

The existing ASAF implementation has strong foundations for CUI compliance:

| Control | Mechanism | Files | Status |
|---------|-----------|-------|--------|
| **03.13.16 — CUI at rest** | AES-256-GCM | `pkg/gateway/cache_encryption.go`, `pkg/dag/encryption.go` | Implemented |
| **03.13.08 — CUI in transit** | Kyber-1024 KEM + AES-256-GCM | `pkg/gateway/layer2_auth.go`, `pkg/adinkra/` | Implemented |
| **03.13.10 — Cryptographic key management** | 30-day rotation, HSM backend | `pkg/license/pqc_*.go`, `pkg/crypto/backend_hsm.go` | Implemented |
| **03.01 — Access control / RBAC** | Row-Level Security, multi-layer auth | `supabase/migrations/`, `pkg/gateway/` | Implemented |
| **03.03 — Audit logging** | DAG-based immutable chain | `pkg/dag/dod_logger.go`, `mcp_tool_calls` table | Implemented |
| **03.06 — Incident response** | Scorpion automation, security_incidents table | `pkg/scorpion/`, migrations | Implemented |
| **03.04.01 — STIG baseline** | RHEL-09 STIG V1R3 hardened image | `Dockerfile.ironbank` | Implemented |
| **03.05 — MFA** | Supabase auth + continuous auth hooks | `src/hooks/useEnhancedAuth*` | Partial |
| **03.13 — Network segmentation** | Docker phantom-network, NSG-equivalent | `docker-compose.yml` | Partial |
| **Post-quantum readiness** | Dilithium-3 (ML-DSA-65), Kyber-1024 (ML-KEM-1024) | `pkg/crypto/`, `pkg/adinkra/` | Implemented |

### 2.3 Gap Analysis — What Is Missing

#### Critical Gaps (Blocker for CUI Authorization)

**G-01 — FIPS 140-2/3 Validated Cryptographic Modules**

The current crypto stack uses standard Go `crypto/aes`, `crypto/cipher`, and Cloudflare CIRCL. These are **not FIPS 140-2 validated modules** — they are correct implementations but without the CMVP certificate that NIST 800-171 03.13.10 and 03.13.16 require.

*Required action:* Build and deploy with `GOEXPERIMENT=boringcrypto` (BoringSSL — FIPS 140-2 validated) for all AES/SHA operations, OR use the `Dockerfile.fips` with RHEL's NSS/libgcrypt (which carry validation certificates). The `hsm` backend (YubiHSM 2) for key operations is the strongest path — YubiHSM 2 is FIPS 140-2 Level 3 certified.

Relevant files: `Dockerfile.fips`, `pkg/crypto/interface.go`, `pkg/crypto/fips_*.go`

**G-02 — Physical Security Documentation (NIST 03.10)**

Hostinger is ISO 27001 certified but is **not FedRAMP authorized** and cannot provide the physical security inheritance documentation (FedRAMP Security Package or equivalent) that a CMMC C3PAO assessor requires. 

The 03.10 control family in `ASAF-GovCloud-SSP/SP_800_171_03.10/` must show **implemented**, not `planned`. On a commercial VPS, this requires:
- Hosting provider's physical access log procedures
- Visitor escort documentation for the specific data center
- Hardware security module (FIPS-certified) for key operations
- Documented media sanitization (DoD 5220.22-M or NIST 800-88) procedures with Hostinger

*If Hostinger cannot produce this documentation:* physical security cannot be marked `implemented` and a C3PAO will issue a finding. This is typically the single largest blocker for commercial VPS CUI authorization.

**G-03 — Personnel Security (NIST 03.09)**

Hostinger's employees with physical or root-level access to the VPS hardware do not undergo US government-equivalent background screening. NIST 800-171 03.09.01 requires screening of individuals before authorizing access to CUI systems.

*Required action:* Either (a) use dedicated hardware with contractual prohibition on Hostinger staff access and written acknowledgment of your security requirements, or (b) move CUI processing to a facility where staff screening is documented (FedRAMP-authorized provider).

**G-04 — Supply Chain Risk Management (NIST 03.17)**

CMMC L2 requires documented SCRM for all external providers with access to CUI or CUI systems. Hostinger, Supabase (cloud), Fly.io, Cloudflare, and Supabase must each be assessed.

The `ASAF-GovCloud-SSP/SP_800_171_03.17/` controls are present. Verify current implementation status in those SSP files against actual vendor reviews.

*Required action:* Maintain a vendor inventory with risk tier, access level, compliance attestation (SOC 2 Type II minimum), and contractual CUI handling requirements for each provider.

**G-05 — Independent Security Assessment (NIST 03.12.04)**

For CMMC L2, a C3PAO (Certified Third-Party Assessment Organization) must independently assess the environment. Self-assessment is not accepted for L2. No amount of internal tooling satisfies this requirement — it requires an in-person/remote assessment by a DoD-accredited C3PAO.

*Current status:* ASAF has strong self-assessment tooling but no evidence of a completed C3PAO engagement.

#### Significant Gaps (Must Resolve Before Assessment)

**G-06 — POA&M Items: "Planned" Controls**

Multiple OSCAL control files in `ASAF-GovCloud-SSP/` show `Implementation Status: planned`. Before a C3PAO assessment, all controls must be either `implemented`, `partial` (with POA&M milestones), or formally documented as `not-applicable` with justification.

Audit a sample:
- `SP_800_171_03.13.01` (Boundary Protection) — `planned`
- Others likely similar given the SSP is in active construction

*Required action:* Systematically update each control file to reflect actual implementation state. Use `POAM_SSP_REPORT.md` to track remediation milestones.

**G-07 — MFA Enforcement Completeness (NIST 03.05.03)**

Authentication hooks exist (`useEnhancedAuth`, `useContinuousAuth`) but the `OnboardingOrchestrator` MFA enforcement is noted as a gap in the Sprint 35 backlog. This must be implemented before any CUI user can authenticate.

*Required action:* Enforce MFA as the first blocking step in `OnboardingOrchestrator`. No path to CUI-touching features without MFA completed.

**G-08 — Backup Verification and BCDR Testing (NIST 03.12.03)**

`20260227_storage_backup_catalog.sql` tracks backups but there is no evidence of tested restoration procedures. NIST 800-171 03.12.03 requires testing of recovery capabilities.

*Required action:* Document quarterly backup restoration tests with results logged to the compliance audit trail.

### 2.4 VPS CUI Compliance Scorecard

| Control Family | Controls Total | Implemented | Partial | Planned / Gap | Blocker? |
|---------------|---------------|-------------|---------|--------------|----------|
| 03.01 Access Control | 22 | 18 | 3 | 1 | No |
| 03.03 Audit & Accountability | 9 | 7 | 2 | 0 | No |
| 03.04 Config Management | 12 | 8 | 2 | 2 | No |
| 03.05 Identification & Auth | 12 | 9 | 2 | 1 | No |
| 03.06 Incident Response | 4 | 3 | 1 | 0 | No |
| 03.07 Maintenance | 6 | 2 | 2 | 2 | No |
| **03.08 Media Protection** | **9** | **2** | **1** | **6** | **Yes (G-02)** |
| **03.09 Personnel Security** | **3** | **0** | **1** | **2** | **Yes (G-03)** |
| **03.10 Physical Protection** | **6** | **0** | **1** | **5** | **Yes (G-02)** |
| 03.11 Risk Assessment | 4 | 2 | 1 | 1 | No |
| 03.12 Security Assessment | 5 | 2 | 1 | 2 | Yes (G-05) |
| 03.13 Sys & Comms Protection | 16 | 10 | 4 | 2 | No |
| 03.14 System & Info Integrity | 10 | 7 | 2 | 1 | No |
| 03.15 Planning | 2 | 1 | 1 | 0 | No |
| 03.16 System & Services Acquisition | 3 | 1 | 1 | 1 | No |
| **03.17 Supply Chain** | **3** | **0** | **1** | **2** | **Yes (G-04)** |

*Estimate based on SSP file structure and implementation patterns observed in codebase.*

### 2.5 Remediation Roadmap for VPS CUI Authorization

Ordered by impact and blocking criticality:

**Tier 1 — Blockers (must resolve before C3PAO engagement)**

| # | Action | Owner | Effort | Timeline |
|---|--------|-------|--------|----------|
| B-1 | Rebuild production binaries with FIPS-validated crypto (`GOEXPERIMENT=boringcrypto` or BoringCrypto module). Validate `Dockerfile.fips` produces CMVP-evidenced binary. | Engineering | 1 week | Sprint 36 |
| B-2 | Deploy YubiHSM 2 for all PQC key operations on VPS. The `pkg/crypto/backend_hsm.go` path is already coded — activate it. Document HSM physical chain of custody. | Engineering/Ops | 2 weeks | Sprint 37 |
| B-3 | Contact Hostinger's enterprise/compliance team for physical security attestation. If unavailable at current tier, obtain a dedicated server (not shared VPS) with contractual physical access restrictions and documented data center compliance posture. Escalate to dedicated colocation if Hostinger cannot provide CMMC-acceptable documentation. | Business/Legal | 2-4 weeks | Sprint 37-38 |
| B-4 | Complete personnel security review for all individuals with SSH/root VPS access. Conduct background screening. Document in SSP 03.09. | HR/Legal | 2 weeks | Sprint 37 |
| B-5 | Develop vendor SCRM register (Hostinger, Supabase, Fly.io, Cloudflare, Brave). Obtain SOC 2 Type II attestations for each. Execute CUI handling agreements. | Business | 3 weeks | Sprint 37-38 |
| B-6 | Engage a CMMC C3PAO (see Cyber-AB marketplace: cyberab.org). Begin pre-assessment gap review. This is a process milestone, not a code task. | Business | 4-8 weeks | Sprint 39-40 |

**Tier 2 — Required Before Assessment**

| # | Action | Files | Effort |
|---|--------|-------|--------|
| T2-1 | Enforce MFA in `OnboardingOrchestrator` as blocking step | `src/` auth components | 2-4h |
| T2-2 | Update all `planned` SSP controls to `partial` with documented POA&M milestones | `ASAF-GovCloud-SSP/**/*.md` | 1 week |
| T2-3 | Implement and document backup restoration testing procedure | `supabase/`, `POAM_SSP_REPORT.md` | 2 days |
| T2-4 | Complete network boundary protection config (NIST 03.13.01 — currently `planned`) | Docker Compose NSGs, VPS firewall | 1 day |
| T2-5 | Implement CUI marking/handling procedures for all data_class=CUI records | Application layer; policy doc | 2 days |

---

## Part III: Recommended Architecture — Tiered Sovereignty Model

This architecture satisfies both priorities: protecting ASAF's proprietary IP on the VPS and enabling customers to process CUI in a compliant environment.

```
┌─────────────────────────────────────────────────────────┐
│  TIER 1 — SOVEREIGN VPS (SecRed Hostinger / Dedicated)  │
│  Classification: Proprietary / Non-CUI                   │
│                                                          │
│  • adinkhepra binary + KASA engine          (IP vault)  │
│  • PQC root keys (YubiHSM 2)            (key authority) │
│  • License authority + attestation signer               │
│  • Telemetry aggregation (anonymized signals only)       │
│  • Supabase (compliance metadata — PUBLIC class only)    │
│                                                          │
│  NO CUI DATA TOUCHES THIS TIER                          │
└─────────────────────────────────────────────────────────┘
                          │ API (PQC-signed)
                          ▼
┌─────────────────────────────────────────────────────────┐
│  TIER 2 — AZURE GOVERNMENT ENCLAVE (FedRAMP High)       │
│  Classification: CUI // SP-CMMC                         │
│                                                          │
│  Customer Azure Gov Tenant                              │
│  ├── AKS Private Cluster                               │
│  │   ├── asaf-scanner (STIG scan agent)               │
│  │   ├── asaf-api (RBAC, session mgmt)                │
│  │   └── asaf-mcp (Claude MCP interface)              │
│  ├── Azure Key Vault HSM (FIPS 140-2 L3)              │
│  ├── PostgreSQL (CUI findings, AES-256-GCM)           │
│  ├── Azure Monitor + Sentinel (audit log)             │
│  └── Private Endpoints (no public internet)           │
│                                                          │
│  ALL CUI DATA STAYS IN THIS TIER                        │
└─────────────────────────────────────────────────────────┘
                          │ (no CUI egress)
                          ▼
┌─────────────────────────────────────────────────────────┐
│  TIER 3 — STATIC FRONT-END (Vercel — Zero Secrets)     │
│                                                          │
│  • React/Vite build artifacts (public, non-CUI)        │
│  • No environment secrets (VITE_ASAF_API_URL is public) │
│  • CDN performance for onboarding / demo flows         │
│  • Zero CUI exposure — only the API URL is in Vercel   │
└─────────────────────────────────────────────────────────┘
```

**Why this model works:**
- The VPS never processes CUI → Hostinger's physical security limitations are irrelevant for CUI compliance
- Azure Government FedRAMP High inheritance covers the hardest control families (03.10, 03.08, 03.09)
- ASAF's PQC architecture remains sovereign — Azure Gov Key Vault supplements, not replaces, the YubiHSM-rooted key hierarchy
- Vercel incident vector is eliminated because zero secrets live in Vercel

---

## Part IV: Brave Search API — CUI OPSEC Analysis

Per the integration plan, Brave's `llm/context` endpoint will ground compliance queries with real-time DISA/NVD data. The ZDR (Zero Data Retention) posture is relevant for CUI:

| Consideration | Assessment |
|--------------|------------|
| Do compliance queries contain CUI? | **Risk: YES** — a query like "STIG finding for system X running RHEL 8.6" may embed system-specific CUI |
| Does ZDR Enterprise eliminate the risk? | **Partially** — ZDR means Brave does not store query data, but the query still transits Brave's infrastructure |
| Is Brave FedRAMP authorized? | **No** — Brave Search is not on the FedRAMP marketplace |
| Can Brave be used for CUI-adjacent queries? | **OPSEC policy required** |

**Recommended implementation rule:**

```typescript
// In stig-query-with-timeline/index.ts — BEFORE Brave call
function sanitizeCUIFromQuery(rawQuery: string): string {
  // Strip system identifiers, hostnames, IP addresses, and
  // any data_class=CUI fields before sending to external API
  return rawQuery
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]')
    .replace(/\b[A-Z]{2,}-\d{3,}-[A-Z0-9]+\b/g, '[SYSID]');
}

// Only call Brave with sanitized, non-CUI query terms
const braveContext = await getBraveContext(
  sanitizeCUIFromQuery(`DISA STIG ${controlId} remediation guidance`)
);
```

For the Azure GovCloud tier specifically: restrict Brave API calls to the Tier 1 VPS (non-CUI) or the front-end (public queries only). **Never call Brave from within the Azure Government enclave** where CUI data is co-resident — any external call from that enclave is a potential data egress vector that the C3PAO will scrutinize.

---

## Part V: Action Items Summary

### Sprint 36 (immediate)

1. Submit Azure Government solution provider validation at `usgovintake.embark.microsoft.com` — select "Azure Government CSP" + "General Validation"
2. Integrate Brave `llm/context` into `stig-query-with-timeline` with CUI sanitization guard (Tier 1/VPS only)
3. Enforce MFA blocking step in `OnboardingOrchestrator`
4. Begin auditing `ASAF-GovCloud-SSP/` controls — update `planned` → `partial` with POA&M dates

### Sprint 37

5. Activate `Dockerfile.fips` for production VPS deployment; validate BoringCrypto CMVP evidence
6. Procure and deploy YubiHSM 2; activate `hsm` crypto backend in production
7. Contact Hostinger enterprise for physical security attestation OR begin dedicated hardware procurement
8. Draft vendor SCRM register; initiate SOC 2 review requests for Supabase, Fly.io, Cloudflare

### Sprint 38-39

9. Provision Azure Government development tenant (post-validation approval)
10. Deploy ASAF scanner + API to AKS private cluster in Azure Gov dev environment
11. Configure Azure Key Vault HSM tier; integrate with `pkg/crypto/backend_hsm.go` via Azure Key Vault API
12. Engage CMMC C3PAO via Cyber-AB marketplace for pre-assessment readiness review

### Sprint 40+

13. Complete C3PAO pre-assessment; address all findings as POA&M items
14. Formal CMMC Level 2 C3PAO assessment against production Azure Gov enclave
15. Update `ASAF-GovCloud-SSP/` SSP with assessment results and final implementation status

---

## References

- NIST SP 800-171 Rev 3: `ASAF-GovCloud-SSP/`, `catalogs/NIST_SP-800-171_rev3/catalog.json`
- CMMC L2 Profile: `profiles/ASAF-CMMC-L2/profile.json`
- ODP Register: `ASAF-GovCloud-SSP/odp-register.yaml`
- Azure Government FedRAMP Package: `https://marketplace.fedramp.gov` (search "Microsoft Azure Government")
- CMMC C3PAO Directory: `https://cyberab.org/Catalog`
- Iron Bank Hardened Container: `Dockerfile.ironbank`, `hardening_manifest.yaml`
- VPS Crypto Stack: `pkg/crypto/interface.go`, `pkg/gateway/cache_encryption.go`
- Existing GovCloud compliance program: `docs/govcloud/GOVCLOUD_COMPLIANCE_PROGRAM.md`
- Existing GovCloud deployment reference: `docs/govcloud/SECRED_GOVCLOUD_DEPLOYMENT_REFERENCE.md`
