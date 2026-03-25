#!/usr/bin/env bash
# Example exports for govcloud_validation (placeholders only — no production identifiers in git).
# Copy to a local file (e.g. secred-govcloud.env.local.sh), replace placeholders, source before runs.
# Do not commit files containing real session tokens, access keys, or org-specific resource ids.

export AWS_REGION=us-gov-west-1
export AWS_DEFAULT_REGION=us-gov-west-1

# Core identity / org
export GOVCLOUD_EXPECTED_ACCOUNT_ID=123456789012
export GOVCLOUD_EXPECTED_ORG_ID=o-xxxxxxxxxx
export GOVCLOUD_EXPECTED_ROOT_ID=r-xxxx
export GOVCLOUD_EXPECTED_OU_IDS=ou-xxxx-aaaaaaa,ou-xxxx-bbbbbbb,ou-xxxx-ccccccc,ou-xxxx-ddddddd,ou-xxxx-eeeeeee,ou-xxxx-fffffff

# IAM Identity Center
export GOVCLOUD_EXPECTED_IDC_INSTANCE_ID=ssoins-xxxxxxxxxxxxxxxx
export GOVCLOUD_EXPECTED_IDENTITY_STORE_ID=d-xxxxxxxxxx
export GOVCLOUD_EXPECTED_PERMISSION_SET_NAME=YourWorkloadPermissionSet
export GOVCLOUD_EXPECTED_PERMISSION_SET_ARN=arn:aws-us-gov:sso:::permissionSet/ssoins-xxxxxxxxxxxxxxxx/ps-xxxxxxxxxxxxxxxx
export GOVCLOUD_EXPECT_PS_ABAC_USPERSON=1

# SCP / RCP (split root vs OU attachments)
# Root allows at most 5 SCPs (FullAWSAccess + 4 custom). If DenyRootAccountUsage is on Workloads only, keep it OFF this line and add it to WORKLOADS_OU below.
export GOVCLOUD_EXPECTED_SCP_NAMES=DenyNonGovRegions,DenyS3PublicAccess,ForceTLS,DenyDisableSecurityServices
# Workloads OU id from: aws organizations list-organizational-units-for-parent --parent-id <root>
export GOVCLOUD_EXPECTED_WORKLOADS_OU_ID=ou-xxxx-workloads
# Custom SCP names only — paste from list-policies-for-target on that OU (order irrelevant).
# FullAWSAccess is usually attached; you do not need to list it. Do not list SCPs attached only on child OUs.
export GOVCLOUD_EXPECTED_SCP_NAMES_WORKLOADS_OU=DenyEC2WithPublicIP,DenyUnencryptedStorage,RequireIMDSv2,DenyRootAccountUsage
export GOVCLOUD_EXPECTED_SECURITY_OU_ID=ou-xxxx-security
export GOVCLOUD_EXPECTED_RCP_NAMES=DenyExternalResourceAccess

# Step 3 — logging / evidence / Security Hub
export GOVCLOUD_EXPECTED_CLOUDTRAIL_NAME=your-org-trail
export GOVCLOUD_EXPECTED_CONFIG_RECORDER_NAME=default
export GOVCLOUD_CHECK_CONFIG_RECORDER=1
export GOVCLOUD_EXPECTED_EVIDENCE_BUCKET=your-evidence-123456789012
export GOVCLOUD_EXPECT_EVIDENCE_OBJECT_LOCK=1
export GOVCLOUD_EXPECT_EVIDENCE_OBJECT_LOCK_RETENTION_DAYS=2555
export GOVCLOUD_MIN_ENABLED_SECURITY_HUB_STANDARDS=7

# Optional hardening (uncomment for stricter Step 3 checks)
# export GOVCLOUD_CHECK_IAM_PASSWORD_POLICY=1
# export GOVCLOUD_EXPECT_IAM_PASSWORD_MIN_LENGTH=14
# export GOVCLOUD_CHECK_ACCOUNT_SECURITY_CONTACT=1
# export GOVCLOUD_S3_BUCKETS_VERIFY_PAB=bucket-a,bucket-b

# Step 4 — VPC
export GOVCLOUD_EXPECTED_VPC_ID=vpc-0123456789abcdef0
export GOVCLOUD_EXPECTED_VPC_SUBNET_COUNT=6

# Step 8 — KMS aliases (with or without alias/ prefix)
export GOVCLOUD_EXPECTED_KMS_ALIASES=your-cloudtrail-cmk,your-evidence-cmk
