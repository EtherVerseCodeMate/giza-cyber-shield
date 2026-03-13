# ADINKHEPRA Tier Reference — Enterprise Procurement Edition

> **For engineers and internal docs:** use the Egyptian names (Khepri, Ra, Atum, Osiris) —
> they are load-bearing identifiers in the codebase, license manager, and DAG.
> **For procurement, RFPs, and customer-facing materials:** use the standard enterprise
> terminology in this document.

---

## Tier Comparison Table

| | **Scout** | **Hunter** | **Hive** | **Pharaoh** |
|---|---|---|---|---|
| **Internal name** | Khepri | Ra | Atum | Osiris |
| **Price** | $50 / month | $500 / month | $2,000 / month | Custom / Quote |
| **Licensed nodes** | 1 | 3 | 10 | Unlimited |
| **SLA tier** | Community | Business | Enterprise | Dedicated |
| **Support** | Community forum | Email, 5-day response | Email + Slack, 2-day response | Dedicated CSM, 4-hour response |

---

## Feature Matrix

| Capability | Scout | Hunter | Hive | Pharaoh |
|---|:---:|:---:|:---:|:---:|
| Vulnerability scan (sonar) | ✓ | ✓ | ✓ | ✓ |
| STIG compliance scan | ✓ | ✓ | ✓ | ✓ |
| ADINKHEPRA attestation badge | ✓ | ✓ | ✓ | ✓ |
| PQC key generation (community profile) | ✓ | ✓ | ✓ | ✓ |
| Dashboard (read-only) | ✓ | ✓ | ✓ | ✓ |
| NIST 800-53 / CMMC mapping | — | ✓ | ✓ | ✓ |
| Threat intelligence enrichment | — | ✓ | ✓ | ✓ |
| Threat detection & alerting | — | ✓ | ✓ | ✓ |
| Advanced PQC profile (ML-DSA-65 / Kyber-1024) | — | ✓ | ✓ | ✓ |
| SBOM generation (CycloneDX / SPDX) | — | ✓ | ✓ | ✓ |
| SSO / SAML integration | — | — | ✓ | ✓ |
| RBAC (role-based access control) | — | — | ✓ | ✓ |
| Automated remediation workflows | — | — | ✓ | ✓ |
| Multi-tenant client portal | — | — | ✓ | ✓ |
| Air-gapped / offline deployment | — | — | — | ✓ |
| Offline PQC license (no cloud heartbeat) | — | — | — | ✓ |
| Custom STIG profiles | — | — | — | ✓ |
| Dedicated deployment support | — | — | — | ✓ |
| IL4 / IL5 / IL6 deployment packages | — | — | — | ✓ |
| Source code escrow option | — | — | — | ✓ |

---

## Authorization Scope

The access control system maps tiers to capability scopes. This table translates
internal scopes to enterprise-readable descriptions.

| Internal scope | Enterprise description |
|---|---|
| `basic-scan` | Unauthenticated vulnerability scan, exposure report |
| `community-pqc` | Standard key generation using published NIST PQC profiles |
| `limited-dash` | Read-only dashboard, single asset |
| `advanced-scan` | Full authenticated scan with credentialed access |
| `stig-nist` | STIG/NIST 800-53/CMMC compliance scanning and gap reports |
| `threat-detection` | Real-time threat intelligence correlation and alerting |
| `auto-remediation` | Automated remediation playbook execution |
| `sso` | SAML/OIDC single sign-on via WorkOS |
| `rbac` | Granular role-based access control |
| `offline-license` | Hardware-bound license, no cloud dependency |
| `air-gapped` | Fully isolated deployment with offline update support |

---

## Deployment Targets by Tier

| Tier | Deployment target |
|---|---|
| Scout | Developer workstation, small business, single asset |
| Hunter | SMB, MSSP managed endpoint, small agency |
| Hive | Mid-market enterprise, MSSP multi-tenant, small DoD contractor |
| Pharaoh | Large enterprise, DoD/IC (IL4–IL6), air-gapped SOC |

---

## Notes for Procurement Documents

- **Contract vehicle compatibility:** Pharaoh tier supports FAR/DFARS clauses,
  FedRAMP-adjacent deployment architectures, and CDRLs.
- **FIPS 140-3:** Available at Pharaoh tier via `Dockerfile.fips`.
- **IronBank image:** Available at Pharaoh tier (`Dockerfile.ironbank`, based on
  UBI9-minimal with RHEL-09-STIG-V1R3 hardening).
- **Data residency:** Pharaoh tier supports fully on-premises deployment with no
  outbound telemetry requirements.
- **License portability:** All tiers use PQC-signed machine-bound licenses.
  Pharaoh licenses survive network outages indefinitely.
