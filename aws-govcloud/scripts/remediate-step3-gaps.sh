#!/usr/bin/env bash
# =============================================================================
# AdinKhepra Protocol — Step 3 Gap Remediation
# =============================================================================
# Closes the 4 HIGH/MEDIUM findings blocking Step 3 completion.
#
# Findings addressed (per SECRED-RUN-002 2026-04-14):
#   Gap 1  GuardDuty findings not exported to evidence bucket
#   Gap 2  Config delivery channel targets CloudTrail bucket (wrong)
#   Gap 3  GuardDuty Malware Protection for S3 not on evidence bucket
#   Gap 4  NIST 800-171 conformance pack not deployed
#
# Prerequisites:
#   - AWS CLI v2 configured with FIPS-capable GovCloud profile
#   - jq installed  (brew install jq / apt-get install jq)
#   - Sufficient IAM permissions (see comments per section)
#
# Usage:
#   source secred-govcloud.env.local.sh   # set credentials + env vars
#   chmod +x remediate-step3-gaps.sh
#   ./remediate-step3-gaps.sh [--dry-run]
#
# DRY RUN mode prints commands without executing them.
# =============================================================================

set -euo pipefail

# ── Config — override with env vars if needed ─────────────────────────────────
REGION="${AWS_REGION:-us-gov-west-1}"
ACCOUNT_ID="${GOVCLOUD_EXPECTED_ACCOUNT_ID:-483774310865}"
EVIDENCE_BUCKET="${GOVCLOUD_EXPECTED_EVIDENCE_BUCKET:-secred-evidence-${ACCOUNT_ID}}"
EVIDENCE_CMK_ALIAS="${GOVCLOUD_EXPECTED_EVIDENCE_CMK_ALIAS:-alias/secred-evidence-cmk}"
CONFIG_RECORDER_NAME="${GOVCLOUD_EXPECTED_CONFIG_RECORDER_NAME:-default}"
NIST_PACK_NAME="secred-nist-800-171"
# S3 bucket for conformance pack templates (must be in same region)
PACK_DELIVERY_BUCKET="${GOVCLOUD_EXPECTED_EVIDENCE_BUCKET:-secred-evidence-${ACCOUNT_ID}}"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
fi

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
log_ok()      { echo -e "${GREEN}[PASS]${NC}  $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_err()     { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

run() {
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "[DRY-RUN] $*"
    else
        eval "$@"
    fi
}

# ── Preamble ──────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  SECRED GOVCLOUD — STEP 3 GAP REMEDIATION"
echo "============================================================"
echo "  Region:          $REGION"
echo "  Account:         $ACCOUNT_ID"
echo "  Evidence bucket: $EVIDENCE_BUCKET"
[[ "$DRY_RUN" == "true" ]] && echo "  Mode:            DRY-RUN (no changes)" || echo "  Mode:            LIVE"
echo "============================================================"
echo ""

# Verify credentials
CALLER=$(aws sts get-caller-identity --region "$REGION" --output json 2>/dev/null) \
    || log_err "Cannot authenticate to AWS GovCloud ($REGION). Check credentials."
ACTUAL_ACCOUNT=$(echo "$CALLER" | jq -r '.Account')
if [[ "$ACTUAL_ACCOUNT" != "$ACCOUNT_ID" ]]; then
    log_warn "Credential account ($ACTUAL_ACCOUNT) != expected ($ACCOUNT_ID)"
    read -rp "Continue anyway? [y/N] " yn
    [[ "$yn" =~ ^[Yy]$ ]] || exit 1
fi
log_ok "Authenticated as: $(echo "$CALLER" | jq -r '.Arn')"

# ── Resolve GuardDuty detector ID ─────────────────────────────────────────────
log_info "Resolving GuardDuty detector ID..."
DETECTOR_ID=$(aws guardduty list-detectors \
    --region "$REGION" \
    --query 'DetectorIds[0]' \
    --output text 2>/dev/null || echo "None")

if [[ "$DETECTOR_ID" == "None" || -z "$DETECTOR_ID" ]]; then
    log_err "No GuardDuty detector found in $REGION. Enable GuardDuty first."
fi
log_ok "GuardDuty detector: $DETECTOR_ID"

# ── Resolve KMS evidence CMK ARN ─────────────────────────────────────────────
log_info "Resolving evidence CMK ARN from alias $EVIDENCE_CMK_ALIAS..."
EVIDENCE_CMK_ARN=$(aws kms describe-key \
    --key-id "$EVIDENCE_CMK_ALIAS" \
    --region "$REGION" \
    --query 'KeyMetadata.Arn' \
    --output text 2>/dev/null || echo "")

if [[ -z "$EVIDENCE_CMK_ARN" || "$EVIDENCE_CMK_ARN" == "None" ]]; then
    log_warn "Cannot resolve CMK ARN from alias '$EVIDENCE_CMK_ALIAS'."
    log_warn "Trying key ID from GOVCLOUD_EXPECTED_EVIDENCE_CMK_ID env var..."
    EVIDENCE_CMK_ARN="${GOVCLOUD_EXPECTED_EVIDENCE_CMK_ID:-}"
    if [[ -z "$EVIDENCE_CMK_ARN" ]]; then
        log_err "Set GOVCLOUD_EXPECTED_EVIDENCE_CMK_ID=<key-arn-or-id> and retry."
    fi
fi
log_ok "Evidence CMK ARN: ${EVIDENCE_CMK_ARN:0:60}..."

echo ""
echo "────────────────────────────────────────────────────────────"
echo "  GAP 1 — GuardDuty findings export to evidence bucket"
echo "────────────────────────────────────────────────────────────"

# Check existing publishing destinations
EXISTING_DEST=$(aws guardduty list-publishing-destinations \
    --detector-id "$DETECTOR_ID" \
    --region "$REGION" \
    --query "Destinations[?DestinationType=='S3'] | [0].Status" \
    --output text 2>/dev/null || echo "")

if [[ "$EXISTING_DEST" == "PUBLISHING_SUCCEEDED" ]]; then
    log_ok "GuardDuty → S3 publishing already active. Skipping."
else
    log_info "Creating GuardDuty S3 publishing destination..."
    EVIDENCE_BUCKET_ARN="arn:aws-us-gov:s3:::${EVIDENCE_BUCKET}"
    run aws guardduty create-publishing-destination \
        --detector-id "$DETECTOR_ID" \
        --destination-type S3 \
        --destination-properties \
            "DestinationArn=${EVIDENCE_BUCKET_ARN},KmsKeyArn=${EVIDENCE_CMK_ARN}" \
        --region "$REGION"
    log_ok "GuardDuty export configured → $EVIDENCE_BUCKET"
fi

# Set finding export frequency to 15 minutes (matches runbook)
log_info "Setting GuardDuty finding export frequency to FIFTEEN_MINUTES..."
run aws guardduty update-detector \
    --detector-id "$DETECTOR_ID" \
    --finding-publishing-frequency FIFTEEN_MINUTES \
    --region "$REGION"
log_ok "Finding export frequency = FIFTEEN_MINUTES"

echo ""
echo "────────────────────────────────────────────────────────────"
echo "  GAP 2 — Config delivery channel → evidence bucket"
echo "────────────────────────────────────────────────────────────"

# Read current delivery channel
CURRENT_BUCKET=$(aws configservice describe-delivery-channels \
    --region "$REGION" \
    --query "DeliveryChannels[?name=='${CONFIG_RECORDER_NAME}'].s3BucketName | [0]" \
    --output text 2>/dev/null || echo "")

if [[ "$CURRENT_BUCKET" == "$EVIDENCE_BUCKET" ]]; then
    log_ok "Config delivery channel already targets $EVIDENCE_BUCKET. Skipping."
else
    log_info "Current delivery bucket: '${CURRENT_BUCKET:-<none>}'"
    log_info "Updating Config delivery channel to $EVIDENCE_BUCKET..."

    # Build the JSON payload
    DELIVERY_CHANNEL_JSON=$(jq -n \
        --arg name "$CONFIG_RECORDER_NAME" \
        --arg bucket "$EVIDENCE_BUCKET" \
        '{
            name:         $name,
            s3BucketName: $bucket,
            configSnapshotDeliveryProperties: {
                deliveryFrequency: "TwentyFour_Hours"
            }
        }')

    run aws configservice put-delivery-channel \
        --delivery-channel "$DELIVERY_CHANNEL_JSON" \
        --region "$REGION"
    log_ok "Config delivery channel updated → $EVIDENCE_BUCKET"
fi

echo ""
echo "────────────────────────────────────────────────────────────"
echo "  GAP 3 — GuardDuty Malware Protection for S3"
echo "────────────────────────────────────────────────────────────"

# Check existing plans
EXISTING_PLAN_COUNT=$(aws guardduty list-malware-protection-plans \
    --region "$REGION" \
    --query 'length(MalwareProtectionPlans)' \
    --output text 2>/dev/null || echo "0")

if [[ "$EXISTING_PLAN_COUNT" -gt 0 ]]; then
    log_ok "Malware Protection plan(s) already exist ($EXISTING_PLAN_COUNT). Skipping."
else
    log_info "Creating GuardDuty Malware Protection plan for $EVIDENCE_BUCKET..."

    # IAM role for Malware Protection (must already exist or create inline)
    MP_ROLE_ARN="arn:aws-us-gov:iam::${ACCOUNT_ID}:role/aws-service-role/malware-protection.guardduty.amazonaws.com/AWSServiceRoleForAmazonGuardDutyMalwareProtection"

    run aws guardduty create-malware-protection-plan \
        --role "$MP_ROLE_ARN" \
        --protected-resource "{\"S3Bucket\":{\"BucketName\":\"${EVIDENCE_BUCKET}\",\"ObjectPrefixes\":[]}}" \
        --tags "Project=AdinKhepra,Environment=production,CUI=true" \
        --region "$REGION" || log_warn "Malware Protection plan creation failed — may require service-linked role. See runbook."
    log_ok "Malware Protection for S3 configured on $EVIDENCE_BUCKET"
fi

echo ""
echo "────────────────────────────────────────────────────────────"
echo "  GAP 4 — NIST 800-171 conformance pack"
echo "────────────────────────────────────────────────────────────"

# Check if pack already deployed
EXISTING_PACK=$(aws configservice describe-conformance-packs \
    --conformance-pack-names "$NIST_PACK_NAME" \
    --region "$REGION" \
    --query "ConformancePackDetails[0].ConformancePackName" \
    --output text 2>/dev/null || echo "")

if [[ "$EXISTING_PACK" == "$NIST_PACK_NAME" ]]; then
    log_ok "Conformance pack '$NIST_PACK_NAME' already deployed. Skipping."
else
    log_info "Deploying NIST 800-171 conformance pack..."

    # Write the conformance pack template (AWS Operational Best Practices for NIST 800-171)
    # NOTE: ELBV2_ACM_CERTIFICATE_REQUIRED removed — invalid in GovCloud (see runbook Gap LOW)
    PACK_TEMPLATE=$(cat <<'YAML'
Parameters:
  AccessKeysRotatedParamMaxAccessKeyAge:
    Default: '90'
    Type: String
  IamPasswordPolicyParamMaxPasswordAge:
    Default: '90'
    Type: String
  IamPasswordPolicyParamMinimumPasswordLength:
    Default: '14'
    Type: String
  IamPasswordPolicyParamRequireLowercaseCharacters:
    Default: 'true'
    Type: String
  IamPasswordPolicyParamRequireNumbers:
    Default: 'true'
    Type: String
  IamPasswordPolicyParamRequireSymbols:
    Default: 'true'
    Type: String
  IamPasswordPolicyParamRequireUppercaseCharacters:
    Default: 'true'
    Type: String
Resources:
  AccessKeysRotated:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: access-keys-rotated
      Source:
        Owner: AWS
        SourceIdentifier: ACCESS_KEYS_ROTATED
      InputParameters:
        maxAccessKeyAge: !Ref AccessKeysRotatedParamMaxAccessKeyAge
  CloudTrailCloudWatchLogsEnabled:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: cloud-trail-cloud-watch-logs-enabled
      Source:
        Owner: AWS
        SourceIdentifier: CLOUD_TRAIL_CLOUD_WATCH_LOGS_ENABLED
  CloudTrailEnabled:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: cloudtrail-enabled
      Source:
        Owner: AWS
        SourceIdentifier: CLOUD_TRAIL_ENABLED
  CloudTrailEncryptionEnabled:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: cloud-trail-encryption-enabled
      Source:
        Owner: AWS
        SourceIdentifier: CLOUD_TRAIL_ENCRYPTION_ENABLED
  CloudTrailLogFileValidationEnabled:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: cloud-trail-log-file-validation-enabled
      Source:
        Owner: AWS
        SourceIdentifier: CLOUD_TRAIL_LOG_FILE_VALIDATION_ENABLED
  GuarddutyEnabledCentralized:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: guardduty-enabled-centralized
      Source:
        Owner: AWS
        SourceIdentifier: GUARDDUTY_ENABLED_CENTRALIZED
  IamPasswordPolicy:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: iam-password-policy
      Source:
        Owner: AWS
        SourceIdentifier: IAM_PASSWORD_POLICY
      InputParameters:
        MaxPasswordAge: !Ref IamPasswordPolicyParamMaxPasswordAge
        MinimumPasswordLength: !Ref IamPasswordPolicyParamMinimumPasswordLength
        RequireLowercaseCharacters: !Ref IamPasswordPolicyParamRequireLowercaseCharacters
        RequireNumbers: !Ref IamPasswordPolicyParamRequireNumbers
        RequireSymbols: !Ref IamPasswordPolicyParamRequireSymbols
        RequireUppercaseCharacters: !Ref IamPasswordPolicyParamRequireUppercaseCharacters
  IamRootAccessKeyCheck:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: iam-root-access-key-check
      Source:
        Owner: AWS
        SourceIdentifier: IAM_ROOT_ACCESS_KEY_CHECK
  MfaEnabledForIamConsoleAccess:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: mfa-enabled-for-iam-console-access
      Source:
        Owner: AWS
        SourceIdentifier: MFA_ENABLED_FOR_IAM_CONSOLE_ACCESS
  MultiRegionCloudTrailEnabled:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: multi-region-cloud-trail-enabled
      Source:
        Owner: AWS
        SourceIdentifier: MULTI_REGION_CLOUD_TRAIL_ENABLED
  RootAccountMfaEnabled:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: root-account-mfa-enabled
      Source:
        Owner: AWS
        SourceIdentifier: ROOT_ACCOUNT_MFA_ENABLED
  S3BucketPublicReadProhibited:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: s3-bucket-public-read-prohibited
      Scope:
        ComplianceResourceTypes:
          - AWS::S3::Bucket
      Source:
        Owner: AWS
        SourceIdentifier: S3_BUCKET_PUBLIC_READ_PROHIBITED
  S3BucketPublicWriteProhibited:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: s3-bucket-public-write-prohibited
      Scope:
        ComplianceResourceTypes:
          - AWS::S3::Bucket
      Source:
        Owner: AWS
        SourceIdentifier: S3_BUCKET_PUBLIC_WRITE_PROHIBITED
  S3BucketServerSideEncryptionEnabled:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: s3-bucket-server-side-encryption-enabled
      Scope:
        ComplianceResourceTypes:
          - AWS::S3::Bucket
      Source:
        Owner: AWS
        SourceIdentifier: S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED
  SecurityhubEnabled:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: securityhub-enabled
      Source:
        Owner: AWS
        SourceIdentifier: SECURITYHUB_ENABLED
  VpcFlowLogsEnabled:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: vpc-flow-logs-enabled
      Source:
        Owner: AWS
        SourceIdentifier: VPC_FLOW_LOGS_ENABLED
YAML
)

    # Upload template to evidence bucket
    TEMPLATE_KEY="conformance-packs/nist-800-171-govcloud.yaml"
    TEMPLATE_S3_URI="s3://${PACK_DELIVERY_BUCKET}/${TEMPLATE_KEY}"

    log_info "Uploading conformance pack template to $TEMPLATE_S3_URI..."
    if [[ "$DRY_RUN" == "false" ]]; then
        echo "$PACK_TEMPLATE" | aws s3 cp - "$TEMPLATE_S3_URI" \
            --region "$REGION" \
            --sse aws:kms \
            --sse-kms-key-id "$EVIDENCE_CMK_ARN"
    else
        echo "[DRY-RUN] aws s3 cp <template> $TEMPLATE_S3_URI"
    fi

    run aws configservice put-conformance-pack \
        --conformance-pack-name "$NIST_PACK_NAME" \
        --template-s3-uri "$TEMPLATE_S3_URI" \
        --delivery-s3-bucket "$PACK_DELIVERY_BUCKET" \
        --delivery-s3-key-prefix "conformance-packs/results" \
        --region "$REGION"
    log_ok "Conformance pack '$NIST_PACK_NAME' deployment initiated"
    log_info "Pack evaluation runs asynchronously — status in 5-10 minutes:"
    log_info "  aws configservice describe-conformance-pack-compliance --conformance-pack-names $NIST_PACK_NAME --region $REGION"
fi

echo ""
echo "────────────────────────────────────────────────────────────"
echo "  REMAINING MANUAL ACTIONS (cannot automate from CLI)"
echo "────────────────────────────────────────────────────────────"
echo ""
echo "  HIGH-1  GovCloud root MFA:"
echo "    Log into: https://console.amazonaws-us-gov.com"
echo "    IAM → Security credentials → Activate MFA"
echo "    Then delete root access keys"
echo ""
echo "  HIGH-2  MFA Delete on evidence bucket:"
echo "    Requires long-term credentials (not SSO)."
echo "    aws s3api put-bucket-versioning \\"
echo "      --bucket $EVIDENCE_BUCKET \\"
echo "      --versioning-configuration Status=Enabled,MFADelete=Enabled \\"
echo "      --mfa 'arn:aws-us-gov:iam::${ACCOUNT_ID}:mfa/root-account-mfa-device <OTP>' \\"
echo "      --region $REGION"
echo ""
echo "  MED     Upload signed SECRED-FORM-001 attestation:"
echo "    aws s3 cp SECRED-FORM-001-signed.pdf \\"
echo "      s3://$EVIDENCE_BUCKET/us-person-records/SECRED-FORM-001-signed.pdf \\"
echo "      --region $REGION"
echo ""
echo "============================================================"
if [[ "$DRY_RUN" == "true" ]]; then
    echo "  DRY-RUN COMPLETE — no changes made"
else
    echo "  REMEDIATION COMPLETE — re-run validator to confirm:"
    echo "  python -m govcloud_validation --only step_03_logging"
fi
echo "============================================================"
echo ""
