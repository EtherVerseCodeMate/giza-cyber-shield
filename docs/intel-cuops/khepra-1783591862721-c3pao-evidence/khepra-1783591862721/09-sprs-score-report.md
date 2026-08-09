# SPRS Score Report
# Supplier Performance Risk System — DoD Submission-Ready
# Per NIST SP 800-171 DoD Assessment Methodology
# Generated: 2026-07-09T10:11:02.719Z | Signed: ML-DSA-65:0x652D8C00128E2B75

## Score Summary
| Metric | Value |
|---|---|
| Maximum Score | 110 |
| Total Point Deductions | -28 |
| **SPRS Score** | **82** |
| CMMC Level 2 Threshold | 110 |
| Assessment Result | FAIL — Below Threshold |

## Score Calculation
Starting score: 110 (all practices passing)

| NIST Practice | Control | Severity | Points Deducted | Finding |
|---|---|---|---|---|
| 3.13.10 | CMMC.SC.L2-3.13.10 | CAT I | -3 | SC-13: MD5 Password Hashing - FIPS Violation |
| 3.14.2 | CMMC.SI.L2-3.14.2 | CAT I | -5 | SI-10: SQL Injection - Login Bypass (Classic) |
| 3.14.6 | CMMC.SI.L2-3.14.6 | CAT I | -3 | SI-7: Unrestricted File Upload - PHP Webshell RCE |
| 3.5.3 | CMMC.IA.L2-3.5.3 | CAT I | -3 | IA-5: Hardcoded Database Credentials |
| 3.1.2 | CMMC.AC.L2-3.1.2 | CAT I | -5 | AC-4: CSRF - State-Changing Action Without Token |
| 3.1.3 | CMMC.AC.L2-3.1.3 | CAT II | -5 | AC-3: Insecure Direct Object Reference - User Data Exposure |
| 3.1.20 | CMMC.AC.L2-3.1.20 | CAT II | -1 | AC-17: Missing HSTS / Insecure Transport |
| 3.4.6 | CMMC.CM.L2-3.4.6 | CAT II | -3 | CM-6: PHP Version Disclosure + Default Error Pages |

**Total Deducted: -28 points**
**Final SPRS Score: 82 / 110**

## DoD Submission
This score must be submitted to the SPRS portal at https://www.sprs.csd.disa.mil/
before contract award for DoD contracts containing DFARS 252.204-7021.

Organization must achieve SPRS = 110 before CMMC Level 2 certification.
Current gap: 28 points requiring remediation.

## Remediation Roadmap
Remediate all 8 CAT I (NON-POA&M) findings first.
Estimated remediation cost: $18 600
Estimated post-remediation SPRS score: 110 (full compliance)
ROI of remediation: 632x vs. breach exposure of $11 760 000
