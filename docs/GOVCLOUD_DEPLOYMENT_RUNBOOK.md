# AdinKhepra Protocol - GovCloud Deployment Runbook v1

## FastAPI + Aurora PostgreSQL | Region: us-gov-west-1

---

| Field | Value |
|-------|-------|
| **Document Type** | Infrastructure Deployment Runbook with Implementation Tracking |
| **System** | AdinKhepra Protocol (Giza Cyber Shield) |
| **Target Environment** | AWS GovCloud (us-gov-west-1) |
| **Architecture** | FastAPI + Aurora PostgreSQL + EKS/Fargate |
| **Current Deployment** | Fly.io (backend) + Vercel (frontend) |
| **Migration Status** | PRE-DEPLOYMENT |
| **Owner** | SouHimBou AI / EtherVerseCodeMate / UrGenCyX |
| **Created** | 2026-02-03 |
| **Last Updated** | 2026-02-03 |
| **Classification** | CUI // SP-CMMC |

---

## Document Purpose

This runbook defines the step-by-step deployment procedure for migrating the AdinKhepra Protocol from the current Fly.io/Vercel deployment to AWS GovCloud (us-gov-west-1). Each step includes implementation tracking checkboxes, evidence requirements, and CMMC control mappings.

**Current State:** Fly.io (backend) + Vercel (frontend) - No FedRAMP authorization
**Target State:** AWS GovCloud (FedRAMP High P-ATO) - Full CMMC L1 infrastructure compliance

---

## Implementation Progress Tracker

| Phase | Description | Status | Steps Complete |
|-------|-------------|--------|----------------|
| Phase 0 | Pre-Reqs - Account Pairing | NOT STARTED | 0/3 |
| Phase 1 | Landing Zone - Organizations & OUs | NOT STARTED | 0/3 |
| Phase 2 | Root Hygiene & Guardrails | NOT STARTED | 0/7 |
| Phase 3 | Centralized Logging & Immutable Evidence | NOT STARTED | 0/5 |
| Phase 4 | Networking Baseline | NOT STARTED | 0/5 |
| Phase 5 | Data Layer - Aurora PostgreSQL | NOT STARTED | 0/5 |
| Phase 6 | Compute - EKS (or Fargate) | NOT STARTED | 0/5 |
| Phase 7 | Identity - Cognito & Identity Center | NOT STARTED | 0/4 |
| Phase 8 | Secrets, Keys & Crypto | NOT STARTED | 0/4 |
| Phase 9 | Secure Enclave API (CUI Boundary) | NOT STARTED | 0/5 |
| Phase 10 | SDLC - Evidence-First | NOT STARTED | 0/4 |
| Phase 11 | First Smoke Test | NOT STARTED | 0/4 |
| Phase 12 | C3PAO Evidence Binder | NOT STARTED | 0/4 |

**Overall Progress: 0/58 steps complete**

---

## Phase 0: Pre-Reqs - Account Pairing

**CMMC Relevance:** Foundation for all inherited FedRAMP controls (PE, SC, SI domains)
**Dependency:** None - this is the entry point
**Blocks:** All subsequent phases

| # | Task | Status | Evidence Required | Notes |
|---|------|--------|------------------|-------|
| 0.1 | [ ] Ensure you control a standard AWS account (commercial) and request AWS GovCloud (US) access | NOT DONE | Account ID screenshot, GovCloud access request confirmation | Submit via AWS Support or TAM |
| 0.2 | [ ] Link the commercial account to GovCloud account (mandatory pairing) | NOT DONE | Account pairing confirmation email/console screenshot | Cannot be undone - verify account details before linking |
| 0.3 | [ ] Identify which users are US-persons and enforce US-persons-only access to CUI workloads | NOT DONE | US-persons attestation document, access roster | ITAR/EAR compliance requirement - document each user's citizenship status |

### Phase 0 Evidence Artifacts
```
evidence/phase-0/
  |- commercial_account_id.png
  |- govcloud_access_request.pdf
  |- account_pairing_confirmation.png
  |- us_persons_attestation.pdf
  |- access_roster.xlsx
```

---

## Phase 1: Landing Zone - Organizations & OUs

**CMMC Relevance:** AC.L1-B.1.I (authorized access), SC.L1-B.1.XI (system separation)
**Dependency:** Phase 0 complete
**Blocks:** Phase 2, 3, 4

| # | Task | Status | Evidence Required | Notes |
|---|------|--------|------------------|-------|
| 1.1 | [ ] Create AWS Organizations in GovCloud | NOT DONE | Organizations console screenshot showing GovCloud org | Root account in GovCloud |
| 1.2 | [ ] Set up Organizational Units (OUs) | NOT DONE | OU hierarchy screenshot | Structure below |
| 1.3 | [ ] Consider Control Tower (GovCloud) for baseline guardrails | NOT DONE | Control Tower dashboard or decision document if not using | Optional but recommended |

