# GovCloud compliance program (governance + technical checks)

This document complements **`govcloud_validation`**: it is the **human and organizational** half of assurance. Automated checks in this repository are **supplementary technical signals** only. They do **not** satisfy CMMC, NIST 800-171, FedRAMP, or other frameworks without a full **system security program**, **assessor review**, and **organizational evidence**.

---

## 1. What the validator is (and is not)

| Role | Description |
|------|-------------|
| **Is** | Runbook-aligned, API-based **drift and presence** checks (SKIP / WARN / PASS). Optional comparison to expected values via `GOVCLOUD_*` environment variables. |
| **Is not** | A control assessor, a penetration test, a full Security Hub / Config ruleset, or proof that policies are **effective** (only that certain APIs returned certain states at run time). |

**Machine-readable mapping:** see `govcloud_validation/compliance_matrix.yaml` (check id → indicative NIST 800-171 rev2 / CMMC Level 2 references). That file includes `coverage` (`partial`, `point_in_time`, `configuration`) and `assessor_notes` so you do not over-claim automation.

---

## 2. System boundaries (template)

Document boundaries **before** you treat validator output as meaningful for audit.

1. **CUI / sensitive data boundary**  
   - What data types enter the system (e.g. CUI categories, metadata only, PHI, etc.)?  
   - Where is data **created, stored, processed, and destroyed** (accounts, regions, VPCs, SaaS)?  
   - What is **in scope** vs **out of scope** for the assessment (explicit list).

2. **Trust zones**  
   - GovCloud accounts and OUs (management, workloads, security, log-archive, audit).  
   - On-prem or other clouds that exchange data with GovCloud (connection type, encryption, identity).

3. **User and non-person entities**  
   - IAM Identity Center permission sets, break-glass, automation roles, CI/CD principals.  
   - Which identities may access CUI and under what conditions (US-person rules, ABAC tags, etc.).

4. **Data flows**  
   - Diagram or table: source → enclave/API → storage → logging/monitoring → backup/evidence.  
   - Note all **egress** paths and how they are controlled (SCP, RCP, firewall, proxy).

5. **Shared responsibility**  
   - Which controls are **AWS inherited**, **hybrid**, or **customer-unique** in your SSP narrative.

Keep the **authoritative** boundary description in your **controlled SSP / CRM**; the repo should only hold **non-sensitive** summaries if needed for engineering.

---

## 3. SSP (System Security Plan) alignment

Typical SSP sections map to evidence types:

| SSP topic | Organizational evidence (examples) | Technical signal from `govcloud_validation` |
|-----------|--------------------------------------|---------------------------------------------|
| Access control | Account management policy, onboarding/offboarding, RBAC/ABAC design | IDC / permission set checks, optional expected ids |
| Identification & authentication | MFA policy, session length, SSO config | Permission set metadata (partial) |
| Audit & accountability | Logging standard, retention, review process | CloudTrail / Config checks (configuration) |
| Configuration management | Baseline, change control | Config recorder, SCP names (partial) |
| Risk assessment | RA cadence, outputs | Security Hub count (weak signal only) |
| System & communications protection | Network segmentation, encryption | VPC checks, bucket encryption, KMS aliases (partial) |

**Gap to avoid:** copying PASS/WARN into an SSP as “control satisfied.” Instead, record **what was tested**, **when**, **by whom**, **scope** (account/region/role), and **assessor judgment** (below).

---

## 4. Policies and procedures (minimum set)

Policies state **what** must be true; procedures state **how** staff do it. Assessors expect both to be **consistent** with the SSP and **operated** (not shelf-ware).

**Examples to maintain internally:**

- Access control and least privilege (including CUI / US-person rules).  
- Change and release management (including IaC and emergency changes).  
- Logging, monitoring, and security incident response.  
- Backup, recovery, and evidence / retention (aligned with Object Lock and legal hold).  
- Vendor / third-party and supply chain (if applicable).  
- Acceptable use and personnel screening (as required by your level).

**Validator relationship:** procedures should define **who runs** `govcloud_validation`, **how often**, **with which role**, and **where reports are stored** (protected, access-controlled).

---

## 5. Sampling and testing strategy

Automated checks are **one sample** at **one time** from **one principal**.

1. **Population vs sample**  
   - Define the **population** (e.g. all production accounts in scope, all S3 buckets holding CUI).  
   - Automated tools usually sample **one account/region/session** unless you orchestrate multiple runs.

2. **Sampling for assessors**  
   - Follow your **assessment plan**: random or risk-based selection of users, changes, tickets, logs.  
   - Keep **screenshots, exports, and tickets** with dates and scope; redact for distribution.

3. **Regression and cadence**  
   - **CI/CD:** run selected stages on a **non-production** role with read-only where possible; do not publish raw reports to public artifacts.  
   - **Production:** periodic run from a **break-glass or security** role per procedure, with stored evidence.

4. **Independence**  
   - Prefer **separate** evidence collection for audits (security team vs engineering) where policy requires it.

---

## 6. Assessor judgment

Assessors evaluate **implementation** and **effectiveness**, not tool output alone.

Provide them:

- **Scope statement** (boundaries above).  
- **Architecture and data flow** artifacts.  
- **Policy / procedure** references and version dates.  
- **Samples** of tickets, log reviews, access reviews, training records (as applicable).  
- **Raw or summarized** validator JSON with: timestamp, `AWS_REGION`, principal (role) used, and list of **SKIP** checks (explained: intentional vs not yet configured).

**Interpretation guide:**

- **PASS** — API state matched the check’s narrow definition at run time.  
- **WARN** — degraded, denied, or ambiguous; needs human triage (may still be acceptable with compensating controls).  
- **SKIP** — prerequisite env or permission missing; **not** “not applicable” unless your assessor agrees.  
- **FAIL** — explicit mismatch (e.g. expected SCP name missing); treat as finding until remediated or formally accepted.

---

## 7. Continuous improvement

- Review `compliance_matrix.yaml` when you add checks or change control intent.  
- Reconcile **Security Hub / Config findings** with validator results; they often overlap but are not identical.  
- Track **POA&M** items for WARN/FAIL that are accepted as residual risk.

---

## 8. Related files

| File | Purpose |
|------|---------|
| `govcloud_validation/compliance_matrix.yaml` | Check id → framework references, coverage, assessor notes |
| `govcloud_validation/README.md` | How to run the CLI and set `GOVCLOUD_*` variables |
| `docs/govcloud/SECRED_GOVCLOUD_DEPLOYMENT_REFERENCE.md` | Template for mapping internal inventory to env vars (no live ids in git) |
