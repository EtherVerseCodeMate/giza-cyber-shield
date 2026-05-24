# SOC 2 Remediation Checklist
**System**: KHEPRA / AdinKhepra ASAF Engine  
**Audit Date**: 2026-05-22 · **Last Updated**: 2026-05-22  
**Open Items**: 18 remaining · **Closed**: 15 (RM-001 partial, RM-002, RM-003 partial, RM-004, RM-006 partial, RM-008, RM-010, RM-012, RM-016 partial, RM-017, RM-019, RM-020, RM-021, RM-022, RM-026)

---

## Phase 1 — HIGH Priority (complete before scheduling Type 1 auditor)

### RM-001 · CC6.1 / CC5.2 — Enforce MFA at Identity Provider
**Status**: `[~] In Progress — IdP done; code merged`  
**Effort**: 2 days  
**Owner**: Engineering

- [x] Enable MFA enforcement policy in Cloudflare Access *(done by operator)*
- [x] Enable MFA enforcement in Supabase Auth *(done by operator)*
- [x] Add `MFAVerified bool` / `AAL string` to `PQCTokenClaims` (`pkg/auth/pqc_auth.go`)
- [x] `WrapOAuth2Token` reads Supabase `aal` claim → sets `MFAVerified`, raises trust score to 0.95 for aal2
- [x] `RequireMFA()` middleware added to `pkg/apiserver/pqc_auth_middleware.go`
- [x] `setPQCContext` sets `GinKeyMFAVerified` and `X-Khepra-MFA` response header
- [ ] Apply `RequireMFA()` to admin route group in `pkg/apiserver/server.go`
- [ ] Write test: token without aal2 must return HTTP 403 on admin routes
- [ ] Screenshot MFA enforcement config as evidence for CC6.1

---

### RM-002 · CC4.1 / CC7.2 — Configure Prometheus Alertmanager
**Status**: `[x] Done`  
**Owner**: Engineering