### OU Structure
```
Root
 +-- Security OU
 |    +-- Log Archive (account)
 |    +-- Audit (account)
 +-- Workloads OU
      +-- Non-Prod (account)
      +-- Prod (account)
```

### Phase 1 Evidence Artifacts
```
evidence/phase-1/
  |- organizations_hierarchy.png
  |- ou_structure.png
  |- control_tower_dashboard.png (if applicable)
  |- control_tower_decision.md (if not using)
```

---

## Phase 2: Root Hygiene & Guardrails

**CMMC Relevance:** AC.L1-B.1.I, AC.L1-B.1.II, IA.L1-B.1.V, IA.L1-B.1.VI
**Dependency:** Phase 1 complete
**Blocks:** Phase 3, 4

| # | Task | Status | Evidence Required | Notes |
|---|------|--------|------------------|-------|
| 2.1 | [ ] Root accounts: enable MFA on all root accounts | NOT DONE | MFA status screenshot per account | Hardware MFA preferred (YubiKey) |
| 2.2 | [ ] Root accounts: remove/disable all access keys | NOT DONE | IAM credential report showing no root access keys | Run `aws iam generate-credential-report` |
| 2.3 | [ ] Create break-glass user with MFA | NOT DONE | Break-glass user IAM config, MFA enabled screenshot | Store credentials in physical safe, document access procedure |
| 2.4 | [ ] IAM Identity Center (SSO) for workforce | NOT DONE | Identity Center configuration screenshot, permission sets | Least-privilege permission sets per role |
| 2.5 | [ ] SCP: Deny non-Gov regions (allow only us-gov-west-1 / us-gov-east-1) | NOT DONE | SCP JSON policy document | See policy template below |
| 2.6 | [ ] SCP: Deny S3 public access + Force TLS (`aws:SecureTransport = true`) | NOT DONE | SCP JSON policy document | Applies org-wide |
| 2.7 | [ ] SCP: Deny disabling CloudTrail / Config / GuardDuty | NOT DONE | SCP JSON policy document | Prevents security control tampering |

### SCP Templates

#### Deny Non-GovCloud Regions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyNonGovRegions",
      "Effect": "Deny",
      "NotAction": [
        "iam:*",
        "sts:*",
        "organizations:*",
        "support:*"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:RequestedRegion": [
            "us-gov-west-1",
            "us-gov-east-1"
          ]
        }
      }
    }
  ]
}
```

#### Deny S3 Public Access + Force TLS
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyS3PublicAccess",
      "Effect": "Deny",
      "Action": "s3:PutBucketPublicAccessBlock",
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "s3:PublicAccessBlockConfiguration/BlockPublicAcls": "true"
        }
      }
    },
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Action": "s3:*",
      "Resource": "*",
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
```

#### Deny Disabling Security Services
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyDisableSecurityServices",
      "Effect": "Deny",
      "Action": [
        "cloudtrail:StopLogging",
        "cloudtrail:DeleteTrail",
        "config:StopConfigurationRecorder",
        "config:DeleteConfigurationRecorder",
        "guardduty:DeleteDetector",
        "guardduty:DisassociateFromMasterAccount"
      ],
      "Resource": "*"
    }
  ]
}
```

### Phase 2 Evidence Artifacts
```
evidence/phase-2/
  |- root_mfa_status_per_account.png
  |- credential_report_no_root_keys.csv
  |- break_glass_procedure.pdf
  |- identity_center_config.png
  |- permission_sets.json
  |- scp_deny_non_gov_regions.json
  |- scp_deny_s3_public_force_tls.json
  |- scp_deny_disable_security.json
