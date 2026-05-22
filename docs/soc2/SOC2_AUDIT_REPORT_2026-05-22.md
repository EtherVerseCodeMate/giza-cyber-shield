# SOC 2 Readiness Audit Report
## KHEPRA / AdinKhepra ASAF Engine

| | |
|---|---|
| **Organisation** | NouchiX SecRed Knowledge Inc. |
| **System** | KHEPRA / AdinKhepra Attestation Security Framework (ASAF) Engine |
| **Audit Date** | 2026-05-22 |
| **Prepared By** | KHEPRA `soc2-audit` CLI (pkg/compliance/soc2) |
| **Scope** | Security (CC1–CC9) · Availability (A) · Processing Integrity (PI) · Confidentiality (C) |
| **Framework** | AICPA Trust Service Criteria 2017 (updated 2022) |
| **Report Type** | Readiness / Gap Assessment (pre-Type 1) |
| **Report File** | `docs/soc2/soc2_readiness_report_2026-05-22.json` |

---

## Executive Summary

This audit assessed 43 SOC 2 Trust Service Criteria against the actual source code, configurations, policies, and CI/CD pipeline of the KHEPRA platform. The findings reflect the state of the repository as of 2026-05-22.

| Metric | Value |
|--------|-------|
| **Criteria Assessed** | 43 |
| **Fully Implemented** | 3 (7 %) |
| **Partially Implemented** | 34 (79 %) |
| **Not Implemented** | 6 (14 %) |
| **Readiness Level** | EARLY_STAGE |
| **HIGH-Priority Gaps** | 8 |
| **Estimated Time to Type 1 Ready** | 10–14 weeks |

**Key Finding**: The platform has significant security *engineering* depth — PQC cryptography, FIM, vulnerability management, immutable DAG audit logging, and SBOM generation are production-grade. The primary gap is in *governance and process* controls: MFA enforcement, documented procedures, vendor agreements, and active monitoring alerting. The 79 % partial-implementation rate indicates that closing these gaps is largely a documentation and configuration effort rather than a rebuild.

---

## Strengths — Fully Implemented Controls

These three criteria are **IMPLEMENTED** with strong, auditor-visible evidence:

### CC2.1 — Information Quality for Internal Control ✅
**Evidence:**
- `pkg/logging/dod_logger.go` — DoD-compliant dual-pipeline logging: JSON → EFK stack + immutable DAG writer. Nanosecond timestamps. Field-level PII redaction (RedactNone / RedactSensitive / RedactAll).
- `pkg/audit/schema.go`, `ingest.go` — Comprehensive event schema capturing device fingerprints, network intelligence, SBOM hashes, and compliance findings.
- `pkg/dag/dag.go` — PQC-signed (ML-DSA-65) Directed Acyclic Graph store providing tamper-evident chain of custody.

### CC6.7 — Encryption in Transit / Data Movement ✅
**Evidence:**
- `pkg/gateway/gateway.go` — TLS 1.2 minimum enforced; cipher suites: `TLS_AES_256_GCM_SHA384`, `TLS_CHACHA20_POLY1305_SHA256`; mTLS support.
- `pkg/crypto/interface.go` — ML-KEM-1024 (FIPS 203 / Kyber) key exchange; ML-DSA-65 (FIPS 204 / Dilithium) signatures.
- `Makefile` — `fips-boring-build` target uses Go BoringCrypto (FIPS 140-3 validated).
- `fly.toml` — `force_https = true` on all Fly.io endpoints.
- `cloudflared_config.yml` — All traffic routed through Cloudflare Tunnel.

### CC7.1 — Configuration and Vulnerability Management ✅
**Evidence:**
- `pkg/vuln/hunter.go` — CVE discovery with CVSS scoring, CISA KEV integration, threat-intel enrichment.
- `pkg/sbom/generator.go` — CycloneDX / SPDX SBOM with per-component CVE correlation, exploitability flagging (KEV), and risk scoring.
- `Makefile` — `fetch-cve`, `fetch-cve-quick` targets for daily CISA KEV updates.
- `.github/workflows/pre-commit-security.yml` — Automated secret detection, SQL injection, and command injection scanning on every PR.
- `pkg/stig/`, `pkg/stigs/` — STIG control compliance scanning.
- `pkg/ert/` — Extended Risk Taxonomy analysis.

---

## Partial Implementations — 34 Criteria