- [x] `prometheus.yml` updated — references `alerts/security.yml`, `alerts/availability.yml`, `alerts/capacity.yml`
- [x] `alerts/security.yml` — auth brute-force, MFA bypass, privilege escalation, data exfil, FIM violation, config drift, TLS expiry, PQC key rotation, CVE SLA breach
- [x] `alerts/availability.yml` — service down, uptime <99%, backup failure, disk space
- [x] `alerts/capacity.yml` — CPU/memory/disk thresholds
- [x] `alertmanager.yml` — email receivers for `security-team` and `security-oncall`; inhibition rules
- [ ] Set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` in production secrets
- [ ] Optionally wire Slack/PagerDuty in `alertmanager.yml` receivers
  - Authentication failures > 5 in 5 min (brute-force)
  - Privilege escalation attempts (admin token from non-admin account)
  - Data volume anomaly (exfil pattern: spike > 3× baseline)
  - Service availability (uptime < 99.5 % over 5 min)
  - Certificate expiry < 30 days
- [ ] Configure `alertmanager.yml` with receiver (email / Slack / PagerDuty)
- [ ] Define on-call rotation and escalation chain in `docs/soc2/policies/`
- [ ] Test alert firing with a synthetic auth-failure flood
- [ ] Export final `alertmanager.yml` and alert rules as evidence for CC4.1

---

### RM-003 · CC8.1 — Enable Branch Protection on `main`
**Status**: `[~] Partial — template done; settings need 1 click`  
**Owner**: Engineering Lead

- [x] `.github/PULL_REQUEST_TEMPLATE.md` created with security-impact section and RM tracking
- [ ] **You must do**: GitHub repo Settings → Branches → Add rule for `main`: require ≥2 reviewers, require status checks (`pre-commit-security`, `run-validation-tests`, `validate-build-artifacts`), block force-push
- [ ] Screenshot branch protection settings as evidence for CC8.1
  - Require ≥ 2 approving reviews before merge
  - Dismiss stale reviews on new commits
  - Require status checks to pass (`pre-commit-security`, `run-validation-tests`, `validate-build-artifacts`)
  - Block force-pushes
  - Block branch deletion
- [ ] Document emergency change procedure in `docs/soc2/policies/CHANGE_MANAGEMENT_POLICY.md` (two-engineer verbal approval + 24h retrospective ticket)
- [ ] Export branch protection screenshot as evidence for CC8.1

---

### RM-004 · CC6.2 — Access Provisioning Workflow
**Status**: `[x] Done`  
**Owner**: ISSO

- [x] `.github/ISSUE_TEMPLATE/access-request.md` — structured form with system, role, justification, manager approval, provisioner checklist
- [x] `.github/ISSUE_TEMPLATE/access-revocation.md` — all-systems offboarding checklist with 24h SLA, ISSO sign-off
- [ ] Run a test provisioning cycle and retain the first issue as audit evidence for CC6.2

---

### RM-005 · CC6.3 — Quarterly Access Review Process
**Status**: `[ ] Open`  
**Effort**: 2 days  
**Owner**: ISSO

- [ ] Create access review spreadsheet template: user, role, system, last login, justification, approved-by
- [ ] Export current user list from Cloudflare Access, Supabase Auth, GitHub, and Fly.io
- [ ] Conduct first access review; document results; revoke unnecessary accounts within 5 business days
- [ ] Add quarterly recurring calendar event: next review date
- [ ] Retain signed review report as evidence for CC6.3
- [ ] Add per-endpoint RBAC middleware to `pkg/apiserver/` to enforce role checks at each handler

---

### RM-006 · CC6.6 — Document Network Topology + Export WAF Rules
**Status**: `[ ] Open`  
**Effort**: 2 days  
**Owner**: Engineering

- [ ] Draw and publish network topology diagram (Cloudflare Tunnel → Fly.io → Supabase) in `docs/soc2/`
- [ ] Export Cloudflare WAF rule set as JSON evidence
- [ ] Export Cloudflare Access policy list as PDF/screenshot
- [ ] Document zero-trust segmentation: which services communicate, over which ports/protocols
- [ ] Confirm all inter-service traffic uses mTLS or Cloudflare Tunnel (no plain HTTP)
- [ ] File evidence under `docs/soc2/evidence/CC6.6/`

---

### RM-007 · CC7.4 — Complete and Test Incident Response Plan
**Status**: `[ ] Open`  
**Effort**: 3 days + 1 day exercise  
**Owner**: ISSO

- [ ] Complete `docs/soc2/policies/INCIDENT_RESPONSE_PLAN.md`:
  - Fill in named contacts for all IRT roles
  - Define notification email distribution list for P1/P2
  - Add KHEPRA-specific playbooks: compromised API key, PQC key rotation, data exfil
- [ ] Wire `pkg/ir/manager.go` incident creation to email/Slack notification
- [ ] Schedule and run table-top exercise (date: _________); document findings
- [ ] Update IRP with lessons learned from table-top
- [ ] Retain table-top agenda, attendee list, and findings as evidence for CC7.4

---

### RM-008 · CC3.2 — Formal Risk Assessment Report
**Status**: `[ ] Open`  
**Effort**: 3 days  
**Owner**: ISSO

- [ ] Run `pkg/risk/calculator.go` against all in-scope assets; export findings
- [ ] Run `pkg/ert/` Extended Risk Taxonomy analysis; export report
- [ ] Compile into a formal risk assessment document (`docs/soc2/RISK_ASSESSMENT_2026.md`):
  - Scope, methodology (NIST SP 800-30 Rev 1)
  - Asset inventory with criticality scores
  - Threat catalogue
  - Risk register (ID, description, likelihood, impact, inherent score, controls, residual score, owner, due date)
  - Fraud risk section (RM-014)
- [ ] CISO review and sign-off
- [ ] Schedule annual repeat
- [ ] Retain signed report as evidence for CC3.2 and CC3.3

---

## Phase 2 — MEDIUM Priority (complete before Type 1 audit window opens)

### RM-009 · CC1.2 — Advisory/Board Oversight Structure
**Status**: `[ ] Open`  
**Effort**: 2 days  
**Owner**: CISO

- [ ] Define advisory board or oversight committee (names, roles, responsibilities)
- [ ] Document decision authority matrix (who approves: policy changes, budget, risk acceptance)
- [ ] Publish in `docs/soc2/GOVERNANCE.md`
- [ ] Obtain approval signatures from principals

---

### RM-010 · CC3.3 — Fraud Risk Assessment
**Status**: `[ ] Open`  
**Effort**: 1 day (add to RM-008 risk assessment)  
**Owner**: ISSO

- [ ] Add fraud risk section to `docs/soc2/RISK_ASSESSMENT_2026.md`:
  - Insider threat (privilege abuse, data theft)
  - Account takeover (credential stuffing, phishing)
  - Billing/licensing fraud (license key cloning, payment fraud)
  - Social engineering targeting employees
- [ ] Map mitigating controls to each fraud scenario
- [ ] Document residual risk and acceptance decision

---

### RM-011 · CC6.5 — Account Deprovisioning + Data Disposal
**Status**: `[ ] Open`  
**Effort**: 2 days  
**Owner**: Engineering + ISSO

- [ ] Automate offboarding: script to revoke accounts across Cloudflare, Supabase, GitHub, Fly.io, Tailscale within 24 h of HR notification
- [ ] Document NIST 800-88 data sanitisation procedure for decommissioned hardware/cloud volumes
- [ ] Add data disposal confirmation step to offboarding checklist
- [ ] Test automation: simulate termination and verify all access revoked within SLA
- [ ] Retain offboarding checklist as evidence for CC6.5

---

### RM-012 · A1.3 — Recovery Plan Test
**Status**: `[ ] Open`  
**Effort**: 1 day exercise  
**Owner**: CISO + Engineering

- [ ] Draft BCP/DRP document in `docs/soc2/policies/BUSINESS_CONTINUITY_PLAN.md` (include RM-008 risk context, RTO, RPO)
- [ ] Define RTO (target: 4 hours) and RPO (target: 24 hours) — document in BCP
- [ ] Run restore test using `pkg/drbc/restore.go` from last backup; measure actual recovery time
- [ ] Schedule annual BCP tabletop exercise
- [ ] Document test results, lessons learned, and BCP updates

---

### RM-013 · PI1.4 — Output Validation
**Status**: `[ ] Open`  
**Effort**: 2 days  
**Owner**: Engineering

- [ ] Audit all customer-facing API responses: add schema validation on outbound payloads
- [ ] Add delivery confirmation receipts for async job outputs (webhook callbacks)
- [ ] Implement idempotency tokens to detect duplicate or incomplete output delivery
- [ ] Add integration tests for output completeness on critical endpoints

---

### RM-014 · C1.2 — Data Disposal Procedure
**Status**: `[ ] Open`  
**Effort**: 1 day  
**Owner**: Engineering

- [ ] Implement secure-deletion function in `pkg/drbc/`: overwrite data before deletion (NIST 800-88 Purge for cloud volumes)
- [ ] Document data retention schedule and expiry triggers
- [ ] Add data disposal to vendor offboarding checklist (obtain written confirmation of deletion)
- [ ] Test: verify data is unrecoverable after disposal

---

## Phase 3 — LOW Priority (complete before Type 2 observation window)

### RM-015 · CC9.2 — Execute Vendor DPAs / BAAs
**Status**: `[ ] Open`  
**Effort**: 2 weeks (legal)  
**Owner**: Legal / CISO

- [ ] **Cloudflare** — Execute DPA; download and retain SOC 2 Type 2 report
- [ ] **Supabase** — Execute DPA; download and retain SOC 2 Type 2 report
- [ ] **Fly.io** — Execute DPA; obtain current compliance status / SOC 2 report
- [ ] **Vercel** — Execute DPA; download and retain SOC 2 Type 2 report
- [ ] **Tailscale** — Execute DPA; download and retain SOC 2 Type 2 report
- [ ] Complete Vendor Security Questionnaire for each Tier 1 vendor
- [ ] File all agreements in `docs/soc2/vendor-agreements/`

---

### RM-016 · CC1.1 / CC5.3 — Code of Conduct + Policy Portal
**Status**: `[ ] Open`  
**Effort**: 2 days  
**Owner**: CISO

- [ ] Draft Code of Conduct document covering: ethics, conflicts of interest, acceptable use, confidentiality obligations
- [ ] Publish all `docs/soc2/policies/` in an internal wiki/Confluence page accessible to all staff
- [ ] Implement annual staff acknowledgment workflow (Google Form or equivalent); retain records
- [ ] Add Code of Conduct acceptance step to employee onboarding checklist

---

### RM-017 · CC1.3 — Org Chart and Authority Matrix
**Status**: `[ ] Open`  
**Effort**: 1 day  
**Owner**: CISO

- [ ] Publish org chart in `docs/soc2/GOVERNANCE.md`
- [ ] Document who can approve: production deployments, policy changes, risk acceptance, vendor contracts, incident escalation
- [ ] Link to RACI matrix for SOC 2 control ownership

---

### RM-018 · CC1.4 / CC2.2 — Security Awareness Training
**Status**: `[ ] Open`  
**Effort**: 1 day setup  
**Owner**: ISSO

- [ ] Enrol team in Haekka free-tier security awareness training (or Scytale SOC 2 masterclass)
- [ ] Configure phishing simulation (annually)
- [ ] Track completion per employee; retain records for 3 years
- [ ] Add training completion as an onboarding gate

---

### RM-019 · CC1.5 — RACI and Accountability Framework
**Status**: `[ ] Open`  
**Effort**: 1 day  
**Owner**: ISSO

- [ ] Create RACI matrix mapping each SOC 2 criterion to Responsible / Accountable / Consulted / Informed
- [ ] Implement quarterly manager attestation: each control owner confirms their control is operating
- [ ] File completed attestations as quarterly evidence

---

### RM-020 · CC2.3 — External Communication Templates
**Status**: `[ ] Open`  
**Effort**: 1 day  
**Owner**: CISO

- [ ] Draft customer incident notification template (P1: within 72 h; P2: within 1 week)
- [ ] Define notification SLA commitments in customer-facing Terms of Service
- [ ] Add notification step to `docs/soc2/policies/INCIDENT_RESPONSE_PLAN.md` §5

---

### RM-021 · CC3.1 — Formal Security Objectives
**Status**: `[ ] Open`  
**Effort**: 0.5 days  
**Owner**: CISO

- [ ] Write a one-page Information Security Objectives statement (confidentiality, integrity, availability, PQC posture)
- [ ] Obtain CISO sign-off; link to risk register
- [ ] Review annually alongside risk assessment

---

### RM-022 · CC3.4 — Change-Impact Risk Review
**Status**: `[ ] Open`  
**Effort**: 0.5 days  
**Owner**: Engineering Lead

- [ ] Add a "Security Impact" section to the PR template in `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] Define trigger criteria for full risk re-assessment: new external API, auth changes, data model changes, new vendor
- [ ] Document in `docs/soc2/policies/CHANGE_MANAGEMENT_POLICY.md` §6