```

---

## Phase 3: Centralized Logging & Immutable Evidence

**CMMC Relevance:** SI.L1-B.1.XII (flaw remediation), SI.L1-B.1.XV (system scanning), SC.L1-B.1.X (boundary protection)
**Dependency:** Phase 1, 2 complete
**Blocks:** Phase 11 (smoke test validation)
**Maps to Terraform:** `deploy/govcloud/terraform/audit.tf`

| # | Task | Status | Evidence Required | Notes |
|---|------|--------|------------------|-------|
| 3.1 | [ ] In Log Archive account, create S3 buckets with Object Lock, versioning, and SSE-KMS | NOT DONE | S3 bucket config screenshot showing Object Lock + versioning + KMS | Immutable audit trail - WORM compliance |
| 3.2 | [ ] Enable org-level CloudTrail logging to log bucket | NOT DONE | CloudTrail console showing org trail active + S3 destination | `audit.tf` lines 167-200 |
| 3.3 | [ ] Enable AWS Config (aggregator) + conformance pack | NOT DONE | Config aggregator dashboard + conformance pack results | `audit.tf` lines 424-470 |
| 3.4 | [ ] Enable GuardDuty (org-level) | NOT DONE | GuardDuty detector status across all accounts | `audit.tf` lines 366-393 |
| 3.5 | [ ] Enable VPC Flow Logs + ALB/NLB access logs to log bucket | NOT DONE | Flow Log configuration + log group screenshot | `audit.tf` lines 292-315 |

### Terraform Validation
```bash
# After applying audit.tf, verify:
aws cloudtrail describe-trails --region us-gov-west-1
aws configservice describe-configuration-recorders --region us-gov-west-1
aws guardduty list-detectors --region us-gov-west-1
aws ec2 describe-flow-logs --region us-gov-west-1
```

### Phase 3 Evidence Artifacts
```
evidence/phase-3/
  |- s3_log_bucket_config.png          (Object Lock, versioning, KMS)
  |- cloudtrail_org_trail.png          (active trail, S3 destination)
  |- aws_config_aggregator.png         (aggregator status)
  |- conformance_pack_results.json     (compliance status)
  |- guardduty_org_status.png          (detector active all accounts)
  |- vpc_flow_logs_config.png          (flow log ID, destination)
  |- alb_access_logs_config.png        (ALB logging enabled)
```

---

## Phase 4: Networking Baseline (per Workloads Account)

**CMMC Relevance:** SC.L1-B.1.X (boundary protection), SC.L1-B.1.XI (public-access separation), AC.L1-B.1.III (external connections)
**Dependency:** Phase 1, 2 complete
**Blocks:** Phase 5, 6, 9

| # | Task | Status | Evidence Required | Notes |
|---|------|--------|------------------|-------|
| 4.1 | [ ] Create VPC with private subnets only for compute; isolated subnets for DB | NOT DONE | VPC diagram, subnet table with CIDR ranges | No public subnets for compute/DB |
| 4.2 | [ ] No direct Internet egress from app subnets; use egress firewall or none | NOT DONE | Route table screenshot showing no IGW routes for private subnets | Air-gapped by default |
| 4.3 | [ ] Add VPC Endpoints (S3, STS, ECR, Logs, KMS, Secrets Manager) - prefer FIPS endpoints | NOT DONE | VPC Endpoints list screenshot | Use `*.fips.us-gov-west-1.amazonaws.com` |
| 4.4 | [ ] Public ALB only if needed; protect with AWS WAF | NOT DONE | ALB config + WAF WebACL association | Only for public API edge |
| 4.5 | [ ] Strict Security Groups and NACLs | NOT DONE | SG rules export, NACL rules export | Deny-all default, allow-list only |

### Network Architecture
```
                    INTERNET
                       |
                  +----+----+
                  | AWS WAF |
                  +----+----+
                       |
              +--------+--------+
              | Public ALB      |
              | (us-gov-west-1) |
              +--------+--------+
                       |
         +-------------+-------------+
         |                           |
  +------+------+           +-------+-------+
  | Private     |           | Private       |
  | App Subnet  |           | App Subnet    |
  | (AZ-a)      |           | (AZ-b)        |
  | EKS/Fargate |           | EKS/Fargate   |
  +------+------+           +-------+-------+
         |                           |
  +------+------+           +-------+-------+
  | Isolated    |           | Isolated      |
  | DB Subnet   |           | DB Subnet     |
  | (AZ-a)      |           | (AZ-b)        |
  | Aurora PG   |           | Aurora PG     |
  +-------------+           +---------------+

  VPC Endpoints: S3, STS, ECR, CloudWatch Logs,
                 KMS, Secrets Manager (FIPS)
```

### FIPS Endpoints Reference
| Service | FIPS Endpoint |
|---------|--------------|
| S3 | `s3-fips.us-gov-west-1.amazonaws.com` |
| STS | `sts.us-gov-west-1.amazonaws.com` (FIPS by default) |
| ECR | `ecr-fips.us-gov-west-1.amazonaws.com` |
| KMS | `kms-fips.us-gov-west-1.amazonaws.com` |
| Secrets Manager | `secretsmanager-fips.us-gov-west-1.amazonaws.com` |
| CloudWatch Logs | `logs.us-gov-west-1.amazonaws.com` |

### Phase 4 Evidence Artifacts
```
evidence/phase-4/
  |- vpc_architecture_diagram.png
  |- subnet_table.md                   (CIDR, AZ, type)
  |- route_tables.png                  (no IGW for private)
  |- vpc_endpoints_list.png            (FIPS endpoints)
  |- waf_webacl_config.json
  |- security_groups_export.json
  |- nacl_rules_export.json