These controls have meaningful technical work in place but require additional documentation, process, or configuration to satisfy auditor requirements.

### CC1 — Control Environment

| Criterion | What Exists | What's Missing |
|-----------|------------|----------------|
| **CC1.1** | `SECURITY.md` vulnerability reporting SLA; proprietary IP policy | Code of Conduct document; annual employee sign-off process |
| **CC1.3** | RBAC hierarchy (Admin/Operator/Viewer) in `pkg/rbac/`; maintainer contact in `hardening_manifest.yaml` | Formal org chart; documented authority matrix |
| **CC1.4** | `docs/SECURE_DEVELOPMENT_LIFECYCLE.md` with AS02–AS06 security controls | Competency framework; training completion tracking |
| **CC1.5** | Every compliance action cryptographically signed and logged to DAG | RACI matrix; quarterly manager attestation process |

### CC2 — Communication and Information

| Criterion | What Exists | What's Missing |
|-----------|------------|----------------|
| **CC2.2** | `SECURITY.md`, `docs/SECURE_DEVELOPMENT_LIFECYCLE.md` published | Security awareness training with completion tracking; phishing simulation |
| **CC2.3** | Public vulnerability disclosure channel (`security@souhimbou.ai`) | Customer incident notification templates; communication SLA commitments |

### CC3 — Risk Assessment

| Criterion | What Exists | What's Missing |
|-----------|------------|----------------|
| **CC3.1** | Security objectives in `SECURITY.md` and `COMPLIANCE_LIBRARY_ONE_PAGER.md` | Formally approved objective statements linked to risk appetite |
| **CC3.2** | `pkg/risk/calculator.go` CVSS financial risk scoring; `pkg/ert/` ERT; `pkg/attest/` PQC-signed attestations | Persistent risk register; formal annual risk assessment report; risk acceptance workflow |
| **CC3.4** | `validate-build-artifacts.yml` detects artifact divergence and hardcoded keys | Formal change-impact risk re-assessment trigger criteria |

### CC4 — Monitoring Activities

| Criterion | What Exists | What's Missing |
|-----------|------------|----------------|
| **CC4.1** | `pkg/sonar/` STIG/configuration drift detection; Prometheus 15s metrics; Grafana dashboards; DAG audit trail | Alertmanager rules (currently empty); on-call escalation integration |
| **CC4.2** | GitHub Issues track CI pipeline findings | Formal deficiency register with SLAs and management sign-off |

### CC5 — Control Activities

| Criterion | What Exists | What's Missing |
|-----------|------------|----------------|
| **CC5.1** | Controls deployed across auth, FIM, vuln, change management | Formal control-selection rationale document tied to risk outputs |
| **CC5.2** | TLS 1.2/1.3, AES-256-GCM, PQC, FIPS build; MFA supported via OAuth2/SAML | MFA **enforcement** at API layer for all admin accounts |
| **CC5.3** | `SECURITY.md`, SSDLC docs, new `docs/soc2/policies/` suite | Central policy portal; annual staff acknowledgment tracking; AUP |

### CC6 — Logical and Physical Access Controls

| Criterion | What Exists | What's Missing |
|-----------|------------|----------------|
| **CC6.1** | ML-DSA-65 PQC JWT (`pkg/auth/pqc_auth.go`); OAuth2 PKCE; SAML 2.0 SSO; multi-protocol auth middleware | MFA **required** at API level; CRL active enforcement |
| **CC6.2** | `AuthProvider` with session lifecycle; OAuth2 PKCE state/verifier tracking | Formal access-request/approval workflow before credentials issued |
| **CC6.3** | RBAC engine with role hierarchy; role claims from PQC tokens; license-tier gating | Per-endpoint RBAC middleware; quarterly access review reports |
| **CC6.4** | Hosted on Cloudflare (SOC 2 Type 2) and Fly.io (SOC 2 in progress) | Obtain and document inherited physical access controls from vendor reports |
| **CC6.6** | `pkg/gateway` TLS + firewall; Cloudflare Tunnel; `force_https` | Documented network topology and zero-trust segmentation; exported WAF rules |
| **CC6.8** | `pkg/fim/` SHA-256 FIM with STIG mapping and DAG audit trail; CI injection scanning | EDR / antivirus engine for behavioral malware detection |

### CC7 — System Operations

