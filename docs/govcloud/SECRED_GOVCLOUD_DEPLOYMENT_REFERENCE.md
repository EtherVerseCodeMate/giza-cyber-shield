# SecRed GovCloud deployment reference (CUI / CMMC L2)

**Organization:** SecRed Knowledge Inc. (NouchiX)  
**Primary region:** `us-gov-west-1`  
**Account (SecDev225):** `483774310865`  
**Generated / snapshot:** 2026-03-24  

Handle per **CUI** policy. Do not distribute outside authorized channels.

This document mirrors live inventory used to configure `govcloud_validation` optional checks. **Corrected note:** the Workloads OU id is **`ou-u7nb-n6kql2ww`** (letter `l`), not `…n6kqi2ww`.

---

## 1. Organization & Identity Center

| Item | Value |
|------|--------|
| Commercial paired account | `445971788114` |
| Organization ID | `o-3zz5j5d5bt` |
| Root ID | `r-u7nb` |
| IAM Identity Center instance | `ssoins-7907091dd7d987a2` (`nouchix-govcloud-prod`) |
| Identity store ID | `d-98676a2943` |
| Access portal | `https://start.us-gov-home.awsapps.com/directory/d-98676a2943` |
| Instance ARN | `arn:aws-us-gov:sso:::instance/ssoins-7907091dd7d987a2` |
| CUI permission set | `CUIWorkloadAccess` — `AdministratorAccess`, 4h session |
| Permission set ARN | `arn:aws-us-gov:sso:::permissionSet/ssoins-7907091dd7d987a2/ps-5325bb5a5aab246e` |
| US-persons group | `USPersons` |
| ABAC (directory) | `us_person` ← `${path:groups[displayName eq "USPersons"].displayName}` |
| ABAC (permission set tag) | `usPerson=true` (validated by `GOVCLOUD_EXPECT_PS_ABAC_USPERSON=1`) |

---

## 2. Organizational units

| OU | ID | Parent |
|----|-----|--------|
| Security | `ou-u7nb-uvf0mgwa` | Root |
| Audit | `ou-u7nb-5ziwfsio` | Security |
| Log-Archive | `ou-u7nb-qy1f21e7` | Security |
| Workloads | `ou-u7nb-n6kql2ww` | Root |
| Non-Prod | `ou-u7nb-6kwa4aiv` | Workloads |
| Prod | `ou-u7nb-by022kuw` | Workloads |

---

## 3. Policies (SCP / RCP) — intent

**Root (SCP)** examples: `DenyNonGovRegions`, `DenyS3PublicAccess`, `ForceTLS`, `DenyDisableSecurityServices`, `DenyRootAccountUsage` (exact attachment set is validated via `GOVCLOUD_EXPECTED_SCP_NAMES`).

**Workloads OU (SCP)** examples: `DenyNonApprovedServices`, `DenyCUIWithoutUSPersonTag` — use `GOVCLOUD_EXPECTED_WORKLOADS_OU_ID` + `GOVCLOUD_EXPECTED_SCP_NAMES_WORKLOADS_OU`.

**Security OU (RCP)** example: `DenyExternalResourceAccess` — use `GOVCLOUD_EXPECTED_SECURITY_OU_ID` + `GOVCLOUD_EXPECTED_RCP_NAMES`.

---

## 4. Networking (production VPC snapshot)

| Resource | ID / value |
|----------|------------|
| VPC | `vpc-0ee43511e5e596609` — `10.0.0.0/16` |
| IGW | `igw-0eff38996003885c1` |
| NAT | `nat-0b2bf56d5a6ee2a49` |
| Public subnets | `subnet-068736b20e45e2c90`, `subnet-060ee155d68e4e131` |
| Private (ECS) | `subnet-08fbb2175061caf7f`, `subnet-09080e70bb6490d6a` |
| Isolated (Aurora) | `subnet-0db323b77f4eb2507`, `subnet-0425ea3ba2eea36ef` |
| Route tables | `rtb-086bf9aec76b63fd7` (public), `rtb-0b2fb89099545e230`, `rtb-0d051d1dda6643723` (private), `rtb-0ed1a11b197ab3e68` (isolated) |

VPC endpoints (interface/gateway) include S3 gateway, ECR API/DKR, KMS FIPS, Secrets Manager FIPS, CloudWatch Logs, STS, Bedrock Runtime FIPS (exact ids in operational CMDB).

---

## 5. Logging, detection, and compliance services

| Service | Reference name / bucket / key |
|---------|-------------------------------|
| CloudTrail (org) | `secred-govcloud-org-trail` — bucket `secred-cloudtrail-483774310865`, CMK `secred-cloudtrail-cmk` |
| CloudWatch Logs | `/aws/cloudtrail/secred-govcloud` |
| GuardDuty | Enabled (multiple protection plans); malware protection bucket e.g. `secred-cloudtrail-483774310865` |
| AWS Config | Recorder `default`; delivery prefix `config/`; aggregator `secred-govcloud-aggregator` |
| Security Hub | Multiple standards enabled (NIST 800-171 rev2, NIST 800-53 rev5, CIS, FSBP, etc.) — use `GOVCLOUD_MIN_ENABLED_SECURITY_HUB_STANDARDS` to sanity-check count |

---

## 6. Evidence & crypto

| Item | Value |
|------|--------|
| Evidence bucket | `secred-evidence-483774310865` — SSE-KMS `secred-evidence-cmk` |
| Object Lock | COMPLIANCE mode — **2555 days** (verify with validator envs) |
| CloudTrail CMK | `d60172a4-69de-4cfe-8e37-d77bbfdbbf15` (`alias/secred-cloudtrail-cmk`) |
| Evidence CMK | `0ad63ea9-7a38-4965-b284-d4a2d0df3a92` (`alias/secred-evidence-cmk`) |

---

## 7. Known gaps & remediation (track in runbook)

| Gap | Remediation |
|-----|-------------|
| MFA delete on evidence bucket | Enable with stable admin credentials per AWS guidance |
| GuardDuty export to evidence bucket | Configure export to `secred-evidence-483774310865` |
| Config delivery target | Prefer evidence bucket once Object Lock defaults are confirmed |
| Malware protection for evidence bucket | Add scanning target for `secred-evidence-483774310865` |
| STS “FIPS” endpoint in GovCloud | Document limitation; STS via standard endpoint / VPC endpoint |
| SECRED-FORM-001 | Upload to `s3://secred-evidence-483774310865/us-person-records/` |
| NIST 800-172 pack | GovCloud rule exclusions (e.g. ELBV2 ACM) — custom conformance pack |

---

## 8. Validator env quick reference

See `govcloud_validation/README.md` and `govcloud_validation/examples/secred-govcloud.env.example.sh` for copy-paste exports aligned with this inventory.