```

---

## Phase 5: Data Layer - Aurora PostgreSQL

**CMMC Relevance:** SC.L1-B.1.X (boundary protection), AC.L1-B.1.I (authorized access), MP.L1-B.1.VII (media sanitization via KMS)
**Dependency:** Phase 4 complete
**Blocks:** Phase 9, 11

| # | Task | Status | Evidence Required | Notes |
|---|------|--------|------------------|-------|
| 5.1 | [ ] Aurora PostgreSQL cluster (Multi-AZ where available) | NOT DONE | Cluster config screenshot, Multi-AZ status | Engine version, instance class documented |
| 5.2 | [ ] Enable pgAudit extension | NOT DONE | `SHOW shared_preload_libraries` output showing pgaudit | Audit all DDL + DML on CUI tables |
| 5.3 | [ ] Harden parameter group (force SSL, strong logging); encryption via KMS CMK | NOT DONE | Parameter group diff from default, KMS key ARN | `rds.force_ssl = 1`, `log_statement = 'all'` |
| 5.4 | [ ] DB admin only via bastion in admin subnet; engine logs to CloudWatch | NOT DONE | Bastion SG rules, CloudWatch log group screenshot | No public DB endpoint |
| 5.5 | [ ] S3 for evidence (SSP/POA&M) with Object Lock for immutable audit | NOT DONE | S3 bucket policy, Object Lock config | WORM compliance for audit artifacts |

### Aurora Parameter Group Hardening
```
rds.force_ssl = 1
log_statement = 'all'
log_min_duration_statement = 0
shared_preload_libraries = 'pgaudit'
pgaudit.log = 'all'
pgaudit.log_catalog = 'on'
pgaudit.log_relation = 'on'
pgaudit.log_statement_once = 'on'
password_encryption = 'scram-sha-256'
ssl_min_protocol_version = 'TLSv1.2'
```

### Phase 5 Evidence Artifacts
```
evidence/phase-5/
  |- aurora_cluster_config.png         (Multi-AZ, encryption, engine version)
  |- pgaudit_enabled.txt               (SHOW shared_preload_libraries output)
  |- parameter_group_hardened.json     (diff from default)
  |- kms_cmk_arn.txt                   (KMS key for DB encryption)
  |- bastion_sg_rules.png              (admin-only access path)
  |- cloudwatch_db_logs.png            (engine logs flowing)
  |- evidence_bucket_object_lock.png   (WORM config)
```

---

## Phase 6: Compute - EKS (or Fargate)

**CMMC Relevance:** AC.L1-B.1.I (authorized access), SI.L1-B.1.XIII (malicious code), SI.L1-B.1.XV (scanning)
**Dependency:** Phase 4 complete
**Blocks:** Phase 9, 10, 11

| # | Task | Status | Evidence Required | Notes |
|---|------|--------|------------------|-------|
| 6.1 | [ ] EKS cluster with Bottlerocket or hardened AMIs; private cluster endpoint | NOT DONE | EKS cluster config, endpoint access screenshot | No public API server endpoint |
| 6.2 | [ ] Use IRSA (IAM roles for service accounts) | NOT DONE | IRSA config, service account annotations | No long-lived credentials in pods |
| 6.3 | [ ] Pod Security Standards; admission controls | NOT DONE | PodSecurityPolicy or PSS config, OPA/Kyverno policies | Restrict privileged containers |
| 6.4 | [ ] Images from ECR Gov; image scanning enabled | NOT DONE | ECR repo config, scan-on-push enabled screenshot | No public registry pulls |
| 6.5 | [ ] EKS audit logs to CloudWatch | NOT DONE | EKS logging configuration screenshot | api, audit, authenticator, controllerManager, scheduler |

### Phase 6 Evidence Artifacts
```
evidence/phase-6/
  |- eks_cluster_config.png            (private endpoint, Bottlerocket)
  |- irsa_service_accounts.yaml        (IRSA annotations)
  |- pod_security_standards.yaml       (PSS/PSP config)
  |- ecr_scan_on_push.png              (scanning enabled)
  |- eks_audit_logs_cloudwatch.png     (all log types enabled)