| Criterion | What Exists | What's Missing |
|-----------|------------|----------------|
| **CC7.2** | `pkg/sonar/` drift detection; Prometheus metrics; dual-pipeline audit logging | Alertmanager alert rules; SIEM correlation for auth failures and privilege escalation |
| **CC7.3** | `pkg/ir/` severity classification (Critical/High/Medium/Low); status lifecycle | Escalation runbooks with response-time SLAs |
| **CC7.4** | `pkg/ir/` IOC tracking, event log chains, DAG logging; automated remediation (`remediation.go`) | Formal IRP document tested via table-top exercise; customer notification automation |
| **CC7.5** | `pkg/drbc/` AES-256-GCM encrypted backup; off-platform R2/S3 sync; restore points | Defined RTO/RPO; automated quarterly restore validation |

### CC8 — Change Management

| Criterion | What Exists | What's Missing |
|-----------|------------|----------------|
| **CC8.1** | `pre-commit-security.yml`; `validate-build-artifacts.yml`; `run-validation-tests.yml`; `CHANGELOG.md` | Branch protection with ≥2 required reviewers; documented emergency change process |

### CC9 — Risk Mitigation

| Criterion | What Exists | What's Missing |
|-----------|------------|----------------|
| **CC9.1** | `pkg/drbc/` backup and restore capability | Formal BCP/DRP document; RTO/RPO; annual tabletop test |
| **CC9.2** | SBOM generation (CycloneDX/SPDX); `hardening_manifest.yaml` image provenance; `go mod vendor` locking | DPAs/BAAs executed with Cloudflare, Supabase, Fly.io, Vercel |

### Availability (A)

| Criterion | What Exists | What's Missing |
|-----------|------------|----------------|
| **A1.1** | Fly.io auto-start; Prometheus capacity metrics | Auto-scaling rules; capacity alarm thresholds; documented review cadence |
| **A1.2** | `pkg/drbc/` AES-256-GCM encrypted incremental backup; persistent volume | Backup scheduling; documented RPO; quarterly restore tests |

### Processing Integrity (PI) and Confidentiality (C)

| Criterion | What Exists | What's Missing |
|-----------|------------|----------------|
| **PI1.1–PI1.3, PI1.5** | DAG-based PQC-signed processing integrity; FIM; API input validation in CI | Comprehensive input validation across all pipeline boundaries; formal policy |
| **C1.1** | Encryption at rest/transit; SECURITY.md asset classification | Formal data classification taxonomy with labels on all assets |

---

## Not Implemented — 6 Criteria

These criteria have **no current implementation** and require work before Type 1:

| Criterion | Title | Remediation | Priority |
|-----------|-------|-------------|----------|
| **CC1.2** | Board Independence and Oversight | Define advisory board or oversight structure; document roles and decision authority | MEDIUM |
| **CC3.3** | Fraud Risk Assessment | Add fraud risk scenarios (insider threat, account takeover, billing fraud) to annual risk assessment | MEDIUM |
| **CC6.5** | Access Discontinuation / Disposal | Implement NIST 800-88 data sanitisation; automate account deprovisioning on termination within 24h | MEDIUM |
| **A1.3** | Availability — Recovery Plan Testing | Schedule and execute annual BCP/DR tabletop; document results | MEDIUM |
| **PI1.4** | Processing Integrity — System Outputs | Implement output validation and delivery confirmation for customer-facing data | LOW |
| **C1.2** | Confidentiality — Disposal | Implement NIST 800-88 data disposal; automate secure deletion on data expiry | LOW |

---

## Prioritised Remediation Roadmap

### Phase 1 — Weeks 1–4 (Unblock HIGH gaps)

| # | Action | Criteria | Owner | Effort |
|---|--------|----------|-------|--------|
| 1 | **Enforce MFA** at API / IdP level for all admin and production accounts | CC6.1, CC5.2 | Engineering | 2 days |
| 2 | **Configure Prometheus Alertmanager** rules for auth failures, privilege escalation, data exfil | CC4.1, CC7.2 | Engineering | 1 day |
| 3 | **Enable branch protection** on `main`: require ≥2 reviewers, block direct pushes | CC8.1 | Engineering Lead | 1 hour |
| 4 | **Document access-request workflow** — who approves, what form, retention | CC6.2 | ISSO | 1 day |
| 5 | **Quarterly access review** process: schedule first review, document template | CC6.3 | ISSO | 2 days |

