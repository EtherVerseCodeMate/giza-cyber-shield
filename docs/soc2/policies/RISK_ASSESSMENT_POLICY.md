# Risk Assessment Policy

**Organisation**: NouchiX SecRed Knowledge Inc.  
**Document ID**: RAP-001  
**Version**: 1.0  
**Effective Date**: 2026-06-01  
**Review Cycle**: Annual  
**Owner**: ISSO  
**SOC 2 Criteria**: CC3.1, CC3.2, CC3.3, CC3.4, CC9.1

---

## 1. Purpose

This policy defines the process for identifying, analysing, evaluating, and treating information security risks to ensure they are managed to an acceptable level.

---

## 2. Risk Assessment Methodology

NouchiX follows the **NIST RMF** methodology aligned with NIST SP 800-30 Rev 1.

### 2.1 Risk Scoring Formula

```
Inherent Risk = Likelihood × Impact
Residual Risk = Inherent Risk × (1 − Control Effectiveness)
```

| Score | Likelihood | Impact |
|-------|-----------|--------|
| 1 | Rare (< once/5 years) | Negligible |
| 2 | Unlikely (once/2–5 years) | Minor |
| 3 | Possible (once/year) | Moderate |
| 4 | Likely (several/year) | Significant |
| 5 | Almost Certain (> monthly) | Severe |

| Residual Score | Risk Level | Treatment Required |
|---------------|-----------|-------------------|
| 1–4 | **LOW** | Accept with monitoring |
| 5–9 | **MEDIUM** | Treat within 90 days |
| 10–16 | **HIGH** | Treat within 30 days |
| 17–25 | **CRITICAL** | Treat immediately |

---

## 3. Risk Assessment Schedule

| Trigger | Frequency |
|---------|---------|
| Scheduled review | Annual |
| New system / significant change | Before go-live |
| Security incident | Post-incident |
| New threat intelligence | As needed |

---

## 4. Risk Register

The risk register must:
- Be maintained in the approved ticketing system or a dedicated risk register tool.
- Include: Risk ID, description, likelihood, impact, inherent score, controls, residual score, owner, due date.
- Be reviewed by the ISSO quarterly.
- Be presented to executive leadership annually.

---

## 5. Risk Treatment Options

| Option | Description |
|--------|-----------|
| **Mitigate** | Implement controls to reduce likelihood or impact |
| **Transfer** | Obtain cyber insurance; contractual liability transfer |
| **Avoid** | Cease the activity that creates the risk |
| **Accept** | Formally accept with documented rationale (LOW risks only) |

All accepted risks require documented CISO approval.

---

## 6. Fraud Risk Assessment

Per CC3.3, fraud risks must be explicitly considered in the annual risk assessment:
- Insider threat scenarios (e.g., privilege abuse, data theft).
- External fraud (e.g., social engineering, account takeover).
- Financial fraud related to billing and licensing systems.

---

## 7. KHEPRA Risk Tooling

The KHEPRA platform's internal scan capabilities (`pkg/risk`, `pkg/ert`) provide automated risk scoring for:
- CVE-based vulnerability risk (`pkg/vuln`)
- Configuration drift risk (Sonar agent)
- Supply chain risk (`pkg/compliance/soc2` + SBOM)

Risk findings from automated scans must be imported into the risk register within **5 business days**.

---

**Approved by**: _____________________________ Date: ______________