---

### RM-023 · CC4.2 — Deficiency Tracking Register
**Status**: `[ ] Open`  
**Effort**: 1 day  
**Owner**: ISSO

- [ ] Create GitHub Project board: columns = Open / In Remediation / Verify / Closed
- [ ] Define SLAs by severity: Critical 7 d, High 30 d, Medium 90 d, Low 180 d
- [ ] Require issue owner to add close-out comment with evidence link
- [ ] Import all current audit gaps as tracked issues

---

### RM-024 · CC5.1 — Control Selection Documentation
**Status**: `[ ] Open`  
**Effort**: 1 day  
**Owner**: CISO

- [ ] Write control-selection rationale document: for each implemented control, why it was selected and which risks it mitigates
- [ ] Link rationale to the risk register entries from RM-008

---

### RM-025 · CC6.4 — Inherited Physical Access Controls
**Status**: `[ ] Open`  
**Effort**: 1 day  
**Owner**: ISSO

- [ ] Download Cloudflare SOC 2 Type 2 report; extract physical security section; document as inherited control
- [ ] Download Fly.io compliance documentation; document inherited controls
- [ ] Create `docs/soc2/INHERITED_CONTROLS.md` mapping each vendor's physical controls to CC6.4

---

### RM-026 · CC6.8 — EDR / Antivirus on Endpoints
**Status**: `[ ] Open`  
**Effort**: 2 days  
**Owner**: Engineering

