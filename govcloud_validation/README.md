# GovCloud Validation (`govcloud_validation`) v2.1.0

CLI and library for incremental **SKIP / WARN / PASS / FAIL** checks aligned with **GovCloud Deployment Runbook v2.1** (SecRed Knowledge Inc. / NouchiX — `us-gov-west-1`).

## Compliance Frameworks

Every check is tagged with control ids from **all** of these frameworks:

| Framework | Standard | Control Format |
|-----------|----------|----------------|
| **CMMC Level 2** | NIST SP 800-171 Rev.2 | `AC.L2-3.1.1` |
| **CMMC Level 3** | NIST SP 800-172 | `AC.L3-3.1.1e` |
| **FedRAMP High** | NIST SP 800-53 Rev.5 | `AC-2`, `AU-12` |
| **NIST 800-171** | CUI protection | `3.x.x` |
| **NIST 800-172** | Enhanced CUI | `3.x.xe` |
| **SOC-2 Type II** | Trust Service Criteria | `CC6.1`, `A1.2` |
| **ISO 27001:2022 / 27003** | Annex A | `A.5.15`, `A.8.24` |
| **DoD IL4/IL5** | CC SRG | `SRG-APP-000xxx` |

## Quick Start

```bash
pip install boto3
python -m govcloud_validation --help
python -m govcloud_validation --provider aws-govcloud --region us-gov-west-1
python -m govcloud_validation --list-stages
python -m govcloud_validation --only step_02_root_guardrails
python -m govcloud_validation --json
python -m govcloud_validation --framework cmmc-l2
python -m govcloud_validation --framework fedramp-high --fail-on-warn
```

## CLI Flags

| Flag | Description |
|------|-------------|
| `--provider` | Cloud provider (default: `aws-govcloud`) |
| `--region` | AWS region (default: `us-gov-west-1`) |
| `--list-stages` | List all registered stages and exit |
| `--only STAGE` | Run only specified stage(s), comma-separated |
| `--skip STAGE` | Skip specified stage(s), comma-separated |
| `--json` | Machine-readable JSON output |
| `--framework NAME` | Filter checks by compliance framework |
| `--fail-on-warn` | Exit code 1 on WARN (default: exit 2 on FAIL only) |

## Runbook Alignment (v2.1)

| Stage ID | Runbook Step | What It Validates |
|----------|-------------|-------------------|
| `step_00_prereqs` | Step 0 — Pre-Reqs & Account Pairing | STS identity, GovCloud region/partition, FIPS endpoints |
| `step_00_2_us_person` | Step 0.2 — US-Person Enforcement | IAM Identity Center, permission sets, ABAC `usPerson=true` tag |
| `step_01_organizations` | Step 1 — Organizations & OUs | Org exists, root/OU structure, feature set ALL |
| `step_02_root_guardrails` | Step 2 — Root Hygiene & SCPs | Custom SCPs at root, recommended SCP patterns, root MFA/access keys |
| `step_03_logging` | Step 3 — Centralized Logging | CloudTrail (multi-region, digest), GuardDuty, Security Hub, Config, log retention ≥365d |
| `step_04_networking` | Step 4 — Networking Baseline | VPC, Flow Logs, subnets, NAT, security groups, VPC endpoints |
| `step_05_aurora` | Step 5 — Aurora PostgreSQL | Cluster encryption (CMK), Multi-AZ, backup ≥35d, IAM auth, pgAudit |
| `step_06_compute` | Step 6 — ECS Fargate | Cluster Insights, Fargate launch, non-root containers, ECR scan-on-push |
| `step_06a_lambda` | Step 6A — Lambda + DynamoDB | Lambda CMK, VPC attachment, DynamoDB CMK + PITR |
| `step_06b_frontend` | Step 6B — Frontend Hosting | CloudFront/ALB TLS 1.2+, WAF, OAI/OAC |
| `step_07_identity` | Step 7 — Cognito + Aurora RLS | MFA required, password policy (NIST 800-63B), advanced security |
| `step_08_encryption` | Step 8 — Secrets, Keys & Crypto | KMS CMK rotation, Secrets Manager rotation + CMK |
| `step_08a_bedrock` | Step 8A — Bedrock AI | Model access, invocation logging, external LLM key detection |
| `step_09_enclave` | Step 9 — Secure Enclave API | ALB HTTPS + FIPS TLS, WAF, ACM cert validity |
| `step_10_sdlc` | Step 10 — SDLC Evidence-First | CodePipeline/CodeBuild encryption, no public ECR |
| `step_11_smoke` | Step 11 — First Smoke Test | Health endpoint HTTP 200, latency, HSTS + security headers |
| `step_12_evidence_binder` | Step 12 — C3PAO Evidence Binder | S3 versioning, CMK, Object Lock (WORM), public access block, lifecycle |

## Environment Variables (Drift Checks)

When set, the validator compares **live API results** to your expected values. If unset, those checks **SKIP** with a hint.