```

---

## Phase 7: Identity - Cognito (App Users) & Identity Center (Admins)

**CMMC Relevance:** IA.L1-B.1.V (identification), IA.L1-B.1.VI (authentication), AC.L1-B.1.I (authorized access)
**Dependency:** Phase 2 (Identity Center), Phase 6 (compute for Cognito integration)
**Blocks:** Phase 9

| # | Task | Status | Evidence Required | Notes |
|---|------|--------|------------------|-------|
| 7.1 | [ ] Cognito User Pool for application end-users | NOT DONE | User Pool config screenshot | App-level authentication |
| 7.2 | [ ] MFA and password policy enforced on Cognito | NOT DONE | MFA config + password policy screenshot | MFA required, not optional |
| 7.3 | [ ] IAM Identity Center for admin access | NOT DONE | Identity Center config, user/group assignments | Already started in Phase 2.4 |
| 7.4 | [ ] MFA enforced on Identity Center; fine-grained permissions by account/role | NOT DONE | MFA policy screenshot, permission set assignments | Map to RBAC roles in `pkg/auth/provider.go` |

### Identity Architecture Mapping
```
+-------------------+     +----------------------+
| APPLICATION USERS | --> | Cognito User Pool    |
| (end-users)       |     | MFA enforced         |
+-------------------+     | Password policy      |
                          | Short-lived tokens   |
                          +----------+-----------+
                                     |
                                     v
                          +----------+-----------+
                          | AdinKhepra Gateway   |
                          | layer2_auth.go       |
                          | JWT validation (0.8) |
                          +----------------------+

+-------------------+     +----------------------+
| ADMINISTRATORS    | --> | IAM Identity Center  |
| (ops/security)    |     | MFA enforced         |
+-------------------+     | Permission sets:     |
                          |  - Admin             |
                          |  - SecurityEngineer  |
                          |  - ComplianceOfficer |
                          |  - Operator          |
                          |  - Viewer            |
                          +----------------------+
```

### Phase 7 Evidence Artifacts
```
evidence/phase-7/
  |- cognito_user_pool_config.png      (MFA, password policy)
  |- cognito_mfa_required.png          (MFA = REQUIRED not OPTIONAL)
  |- identity_center_config.png        (SSO setup)
  |- identity_center_mfa_policy.png    (MFA enforced)
  |- permission_set_assignments.json   (role-to-account mapping)
```

---

## Phase 8: Secrets, Keys & Crypto

**CMMC Relevance:** SC.L1-B.1.X (boundary protection - encryption), MP.L1-B.1.VII (media sanitization via crypto-shredding), AC.L1-B.1.IV (public info control)
**Dependency:** Phase 4, 5 complete
**Blocks:** Phase 9

| # | Task | Status | Evidence Required | Notes |
|---|------|--------|------------------|-------|
| 8.1 | [ ] KMS CMKs per environment (logs, data, app); key rotation policies | NOT DONE | KMS key inventory, rotation policy per key | Maps to `deploy/govcloud/terraform/secrets.tf` |
| 8.2 | [ ] Secrets Manager for DB creds / API keys | NOT DONE | Secrets Manager inventory screenshot | Never store secrets in code or frontend |
| 8.3 | [ ] Never store secrets in code or frontend | NOT DONE | Gitleaks scan results (clean), code review attestation | Run `gitleaks detect --source .` |
| 8.4 | [ ] Enforce TLS 1.2+ and FIPS endpoints in all SDKs/clients | NOT DONE | SDK config showing FIPS endpoint usage, TLS min version | `AWS_USE_FIPS_ENDPOINT=true` |

### KMS Key Inventory Template
| Key Alias | Purpose | Rotation | Used By |
|-----------|---------|----------|---------|
| `alias/khepra-logs` | CloudTrail/CloudWatch log encryption | Annual (auto) | CloudTrail, CloudWatch |
| `alias/khepra-data` | Aurora PostgreSQL encryption at rest | Annual (auto) | RDS |
| `alias/khepra-app` | Application-level encryption (Secrets Manager, S3) | Annual (auto) | Secrets Manager, S3 |
| `alias/khepra-evidence` | Immutable evidence bucket encryption | Annual (auto) | S3 (Object Lock bucket) |

### Phase 8 Evidence Artifacts
```
evidence/phase-8/
  |- kms_key_inventory.json            (all CMKs with rotation status)
  |- secrets_manager_inventory.png     (all managed secrets)
  |- gitleaks_scan_clean.txt           (no secrets in code)
  |- fips_endpoint_config.png          (SDK/client config)
  |- tls_min_version_verification.txt  (TLS 1.2+ enforced)
