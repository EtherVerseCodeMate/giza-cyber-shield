# SOC 2 Audit Readiness Guide — Giza Cyber Shield / KHEPRA Platform

**Version**: 1.0  
**Date**: 2026-05-22  
**Owner**: Security & Compliance  
**Framework**: AICPA Trust Service Criteria (TSC) 2017 (updated 2022)

---

## 1. What Is SOC 2 and Why It Matters

SOC 2 (System and Organization Controls 2) is an auditing standard developed by the American Institute of Certified Public Accountants (AICPA). It verifies that a service organisation's controls over **security, availability, processing integrity, confidentiality, and privacy** meet the Trust Service Criteria (TSC).

Unlike ISO 27001, SOC 2 is not a certification — it is a **report** issued by an independent CPA after examining your controls. Two report types exist:

| Type | What It Proves | Observation Window | Best For |
|------|---------------|-------------------|----------|
| **Type 1** | Controls are suitably designed at a point in time | Single date | First audit / quick signal |
| **Type 2** | Controls are operating effectively over time | 6–12 months | Enterprise customers, enterprise deals |

KHEPRA targets **Type 2** with a minimum 6-month observation window, covering the **Security (CC)** and **Availability (A)** criteria categories.

---

## 2. Scope

### 2.1 In-Scope Systems

| System | Description |
|--------|-------------|
| KHEPRA Protocol Engine | Core compliance translation service |
| AdinKhepra ASAF Engine | Attestation and cryptographic signing |
| Sonar Continuous Monitoring Agent | Real-time drift detection |
| API Gateway | Public-facing REST/gRPC endpoints |
| Dashboard (Next.js) | Customer-facing web application |
| Telemetry Service | Anonymised usage analytics |
| Supporting Infrastructure | Cloudflare Workers, Supabase, SQLite |

### 2.2 Trust Service Criteria Selected

- **Required**: CC1–CC9 (Common Criteria / Security)
- **Optional (included)**: A1.1–A1.3 (Availability)
- **Optional (future)**: PI (Processing Integrity), C (Confidentiality)

---

## 3. SOC 2 TSC → Khepra Control Mapping

The table below maps each TSC criterion to existing KHEPRA modules and NIST 800-53 / CMMC controls already implemented.

| TSC | Title | Khepra Module | NIST 800-53 | CMMC |
|-----|-------|--------------|------------|------|
| CC6.1 | Logical Access | `pkg/auth`, `pkg/license` | AC-2, IA-2, IA-5 | AC.L1-3.1.1 |
| CC6.3 | Role-Based Access | `pkg/rbac` | AC-3, AC-6 | AC.L2-3.1.3 |
| CC6.6 | External Threats | `pkg/net`, Cloudflare WAF | SC-7, SI-3 | SC.L1-3.13.1 |
| CC6.7 | Encryption in Transit | `pkg/crypto` (PQC/Kyber) | SC-8, SC-13 | SC.L2-3.13.8 |
| CC6.8 | Malicious Software | `pkg/scanner`, `pkg/fim` | SI-3, SI-7 | SI.L1-3.14.1 |
| CC7.1 | Vuln Management | `pkg/vuln`, `pkg/stig` | RA-5, SI-2 | RA.L2-3.11.2 |
| CC7.2 | Anomaly Detection | `pkg/sonar`, `pkg/audit` | AU-6, SI-4 | AU.L2-3.3.5 |
| CC7.4 | Incident Response | `pkg/ir` | IR-4, IR-8 | IR.L2-3.6.1 |
| CC8.1 | Change Management | CI/CD pipeline, DAG log | CM-3, SA-10 | CM.L2-3.4.3 |
| CC9.2 | Vendor Risk | `docs/legal/` | SA-9, SR-3 | SR.L2-3.17.1 |
| A1.2 | Backup & Recovery | Supabase backups, `pkg/drbc` | CP-6, CP-7 | RE.L2-3.9.1 |

---

## 4. Gap Remediation Roadmap

Use the `soc2-audit` CLI (`cmd/soc2-audit/`) to run the automated gap assessment:

```bash
# Run full readiness report
go run ./cmd/soc2-audit/ -system "KHEPRA Platform" -scope "CC + A criteria"

# Export JSON report
go run ./cmd/soc2-audit/ -out reports/soc2_readiness_$(date +%Y%m%d).json

# Show criterion status table
go run ./cmd/soc2-audit/ -summary

# Show evidence checklist
go run ./cmd/soc2-audit/ -evidence

# Seed from existing NIST 800-53 status
go run ./cmd/soc2-audit/ -nist-status nist_status.json
```

