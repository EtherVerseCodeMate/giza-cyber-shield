#!/usr/bin/env bash
# SecRed / NouchiX GovCloud — example exports for govcloud_validation (no secrets).
# Copy to a local file (e.g. secred-govcloud.env.local.sh), fill gaps, source before runs.
# Do not commit files containing real session tokens or access keys.

export AWS_REGION=us-gov-west-1
export AWS_DEFAULT_REGION=us-gov-west-1

# Core identity / org
export GOVCLOUD_EXPECTED_ACCOUNT_ID=483774310865
export GOVCLOUD_EXPECTED_ORG_ID=o-3zz5j5d5bt
export GOVCLOUD_EXPECTED_ROOT_ID=r-u7nb
export GOVCLOUD_EXPECTED_OU_IDS=ou-u7nb-uvf0mgwa,ou-u7nb-5ziwfsio,ou-u7nb-qy1f21e7,ou-u7nb-n6kql2ww,ou-u7nb-6kwa4aiv,ou-u7nb-by022kuw

# IAM Identity Center
export GOVCLOUD_EXPECTED_IDC_INSTANCE_ID=ssoins-7907091dd7d987a2
export GOVCLOUD_EXPECTED_IDENTITY_STORE_ID=d-98676a2943
export GOVCLOUD_EXPECTED_PERMISSION_SET_NAME=CUIWorkloadAccess
export GOVCLOUD_EXPECTED_PERMISSION_SET_ARN=arn:aws-us-gov:sso:::permissionSet/ssoins-7907091dd7d987a2/ps-5325bb5a5aab246e
export GOVCLOUD_EXPECT_PS_ABAC_USPERSON=1

# SCP / RCP (split root vs OU attachments)
export GOVCLOUD_EXPECTED_SCP_NAMES=DenyNonGovRegions,DenyS3PublicAccess,ForceTLS,DenyDisableSecurityServices,DenyRootAccountUsage
# Workloads OU id confirmed via Organizations API: ou-u7nb-n6kql2ww (letter l)
export GOVCLOUD_EXPECTED_WORKLOADS_OU_ID=ou-u7nb-n6kql2ww
export GOVCLOUD_EXPECTED_SCP_NAMES_WORKLOADS_OU=DenyNonApprovedServices,DenyCUIWithoutUSPersonTag,DenyEC2WithPublicIP,DenyUnencryptedStorage,RequireIMDSv2
export GOVCLOUD_EXPECTED_SECURITY_OU_ID=ou-u7nb-uvf0mgwa
export GOVCLOUD_EXPECTED_RCP_NAMES=DenyExternalResourceAccess

# Step 3 — logging / evidence / Security Hub
export GOVCLOUD_EXPECTED_CLOUDTRAIL_NAME=secred-govcloud-org-trail
export GOVCLOUD_EXPECTED_CONFIG_RECORDER_NAME=default
export GOVCLOUD_CHECK_CONFIG_RECORDER=1
export GOVCLOUD_EXPECTED_EVIDENCE_BUCKET=secred-evidence-483774310865
export GOVCLOUD_EXPECT_EVIDENCE_OBJECT_LOCK=1
export GOVCLOUD_EXPECT_EVIDENCE_OBJECT_LOCK_RETENTION_DAYS=2555
export GOVCLOUD_MIN_ENABLED_SECURITY_HUB_STANDARDS=7

# Step 4 — VPC
export GOVCLOUD_EXPECTED_VPC_ID=vpc-0ee43511e5e596609
export GOVCLOUD_EXPECTED_VPC_SUBNET_COUNT=6

# Step 8 — KMS aliases (with or without alias/ prefix)
export GOVCLOUD_EXPECTED_KMS_ALIASES=secred-cloudtrail-cmk,secred-evidence-cmk
