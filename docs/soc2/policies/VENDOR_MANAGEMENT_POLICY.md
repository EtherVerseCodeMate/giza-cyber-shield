# Vendor Management Policy

**Organisation**: NouchiX SecRed Knowledge Inc.  
**Document ID**: VMP-001  
**Version**: 1.0  
**Effective Date**: 2026-06-01  
**Review Cycle**: Annual  
**Owner**: CISO / Legal  
**SOC 2 Criteria**: CC9.2

---

## 1. Purpose

This policy establishes requirements for assessing, onboarding, monitoring, and offboarding vendors and third-party service providers that access, process, store, or transmit NouchiX or customer data.

---

## 2. Scope

All third-party vendors, cloud service providers, contractors, and partners with access to in-scope systems or data.

---

## 3. Vendor Risk Classification

| Tier | Definition | Assessment Frequency |
|------|-----------|---------------------|
| **Tier 1 — Critical** | Processes customer PII or CUI; direct system access | Annual + upon significant change |
| **Tier 2 — High** | Access to internal systems; no direct customer data | Annual |
| **Tier 3 — Low** | No access to systems or data (e.g., office supplies) | Biennial |

---

## 4. Vendor Onboarding Requirements

Before onboarding a Tier 1 or Tier 2 vendor:

1. Complete a Vendor Security Questionnaire (VSQ).
2. Review vendor's SOC 2 Type 2 report, ISO 27001 certificate, or equivalent.
3. Execute a Data Processing Agreement (DPA) / Business Associate Agreement (BAA) where applicable.
4. Obtain legal review of the contract's security and data protection clauses.
5. Document approval by the CISO.

---

## 5. In-Scope Vendors (Current)

| Vendor | Tier | Data Handled | Agreement | SOC 2 Report |
|--------|------|-------------|-----------|-------------|
| Cloudflare | 1 | Network traffic, DNS | DPA | Yes (Type 2) |
| Supabase | 1 | Customer data, auth tokens | DPA | Yes (Type 2) |
| GitHub | 2 | Source code, secrets | Terms + DPA | Yes (Type 2) |
| Vercel | 2 | Application deployments | DPA | Yes (Type 2) |
| Fly.io | 2 | Container workloads | DPA | In progress |
| Tailscale | 2 | Network access logs | DPA | Yes (Type 2) |

---

## 6. Ongoing Monitoring

- Tier 1 vendors must provide updated SOC 2 reports annually.
- Security incidents involving vendors must be reported to the ISSO within **24 hours**.
- Vendor access is reviewed as part of the quarterly access review process.

---

## 7. Vendor Offboarding

Upon termination of a vendor relationship:
1. Revoke all access credentials within **24 hours**.
2. Confirm data deletion or return per contractual terms.
3. Obtain written confirmation of data destruction.
4. Archive contract and security documentation for **5 years**.

---

**Approved by**: _____________________________ Date: ______________
