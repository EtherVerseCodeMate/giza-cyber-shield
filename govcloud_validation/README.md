# GovCloud validation (`govcloud_validation`)

CLI and library for incremental **SKIP / WARN / PASS** checks aligned with **GovCloud Deployment Runbook v2.1** (SecRed Knowledge Inc. / NouchiX — `us-gov-west-1`).

**Inventory mapping (placeholders only in-repo):** [GovCloud deployment reference template](../docs/govcloud/SECRED_GOVCLOUD_DEPLOYMENT_REFERENCE.md) · `examples/secred-govcloud.env.example.sh` (copy to a local gitignored file for real values)

**Compliance program (SSP, boundaries, sampling, assessor judgment):** [GOVCLOUD_COMPLIANCE_PROGRAM.md](../docs/govcloud/GOVCLOUD_COMPLIANCE_PROGRAM.md) · **Control matrix (YAML):** `compliance_matrix.yaml` — maps each `check_id` to indicative NIST SP 800-171 rev2 / CMMC Level 2 references, `coverage` type, and assessor caveats. The matrix is **not** authoritative for audits; it prevents over-claiming automation.

```bash
pip install boto3
python -m govcloud_validation --help
python -m govcloud_validation --provider aws-govcloud --region us-gov-west-1 --list-stages
```

## Runbook alignment (v2.1)

| Stage id | Runbook |
|----------|---------|
| `step_00_prereqs` | Step 0 — Pre-Reqs & account pairing |
| `step_00_2_us_person` | Step 0.2 — US-person enforcement (IAM Identity Center checks live here) |
| `step_01_organizations` | Step 1 — Organizations & OUs |
| `step_02_root_guardrails` | Step 2 — Root hygiene & **SCPs** (custom SCP presence at root) |
| `step_03_logging` … `step_12_evidence_binder` | Steps 3–12 |

**Runbook-only steps** (no separate stage id yet — track manually): **6A** Lambda + DynamoDB, **6B** frontend hosting, **8A** Bedrock. They can be added as stages when you want them in CI.

## Deployment model (current vs future)

- **Now:** A single **management / workload** account under **Root** is common early on; management accounts **cannot** be moved into an OU — that is normal.
- **Later:** Add Log-Archive, Audit, Non-Prod, and Prod **accounts** and place them under the OUs you create (Step 3+ for log/audit accounts).

## Landing zone OU layout (example)

Use real ids from the Organizations API with `GOVCLOUD_EXPECTED_ROOT_ID` / `GOVCLOUD_EXPECTED_OU_IDS` (optional drift checks). Illustrative shape only:

```
Root (r-xxxx)
├── Security (ou-xxxx-security)
│   ├── Audit (ou-xxxx-audit)
│   └── Log-Archive (ou-xxxx-logs)
└── Workloads (ou-xxxx-workloads)
    ├── Non-Prod (ou-xxxx-nonprod)
    └── Prod (ou-xxxx-prod)
```

**Comma-separated OU ids** (same order not required): paste your six (or fewer) ids from internal inventory — do not commit populated values.

## Optional drift checks (environment variables)

When set, the AWS validator compares **live API results** to your expected values. If unset, those checks **SKIP** with a hint.