### Phase 2 — Weeks 5–8 (Close governance gaps)

| # | Action | Criteria | Owner | Effort |
|---|--------|----------|-------|--------|
| 6 | **Conduct formal risk assessment** using `pkg/risk/calculator.go` output; produce report | CC3.2, CC3.3 | ISSO | 3 days |
| 7 | **Execute vendor DPAs/BAAs**: Cloudflare, Supabase, Fly.io, Vercel, Tailscale | CC9.2 | Legal | 2 weeks |
| 8 | **Complete and table-top-test IRP** (`docs/soc2/policies/INCIDENT_RESPONSE_PLAN.md`) | CC7.4, CC7.3 | ISSO | 3 days + 1 day exercise |
| 9 | **Publish Code of Conduct**; collect employee sign-offs | CC1.1, CC5.3 | CISO | 1 day |
| 10 | **Document BCP/DRP** with defined RTO/RPO | CC9.1, A1.3 | CISO | 2 days |

### Phase 3 — Weeks 9–12 (Evidence collection and Type 1 prep)

| # | Action | Criteria | Owner | Effort |
|---|--------|----------|-------|--------|
| 11 | Define RTO/RPO; automate backup scheduling; run restore test | A1.2, CC7.5 | Engineering | 2 days |
| 12 | Obtain SOC 2 Type 2 reports from Cloudflare, Supabase, Fly.io; document inherited controls | CC6.4 | ISSO | 1 week |
| 13 | Implement data classification taxonomy; label all data assets | C1.1 | CISO | 3 days |
| 14 | Implement NIST 800-88 data disposal and account deprovisioning automation | CC6.5, C1.2 | Engineering | 2 days |
| 15 | Configure alerts for deprovisioning SLA violations; run first quarterly access review | CC6.3 | ISSO | 1 day |

### Phase 4 — Week 12+ (Type 1 Audit)

- Engage CPA firm for Type 1 point-in-time audit (~$8k–$15k).
- Provide the JSON report (`docs/soc2/soc2_readiness_report_2026-05-22.json`) as the gap-closure baseline.
- Begin 6-month Type 2 observation window immediately after Type 1 is clean.

---

## Evidence Inventory

The following evidence must be collected and stored in KHEPRA's evidence library before the Type 1 audit date. Use `go run ./cmd/soc2-audit/ -evidence` for the full checklist.

| Criterion | Evidence Required | Current Status |
|-----------|-----------------|---------------|
| CC1.1 | Code of Conduct with employee sign-offs | ❌ Missing |
| CC3.2 | Formal risk assessment report | ❌ Missing |
| CC4.1 | Continuous monitoring logs / alert configuration | ⚠️ Logs exist; alerts not configured |
| CC6.1 | MFA enforcement configuration screenshot | ❌ Not enforced yet |
| CC6.2 | Access provisioning approval records | ❌ Missing |
| CC6.3 | Quarterly access review report | ❌ Missing |
| CC6.6 | Firewall/WAF rules export | ⚠️ Exists; not exported as evidence |
| CC6.7 | TLS configuration export | ✅ `pkg/gateway/gateway.go` |
| CC7.1 | Vulnerability scan reports + patch records | ✅ `pkg/vuln/`, CI pipeline |
| CC7.4 | IRP document + table-top exercise results | ⚠️ IRP drafted; not tested |
| CC8.1 | PR approval records (≥2 reviewers) | ⚠️ CI exists; no branch protection yet |
| CC9.2 | Executed DPAs/BAAs for all vendors | ❌ Missing |
| A1.2 | Backup restoration test results | ❌ Missing |

---

## KHEPRA Continuous Monitoring Integration

The following KHEPRA-native capabilities auto-collect evidence once configured:

```bash
# Start continuous SOC 2 evidence collection (CC4.1, CC7.1, CC7.2)
khepra-daemon --mode soc2-monitor --criteria CC4.1,CC7.1,CC7.2 --output evidence/

# Run gap assessment at any time
go run ./cmd/soc2-audit/ \
  -system "KHEPRA Platform" \
  -implementations docs/soc2/implementations.json \
  -out docs/soc2/soc2_readiness_$(date +%Y%m%d).json

# Seed SOC 2 status from existing NIST 800-53 compliance data
go run ./cmd/soc2-audit/ \
  -nist-status nist_control_status.json \
  -out docs/soc2/soc2_readiness_seeded.json
```

