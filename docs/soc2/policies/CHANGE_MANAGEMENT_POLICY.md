# Change Management Policy

**Organisation**: NouchiX SecRed Knowledge Inc.  
**Document ID**: CMP-001  
**Version**: 1.0  
**Effective Date**: 2026-06-01  
**Review Cycle**: Annual  
**Owner**: Engineering Lead / ISSO  
**SOC 2 Criteria**: CC8.1

---

## 1. Purpose

This policy defines the process for authorising, documenting, testing, and implementing changes to production systems to prevent unauthorised or untested changes from introducing vulnerabilities or outages.

---

## 2. Scope

All changes to production infrastructure, application code, configurations, cryptographic keys, and security controls within the KHEPRA platform boundary.

---

## 3. Change Types

| Type | Definition | Approval Required | Testing Required |
|------|-----------|------------------|-----------------|
| **Standard** | Routine, pre-approved, low risk | Team lead | Automated tests |
| **Normal** | Planned, moderate risk | Team lead + ISSO | Staging + automated tests |
| **Emergency** | Urgent fix for P1/P2 incident | Two senior engineers | Post-deploy testing |
| **Major** | Significant architectural change | Engineering Lead + CISO | Full regression |

---

## 4. Change Control Process

### 4.1 Standard / Normal Changes
1. Create a GitHub issue or JIRA ticket describing the change, rationale, and risk.
2. Open a pull request (PR) with the change.
3. PR must receive **at least 2 approvals** from authorised reviewers.
4. Automated CI/CD tests must pass (including SAST, dependency scan, unit tests).
5. Deploy to staging environment; verify expected behaviour.
6. Merge to main and deploy to production via the approved pipeline.
7. Monitor production metrics for **30 minutes** post-deploy.

### 4.2 Emergency Changes
1. Two authorised engineers approve the change verbally or via Slack.
2. Change is applied to production.
3. A retrospective change ticket is created within **24 hours**.
4. Post-deploy review must occur within **48 hours**.

### 4.3 Cryptographic Key Changes
- Key rotation requires CISO approval.
- New keys must be cryptographically verified before old keys are revoked.
- Key changes are logged in the DAG-based tamper-evident ledger.

---

## 5. Evidence for SOC 2

All changes must be traceable in version control. The following constitute change management evidence:

- GitHub PR with ≥2 approvals and passing CI checks.
- Linked change ticket with risk assessment.
- Deployment log with timestamp and deployer identity.
- DAG-signed audit record of configuration state before and after change.

KHEPRA's DAG store (`pkg/dag`) automatically records configuration hashes before and after each deployment, providing tamper-evident change evidence for CC8.1.

---

## 6. Configuration Baseline

- All production configurations are stored as code in version control.
- KHEPRA Sonar agent monitors for configuration drift and alerts the ISSO.
- Configuration drift constitutes an unauthorised change and must be remediated within **24 hours**.

---

**Approved by**: _____________________________ Date: ______________