### 4.1 Priority Remediation Items

| Priority | Criterion | Gap | Target Date |
|----------|-----------|-----|------------|
| HIGH | CC6.1 | MFA not enforced for all admin accounts | Week 2 |
| HIGH | CC6.3 | No formal quarterly access review process | Week 4 |
| HIGH | CC7.4 | IRP not table-top tested in last 12 months | Week 6 |
| HIGH | CC8.1 | PRs merged without required approvals in some repos | Week 2 |
| HIGH | CC3.2 | Formal risk assessment not documented this year | Week 8 |
| MEDIUM | CC9.2 | Missing BAA/DPA for 3 vendors | Week 6 |
| MEDIUM | A1.3 | BCP not tested | Week 10 |

---

## 5. Evidence Collection

All audit evidence must be collected and indexed in the KHEPRA evidence library. Use the `pkg/compliance/soc2.EvidenceCollector` API or the CLI:

```go
ec := soc2.NewEvidenceCollector()
ev := ec.Add("CC6.1", soc2.EvidenceConfiguration,
    "MFA Enforcement Screenshot",
    "Screenshot showing MFA enforced in Cloudflare Access",
    "admin@nouchix.com",
    screenshotBytes)
```

### 5.1 Evidence Retention

| Evidence Type | Minimum Retention | Storage |
|--------------|------------------|---------|
| Policy documents | 3 years | Encrypted S3 / R2 |
| Access review reports | 3 years | Encrypted S3 / R2 |
| Audit logs | 1 year (real-time), 3 years (archive) | Immutable DAG + S3 |
| Incident reports | 5 years | Encrypted S3 / R2 |
| Change tickets | 3 years | GitHub / JIRA |

---

## 6. Policy Documents

The following policies must be in place before the Type 1 audit date:

| Policy | File | Status |
|--------|------|--------|
| Information Security Policy | `docs/soc2/policies/INFORMATION_SECURITY_POLICY.md` | Draft |
| Access Control Policy | `docs/soc2/policies/ACCESS_CONTROL_POLICY.md` | Draft |
| Incident Response Plan | `docs/soc2/policies/INCIDENT_RESPONSE_PLAN.md` | Draft |
| Change Management Policy | `docs/soc2/policies/CHANGE_MANAGEMENT_POLICY.md` | Draft |
| Vendor Management Policy | `docs/soc2/policies/VENDOR_MANAGEMENT_POLICY.md` | Draft |
| Risk Assessment Policy | `docs/soc2/policies/RISK_ASSESSMENT_POLICY.md` | Draft |
| Business Continuity Plan | `docs/soc2/policies/BUSINESS_CONTINUITY_PLAN.md` | Draft |

---

## 7. Audit Timeline

| Milestone | Target Date | Owner |
|-----------|------------|-------|
| Gap assessment complete | Week 2 | ISSO |
| HIGH-priority gaps remediated | Week 8 | Engineering |
| All policies drafted and approved | Week 6 | CISO |
| Evidence collection started | Week 4 | Compliance |
| Type 1 audit window | Week 12 | CPA firm |
| Type 2 observation window begins | Week 14 | All |
| Type 2 audit completion | Week 38 (6 mo.) | CPA firm |

---

## 8. Auditor Selection

Obtain quotes from at least 3 CPA firms. Typical costs:

| Report Type | Cost Range | Timeline |
|------------|-----------|----------|
| Type 1 | $5,000–$15,000 | 2–4 weeks |
| Type 2 (6-month) | $15,000–$40,000 | 6–9 months total |

**Free preparation resources**:
- Scytale SOC 2 Masterclass (free)
- StrongDM Comply open-source policy library (free)
- Haekka security awareness training (free tier)
- AICPA TSC whitepaper (free download)

---

## 9. Continuous Compliance with KHEPRA

KHEPRA's Sonar agent provides continuous evidence collection for CC4.1 and CC7.1:

```bash
# Start continuous SOC 2 evidence collection
khepra-daemon --mode soc2-monitor --criteria CC4.1,CC7.1,CC7.2 --output evidence/
```

The DAG-based audit log provides a tamper-evident chain of custody for all compliance events, directly satisfying the evidence requirements for CC4.1, CC7.2, and CC8.1.

---

## 10. Contacts

| Role | Name | Contact |
|------|------|---------|
| Information Security Officer | SGT Souhimbou Kone | skone@alumni.albany.edu |
| Security Reports | Security Team | security@souhimbou.ai |
| Compliance Enquiries | Compliance Team | support@souhimbou.ai |