| Variable | Purpose |
|----------|---------|
| `GOVCLOUD_EXPECTED_ACCOUNT_ID` | STS caller account (12-digit id from your GovCloud account). |
| `GOVCLOUD_EXPECTED_ORG_ID` | `organizations:DescribeOrganization` → `Organization.Id`. |
| `GOVCLOUD_EXPECTED_ROOT_ID` | Organization **root** id (e.g. `r-xxxx`). |
| `GOVCLOUD_EXPECTED_OU_IDS` | Comma-separated OU ids that must exist **anywhere** under root. |
| `GOVCLOUD_EXPECTED_IDC_INSTANCE_ID` | IAM Identity Center instance id (`ssoins-…`). |
| `GOVCLOUD_EXPECTED_IDENTITY_STORE_ID` | Identity store id (`d-…` in portal URL). |
| `GOVCLOUD_EXPECTED_PERMISSION_SET_ARN` | IAM Identity Center permission set ARN (must appear in `ListPermissionSets`). |
| `GOVCLOUD_EXPECTED_PERMISSION_SET_NAME` | Permission set **name** (e.g. `CUIWorkloadAccess`); verified via `DescribePermissionSet`. |
| `GOVCLOUD_EXPECTED_PS_TAG_KEY` / `GOVCLOUD_EXPECTED_PS_TAG_VALUE` | ABAC tag on that permission set (via `ListTagsForResource` on the PS ARN). |
| `GOVCLOUD_EXPECT_PS_ABAC_USPERSON` | Set to `1` / `true` / `yes` to expect **`usPerson`=`true`** on the permission set (shorthand if key/value omitted). |
| `GOVCLOUD_EXPECTED_SCP_NAMES` | Optional: comma-separated **names** of SCPs you expect **attached at root**. |
| `GOVCLOUD_EXPECTED_WORKLOADS_OU_ID` | Workloads OU id (e.g. `ou-xxxx-workloads`). |
| `GOVCLOUD_EXPECTED_SCP_NAMES_WORKLOADS_OU` | SCP **names** expected **on that OU** (comma-separated). |
| `GOVCLOUD_EXPECTED_SECURITY_OU_ID` | Security OU id (RCP checks). |
| `GOVCLOUD_EXPECTED_RCP_NAMES` | Resource Control Policy **names** on that OU (comma-separated; GovCloud Organizations). |
| `GOVCLOUD_EXPECTED_CLOUDTRAIL_NAME` | Named trail: exists, logging, log file validation when returned by API. |
| `GOVCLOUD_EXPECTED_CONFIG_RECORDER_NAME` | Config recorder name; or set `GOVCLOUD_CHECK_CONFIG_RECORDER=1` to use `default`. |
| `GOVCLOUD_EXPECTED_EVIDENCE_BUCKET` | S3 evidence bucket: HeadBucket, encryption, optional Object Lock. |
| `GOVCLOUD_EXPECT_EVIDENCE_OBJECT_LOCK` | `1` / `true` to treat Object Lock as required. |
| `GOVCLOUD_EXPECT_EVIDENCE_OBJECT_LOCK_RETENTION_DAYS` | With Object Lock COMPLIANCE, expect retention ≥ this many days (e.g. `2555`). |
| `GOVCLOUD_MIN_ENABLED_SECURITY_HUB_STANDARDS` | Minimum count of enabled Security Hub standards subscriptions. |
| `GOVCLOUD_CHECK_IAM_PASSWORD_POLICY` | Set `1` / `true` to enforce IAM account password policy (min length + complexity). |
| `GOVCLOUD_EXPECT_IAM_PASSWORD_MIN_LENGTH` | Minimum length to require when the above is on (default **14**). |
| `GOVCLOUD_CHECK_ACCOUNT_SECURITY_CONTACT` | Set `1` / `true` to require an alternate **SECURITY** contact (`account:GetAlternateContact`). |
| `GOVCLOUD_S3_BUCKETS_VERIFY_PAB` | Comma-separated bucket names — bucket-level **Block Public Access** must be fully on (max 20 buckets). |
| `GOVCLOUD_EXPECTED_VPC_ID` | Expected workload VPC id. |
| `GOVCLOUD_EXPECTED_VPC_SUBNET_COUNT` | With VPC id, expect at least this many subnets. |
| `GOVCLOUD_EXPECTED_KMS_ALIASES` | Comma-separated CMK aliases (`alias/` optional), e.g. `your-cloudtrail-cmk,your-evidence-cmk`. |
| `ASAF_SMOKE_HEALTH_URL` | Step 11: HTTP GET health endpoint. |

Example:

