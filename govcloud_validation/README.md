# GovCloud validation (`govcloud_validation`)

CLI and library for incremental **SKIP / WARN / PASS** checks aligned with **GovCloud Deployment Runbook v2.1** (SecRed Knowledge Inc. / NouchiX — `us-gov-west-1`).

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

- **Now:** Single account **SecDev225** (`483774310865`, management account under **Root**). Deploy workloads here first; management accounts **cannot** be moved into an OU — that is normal.
- **Later:** Add Log-Archive, Audit, Non-Prod, and Prod **accounts** and place them under the OUs you already created (Step 3+ for log/audit accounts).

## Landing zone OU layout (SecRed — Step 1 complete)

Use these ids with `GOVCLOUD_EXPECTED_ROOT_ID` / `GOVCLOUD_EXPECTED_OU_IDS` (optional drift checks).

```
Root (r-u7nb)
├── Security (ou-u7nb-uvf0mgwa)
│   ├── Audit (ou-u7nb-5ziwfsio)
│   └── Log-Archive (ou-u7nb-qy1f21e7)
└── Workloads (ou-u7nb-n6kqi2ww)
    ├── Non-Prod (ou-u7nb-6kwa4aiv)
    └── Prod (ou-u7nb-by022kuw)
```

**Comma-separated OU ids** (same order not required):

`ou-u7nb-uvf0mgwa,ou-u7nb-5ziwfsio,ou-u7nb-qy1f21e7,ou-u7nb-n6kqi2ww,ou-u7nb-6kwa4aiv,ou-u7nb-by022kuw`

## Optional drift checks (environment variables)

When set, the AWS validator compares **live API results** to your expected values. If unset, those checks **SKIP** with a hint.

| Variable | Purpose |
|----------|---------|
| `GOVCLOUD_EXPECTED_ACCOUNT_ID` | STS caller account (e.g. `483774310865` / SecDev225). |
| `GOVCLOUD_EXPECTED_ORG_ID` | `organizations:DescribeOrganization` → `Organization.Id`. |
| `GOVCLOUD_EXPECTED_ROOT_ID` | Organization **root** id (e.g. `r-u7nb`). |
| `GOVCLOUD_EXPECTED_OU_IDS` | Comma-separated OU ids that must exist **anywhere** under root. |
| `GOVCLOUD_EXPECTED_IDC_INSTANCE_ID` | IAM Identity Center instance id (`ssoins-…`). |
| `GOVCLOUD_EXPECTED_IDENTITY_STORE_ID` | Identity store id (`d-…` in portal URL). |
| `GOVCLOUD_EXPECTED_PERMISSION_SET_ARN` | IAM Identity Center permission set ARN (must appear in `ListPermissionSets`). |
| `GOVCLOUD_EXPECTED_PERMISSION_SET_NAME` | Permission set **name** (e.g. `CUIWorkloadAccess`); verified via `DescribePermissionSet`. |
| `GOVCLOUD_EXPECTED_PS_TAG_KEY` / `GOVCLOUD_EXPECTED_PS_TAG_VALUE` | ABAC tag on that permission set (via `ListTagsForResource` on the PS ARN). |
| `GOVCLOUD_EXPECT_PS_ABAC_USPERSON` | Set to `1` / `true` / `yes` to expect **`usPerson`=`true`** on the permission set (shorthand if key/value omitted). |
| `GOVCLOUD_EXPECTED_SCP_NAMES` | Optional: comma-separated **names** of SCPs you expect **attached at root**. |
| `ASAF_SMOKE_HEALTH_URL` | Step 11: HTTP GET health endpoint. |

Example:

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
# Or explicit tag pair:
# export GOVCLOUD_EXPECTED_PS_TAG_KEY=usPerson
# export GOVCLOUD_EXPECTED_PS_TAG_VALUE=true
# After you attach SCPs at root:
# export GOVCLOUD_EXPECTED_SCP_NAMES=MyDenyList,MyRegionLock
```

## Operator reference (non-secret)

| Item | Value |
|------|--------|
| **Document** | SECRED-RUN-002 v2.1 — GovCloud Deployment Runbook |
| **Primary region** | `us-gov-west-1` |
| **GovCloud account (SecDev225)** | `483774310865` |
| **Commercial paired account** | `445971788114` |
| **Organization ID** | `o-3zz5j5d5bt` |
| **IAM Identity Center instance** | `ssoins-7907091dd7d987a2` (`nouchix-govcloud-prod`) |
| **Identity store ID** | `d-98676a2943` |
| **Access portal (IPv4)** | `https://start.us-gov-home.awsapps.com/directory/d-98676a2943` |
| **Dual-stack portal** | `https://ssoins-7907091dd7d987a2.portal.us-gov-west-1.app.aws` |
| **FIPS sign-in** | `us-gov-west-1.signin-fips.amazonaws-us-gov.com` |
| **IDC user (example)** | `souhimbou-kone` |
| **IDC user email (directory)** | `cybersouhimbou@secredknowledgeinc.tech` |

### CUI workload permission set (`CUIWorkloadAccess`)

Documented for runbook / auditor context. The CLI does **not** read user profile attributes (phone, address, etc.) — keep those out of git.

| Item | Value |
|------|--------|
| **Permission set name** | `CUIWorkloadAccess` |
| **ARN** | `arn:aws-us-gov:sso:::permissionSet/ssoins-7907091dd7d987a2/ps-5325bb5a5aab246e` |
| **Session duration** | 4 hours |
| **Provisioned status** | Provisioned (to SecDev225 `483774310865`) |
| **Attached AWS managed policy** | `AdministratorAccess` (job function) |
| **Description (console)** | Full admin access for verified US-Person CUI workload administrators — SecRed Knowledge Inc. |
| **ABAC tag on permission set (console)** | `usPerson` = `true` (validated when `GOVCLOUD_EXPECT_PS_ABAC_USPERSON=1` or explicit tag env vars) |

**Note:** This tool reads tags on the **permission set** resource in IAM Identity Center. Tags on the **directory user** (same key/value) are a separate control plane (`identitystore`); say if you want a follow-up check there.

Do **not** commit secrets (MFA seeds, access keys, session tokens) or unnecessary **PII** (phone, street address). Attestation **SECRED-FORM-001** and evidence uploads belong in your controlled evidence store after Step 3.

## Step 2 (SCPs) — what the validator does

- Lists **SCPs attached at the organization root** (`list_policies_for_target`).
- **WARN** if only AWS-managed SCPs are present (prompt to attach your custom guardrail SCPs).
- **PASS** when at least one **custom** (`AwsManaged == false`) SCP is attached at root.
- Optional **exact name** check via `GOVCLOUD_EXPECTED_SCP_NAMES`.

SCPs attached to **OUs** only are not fully validated yet; say if you want OU-target checks next.

## What you can provide next

- **SCP names** (as attached at root) for `GOVCLOUD_EXPECTED_SCP_NAMES`.
- **Org CloudTrail / delegated admin** account ids once Step 3 accounts exist.
- **VPC tags**, **ECS cluster names**, **Cognito pool ids**, **Aurora cluster id** for tighter resource-level checks.
- **Smoke URL** (`ASAF_SMOKE_HEALTH_URL`) when the API is live.