```

---

## Phase 9: Secure Enclave API (CUI Boundary)

**CMMC Relevance:** AC.L1-B.1.III (external connections), AC.L1-B.1.IV (public info control), SC.L1-B.1.X (boundary protection), SC.L1-B.1.XI (public-access separation)
**Dependency:** Phase 4, 5, 6, 7, 8 complete
**Blocks:** Phase 11

| # | Task | Status | Evidence Required | Notes |
|---|------|--------|------------------|-------|
| 9.1 | [ ] Backend (FastAPI) runs in EKS/Fargate (private), exposes single public edge (ALB/API GW) with WAF | NOT DONE | Architecture diagram, ALB config, WAF association | Maps to gateway DEMARC concept |
| 9.2 | [ ] Zero CUI in the frontend; UI calls API via HTTPS with short-lived tokens (Cognito) | NOT DONE | Frontend code review attestation, token TTL config | Vercel frontend serves static assets only |
| 9.3 | [ ] All requests logged; structured logs | NOT DONE | Sample log output showing structured JSON | Maps to `pkg/logging/dod_logger.go` |
| 9.4 | [ ] Rate-limits enforced | NOT DONE | Rate limit config, 429 response verification | Maps to `pkg/apiserver/middleware.go:106-158` |
| 9.5 | [ ] Strict CORS configured | NOT DONE | CORS header config, allowed origins list | Maps to `pkg/apiserver/middleware.go:61-77` |

### CUI Boundary Diagram
```
+------------------+          +-------------------+
|  VERCEL (PUBLIC)  |          |  AWS GOVCLOUD     |
|  Static Frontend |  HTTPS   |  (CUI BOUNDARY)   |
|  Zero CUI        +--------->+                   |
|  Short-lived JWT |          |  ALB + WAF        |
+------------------+          |    |              |
                              |  FastAPI (EKS)   |
                              |    |              |
                              |  Aurora PG        |
                              |  (CUI at rest)    |
                              +-------------------+
```

### Phase 9 Evidence Artifacts
```
evidence/phase-9/
  |- cui_boundary_diagram.png          (system boundary)
  |- alb_waf_config.png                (WAF WebACL on ALB)
  |- frontend_no_cui_attestation.md    (code review)
  |- cognito_token_ttl_config.png      (short-lived tokens)
  |- structured_log_sample.json        (request logging)
  |- rate_limit_429_test.png           (rate limit verified)
  |- cors_config.json                  (allowed origins)
```

---

## Phase 10: SDLC - Evidence-First

**CMMC Relevance:** SI.L1-B.1.XII (flaw remediation), SI.L1-B.1.XIII (malicious code), SI.L1-B.1.XV (scanning)
**Dependency:** Phase 4, 6 complete
**Blocks:** Phase 11

| # | Task | Status | Evidence Required | Notes |
|---|------|--------|------------------|-------|
| 10.1 | [ ] Private CI/CD runners inside VPC | NOT DONE | Runner config showing VPC placement, no public IP | GitHub Actions self-hosted or CodeBuild in VPC |
| 10.2 | [ ] Build, sign images (cosign), push to ECR | NOT DONE | cosign signature verification output, ECR push logs | Supply chain integrity |
| 10.3 | [ ] SAST/DAST/SCA artifacts written to S3 (Object Lock folders) as evidence | NOT DONE | S3 evidence bucket structure, sample scan artifact | Immutable scan results |
| 10.4 | [ ] Infrastructure-as-Code (Terraform/Ansible); SCAP/OpenSCAP STIG scans on AMIs/hosts | NOT DONE | Terraform plan output, SCAP scan results | Maps to `deploy/govcloud/terraform/` |

### CI/CD Pipeline Architecture
```
Developer Push
      |
      v
+-----+------+
| GitHub     |
| Actions    |
+-----+------+
      |
      v (self-hosted runner in VPC)
+-----+-----------+
| Build & Test    |
| SAST (Semgrep)  |
| SCA (Trivy)     |
+-----+-----------+
      |
      v
+-----+-----------+
| Sign (cosign)   |
| Push to ECR Gov |
+-----+-----------+
      |
      v
+-----+-----------+
| SCAP/STIG Scan  |
| Store evidence   |
| to S3 (WORM)   |
+-----+-----------+
      |
      v
+-----+-----------+
| Deploy to EKS   |
| (rolling update) |
+-----------------+
```

### Phase 10 Evidence Artifacts
```
evidence/phase-10/
  |- cicd_runner_vpc_config.png        (runner in private subnet)
  |- cosign_signature_verify.txt       (image signature verification)
  |- ecr_push_logs.json                (image push audit)
  |- sast_scan_results.json            (SAST output)
  |- dast_scan_results.json            (DAST output)
  |- sca_scan_results.json             (SCA/dependency output)
  |- scap_stig_results.xml             (SCAP scan results)
  |- terraform_plan_output.txt         (IaC plan)
