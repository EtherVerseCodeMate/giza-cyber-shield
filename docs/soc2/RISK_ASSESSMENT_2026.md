# Information Security Risk Assessment 2026
**Organisation**: NouchiX SecRed Knowledge Inc.  
**Document ID**: RA-2026-001 | **SOC 2**: CC3.1, CC3.2, CC3.3, CC3.4  
**Methodology**: NIST SP 800-30 Rev 1  
**Period**: 2026-01-01 to 2026-12-31  
**Prepared by**: ISSO | **Approved by**: CISO  
**Approval Date**: ___________ | **Next Review**: 2027-06-01

---

## 1. Scope

All systems within the KHEPRA / AdinKhepra ASAF Engine SOC 2 boundary:
KHEPRA API, Supabase DB, Cloudflare Workers, Fly.io compute, Dashboard, Telemetry.

---

## 2. Risk Scoring

```
Inherent Risk Score = Likelihood (1–5) × Impact (1–5)        [max 25]
Residual Risk Score = Inherent × (1 − Control Effectiveness) [0.0–1.0]
```

| Score | Level | Treatment |
|-------|-------|----------|
| 1–4 | LOW | Accept with monitoring |
| 5–9 | MEDIUM | Remediate within 90 days |
| 10–16 | HIGH | Remediate within 30 days |
| 17–25 | CRITICAL | Immediate remediation; cannot be accepted |

---

## 3. Risk Register

| ID | Threat | Asset | Likelihood | Impact | Inherent | Controls | Effectiveness | Residual | Level | Owner | Due Date |
|----|--------|-------|-----------|--------|---------|---------|--------------|---------|-------|-------|---------|
| R-001 | Credential theft / account takeover | All systems | 3 | 5 | 15 | MFA enforced (Cloudflare + Supabase), PQC JWT, session expiry | 0.80 | 3 | LOW | Eng Lead | Ongoing |
| R-002 | API key exfiltration | `pkg/license/`, Supabase | 3 | 4 | 12 | License-bound keys, hash storage, rate limiting | 0.70 | 4 | LOW | Engineering | Ongoing |
| R-003 | PQC private key compromise | `adinkhepra_master_dilithium` | 1 | 5 | 5 | Sealed storage, restricted access, offline copy | 0.85 | 1 | LOW | CISO | Ongoing |
| R-004 | Ransomware / data destruction | Fly.io volumes, Supabase | 2 | 5 | 10 | Daily encrypted backup (R2), AES-256-GCM, restore tested | 0.75 | 3 | LOW | Engineering | 2026-09-01 |
| R-005 | Vulnerability exploitation (unpatched CVE) | All services | 3 | 4 | 12 | Weekly scans, CISA KEV integration, 7-day patch SLA | 0.80 | 2 | LOW | Engineering | Ongoing |
| R-006 | Insider threat / privilege abuse | Production systems | 2 | 5 | 10 | RBAC, DAG audit trail, quarterly access reviews | 0.70 | 3 | LOW | ISSO | Ongoing |
| R-007 | Supply chain compromise (dependency) | `go.mod`, `vendor/` | 2 | 4 | 8 | `go mod vendor`, SBOM, validate-build-artifacts CI | 0.75 | 2 | LOW | Engineering | Ongoing |
| R-008 | Data exfiltration (customer data) | Supabase, API | 2 | 5 | 10 | TLS 1.2/PQC, RBAC, DAG logging, outbound anomaly alerts | 0.80 | 2 | LOW | Engineering | Ongoing |
| R-009 | DDoS / availability attack | API, Cloudflare | 3 | 3 | 9 | Cloudflare DDoS protection, rate limiting, multi-region plan | 0.75 | 2 | LOW | Engineering | 2026-09-01 |
| R-010 | Harvest-Now-Decrypt-Later (quantum) | Encrypted data | 2 | 5 | 10 | ML-KEM-1024, ML-DSA-65, FIPS BoringCrypto | 0.90 | 1 | LOW | Engineering | Ongoing |
| R-011 | Vendor failure (Cloudflare/Supabase/Fly.io) | Platform | 1 | 5 | 5 | Multi-vendor design, backup to R2, BCP procedures | 0.70 | 2 | LOW | CISO | Ongoing |
| R-012 | Regulatory non-compliance (SOC 2 gaps) | All | 3 | 3 | 9 | SOC 2 remediation programme (this document) | 0.60 | 4 | LOW | ISSO | 2026-09-01 |

---

## 4. Fraud Risk Assessment (CC3.3)

| Fraud Scenario | Likelihood | Impact | Inherent | Mitigating Controls | Residual |
|---------------|-----------|--------|---------|-------------------|---------|
| Insider data theft | 2 | 4 | 8 | RBAC, DAG audit trail, access reviews, offboarding automation | 2 |
| License key cloning / piracy | 3 | 3 | 9 | License-bound to machine ID, telemetry validation, CRL | 3 |
| Account takeover (external) | 3 | 4 | 12 | MFA enforced, PQC tokens, session TTL, anomaly alerts | 2 |
| Billing / payment fraud | 2 | 3 | 6 | Payment processor handles billing; no direct card storage | 2 |
| Social engineering (phishing) | 3 | 3 | 9 | Security awareness training, MFA enforcement | 3 |

---

## 5. Risk Treatment Decisions

| Risk ID | Treatment | Justification | Sign-off |
|---------|----------|--------------|---------|
| R-001 to R-012 | Mitigate (controls in place) | Residual scores all LOW after controls applied | CISO: ___________ |

---

## 6. Risk Acceptance Register

*No risks accepted at MEDIUM or above at time of this assessment.*

---

## 7. Automated Risk Tooling

Risk scores are also computed dynamically by the KHEPRA platform:

```bash
# Generate risk report from live vulnerability data
go run ./cmd/khepra-pentest/ --risk-report --output docs/soc2/evidence/CC3.2/risk_$(date +%Y%m%d).json

# ERT (Extended Risk Taxonomy) analysis
go run ./cmd/khepra-pentest/ --ert-analysis --output docs/soc2/evidence/CC3.2/ert_$(date +%Y%m%d).json
```

Automated findings must be reviewed by the ISSO and imported into this register within 5 business days.

---

**CISO Approval**: ___________________________ Date: _______________  
**ISSO Review**: ___________________________ Date: _______________
