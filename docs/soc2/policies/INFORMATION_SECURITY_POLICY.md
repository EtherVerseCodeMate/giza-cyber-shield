# Information Security Policy

**Organisation**: NouchiX SecRed Knowledge Inc.  
**Document ID**: ISP-001  
**Version**: 1.0  
**Effective Date**: 2026-06-01  
**Review Cycle**: Annual  
**Owner**: CISO / Information Security Officer  
**SOC 2 Criteria**: CC1.1, CC1.4, CC5.3, CC2.2

---

## 1. Purpose

This policy establishes the principles, responsibilities, and minimum standards governing the protection of information assets at NouchiX SecRed Knowledge Inc. It supports the organisation's SOC 2 compliance programme and aligns with NIST SP 800-53 Rev 5 and ISO/IEC 27001:2022.

---

## 2. Scope

This policy applies to all employees, contractors, vendors, and third parties who access or process information assets owned or managed by NouchiX SecRed Knowledge Inc., including all systems within the KHEPRA platform boundary.

---

## 3. Information Security Principles

1. **Confidentiality** — Information is accessible only to those authorised to access it.
2. **Integrity** — Information and processing methods are accurate and complete.
3. **Availability** — Authorised users have access to information when required.
4. **Least Privilege** — Access rights are limited to the minimum necessary for job functions.
5. **Defence in Depth** — Multiple layered controls are used to protect information assets.

---

## 4. Roles and Responsibilities

| Role | Responsibility |
|------|---------------|
| CISO | Overall information security programme ownership |
| ISSO | Day-to-day compliance management, policy maintenance |
| Engineering Leads | Secure development practices, vulnerability remediation |
| All Staff | Adherence to this policy; reporting of security incidents |

---

## 5. Minimum Security Standards

### 5.1 Authentication
- Multi-factor authentication (MFA) is **mandatory** for all user accounts with access to production systems, customer data, or administrative interfaces.
- Passwords must meet complexity requirements: ≥16 characters, mixed case, digits, and symbols.
- Service accounts must use cryptographic keys or tokens; shared passwords are prohibited.

### 5.2 Encryption
- Data in transit must be protected using TLS 1.2 or higher. Where post-quantum threats are relevant, CRYSTALS-Kyber (FIPS 203) shall be employed.
- Data at rest must be encrypted using AES-256-GCM or equivalent.
- Cryptographic keys must be managed in accordance with the Cryptographic Key Management Standard.

### 5.3 Access Control
- Access to systems and data must be approved, documented, and granted on a least-privilege basis.
- Access rights must be reviewed quarterly.
- Accounts must be deprovisioned within 24 hours of employment termination.

### 5.4 Vulnerability Management
- Vulnerability scans must be performed at least weekly.
- Critical vulnerabilities (CVSS ≥ 9.0) must be remediated within **7 days**.
- High vulnerabilities (CVSS 7.0–8.9) must be remediated within **30 days**.
- The KHEPRA STIG/vulnerability scan module provides automated scan evidence.

### 5.5 Incident Response
- All security incidents must be reported to the ISSO within **1 hour** of discovery.
- The Incident Response Plan (IRP-001) governs response procedures.
- Incidents must be logged in the DAG-based audit trail for tamper-evident record keeping.

### 5.6 Change Management
- All changes to production systems must follow the Change Management Policy (CMP-001).
- Emergency changes must be approved by two authorised individuals.
- All changes must be recorded in the version control system and linked to an approved change ticket.

---

## 6. Acceptable Use

- Company systems and data must be used only for authorised business purposes.
- Employees must not install unauthorised software on company systems.
- Sensitive data must not be stored on personal devices unless approved and encrypted.

---

## 7. Training and Awareness

All employees must complete security awareness training:
- **Onboarding**: Within 30 days of start date.
- **Annual**: Refresher training each calendar year.
- **Role-specific**: Engineers complete secure development training; administrators complete privileged access training.

---

## 8. Compliance and Enforcement

Violations of this policy may result in disciplinary action up to and including termination of employment or contract. Suspected violations must be reported to the ISSO.

---

## 9. Policy Review

This policy is reviewed annually or upon significant changes to the threat landscape, regulatory environment, or organisational structure. The CISO is responsible for initiating the review.

---

## 10. Related Documents

- Access Control Policy (ACP-001)
- Incident Response Plan (IRP-001)
- Change Management Policy (CMP-001)
- Vendor Management Policy (VMP-001)
- Risk Assessment Policy (RAP-001)
- Cryptographic Key Management Standard

---

**Approved by**: _____________________________ Date: ______________  
**CISO / ISSO**: SGT Souhimbou Kone
