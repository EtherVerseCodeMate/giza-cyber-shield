#!/usr/bin/env bash
# =============================================================================
# AdinKhepra Protocol — Step 4 Security Groups
# =============================================================================
# Creates the three security groups required before Steps 5-6 can start:
#   ALB-SG    Internet-facing HTTPS ingress (port 443 from 0.0.0.0/0)
#   ECS-SG    App tier — ingress from ALB-SG only
#   Aurora-SG Database tier — ingress from ECS-SG on 5432 only
#
# Prerequisites:
#   - AWS CLI v2 with GovCloud credentials
#   - VPC vpc-0ee43511e5e596609 already exists (Step 4 complete)
#   - jq installed
#
# Usage:
#   source secred-govcloud.env.local.sh
#   chmod +x create-security-groups.sh
#   ./create-security-groups.sh [--dry-run]
# =============================================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
REGION="${AWS_REGION:-us-gov-west-1}"
ACCOUNT_ID="${GOVCLOUD_EXPECTED_ACCOUNT_ID:-483774310865}"
VPC_ID="${GOVCLOUD_EXPECTED_VPC_ID:-vpc-0ee43511e5e596609}"
APP_PORT="${ASAF_APP_PORT:-8080}"          # ECS container port
PROJECT_TAG="AdinKhepra"
ENV_TAG="production"

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

