# Plan of Action & Milestones (POA&M)
# ASAF / SecRed Knowledge Inc. — AdinKhepra Protocol
# NIST SP 800-171 Rev 3 · CMMC Level 2
# Last Updated: 2026-05-09

---

## Summary Status

| Severity | Count | Notes |
|---|---|---|
| **Critical Blocker** | 5 | Must resolve before C3PAO engagement |
| **Significant** | 4 | Must resolve before assessment |
| **Access Control (Carry-forward)** | 4 | From original 2026-03-09 POAM |

---

## Critical Blockers — Must Resolve Before C3PAO Assessment

| Control ID | Control Name | Weakness Description | Remediation Plan | Responsible Party | Scheduled Completion | Status |
|---|---|---|---|---|---|---|
| 03.13.10 | Cryptographic Key Management | Production binary built without FIPS 140-2 validated crypto modules. `Dockerfile.fips` with `GOEXPERIMENT=boringcrypto` exists but is not the active production build. Standard Go `crypto/aes` lacks CMVP certificate. | Switch VPS production deployment to use `Dockerfile.fips`. Validate BoringCrypto CMVP evidence (Certificate #4407). Document in SSP. | Engineering | 2026-05-30 (Sprint 36) | **OPEN** |
| 03.10.01 | Physical Access Authorizations | Hosting provider (Hostinger) is ISO 27001 but not FedRAMP authorized. Cannot provide physical access log documentation required by CMMC C3PAO assessors. No dedicated hardware with documented access restrictions. | (A) Contact Hostinger enterprise for physical security attestation package. If unavailable, escalate to dedicated server (not shared VPS) with contractual physical access restrictions. For Azure GovCloud path: inherit from Azure Gov FedRAMP package (eliminates this gap). Document in SSP 03.10 as partial with Azure Gov inheritance reference. | Business/Ops | 2026-06-15 (Sprint 37) | **OPEN** |
| 03.09.01 | Personnel Screening | Individuals with SSH/root VPS access have not been formally screened per NIST 800-171 03.09.01. Hostinger data center staff do not undergo US government equivalent background screening. | Conduct background screening for all SecRed personnel with SSH access to VPS. Document screening records. For Hostinger staff access: obtain contractual prohibition and written acknowledgment. For Azure GovCloud path: Azure Government personnel security (PRIVA program) inherited. | HR/Legal | 2026-06-15 (Sprint 37) | **OPEN** |
| 03.17.01 | SCRM Plan | No documented Supply Chain Risk Management plan. Vendors (Hostinger, Supabase, Fly.io, Cloudflare, Brave Search) not formally assessed. No SOC 2 Type II attestations collected. No CUI handling agreements in place. | (1) Create vendor SCRM register. (2) Request SOC 2 Type II reports from Supabase, Cloudflare. (3) Verify Brave Search ZDR Enterprise agreement for zero-data-retention documentation. (4) Execute CUI handling/DPA agreements with each vendor. (5) Document in SSP 03.17. | Business/Legal | 2026-06-30 (Sprint 38) | **OPEN** |
| 03.12.04 | Independent Security Assessment | CMMC Level 2 requires C3PAO (Certified Third-Party Assessment Organization) assessment. Self-assessment tools (KASA, ASAF STIG scanner) satisfy internal monitoring but do not satisfy the C3PAO requirement. No C3PAO engagement initiated. | (1) Register SecRed Knowledge Inc. on SAM.gov (prerequisite). (2) Submit Azure Government solution provider validation at usgovintake.embark.microsoft.com. (3) Identify C3PAO via cyberab.org Cyber-AB marketplace. (4) Begin pre-assessment gap review engagement. | Business | 2026-08-01 (Sprint 40) | **OPEN** |

---

## Significant Gaps — Must Resolve Before Assessment

| Control ID | Control Name | Weakness Description | Remediation Plan | Responsible Party | Scheduled Completion | Status |
|---|---|---|---|---|---|---|
| 03.05.03 | Multi-Factor Authentication | MFA enforcement exists in auth hooks but is not a blocking step in the user onboarding flow. Users can reach CUI-adjacent features without completing MFA enrollment. | Enforce MFA as the first blocking step in onboarding flow before any CUI-touching feature is accessible. Implement TOTP enrollment prompt that cannot be dismissed. | Engineering | 2026-05-23 (Sprint 36) | **OPEN** |
| 03.13.01 | Boundary Protection | Network boundary protection (NIST 03.13.01) is `planned` in SSP. Docker Compose `phantom-network` provides partial segmentation but lacks formal NSG-equivalent documentation and ufw rules are incomplete per Sprint 35 issues. | (1) Document all ingress/egress rules for VPS ufw. (2) Update SSP 03.13.01 to `partial` with implemented controls listed. (3) For Azure GovCloud path: Azure Firewall Premium + NSG rules in Terraform template. | Engineering | 2026-05-30 (Sprint 36) | **OPEN** |
| 03.12.03 | Security Control Testing / BCDR | `20260227_storage_backup_catalog.sql` tracks backups but no documented backup restoration test has been performed. NIST 800-171 03.12.03 requires tested recovery procedures. | (1) Perform Supabase backup restoration test to isolated environment. (2) Document test results (timestamp, data integrity verification, time-to-recovery). (3) Schedule quarterly recurring tests. (4) Log results to compliance audit trail. | Engineering/Ops | 2026-05-30 (Sprint 36) | **OPEN** |
| 03.08.01–03.08.09 | Media Protection | Hostinger cannot provide documented media sanitization procedures (DoD 5220.22-M / NIST 800-88). No formal media disposal documentation exists. | For VPS: Obtain written media sanitization commitment from Hostinger OR migrate CUI to Azure Gov (which inherits Azure's cryptographic erasure + physical destruction procedures). Document in SSP 03.08 as either inherited (Azure Gov) or partial with Hostinger attestation. | Business/Ops | 2026-06-30 (Sprint 38) | **OPEN** |

---

## Carry-Forward Access Control Items (Original 2026-03-09 POAM)

| Control ID | Weakness | Remediation Plan | Scheduled Completion | Status |
|---|---|---|---|---|
| 03.01.04 | Separation of duties not fully documented | Document role separation in RBAC matrix; verify in `pkg/rbac/` implementation | 2026-06-01 | **OPEN** |
| 03.01.06 | Least privilege enforcement gaps | Audit `pkg/rbac/` role assignments; remove over-privileged roles | 2026-06-01 | **OPEN** |
| 03.01.07 | Privileged function auditing | Verify all privileged function calls are logged to DAG audit chain | 2026-06-01 | **OPEN** |
| 03.01.09 | CUI notification / consent | Add CUI handling notification to onboarding flow | 2026-05-23 | **OPEN** |

---

## Completed Items

| Control ID | Resolved | Resolution Notes |
|---|---|---|
| 03.13.16 (KDF) | 2026-05-09 | Upgraded `qkd_distribution.go` AES key derivation from raw SHA-256 to HKDF-SHA-256 per NIST SP 800-56C Rev 2. `deriveAESKey()` function with domain context `"ADINKHEPRA-QKD-AES256GCM-v1"`. |

---

## Notes for C3PAO Assessors

- Azure GovCloud path (Part I of assessment) eliminates gaps 03.10, 03.09, 03.08 through FedRAMP High inheritance
- Cryptographic signing stack (ML-DSA-65 + Kyber-1024) is NIST FIPS 203/204 standardized — PQC readiness is fully implemented, not planned
- CUI data flow architecture ensures CUI never transits the Hostinger VPS — VPS processes compliance signals only
- KASA security engine and ASAF MCP interface provide continuous compliance monitoring aligned to NIST 03.14 and 03.11