```bash
export GOVCLOUD_EXPECTED_ACCOUNT_ID=123456789012
export GOVCLOUD_EXPECTED_ORG_ID=o-xxxxxxxxxx
export GOVCLOUD_EXPECTED_ROOT_ID=r-xxxx
export GOVCLOUD_EXPECTED_OU_IDS=ou-xxxx-aaaaaaa,ou-xxxx-bbbbbbb,ou-xxxx-ccccccc,ou-xxxx-ddddddd,ou-xxxx-eeeeeee,ou-xxxx-fffffff
export GOVCLOUD_EXPECTED_IDC_INSTANCE_ID=ssoins-xxxxxxxxxxxxxxxx
export GOVCLOUD_EXPECTED_IDENTITY_STORE_ID=d-xxxxxxxxxx
export GOVCLOUD_EXPECTED_PERMISSION_SET_NAME=YourWorkloadPermissionSet
export GOVCLOUD_EXPECTED_PERMISSION_SET_ARN=arn:aws-us-gov:sso:::permissionSet/ssoins-xxxxxxxxxxxxxxxx/ps-xxxxxxxxxxxxxxxx
export GOVCLOUD_EXPECT_PS_ABAC_USPERSON=1

# Or explicit tag pair:
# export GOVCLOUD_EXPECTED_PS_TAG_KEY=usPerson
# export GOVCLOUD_EXPECTED_PS_TAG_VALUE=true
# After you attach SCPs at root:
# export GOVCLOUD_EXPECTED_SCP_NAMES=MyDenyList,MyRegionLock
```

## Operator reference (non-secret)

Keep org-specific account ids, portal URLs, permission set ARNs, and user directory details in **internal** runbooks or gitignored env files — not in this repository.

| Item | Notes |
|------|--------|
| **Runbook** | GovCloud Deployment Runbook v2.1 (your org’s controlled copy). |
| **Primary region** | Typically `us-gov-west-1` for AWS GovCloud (US). |
| **IAM Identity Center** | Instance id, identity store id, and portal URLs come from the IAM Identity Center console / API. |
| **FIPS sign-in** | `us-gov-west-1.signin-fips.amazonaws-us-gov.com` (partition-specific). |

### CUI-style workload permission sets

The validator can check a named permission set and optional ABAC tags (`GOVCLOUD_EXPECTED_PERMISSION_SET_*`, `GOVCLOUD_EXPECT_PS_ABAC_USPERSON`, or explicit tag env vars). It does **not** read directory user profile attributes (phone, address, etc.) — keep those out of git.

**Note:** This tool reads tags on the **permission set** resource in IAM Identity Center. Tags on the **directory user** are a separate control plane (`identitystore`).

Do **not** commit secrets (MFA seeds, access keys, session tokens) or unnecessary **PII**. Attestation forms and evidence uploads belong in your controlled evidence store after Step 3.

## AWS API actions (for least-privilege IAM policies)

There is no separate “permissions manifest” file: the **source of truth** is which boto3 calls run in `govcloud_validation/validators/aws_govcloud.py`. Map those to IAM actions using AWS’s **service authorization reference** (same action names as in IAM policies):