| Variable | Purpose |
|----------|---------|
| `GOVCLOUD_EXPECTED_ACCOUNT_ID` | STS caller account (e.g. `483774310865`). |
| `GOVCLOUD_EXPECTED_ORG_ID` | `organizations:DescribeOrganization` → `Organization.Id`. |
| `GOVCLOUD_EXPECTED_ROOT_ID` | Organization **root** id (e.g. `r-u7nb`). |
| `GOVCLOUD_EXPECTED_OU_IDS` | Comma-separated OU ids that must exist under root. |
| `GOVCLOUD_EXPECTED_IDC_INSTANCE_ID` | IAM Identity Center instance id (`ssoins-…`). |
| `GOVCLOUD_EXPECTED_IDENTITY_STORE_ID` | Identity store id (`d-…`). |
| `GOVCLOUD_EXPECTED_PERMISSION_SET_ARN` | Permission set ARN. |
| `GOVCLOUD_EXPECTED_PERMISSION_SET_NAME` | Permission set name (e.g. `CUIWorkloadAccess`). |
| `GOVCLOUD_EXPECTED_PS_TAG_KEY` / `_VALUE` | ABAC tag key/value on permission set. |
| `GOVCLOUD_EXPECT_PS_ABAC_USPERSON` | Shorthand: expect `usPerson=true` tag. |
| `GOVCLOUD_EXPECTED_SCP_NAMES` | Comma-separated SCP names expected at root. |
| `ASAF_SMOKE_HEALTH_URL` | Step 11: HTTP GET health endpoint URL. |
| `AWS_USE_FIPS_ENDPOINT` | Set `true` (default) to prefer FIPS endpoints. |

### Example

```bash
export GOVCLOUD_EXPECTED_ACCOUNT_ID=483774310865
export GOVCLOUD_EXPECTED_ORG_ID=o-3zz5j5d5bt
export GOVCLOUD_EXPECTED_ROOT_ID=r-u7nb
export GOVCLOUD_EXPECTED_OU_IDS=ou-u7nb-uvf0mgwa,ou-u7nb-5ziwfsio,ou-u7nb-qy1f21e7,ou-u7nb-n6kqi2ww,ou-u7nb-6kwa4aiv,ou-u7nb-by022kuw
export GOVCLOUD_EXPECTED_IDC_INSTANCE_ID=ssoins-7907091dd7d987a2
export GOVCLOUD_EXPECTED_IDENTITY_STORE_ID=d-98676a2943
export GOVCLOUD_EXPECTED_PERMISSION_SET_NAME=CUIWorkloadAccess
export GOVCLOUD_EXPECTED_PERMISSION_SET_ARN=arn:aws-us-gov:sso:::permissionSet/ssoins-7907091dd7d987a2/ps-5325bb5a5aab246e
export GOVCLOUD_EXPECT_PS_ABAC_USPERSON=1
export ASAF_SMOKE_HEALTH_URL=https://api.khepra.example.gov/health

python -m govcloud_validation --region us-gov-west-1
```

## Compliance Control Matrix

### Step 0: Pre-Reqs
| Check | CMMC L2 | CMMC L3 | FedRAMP | SOC-2 | ISO 27001 | IL4/IL5 |
|-------|---------|---------|---------|-------|-----------|---------|
| STS Identity | AC.L2-3.1.1, IA.L2-3.5.1 | — | IA-2, AC-2 | CC6.1 | A.5.15 | SRG-APP-000033 |
| GovCloud Region | SC.L2-3.13.8 | — | — | — | — | SRG-APP-000033 |
| FIPS Endpoint | SC.L2-3.13.11 | — | SC-13 | — | — | SRG-APP-000023 |

### Step 0.2: US-Person Enforcement
| Check | CMMC L2 | CMMC L3 | FedRAMP | SOC-2 | ISO 27001 | IL4/IL5 |
|-------|---------|---------|---------|-------|-----------|---------|
| IDC Instance | IA.L2-3.5.1 | — | IA-2, AC-2 | CC6.1 | — | — |
| Permission Set | AC.L2-3.1.5 | — | AC-6 | CC6.3 | — | — |
| ABAC usPerson | AC.L2-3.1.1, PS.L2-3.9.2 | AC.L3-3.1.1e, IA.L3-3.5.1e | — | CC6.1 | A.5.2 | — |

### Step 2: SCPs
| Check | CMMC L2 | CMMC L3 | FedRAMP | SOC-2 | ISO 27001 | IL4/IL5 |
|-------|---------|---------|---------|-------|-----------|---------|
| SCP Enabled | AC.L2-3.1.5, CM.L2-3.4.2 | AC.L3-3.1.1e, CM.L3-3.4.1e | AC-6, SC-7 | CC6.6 | A.5.15, A.8.9 | SRG-APP-000231 |
| Custom SCPs | AC.L2-3.1.5, SC.L2-3.13.1 | AC.L3-3.1.1e | AC-6, CM-6, SC-7 | CC6.6, CC8.1 | A.5.15 | SRG-APP-000231 |
| Root MFA | IA.L2-3.5.3, AC.L2-3.1.7 | — | — | CC6.1 | A.5.15 | — |