log_info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[PASS]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_err()   { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

run() {
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "[DRY-RUN] $*"
        echo "sg-dryrun000000000"   # fake SG ID for dry-run chaining
        return 0
    fi
    eval "$@"
}

# ── Preamble ──────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  SECRED GOVCLOUD — CREATE SECURITY GROUPS (Step 4)"
echo "============================================================"
echo "  Region:  $REGION"
echo "  Account: $ACCOUNT_ID"
echo "  VPC:     $VPC_ID"
[[ "$DRY_RUN" == "true" ]] && echo "  Mode:    DRY-RUN" || echo "  Mode:    LIVE"
echo "============================================================"
echo ""

# Verify credentials + VPC
aws sts get-caller-identity --region "$REGION" --output json >/dev/null 2>&1 \
    || log_err "Cannot authenticate to AWS GovCloud. Check credentials."

VPC_STATE=$(aws ec2 describe-vpcs \
    --vpc-ids "$VPC_ID" \
    --region "$REGION" \
    --query 'Vpcs[0].State' \
    --output text 2>/dev/null || echo "")

[[ "$VPC_STATE" == "available" ]] \
    || log_err "VPC $VPC_ID not found or not available in $REGION."
log_ok "VPC $VPC_ID is available"

# Helper: get existing SG ID by name in VPC (returns empty if not found)
get_sg_id() {
    local sg_name="$1"
    aws ec2 describe-security-groups \
        --filters \
            "Name=vpc-id,Values=${VPC_ID}" \
            "Name=group-name,Values=${sg_name}" \
        --region "$REGION" \
        --query 'SecurityGroups[0].GroupId' \
        --output text 2>/dev/null || echo ""
}

# Helper: create SG and return its ID
create_sg() {
    local name="$1"
    local desc="$2"
    aws ec2 create-security-group \
        --group-name "$name" \
        --description "$desc" \
        --vpc-id "$VPC_ID" \
        --region "$REGION" \
        --query 'GroupId' \
        --output text
}

tag_sg() {
    local sg_id="$1"
    local name="$2"
    aws ec2 create-tags \
        --resources "$sg_id" \
        --tags \
            "Key=Name,Value=${name}" \
            "Key=Project,Value=${PROJECT_TAG}" \
            "Key=Environment,Value=${ENV_TAG}" \
            "Key=CUI,Value=true" \
            "Key=ManagedBy,Value=create-security-groups.sh" \
        --region "$REGION"
}

echo "────────────────────────────────────────────────────────────"
echo "  1) ALB-SG — Internet-facing HTTPS ingress"
echo "────────────────────────────────────────────────────────────"

ALB_SG_NAME="secred-alb-sg"
ALB_SG_ID=$(get_sg_id "$ALB_SG_NAME")

if [[ -n "$ALB_SG_ID" && "$ALB_SG_ID" != "None" ]]; then
    log_ok "ALB-SG already exists: $ALB_SG_ID  (skipping creation)"
else
    log_info "Creating $ALB_SG_NAME..."
    if [[ "$DRY_RUN" == "false" ]]; then
        ALB_SG_ID=$(create_sg "$ALB_SG_NAME" \
            "ASAF ALB — HTTPS 443 ingress from internet (CUI boundary)")
        tag_sg "$ALB_SG_ID" "$ALB_SG_NAME"

        # Ingress: HTTPS from anywhere (ALB handles TLS termination)
        aws ec2 authorize-security-group-ingress \
            --group-id "$ALB_SG_ID" \
            --ip-permissions \
                "IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0,Description='HTTPS public ingress'}]" \
                "IpProtocol=tcp,FromPort=443,ToPort=443,Ipv6Ranges=[{CidrIpv6=::/0,Description='HTTPS public ingress IPv6'}]" \
            --region "$REGION"

        # Remove default outbound rule (we'll add specific egress later)
        aws ec2 revoke-security-group-egress \
            --group-id "$ALB_SG_ID" \
            --ip-permissions "IpProtocol=-1,IpRanges=[{CidrIp=0.0.0.0/0}]" \
            --region "$REGION" 2>/dev/null || true
    else
        echo "[DRY-RUN] aws ec2 create-security-group --group-name $ALB_SG_NAME ..."
        ALB_SG_ID="sg-ALB00000000000000"
    fi
    log_ok "ALB-SG created: $ALB_SG_ID"
fi

echo ""
echo "────────────────────────────────────────────────────────────"
echo "  2) ECS-SG — Application tier (ingress from ALB-SG only)"
echo "────────────────────────────────────────────────────────────"

ECS_SG_NAME="secred-ecs-sg"
ECS_SG_ID=$(get_sg_id "$ECS_SG_NAME")

if [[ -n "$ECS_SG_ID" && "$ECS_SG_ID" != "None" ]]; then
    log_ok "ECS-SG already exists: $ECS_SG_ID  (skipping creation)"
else
    log_info "Creating $ECS_SG_NAME..."
    if [[ "$DRY_RUN" == "false" ]]; then
        ECS_SG_ID=$(create_sg "$ECS_SG_NAME" \
            "ASAF ECS Fargate tasks — ingress from ALB-SG on port ${APP_PORT}")
        tag_sg "$ECS_SG_ID" "$ECS_SG_NAME"

        # Ingress: app port from ALB-SG only
        aws ec2 authorize-security-group-ingress \
            --group-id "$ECS_SG_ID" \
            --ip-permissions \
                "IpProtocol=tcp,FromPort=${APP_PORT},ToPort=${APP_PORT},UserIdGroupPairs=[{GroupId=${ALB_SG_ID},Description='From ALB'}]" \
            --region "$REGION"

        # Remove default outbound rule — replace with specific egress
        aws ec2 revoke-security-group-egress \
            --group-id "$ECS_SG_ID" \
            --ip-permissions "IpProtocol=-1,IpRanges=[{CidrIp=0.0.0.0/0}]" \
            --region "$REGION" 2>/dev/null || true

        # Egress: HTTPS to VPC endpoints (KMS, ECR, Secrets Manager, Logs, etc.)
        aws ec2 authorize-security-group-egress \
            --group-id "$ECS_SG_ID" \
            --ip-permissions \
                "IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=10.0.0.0/16,Description='VPC endpoints HTTPS'}]" \
            --region "$REGION"
    else
        echo "[DRY-RUN] aws ec2 create-security-group --group-name $ECS_SG_NAME ..."
        ECS_SG_ID="sg-ECS00000000000000"
    fi
    log_ok "ECS-SG created: $ECS_SG_ID"
fi

# ALB-SG egress: app port to ECS-SG (add now that ECS-SG exists)
log_info "Adding ALB-SG egress → ECS-SG port $APP_PORT..."
if [[ "$DRY_RUN" == "false" ]]; then
    aws ec2 authorize-security-group-egress \
        --group-id "$ALB_SG_ID" \
        --ip-permissions \
            "IpProtocol=tcp,FromPort=${APP_PORT},ToPort=${APP_PORT},UserIdGroupPairs=[{GroupId=${ECS_SG_ID},Description='To ECS tasks'}]" \
        --region "$REGION" 2>/dev/null \
        && log_ok "ALB-SG → ECS-SG egress rule added" \
        || log_warn "ALB-SG → ECS-SG egress rule may already exist"
else
    echo "[DRY-RUN] aws ec2 authorize-security-group-egress --group-id $ALB_SG_ID ..."
fi

echo ""
echo "────────────────────────────────────────────────────────────"
echo "  3) Aurora-SG — Database tier (ingress from ECS-SG only)"
echo "────────────────────────────────────────────────────────────"

AURORA_SG_NAME="secred-aurora-sg"
AURORA_SG_ID=$(get_sg_id "$AURORA_SG_NAME")

if [[ -n "$AURORA_SG_ID" && "$AURORA_SG_ID" != "None" ]]; then
    log_ok "Aurora-SG already exists: $AURORA_SG_ID  (skipping creation)"
else
    log_info "Creating $AURORA_SG_NAME..."
    if [[ "$DRY_RUN" == "false" ]]; then
        AURORA_SG_ID=$(create_sg "$AURORA_SG_NAME" \
            "ASAF Aurora PostgreSQL — ingress from ECS-SG on port 5432 only")
        tag_sg "$AURORA_SG_ID" "$AURORA_SG_NAME"

        # Ingress: PostgreSQL from ECS-SG only
        aws ec2 authorize-security-group-ingress \
            --group-id "$AURORA_SG_ID" \
            --ip-permissions \
                "IpProtocol=tcp,FromPort=5432,ToPort=5432,UserIdGroupPairs=[{GroupId=${ECS_SG_ID},Description='From ECS tasks'}]" \
            --region "$REGION"

        # Remove default outbound (Aurora has no outbound requirements)
        aws ec2 revoke-security-group-egress \
            --group-id "$AURORA_SG_ID" \
            --ip-permissions "IpProtocol=-1,IpRanges=[{CidrIp=0.0.0.0/0}]" \
            --region "$REGION" 2>/dev/null || true
    else
        echo "[DRY-RUN] aws ec2 create-security-group --group-name $AURORA_SG_NAME ..."
        AURORA_SG_ID="sg-AURORA0000000000"
    fi
    log_ok "Aurora-SG created: $AURORA_SG_ID"
fi

# ECS-SG egress: PostgreSQL to Aurora-SG
log_info "Adding ECS-SG egress → Aurora-SG port 5432..."
if [[ "$DRY_RUN" == "false" ]]; then
    aws ec2 authorize-security-group-egress \
        --group-id "$ECS_SG_ID" \
        --ip-permissions \
            "IpProtocol=tcp,FromPort=5432,ToPort=5432,UserIdGroupPairs=[{GroupId=${AURORA_SG_ID},Description='To Aurora PostgreSQL'}]" \
        --region "$REGION" 2>/dev/null \
        && log_ok "ECS-SG → Aurora-SG egress rule added" \
        || log_warn "ECS-SG → Aurora-SG egress rule may already exist"
else
    echo "[DRY-RUN] aws ec2 authorize-security-group-egress --group-id $ECS_SG_ID ..."
fi

echo ""
echo "============================================================"
echo "  SECURITY GROUP SUMMARY"
echo "============================================================"
echo "  ALB-SG:    $ALB_SG_ID  (secred-alb-sg)"
echo "  ECS-SG:    $ECS_SG_ID  (secred-ecs-sg)"
echo "  Aurora-SG: $AURORA_SG_ID  (secred-aurora-sg)"
echo ""
echo "  Traffic flow enforced:"
echo "  Internet :443 → ALB-SG → ECS-SG :${APP_PORT} → Aurora-SG :5432"
echo ""
echo "  Update env file:"
echo "  export GOVCLOUD_EXPECTED_ALB_SG_ID=$ALB_SG_ID"
echo "  export GOVCLOUD_EXPECTED_ECS_SG_ID=$ECS_SG_ID"
echo "  export GOVCLOUD_EXPECTED_AURORA_SG_ID=$AURORA_SG_ID"
echo ""
echo "  Next: Step 5 — create Aurora cluster using Aurora-SG:"
echo "  aws rds create-db-cluster \\"
echo "    --db-cluster-identifier secred-govcloud-aurora \\"
echo "    --engine aurora-postgresql \\"
echo "    --engine-version 15.4 \\"
echo "    --vpc-security-group-ids $AURORA_SG_ID \\"
echo "    --db-subnet-group-name secred-isolated-subnet-group \\"
echo "    --storage-encrypted \\"
echo "    --kms-key-id alias/secred-evidence-cmk \\"
echo "    --backup-retention-period 35 \\"
echo "    --deletion-protection \\"
echo "    --enable-iam-database-authentication \\"
echo "    --region $REGION"
echo "============================================================"
echo ""
