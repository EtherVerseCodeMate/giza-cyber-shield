# POA&M Eligibility Analysis
# Per CMMC Assessment Process (CAP) v2.0 + NIST SP 800-171 DoD Assessment Methodology
# Generated: 2026-07-09T10:11:02.719Z | Signed: ML-DSA-65:0x652D8C00128E2B75

## CRITICAL — NON-POA&M Findings (must remediate BEFORE assessment)
These 8 findings cannot be placed on a Plan of Action & Milestones.
A CAT I finding on a high-weight practice (3-5pt) = IMMEDIATE ASSESSMENT FAILURE.

### SC-13 — MD5 Password Hashing - FIPS Violation
- CMMC Practice: CMMC.SC.L2-3.13.10
- NIST 800-171: 3.13.10 | CCI: CCI-002450
- SPRS Weight: 3 points
- Exposure: $1 800 000
- Status: FAIL — NON-POA&M — REMEDIATE BEFORE ASSESSMENT
- Remediation: Replace with bcrypt cost=12 or Argon2id. Est: 4h

### SI-10 — SQL Injection - Login Bypass (Classic)
- CMMC Practice: CMMC.SI.L2-3.14.2
- NIST 800-171: 3.14.2 | CCI: CCI-002754
- SPRS Weight: 5 points
- Exposure: $2 400 000
- Status: FAIL — NON-POA&M — REMEDIATE BEFORE ASSESSMENT
- Remediation: Parameterized queries + input validation + WAF. Est: 8h

### SI-10c — Blind SQL Injection - Data Exfiltration
- CMMC Practice: CMMC.SI.L2-3.14.2
- NIST 800-171: 3.14.2 | CCI: CCI-002754
- SPRS Weight: 5 points
- Exposure: $1 600 000
- Status: FAIL — NON-POA&M — REMEDIATE BEFORE ASSESSMENT
- Remediation: Parameterized queries across all DB calls. Est: 8h

### SI-10b — Command Injection - OS-Level RCE
- CMMC Practice: CMMC.SI.L2-3.14.2
- NIST 800-171: 3.14.2 | CCI: CCI-002754
- SPRS Weight: 5 points
- Exposure: $1 200 000
- Status: FAIL — NON-POA&M — REMEDIATE BEFORE ASSESSMENT
- Remediation: Input allowlist (IP regex) + escapeshellarg(). Est: 4h

### SI-7 — Unrestricted File Upload - PHP Webshell RCE
- CMMC Practice: CMMC.SI.L2-3.14.6
- NIST 800-171: 3.14.6 | CCI: CCI-002748
- SPRS Weight: 3 points
- Exposure: $980 000
- Status: FAIL — NON-POA&M — REMEDIATE BEFORE ASSESSMENT
- Remediation: Server-side file type allowlist + rename + disable exec in upload dir. Est: 6h

### IA-5 — Hardcoded Database Credentials
- CMMC Practice: CMMC.IA.L2-3.5.3
- NIST 800-171: 3.5.3 | CCI: CCI-000186
- SPRS Weight: 3 points
- Exposure: $890 000
- Status: FAIL — NON-POA&M — REMEDIATE BEFORE ASSESSMENT
- Remediation: Move secrets to env vars + Vault. Rotate immediately. Est: 3h

### AC-4 — CSRF - State-Changing Action Without Token
- CMMC Practice: CMMC.AC.L2-3.1.2
- NIST 800-171: 3.1.2 | CCI: CCI-000366
- SPRS Weight: 5 points
- Exposure: $760 000
- Status: FAIL — NON-POA&M — REMEDIATE BEFORE ASSESSMENT
- Remediation: SameSite=Strict cookie + CSRF token on all state-changing requests. Est: 4h

### SI-10d — Stored XSS - Persistent Script Injection
- CMMC Practice: CMMC.SI.L2-3.14.2
- NIST 800-171: 3.14.2 | CCI: CCI-002754
- SPRS Weight: 5 points
- Exposure: $640 000
- Status: FAIL — NON-POA&M — REMEDIATE BEFORE ASSESSMENT
- Remediation: Output encoding (htmlspecialchars) + CSP. Est: 3h

## POA&M-Eligible Findings
These 4 findings may be addressed via a formal POA&M with milestones.

### AC-3 — Insecure Direct Object Reference - User Data Exposure
- CMMC Practice: CMMC.AC.L2-3.1.3
- NIST 800-171: 3.1.3 | CCI: CCI-001873
- SPRS Weight: 5 points
- Exposure: $480 000
- Remediation: Server-side authorization check on every object access. Est: 2h
- POA&M Milestone: 90 days from assessment

### AC-17 — Missing HSTS / Insecure Transport
- CMMC Practice: CMMC.AC.L2-3.1.20
- NIST 800-171: 3.1.20 | CCI: CCI-003123
- SPRS Weight: 1 points
- Exposure: $450 000
- Remediation: Enable HTTPS + HSTS max-age=31536000 includeSubDomains. Est: 1h
- POA&M Milestone: 90 days from assessment

### SI-3 — Missing CSP + Reflected XSS
- CMMC Practice: CMMC.SI.L1-3.14.2
- NIST 800-171: 3.14.2 | CCI: CCI-002754
- SPRS Weight: 1 points
- Exposure: $380 000
- Remediation: strict-dynamic CSP + output encoding + DOMPurify. Est: 3h
- POA&M Milestone: 90 days from assessment

### CM-6 — PHP Version Disclosure + Default Error Pages
- CMMC Practice: CMMC.CM.L2-3.4.6
- NIST 800-171: 3.4.6 | CCI: CCI-001499
- SPRS Weight: 3 points
- Exposure: $180 000
- Remediation: Suppress headers in php.ini + custom error pages. Est: 1h
- POA&M Milestone: 90 days from assessment

## Assessor Statement
This analysis was produced by KHEPRA ERT v2.0 using NIST SP 800-171 DoD Assessment
Methodology point weights. NON-POA&M determinations reflect controls where partial
implementation constitutes an automatic assessment failure per CMMC CAP v2.0.
