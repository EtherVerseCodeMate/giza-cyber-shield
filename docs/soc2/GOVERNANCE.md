# Governance — Org Chart, Authority Matrix & RACI
**Organisation**: NouchiX SecRed Knowledge Inc.  
**Document ID**: GOV-001 | **SOC 2**: CC1.2, CC1.3, CC1.5

---

## Organisational Structure

```
┌─────────────────────────────────────┐
│   NouchiX SecRed Knowledge Inc.     │
│   Founder / CEO: SGT Souhimbou Kone │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌──────▼───────┐
│    CISO     │  │  Engineering  │
│  (= Founder │  │     Lead      │
│  currently) │  └──────┬────────┘
└──────┬──────┘         │
       │         ┌──────┴──────────┐
┌──────▼──────┐  │  Developers /  │
│    ISSO     │  │   Operators    │
│ (= Founder  │  └────────────────┘
│ currently)  │
└─────────────┘
```

*Note: Until headcount grows, the Founder holds CISO and ISSO roles. These must be separated before a Type 2 audit with >5 employees.*

---

## Authority Matrix

| Decision | CISO | ISSO | Eng Lead | Engineering | Requires Dual Approval |
|----------|------|------|----------|-------------|----------------------|
| Policy creation / update | ✅ Owner | Review | Input | — | CISO + ISSO |
| Risk acceptance (LOW) | ✅ | Recommend | — | — | No |
| Risk acceptance (MED/HIGH) | ✅ Required | ✅ Required | — | — | Yes |
| Production deployment | Notify | Notify | ✅ Approve | Execute | Eng Lead + 1 reviewer |
| Emergency production change | ✅ Aware | ✅ Aware | ✅ Approve | ✅ Second engineer | 2 engineers |
| New vendor onboarding | ✅ Approve | Review | Input | — | CISO + Legal |
| Incident escalation (P1/P2) | ✅ Notified | ✅ Commander | Notified | Respond | — |
| Access provisioning (standard) | — | ✅ Approve | ✅ Approve | — | Manager + System owner |
| Access provisioning (admin) | ✅ Required | ✅ Required | — | — | CISO + ISSO |
| Budget approval | ✅ Owner | — | Input | — | No |
| PQC key rotation | ✅ Approve | ✅ Approve | Execute | Execute | CISO + ISSO |

---

## RACI Matrix — SOC 2 Controls

| SOC 2 Criterion | Control Description | Responsible | Accountable | Consulted | Informed |
|-----------------|--------------------|-----------:|----------:|---------|--------|
| CC1.1 | Code of Conduct | ISSO | CISO | All Staff | All Staff |
| CC1.3 | Org structure | CISO | CISO | ISSO | Board |
| CC1.4 | Competency framework | ISSO | CISO | Eng Lead | All Staff |
| CC1.5 | Accountability attestation | ISSO | CISO | Managers | All Staff |
| CC2.2 | Security awareness training | ISSO | CISO | HR | All Staff |
| CC3.2 | Risk assessment | ISSO | CISO | Eng Lead | Board |
| CC4.1 | Continuous monitoring | Engineering | Eng Lead | ISSO | CISO |
| CC4.2 | Deficiency tracking | ISSO | CISO | Engineering | CISO |
| CC6.1 | MFA enforcement | Engineering | Eng Lead | ISSO | CISO |
| CC6.2 | Access provisioning | ISSO | CISO | Eng Lead | — |
| CC6.3 | Access reviews | ISSO | CISO | Engineering | CISO |
| CC6.6 | Network controls | Engineering | Eng Lead | ISSO | CISO |
| CC6.7 | Encryption | Engineering | Eng Lead | ISSO | CISO |
| CC6.8 | Malware prevention | Engineering | Eng Lead | ISSO | CISO |
| CC7.1 | Vuln management | Engineering | Eng Lead | ISSO | CISO |
| CC7.2 | Anomaly detection | Engineering | Eng Lead | ISSO | CISO |
| CC7.4 | Incident response | ISSO | CISO | Engineering | All Staff |
| CC8.1 | Change management | Engineering | Eng Lead | ISSO | CISO |
| CC9.2 | Vendor management | CISO | CISO | Legal, ISSO | Engineering |
| A1.2 | Backup / recovery | Engineering | Eng Lead | ISSO | CISO |

---

## Control Ownership Attestation

Control owners must attest quarterly that their controls are operating effectively.  
Next attestation due: **2026-09-01**

| Owner | Controls | Last Attested | Next Due |
|-------|---------|-------------|---------|
| CISO | CC1.1, CC1.3, CC9.2, policy suite | ___________ | 2026-09-01 |
| ISSO | CC3.2, CC6.2, CC6.3, CC7.4 | ___________ | 2026-09-01 |
| Eng Lead | CC4.1, CC6.1, CC6.7, CC8.1, A1.2 | ___________ | 2026-09-01 |