The DAG-based audit trail (`pkg/dag/`) provides tamper-evident chain of custody for CC4.1, CC7.2, and CC8.1 evidence that no third-party tool can match — PQC-signed (ML-DSA-65) immutable nodes survive any single vendor's key compromise.

---

## Appendix A — Full Criterion Status

| ID | Family | Status | Title |
|----|--------|--------|-------|
| CC1.1 | CC | PARTIAL | Commitment to Integrity and Ethical Values |
| CC1.2 | CC | NOT_IMPLEMENTED | Board Independence and Oversight |
| CC1.3 | CC | PARTIAL | Organizational Structure and Authority |
| CC1.4 | CC | PARTIAL | Commitment to Competence |
| CC1.5 | CC | PARTIAL | Accountability for Internal Controls |
| CC2.1 | CC | **IMPLEMENTED** | Information Quality for Internal Control |
| CC2.2 | CC | PARTIAL | Internal Communication of Objectives and Responsibilities |
| CC2.3 | CC | PARTIAL | External Communication of Relevant Information |
| CC3.1 | CC | PARTIAL | Specification of Objectives |
| CC3.2 | CC | PARTIAL | Risk Identification and Analysis |
| CC3.3 | CC | NOT_IMPLEMENTED | Fraud Risk Assessment |
| CC3.4 | CC | PARTIAL | Changes Affecting Internal Control |
| CC4.1 | CC | PARTIAL | Selection and Development of Ongoing Evaluations |
| CC4.2 | CC | PARTIAL | Evaluation and Communication of Deficiencies |
| CC5.1 | CC | PARTIAL | Selection and Development of Control Activities |
| CC5.2 | CC | PARTIAL | Selection of Technology Controls |
| CC5.3 | CC | PARTIAL | Deployment Through Policies and Procedures |
| CC6.1 | CC | PARTIAL | Logical Access Security — Implementation |
| CC6.2 | CC | PARTIAL | Logical Access Security — Prior to Access |
| CC6.3 | CC | PARTIAL | Logical Access Security — Role-Based Access |
| CC6.4 | CC | PARTIAL | Physical Access Restrictions |
| CC6.5 | CC | NOT_IMPLEMENTED | Logical and Physical Access — Discontinuation |
| CC6.6 | CC | PARTIAL | Logical Access Security — External Threats |
| CC6.7 | CC | **IMPLEMENTED** | Logical Access Security — Transmission and Movement |
| CC6.8 | CC | PARTIAL | Logical Access Security — Malicious Software Prevention |
| CC7.1 | CC | **IMPLEMENTED** | Configuration and Vulnerability Management |
| CC7.2 | CC | PARTIAL | Anomaly and Threat Detection |
| CC7.3 | CC | PARTIAL | Incident Evaluation and Escalation |
| CC7.4 | CC | PARTIAL | Incident Response |
| CC7.5 | CC | PARTIAL | Post-Incident Recovery |
| CC8.1 | CC | PARTIAL | Change Management Process |
| CC9.1 | CC | PARTIAL | Risk Mitigation Activities |
| CC9.2 | CC | PARTIAL | Vendor and Business Partner Risk Management |
| A1.1 | A | PARTIAL | Availability — Capacity Management |
| A1.2 | A | PARTIAL | Availability — Environmental Protections |
| A1.3 | A | NOT_IMPLEMENTED | Availability — Recovery Plan Testing |
| PI1.1 | PI | PARTIAL | Processing Integrity — Complete and Accurate Processing |
| PI1.2 | PI | PARTIAL | Processing Integrity — System Inputs |
| PI1.3 | PI | PARTIAL | Processing Integrity — System Processing |
| PI1.4 | PI | NOT_IMPLEMENTED | Processing Integrity — System Outputs |
| PI1.5 | PI | PARTIAL | Processing Integrity — Stored Items |
| C1.1 | C | PARTIAL | Confidentiality — Identification and Maintenance |
| C1.2 | C | NOT_IMPLEMENTED | Confidentiality — Disposal |

---

*This report was generated by the KHEPRA `soc2-audit` CLI tool using `pkg/compliance/soc2`. The machine-readable source is `docs/soc2/soc2_readiness_report_2026-05-22.json`. All findings are based on static analysis of the codebase; dynamic runtime testing is recommended before Type 1 audit.*