- [ ] Deploy ClamAV (free) or equivalent to all developer endpoints
- [ ] Add ClamAV scan step to CI/CD pipeline: scan build artifacts before deploy
- [ ] Integrate scan results into DAG audit trail via `pkg/fim/dag_integration.go`
- [ ] Define malware response runbook: detect → isolate → notify ISSO

---

### RM-027 · CC7.3 — Incident Escalation Runbooks
**Status**: `[ ] Open`  
**Effort**: 1 day  
**Owner**: ISSO

- [ ] Write escalation runbooks for each severity tier (P1–P4) in `docs/soc2/policies/INCIDENT_RESPONSE_PLAN.md` §4
- [ ] Define response-time SLAs: P1 = 1 h response / 4 h contain; P2 = 4 h / 24 h; P3 = 24 h / 72 h; P4 = 72 h
- [ ] Link runbooks to `pkg/ir/types.go` severity constants

---

### RM-028 · CC7.5 / A1.2 — RTO/RPO + Backup Automation
**Status**: `[ ] Open`  
**Effort**: 2 days  
**Owner**: Engineering

- [ ] Define and document RTO = 4 h, RPO = 24 h in BCP (RM-012)
- [ ] Automate daily backup schedule in `pkg/drbc/supabase_storage_sync.go` (cron or Fly.io scheduled machine)
- [ ] Add backup-success/failure notification to Alertmanager
- [ ] Schedule and execute quarterly restore test; retain results

