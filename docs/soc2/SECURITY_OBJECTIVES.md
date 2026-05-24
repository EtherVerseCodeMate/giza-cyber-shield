# Information Security Objectives
**Organisation**: NouchiX SecRed Knowledge Inc.  
**Document ID**: OBJ-001 | **Version**: 1.0 | **SOC 2**: CC3.1, CC5.1  
**Approved by**: SGT Souhimbou Kone (CISO) | **Effective**: 2026-06-01 | **Review**: Annual

---

## 1. Objectives

| # | Objective | Measurement | Target | SOC 2 |
|---|-----------|------------|-------|-------|
| OBJ-1 | Protect customer data from unauthorised disclosure | Data breach incidents | Zero confirmed breaches | CC6.1–CC6.8 |
| OBJ-2 | Maintain platform availability for customers | Uptime SLA | ≥ 99.5% monthly | A1.1–A1.3 |
| OBJ-3 | Detect and respond to security incidents within SLA | P1 mean time to contain | ≤ 4 hours | CC7.2–CC7.5 |
| OBJ-4 | Ensure all production access requires MFA | MFA enforcement rate | 100% of admin accounts | CC6.1 |
| OBJ-5 | Patch critical vulnerabilities within policy SLA | Patch compliance rate | 100% within 7 days (Critical), 30 days (High) | CC7.1 |
| OBJ-6 | Maintain quantum-resistant cryptography across all services | PQC algorithm coverage | 100% of new key material uses ML-KEM/ML-DSA | CC6.7 |
| OBJ-7 | Provide tamper-evident audit trail for all compliance events | DAG coverage | 100% of control-relevant events signed to DAG | CC2.1, CC4.1 |
| OBJ-8 | Complete annual risk assessment and maintain risk register | Risk register currency | Updated annually; all HIGH risks with remediation plans | CC3.2 |
| OBJ-9 | Achieve and maintain SOC 2 Type 2 report | Type 2 report | Issued by licensed CPA firm; renewed annually | All |

---

## 2. Risk Appetite

NouchiX accepts LOW residual risks without formal approval. MEDIUM and HIGH residual risks require CISO + ISSO written approval and a remediation plan with a defined due date. CRITICAL risks must be remediated immediately and cannot be accepted.

---

## 3. Review

These objectives are reviewed annually alongside the risk assessment and reported to the advisory board. Significant changes to the threat landscape or business model trigger an interim review.