```

---

## Phase 11: First Smoke Test (Hello-World)

**CMMC Relevance:** Validates all controls are operational end-to-end
**Dependency:** Phase 3, 5, 6, 9 complete
**Blocks:** Phase 12 (evidence binder)

| # | Task | Status | Evidence Required | Notes |
|---|------|--------|------------------|-------|
| 11.1 | [ ] Deploy FastAPI service with one route (`/healthz`); connect to Aurora; write a test record | NOT DONE | `/healthz` response screenshot, DB test record query | Basic end-to-end validation |
| 11.2 | [ ] Verify CloudTrail / Config / GuardDuty events are flowing | NOT DONE | CloudTrail event for the test request, Config snapshot, GuardDuty detector active | Cross-reference with Phase 3 |
| 11.3 | [ ] Verify ALB access logs, EKS audit logs, DB logs | NOT DONE | ALB log entry, EKS audit log entry, Aurora pgAudit log entry | All three log streams active |
| 11.4 | [ ] Store runbook outputs (screenshots/IDs) in evidence bucket (immutable) | NOT DONE | S3 evidence bucket listing with Object Lock confirmation | Immutable proof of operational controls |

### Smoke Test Validation Checklist
```bash
# 1. Test API endpoint
curl -k https://<ALB_DNS>/healthz

# 2. Verify CloudTrail
aws cloudtrail lookup-events --lookup-attributes \
  AttributeKey=EventSource,AttributeValue=elasticloadbalancing.amazonaws.com \
  --region us-gov-west-1

# 3. Verify GuardDuty active
aws guardduty list-detectors --region us-gov-west-1

# 4. Verify Config recording
aws configservice describe-configuration-recorder-status --region us-gov-west-1

# 5. Verify VPC Flow Logs
aws ec2 describe-flow-logs --region us-gov-west-1

# 6. Check Aurora connectivity
psql "host=<cluster-endpoint> dbname=khepra user=admin sslmode=verify-full" \
  -c "SELECT 1 AS smoke_test;"

# 7. Verify pgAudit logging
aws logs filter-log-events \
  --log-group-name /aws/rds/cluster/<cluster-name>/postgresql \
  --filter-pattern "AUDIT" --region us-gov-west-1
```

### Phase 11 Evidence Artifacts
```
evidence/phase-11/
  |- healthz_response.png              (200 OK from /healthz)
  |- db_test_record.png                (SELECT query result)
  |- cloudtrail_event_sample.json      (API event captured)
  |- config_recorder_active.png        (Config recording)
  |- guardduty_detector_active.png     (GuardDuty running)
  |- alb_access_log_entry.txt          (ALB log for test request)
  |- eks_audit_log_entry.json          (EKS audit event)
  |- pgaudit_log_entry.txt             (DB audit log)
  |- evidence_bucket_immutable.png     (S3 Object Lock verified)
```

---

## Phase 12: C3PAO Evidence Binder (Start Early)

**CMMC Relevance:** All 17 practices - this is the deliverable for certification assessment
**Dependency:** All prior phases
**Blocks:** CMMC certification

| # | Task | Status | Evidence Required | Notes |
|---|------|--------|------------------|-------|
| 12.1 | [ ] System boundary diagram; data flow; inventory | NOT DONE | Diagrams in evidence bucket | Derived from Phase 4 + Phase 9 diagrams |
| 12.2 | [ ] AU/CM/AC/SI control write-ups; pointers to immutable artifacts | NOT DONE | Control narrative documents with S3 artifact links | Maps to `docs/CMMC_L1_SELF_ASSESSMENT.md` and `docs/CMMC_L1_AUDIT_SUMMARY.md` |
| 12.3 | [ ] US-persons access records; FIPS endpoints usage statement | NOT DONE | Access roster + FIPS attestation document | From Phase 0.3 + Phase 8.4 |
| 12.4 | [ ] Complete POA&M with all milestones resolved | NOT DONE | POA&M document showing all items closed | This document serves as the tracking tool |

### Evidence Binder Structure
```
c3pao-evidence-binder/
  +-- 01-system-boundary/
  |    |- system_boundary_diagram.pdf
  |    |- data_flow_diagram.pdf
  |    |- asset_inventory.xlsx
  |    |- cui_data_map.xlsx
  |
  +-- 02-controls/
  |    |- AC_control_writeups.pdf
  |    |- AU_control_writeups.pdf
  |    |- CM_control_writeups.pdf
  |    |- IA_control_writeups.pdf
  |    |- MP_control_writeups.pdf
  |    |- PE_control_writeups.pdf     (inherited controls documentation)
  |    |- SC_control_writeups.pdf
  |    |- SI_control_writeups.pdf
  |
  +-- 03-evidence/
  |    |- phase-0/ through phase-11/  (all artifacts from this runbook)
  |
  +-- 04-policies/
  |    |- access_control_policy.pdf
  |    |- media_sanitization_policy.pdf
  |    |- incident_response_plan.pdf
  |    |- configuration_management_plan.pdf
  |
  +-- 05-personnel/
  |    |- us_persons_attestation.pdf
  |    |- access_roster.xlsx
  |    |- role_assignments.xlsx
  |
  +-- 06-compliance/
       |- CMMC_L1_SELF_ASSESSMENT.md
       |- CMMC_L1_AUDIT_SUMMARY.md
       |- POAM.xlsx
       |- fips_endpoints_statement.pdf
       |- govcloud_shared_responsibility.pdf