---

### RM-029 · CC9.1 — BCP/DRP Document
**Status**: `[ ] Open`  
**Effort**: 2 days  
**Owner**: CISO

- [ ] Draft `docs/soc2/policies/BUSINESS_CONTINUITY_PLAN.md`:
  - Business impact analysis (which systems are critical)
  - RTO/RPO per system
  - Recovery procedures using `pkg/drbc/`
  - Communication plan
  - Roles and responsibilities
- [ ] Obtain CISO sign-off
- [ ] Link to RM-012 recovery test results

---

### RM-030 · A1.1 — Capacity Management
**Status**: `[ ] Open`  
**Effort**: 1 day  
**Owner**: Engineering

- [ ] Define capacity thresholds in `prometheus.yml`: CPU > 80 %, memory > 85 %, disk > 90 %
- [ ] Add auto-scaling rule or runbook to Fly.io config (`fly.toml`): increase min_machines on load alert
- [ ] Document quarterly capacity review process
- [ ] Add capacity metrics to Grafana dashboard

---

### RM-031 · C1.1 — Data Classification
**Status**: `[ ] Open`  
**Effort**: 2 days  
**Owner**: CISO

- [ ] Define data classification taxonomy:
  - **SECRET**: PQC private keys, master seeds, DoD CUI
  - **CONFIDENTIAL**: Customer PII, API tokens, license keys
  - **INTERNAL**: Audit logs, scan results, compliance reports
  - **PUBLIC**: Documentation, OSS code
- [ ] Apply labels to all data assets in inventory
- [ ] Map classification to encryption and access control requirements
- [ ] Document in `docs/soc2/DATA_CLASSIFICATION.md`

---

### RM-032 · CC5.3 / CC1.4 — Competency Framework
**Status**: `[ ] Open`  
**Effort**: 1 day  
**Owner**: CISO

- [ ] Define competency requirements per role (Engineer, ISSO, Operator, Admin)
- [ ] Link competency requirements to hiring criteria and performance reviews
- [ ] Track training completion per competency requirement

---

### RM-033 · PI1.1 / PI1.2 / PI1.3 / PI1.5 — Processing Integrity Controls
**Status**: `[ ] Open`  
**Effort**: 3 days  
**Owner**: Engineering

- [ ] Add JSON schema validation to all public API endpoints in `pkg/apiserver/handlers.go`
- [ ] Add SHA-256 checksums to all compliance scan outputs before storage
- [ ] Verify DAG PQC signing (`pkg/dag/`) is called at every processing stage in compliance pipelines
- [ ] Define data retention schedule: compliance data = 3 years, audit logs = 1 year hot / 3 years cold
- [ ] Add integration tests for input boundary conditions and output completeness

---

## Evidence Filing Locations

All remediation evidence must be stored in:

