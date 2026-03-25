# GovCloud deployment reference (template)

**Purpose:** Describe how to map your **internal** deployment inventory (org-approved storage only) to `govcloud_validation` environment variables. **Do not** paste production account IDs, ARNs, OU ids, resource ids, or KMS key material into this repository.

**Primary GovCloud region (example):** `us-gov-west-1`

Replace every placeholder below with values from your CMDB or internal runbook. Keep authoritative, environment-specific data in **gitignored** local files (for example `examples/secred-govcloud.env.local.sh`) or your secret manager.

---

## 1. Organization & Identity Center

| Item | Placeholder / notes |
|------|---------------------|
| GovCloud workload account | `YOUR_GOVCLOUD_ACCOUNT_ID` |
| Commercial paired account (if applicable) | `YOUR_COMMERCIAL_ACCOUNT_ID` |
| Organization ID | `o-xxxxxxxxxx` |
| Root ID | `r-xxxx` |
| IAM Identity Center instance id | `ssoins-…` |
| Identity store ID | `d-…` |
| Access portal | `https://start.us-gov-home.awsapps.com/directory/d-…` |
| Permission set name / ARN | e.g. workload admin set — copy exact ARN from IAM Identity Center |
| US-persons group | e.g. `USPersons` |
| ABAC | Align with `GOVCLOUD_EXPECT_PS_ABAC_USPERSON` and your directory attributes |

---

## 2. Organizational units

Document your OU tree (Security, Audit, Log-Archive, Workloads, Non-Prod, Prod, etc.) and list ids in `GOVCLOUD_EXPECTED_OU_IDS`. **OU ids are easy to mis-copy** (similar characters); confirm via the Organizations API or console.

---

## 3. Policies (SCP / RCP)

- **Root SCPs:** names in `GOVCLOUD_EXPECTED_SCP_NAMES` must match what is attached at the organization root (or your chosen attachment scope).
- **Workloads OU SCPs:** set `GOVCLOUD_EXPECTED_WORKLOADS_OU_ID` and `GOVCLOUD_EXPECTED_SCP_NAMES_WORKLOADS_OU` to the OU where those policies are attached (child OUs may differ from the parent).
- **Security OU RCPs:** `GOVCLOUD_EXPECTED_SECURITY_OU_ID` + `GOVCLOUD_EXPECTED_RCP_NAMES`.

---

## 4. Networking

Capture expected VPC id, subnet layout, and route expectations in env vars (`GOVCLOUD_EXPECTED_VPC_ID`, `GOVCLOUD_EXPECTED_VPC_SUBNET_COUNT`, etc.). Interface and gateway endpoint ids stay in operational CMDB, not in git.

---

## 5. Logging, detection, and compliance

| Area | Env / notes |
|------|-------------|
| Org CloudTrail | `GOVCLOUD_EXPECTED_CLOUDTRAIL_NAME` |
| AWS Config | `GOVCLOUD_EXPECTED_CONFIG_RECORDER_NAME`, `GOVCLOUD_CHECK_CONFIG_RECORDER` |
| Security Hub | `GOVCLOUD_MIN_ENABLED_SECURITY_HUB_STANDARDS` (sanity count) |
| Evidence bucket | `GOVCLOUD_EXPECTED_EVIDENCE_BUCKET` + Object Lock expectations |

---

## 6. Evidence & crypto

Record CMK **aliases** you expect (`GOVCLOUD_EXPECTED_KMS_ALIASES`). Key UUIDs and bucket policies belong in internal docs.

---

## 7. Validator env quick reference

See `govcloud_validation/README.md` and `govcloud_validation/examples/secred-govcloud.env.example.sh` (placeholders only). Copy to a **local** file, fill with real values, `source` before runs; never commit populated env files.

## 8. Compliance program & control matrix

For **system boundaries**, **SSP alignment**, **policies/procedures**, **sampling**, and **assessor interpretation** of PASS/WARN/SKIP — see [GOVCLOUD_COMPLIANCE_PROGRAM.md](./GOVCLOUD_COMPLIANCE_PROGRAM.md). For check-level framework mapping, see `govcloud_validation/compliance_matrix.yaml`.