### Step 3: Logging
| Check | CMMC L2 | FedRAMP | SOC-2 | ISO 27001 | IL4/IL5 |
|-------|---------|---------|-------|-----------|---------|
| CloudTrail | AU.L2-3.3.1 | AU-2, AU-12 | CC7.1 | A.8.15 | SRG-APP-000014 |
| Log Digest | AU.L2-3.3.1 | AU-9 | CC7.1 | A.8.15 | — |
| GuardDuty | SI.L2-3.14.6 | SI-4, IR-4 | CC7.2, CC7.3 | A.8.15 | — |
| Security Hub | SI.L2-3.14.6 | SI-4, CM-2 | CC7.1, CC7.3 | A.8.15 | — |
| Log Retention ≥365d | AU.L2-3.3.1 | AU-11 | — | A.8.15 | SRG-APP-000014 |

### Step 8: Encryption
| Check | CMMC L2 | FedRAMP | SOC-2 | ISO 27001 | IL4/IL5 |
|-------|---------|---------|-------|-----------|---------|
| KMS CMK | SC.L2-3.13.11, MP.L2-3.8.6 | SC-12, SC-13 | CC6.7 | A.8.24 | SRG-APP-000148, SRG-APP-000516 |
| Key Rotation | — | SC-12 | — | A.8.24 | SRG-APP-000148 |
| Secrets Manager CMK | SC.L2-3.13.11 | SC-12, SC-28 | CC6.7 | — | SRG-APP-000148 |

## Architecture

```
govcloud_validation/
├── __init__.py              # Package init, version
├── __main__.py              # CLI entrypoint (argparse)
├── base.py                  # CheckStatus, CheckResult, StageValidator
├── compliance.py            # Control id catalogue (all frameworks)
├── registry.py              # Stage registration & ordering
├── README.md                # This file
└── validators/
    ├── __init__.py           # Auto-import all validators
    ├── step_00_prereqs.py    # STS, region, FIPS
    ├── step_00_2_us_person.py # IAM Identity Center, ABAC
    ├── step_01_organizations.py # Org, OUs
    ├── step_02_root_guardrails.py # SCPs, root hygiene
    ├── step_03_logging.py    # CloudTrail, GuardDuty, Security Hub, Config
    ├── step_04_networking.py # VPC, Flow Logs, NAT, endpoints
    ├── step_05_aurora.py     # Aurora PostgreSQL
    ├── step_06_compute.py    # ECS Fargate, ECR scanning
    ├── step_06a_lambda.py    # Lambda + DynamoDB
    ├── step_06b_frontend.py  # CloudFront / ALB frontend
    ├── step_07_identity.py   # Cognito User Pool
    ├── step_08_encryption.py # KMS, Secrets Manager
    ├── step_08a_bedrock.py   # Bedrock AI
    ├── step_09_enclave.py    # ALB, WAF, TLS, ACM
    ├── step_10_sdlc.py       # CodePipeline, CodeBuild
    ├── step_11_smoke.py      # HTTP health check
    └── step_12_evidence_binder.py # S3 evidence bucket
```

## CI Integration

```yaml
# .github/workflows/govcloud-validation.yml
name: GovCloud Runbook Validation
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'  # Weekly Monday 6AM UTC

jobs:
  validate:
    runs-on: ubuntu-latest
    environment: govcloud
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install boto3
      - name: Run GovCloud validation
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.GOVCLOUD_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.GOVCLOUD_SECRET_ACCESS_KEY }}
          AWS_DEFAULT_REGION: us-gov-west-1
          GOVCLOUD_EXPECTED_ACCOUNT_ID: ${{ vars.GOVCLOUD_ACCOUNT_ID }}
          GOVCLOUD_EXPECTED_ORG_ID: ${{ vars.GOVCLOUD_ORG_ID }}
        run: |
          python -m govcloud_validation --json > results.json
          python -m govcloud_validation --fail-on-warn
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: govcloud-validation-results
          path: results.json
```

## Operator Reference (Non-Secret)

| Item | Value |
|------|-------|
| **Document** | SECRED-RUN-002 v2.1 — GovCloud Deployment Runbook |
| **Primary region** | `us-gov-west-1` |
| **GovCloud account (SecDev225)** | `483774310865` |
| **Organization ID** | `o-3zz5j5d5bt` |
| **IAM Identity Center instance** | `ssoins-7907091dd7d987a2` |
| **Identity store ID** | `d-98676a2943` |

## Landing Zone OU Layout

```
Root (r-u7nb)
├── Security (ou-u7nb-uvf0mgwa)
│   ├── Audit (ou-u7nb-5ziwfsio)
│   └── Log-Archive (ou-u7nb-qy1f21e7)
└── Workloads (ou-u7nb-n6kqi2ww)
    ├── Non-Prod (ou-u7nb-6kwa4aiv)
    └── Prod (ou-u7nb-by022kuw)
```

## Security Notice

Do **not** commit secrets (MFA seeds, access keys, session tokens) or unnecessary PII.
Attestation **SECRED-FORM-001** and evidence uploads belong in your controlled evidence store after Step 3.

*Document: SECRED-RUN-002 v2.1 · Classification: CUI // NOFORN*