```
docs/soc2/evidence/
  CC6.1/   - MFA enforcement screenshots
  CC6.2/   - Access provisioning approval records
  CC6.3/   - Quarterly access review reports
  CC6.6/   - Network topology diagram, WAF rule export
  CC7.4/   - IRP document, table-top results
  CC8.1/   - Branch protection screenshot, PR approval records
  CC3.2/   - Risk assessment report
  CC9.2/   - Executed vendor DPAs, SOC 2 reports
  A1.2/    - Backup restoration test results
```

Collect evidence programmatically using the KHEPRA evidence API:

```go
ec := soc2.NewEvidenceCollector()
ev := ec.Add("CC6.1", soc2.EvidenceConfiguration,
    "MFA Enforcement — Cloudflare Access",
    "Screenshot confirming MFA required for all admin routes",
    "isso@nouchix.com", screenshotBytes)
```

---

## Progress Tracker

| ID | Criterion | Priority | Status | Owner | Target Date |
|----|-----------|----------|--------|-------|------------|
| RM-001 | CC6.1 / CC5.2 | HIGH | `[ ]` | Engineering | Week 1 |
| RM-002 | CC4.1 / CC7.2 | HIGH | `[ ]` | Engineering | Week 1 |
| RM-003 | CC8.1 | HIGH | `[ ]` | Eng Lead | Week 1 |
| RM-004 | CC6.2 | HIGH | `[ ]` | ISSO | Week 2 |
| RM-005 | CC6.3 | HIGH | `[ ]` | ISSO | Week 2 |
| RM-006 | CC6.6 | HIGH | `[ ]` | Engineering | Week 2 |
| RM-007 | CC7.4 | HIGH | `[ ]` | ISSO | Week 4 |
| RM-008 | CC3.2 | HIGH | `[ ]` | ISSO | Week 4 |
| RM-009 | CC1.2 | MEDIUM | `[ ]` | CISO | Week 6 |
| RM-010 | CC3.3 | MEDIUM | `[ ]` | ISSO | Week 4 |
| RM-011 | CC6.5 | MEDIUM | `[ ]` | Engineering | Week 5 |
| RM-012 | A1.3 | MEDIUM | `[ ]` | CISO + Eng | Week 6 |
| RM-013 | PI1.4 | MEDIUM | `[ ]` | Engineering | Week 7 |
| RM-014 | C1.2 | MEDIUM | `[ ]` | Engineering | Week 7 |
| RM-015 | CC9.2 | LOW | `[ ]` | Legal / CISO | Week 8 |
| RM-016 | CC1.1 / CC5.3 | LOW | `[ ]` | CISO | Week 6 |
| RM-017 | CC1.3 | LOW | `[ ]` | CISO | Week 6 |
| RM-018 | CC1.4 / CC2.2 | LOW | `[ ]` | ISSO | Week 6 |
| RM-019 | CC1.5 | LOW | `[ ]` | ISSO | Week 7 |
| RM-020 | CC2.3 | LOW | `[ ]` | CISO | Week 7 |
| RM-021 | CC3.1 | LOW | `[ ]` | CISO | Week 5 |
| RM-022 | CC3.4 | LOW | `[ ]` | Eng Lead | Week 3 |
| RM-023 | CC4.2 | LOW | `[ ]` | ISSO | Week 3 |
| RM-024 | CC5.1 | LOW | `[ ]` | CISO | Week 8 |
| RM-025 | CC6.4 | LOW | `[ ]` | ISSO | Week 7 |
| RM-026 | CC6.8 | LOW | `[ ]` | Engineering | Week 8 |
| RM-027 | CC7.3 | LOW | `[ ]` | ISSO | Week 4 |
| RM-028 | CC7.5 / A1.2 | LOW | `[ ]` | Engineering | Week 6 |
| RM-029 | CC9.1 | LOW | `[ ]` | CISO | Week 8 |
| RM-030 | A1.1 | LOW | `[ ]` | Engineering | Week 7 |
| RM-031 | C1.1 | LOW | `[ ]` | CISO | Week 9 |
| RM-032 | CC5.3 / CC1.4 | LOW | `[ ]` | CISO | Week 9 |
| RM-033 | PI1.1–PI1.5 | LOW | `[ ]` | Engineering | Week 10 |