```

### Phase 12 Evidence Artifacts
```
evidence/phase-12/
  |- system_boundary_diagram.pdf
  |- data_flow_diagram.pdf
  |- asset_inventory.xlsx
  |- control_writeups_complete.pdf
  |- us_persons_records.pdf
  |- fips_statement.pdf
  |- poam_all_closed.pdf
```

---

## Cross-Reference: Runbook Phases to CMMC Practices

| CMMC Practice | Relevant Phases | Infrastructure Evidence Needed |
|---------------|----------------|-------------------------------|
| AC.L1-B.1.I | 2, 6, 7 | Identity Center, Cognito, EKS IRSA |
| AC.L1-B.1.II | 2, 7 | Permission sets, Cognito groups |
| AC.L1-B.1.III | 4, 9 | VPC, ALB/WAF, Security Groups |
| AC.L1-B.1.IV | 3, 5, 8, 9 | S3 policies, Secrets Manager, CORS |
| IA.L1-B.1.V | 7 | Cognito User Pool, Identity Center |
| IA.L1-B.1.VI | 2, 7 | MFA enforcement, Cognito MFA |
| MP.L1-B.1.VII | 5, 8 | KMS CMKs, key rotation, crypto-shredding |
| PE.L1-B.1.VIII | 0, 1 | GovCloud account = FedRAMP inherited |
| PE.L1-B.1.IX | 0, 1 | GovCloud account = FedRAMP inherited |
| SC.L1-B.1.X | 3, 4, 9 | VPC Flow Logs, GuardDuty, WAF, ALB |
| SC.L1-B.1.XI | 4, 9 | VPC subnet separation, ALB routing |
| SI.L1-B.1.XII | 3, 10 | Config, Security Hub, SAST/DAST |
| SI.L1-B.1.XIII | 3, 6, 10 | GuardDuty, ECR scanning, WAF |
| SI.L1-B.1.XIV | 3 | GuardDuty auto-updates, WAF managed rules |
| SI.L1-B.1.XV | 3, 6, 10 | GuardDuty continuous, ECR scan-on-push, Config |

---

## Migration Risk Register

| Risk ID | Description | Impact | Likelihood | Mitigation |
|---------|-------------|--------|------------|------------|
| MR-01 | GovCloud account approval delay | High (blocks all) | Medium | Submit request early; maintain commercial account as fallback |
| MR-02 | Aurora PostgreSQL not available in us-gov-west-1 AZ | Medium | Low | Verify AZ availability; plan for single-AZ if needed |
| MR-03 | EKS version lag in GovCloud vs commercial | Low | High | Test with GovCloud-available EKS version before migration |
| MR-04 | FIPS endpoint not available for all services | Medium | Medium | Maintain list of FIPS-available services; document exceptions |
| MR-05 | Fly.io/Vercel decommission timing | Medium | Low | Run dual-stack during transition; DNS cutover as final step |
| MR-06 | Cost increase from GovCloud pricing premium | Medium | High | Budget for ~20-30% premium over commercial AWS pricing |
| MR-07 | US-persons requirement limits team access | High | Medium | Document all team members' eligibility; plan for restricted access |

---

## Fly.io / Vercel Decommission Checklist

*To be executed AFTER GovCloud deployment is validated (Phase 11 complete)*

| # | Task | Status | Notes |
|---|------|--------|-------|
| D.1 | [ ] Verify all traffic migrated to GovCloud ALB | NOT DONE | DNS records point to new endpoint |
| D.2 | [ ] Export all Fly.io application logs | NOT DONE | Retain for audit trail continuity |
| D.3 | [ ] Export all Fly.io secrets/environment variables | NOT DONE | Verify migrated to Secrets Manager |
| D.4 | [ ] Disable Fly.io application (do not delete immediately) | NOT DONE | Keep dormant for 90-day rollback window |
| D.5 | [ ] Update Vercel frontend environment variables to point to GovCloud API | NOT DONE | Or migrate frontend to CloudFront/S3 |
| D.6 | [ ] Delete Fly.io application after 90-day verification period | NOT DONE | Final decommission |
| D.7 | [ ] Document decommission in change management log | NOT DONE | Evidence for C3PAO |

---

*Document created: 2026-02-03*
*System: AdinKhepra Protocol - Giza Cyber Shield*
*Migration: Fly.io/Vercel -> AWS GovCloud (us-gov-west-1)*
*Classification: CUI // SP-CMMC*
*Revision: 1.0*