- **IAM:** [Actions, resources, and condition keys for AWS IAM](https://docs.aws.amazon.com/service-authorization/latest/reference/list_identityandaccessmanagement.html) — e.g. `iam:GetAccountSummary`, `iam:GetAccountPasswordPolicy` (opt-in check).
- **Account:** [Actions for AWS Account Management](https://docs.aws.amazon.com/service-authorization/latest/reference/list_awsaccountmanagement.html) — e.g. `account:GetAlternateContact` (opt-in check).

**Newer checks discussed previously (typical read-only actions):**

| Area | IAM policy actions (examples) |
|------|------------------------------|
| Step 0 root hygiene | `iam:GetAccountSummary` |
| Step 3 password policy (opt-in) | `iam:GetAccountPasswordPolicy` |
| Step 3 alternate contact (opt-in) | `account:GetAlternateContact` |
| Step 3 S3 / evidence / PAB | `s3:GetBucketEncryption`, `s3:GetBucketObjectLockConfiguration`, `s3:GetPublicAccessBlock`, `s3:HeadBucket`, `s3control:GetPublicAccessBlock` |
| Step 3 Config | `config:DescribeConfigurationRecorderStatus`, `config:DescribeDeliveryChannels` |
| Step 3 GuardDuty | `guardduty:ListDetectors` |

If a check returns **WARN** with “AccessDenied” / “UnauthorizedOperation”, the role running the validator is missing the matching action (or an SCP denies it).

## Step 0 (pre-reqs) — root & account signals

- **STS** caller identity (session present).
- Optional expected **account id** (`GOVCLOUD_EXPECTED_ACCOUNT_ID`).
- **IAM `GetAccountSummary`**: root **MFA** enabled (`iam_root_mfa_enabled`) and **no root access keys** (`iam_root_access_keys_absent`), or **WARN**.

## Step 2 (SCPs / RCPs) — what the validator does

- Lists **SCPs attached at the organization root** (`list_policies_for_target`).
- **WARN** if only AWS-managed SCPs are present (prompt to attach your custom guardrail SCPs).
- **PASS** when at least one **custom** (`AwsManaged == false`) SCP is attached at root.
- Optional **exact name** check via `GOVCLOUD_EXPECTED_SCP_NAMES` (root only).
- Optional **Workloads OU SCP** names via `GOVCLOUD_EXPECTED_WORKLOADS_OU_ID` + `GOVCLOUD_EXPECTED_SCP_NAMES_WORKLOADS_OU`.
- Optional **Security OU RCP** names via `GOVCLOUD_EXPECTED_SECURITY_OU_ID` + `GOVCLOUD_EXPECTED_RCP_NAMES` (filter `RESOURCE_CONTROL_POLICY`).

## Step 3 (logging & evidence) — extended optional checks

Beyond CloudTrail `DescribeTrails` and GuardDuty, you can enforce:

- **GuardDuty**: API reachability plus at least one **detector** in the session region (`guardduty_detector_present`), or **WARN**.
- A **named trail** (`GOVCLOUD_EXPECTED_CLOUDTRAIL_NAME`): `GetTrail`, `GetTrailStatus` (logging + log file validation when present).
- **AWS Config** recorder status (`GOVCLOUD_EXPECTED_CONFIG_RECORDER_NAME` or `GOVCLOUD_CHECK_CONFIG_RECORDER=1`), **recording** flag, and **delivery channel(s)** when a recorder is in scope.
- **Evidence bucket** (`GOVCLOUD_EXPECTED_EVIDENCE_BUCKET`): encryption, Object Lock (optional retention days), and **bucket-level Block Public Access** (four settings).
- **Security Hub** enabled standards count (`GOVCLOUD_MIN_ENABLED_SECURITY_HUB_STANDARDS`).
- Optional **IAM password policy** (`GOVCLOUD_CHECK_IAM_PASSWORD_POLICY=1`) and **alternate SECURITY contact** (`GOVCLOUD_CHECK_ACCOUNT_SECURITY_CONTACT=1`).
- Optional **named buckets** PAB audit (`GOVCLOUD_S3_BUCKETS_VERIFY_PAB`).
- **Account-wide S3 Block Public Access** (`s3control` `GetPublicAccessBlock`): all four settings must be true, or **WARN** (or if account PAB is not configured).
- **EBS encryption by default** for the session region (`GetEbsEncryptionByDefault`): **WARN** if disabled.

## What you can provide next

- **SCP names** (as attached at root) for `GOVCLOUD_EXPECTED_SCP_NAMES`.
- **Org CloudTrail / delegated admin** account ids once Step 3 accounts exist.
- **VPC tags**, **ECS cluster names**, **Cognito pool ids**, **Aurora cluster id** for tighter resource-level checks.
- **Smoke URL** (`ASAF_SMOKE_HEALTH_URL`) when the API is live.
