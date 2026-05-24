# Governance — Org Structure, Authority Matrix & RACI
**Organisation**: NouchiX SecRed Knowledge Inc.  
**Document ID**: GOV-001 | **Version**: 1.1 | **SOC 2**: CC1.2, CC1.3, CC1.5  
**Last Updated**: 2026-05-22

---

## 1. Organisational Structure

NouchiX SecRed Knowledge Inc. is a pre-revenue, solo-founder company. All
executive, security, and engineering functions are currently held by the
Founder. Independent oversight is provided by a named Business Advisor.

```
┌──────────────────────────────────────────────────────┐
│              Advisory Oversight                       │
│  Donnie Yancey — Business Advisor (MBA Mentor)        │
│  • Reviews annual risk assessment                     │
│  • Receives quarterly security briefings              │
│  • Approves HIGH/CRITICAL risk acceptance decisions   │
└──────────────────────┬───────────────────────────────┘
                       │ independent oversight
┌──────────────────────▼───────────────────────────────┐
│            NouchiX SecRed Knowledge Inc.              │
│   Founder / CEO / CISO / ISSO: SGT Souhimbou Kone    │
│                                                       │
│  Wears all hats until first security hire:            │
│    • Product, Engineering, Security, Compliance       │
└──────────────────────────────────────────────────────┘
```

**Solo-founder compensating controls** (replaces dual-person requirements):

| Requirement | Solo-founder compensating control |
|-------------|----------------------------------|
| CISO ≠ ISSO | Founder documents security decisions in the DAG audit trail; Advisor reviews quarterly — creating an independent review trail |
| 2 approvals for production deploy | Branch protection requires CI passing; PR is self-approved but all changes are signed to the tamper-evident DAG; Advisor notified of major releases |
| 2 approvals for HIGH risk acceptance | Advisor provides written concurrence (email sufficient) before any HIGH/CRITICAL risk is formally accepted |
| Annual security training | Founder completes and self-certifies Scytale SOC 2 masterclass + Haekka modules; certificate retained |
| Table-top exercise | Founder conducts solo walkthrough of IRP scenarios; documents findings; Advisor reviews summary |

*When headcount reaches 3+, CISO and ISSO roles must be separated.*

---

## 2. Advisory Board

### Current Composition

| Name | Role | Expertise | Appointed | Term |
|------|------|-----------|-----------|------|
| **Donnie Yancey** | Business Advisor | MBA — business strategy, governance, risk management | 2026-05-22 | Annual renewal |

### Advisor Responsibilities (CC1.2)

Donnie Yancey's oversight responsibilities for SOC 2 purposes:

1. **Quarterly Security Briefings** — Founder sends a 1-page security posture summary each quarter (template: `docs/soc2/QUARTERLY_SECURITY_BRIEFING_TEMPLATE.md`). Advisor acknowledges receipt in writing (email).
2. **Annual Risk Assessment Review** — Advisor reviews and signs `docs/soc2/RISK_ASSESSMENT_2026.md` annually before it is finalised.
3. **HIGH/CRITICAL Risk Acceptance** — Advisor provides written concurrence before any risk scored HIGH or CRITICAL is formally accepted rather than remediated.
4. **Policy Approval** — Advisor countersigns major policy documents (ISP-001, IRP-001, BCP-001) to evidence independent governance review.
5. **Incident Escalation** — For P1 incidents affecting customer data, Advisor is notified within 24 hours.

### What the Auditor Will Ask For

| Evidence | How It's Produced |
|----------|------------------|
| Advisor appointment letter / resolution | `docs/soc2/ADVISORY_BOARD_CHARTER.md` + signed copy |
| Evidence of oversight activity | Quarterly briefing email threads (retain in `docs/soc2/evidence/CC1.2/`) |
| Advisor sign-off on risk assessment | Signed page of `RISK_ASSESSMENT_2026.md` |
| Advisor sign-off on key policies | Signature blocks in policy documents |

---

## 3. Authority Matrix

*All roles currently held by the Founder. Advisor provides independent oversight where noted.*

| Decision | Founder | Advisor | Effective Approval |
|----------|---------|---------|-------------------|
| Policy creation / update | ✅ Author | ✅ Review + sign | Both |
| Risk acceptance — LOW | ✅ | Informed | Founder alone |
| Risk acceptance — MEDIUM | ✅ | ✅ Notified | Founder with documented rationale |
| Risk acceptance — HIGH/CRITICAL | ✅ Propose | ✅ Written concurrence required | Both |
| Production deployment | ✅ | Notified (major releases) | CI gates + DAG signature |
| Vendor onboarding (Tier 1) | ✅ | ✅ Informed | Founder + documented review |
| P1/P2 incident declaration | ✅ Commander | ✅ Notified within 24h | Founder executes |
| PQC key rotation | ✅ | Notified | Founder + DAG-signed rotation record |
| Budget decisions | ✅ Owner | Advisory input | Founder |

---

## 4. RACI Matrix — SOC 2 Controls

*All Responsible/Accountable roles are held by the Founder. Advisor is Consulted on strategic controls.*

| SOC 2 | Description | Responsible | Accountable | Consulted | Informed |
|-------|-------------|-------------|-------------|-----------|---------|
| CC1.1 | Code of Conduct | Founder | Founder | Advisor | — |
| CC1.2 | Advisory oversight | Advisor | Advisor | Founder | — |
| CC1.3 | Org structure | Founder | Founder | Advisor | — |
| CC1.4 | Competency / training | Founder | Founder | Advisor | — |
| CC1.5 | Accountability attestation | Founder | Founder | Advisor | — |
| CC2.2 | Security awareness training | Founder | Founder | — | Advisor |
| CC3.2 | Risk assessment | Founder | Founder | Advisor | — |
| CC4.1 | Continuous monitoring | Founder | Founder | — | Advisor (quarterly) |
| CC6.1 | MFA enforcement | Founder | Founder | — | — |
| CC6.2 | Access provisioning | Founder | Founder | — | — |
| CC6.3 | Access reviews | Founder | Founder | — | — |
| CC6.7 | Encryption | Founder | Founder | — | — |
| CC7.4 | Incident response | Founder | Founder | Advisor (P1) | — |
| CC8.1 | Change management | Founder | Founder | — | — |
| CC9.2 | Vendor management | Founder | Founder | Advisor | — |
| A1.2 | Backup / recovery | Founder | Founder | — | — |

---

## 5. Control Ownership Attestation

The Founder self-attests quarterly that all controls are operating effectively.
Attestation records are retained in `docs/soc2/evidence/CC1.5/`.

**Next attestation due**: 2026-09-01

| Owner | Controls | Last Attested | Next Due |
|-------|---------|-------------|---------|
| SGT Souhimbou Kone (Founder) | All SOC 2 controls | ___________ | 2026-09-01 |
| Donnie Yancey (Advisor) | CC1.2 oversight activities | ___________ | 2026-09-01 |
