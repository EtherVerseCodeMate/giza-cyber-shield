#!/bin/bash
# =============================================================================
# SouHimBou AI / Khepra Protocol — Secrets Configuration Helper
#
# Usage: ./scripts/deploy_config.sh
#
# Prerequisites:
#   supabase CLI  — https://supabase.com/docs/guides/cli
#   fly CLI       — https://fly.io/docs/flyctl/install/
#
# Sets the following secrets:
#
#   Supabase Edge Functions (supabase secrets set):
#     STRIPE_SECRET_KEY          Stripe secret key (sk_live_... or sk_test_...)
#     STRIPE_WEBHOOK_SECRET      Stripe webhook signing secret (whsec_...)
#     STRIPE_PRICE_KHEPRI        Stripe Price ID for KHEPRI ($50/mo)
#     STRIPE_PRICE_RA            Stripe Price ID for RA ($500/mo)
#     STRIPE_PRICE_ATUM          Stripe Price ID for ATUM ($2,000/mo)
#     OTX_API_KEY                AlienVault OTX API key
#     SHODAN_API_KEY             Shodan API key
#     KHEPRA_WEBHOOK_SECRET      HMAC secret for n8n-webhook-receiver
#     BACKUP_BUCKET_NAME         Cloudflare R2 bucket for storage-backup-worker
#     BACKUP_ACCOUNT_ID          Cloudflare account ID for R2
#     BACKUP_ACCESS_KEY_ID       R2 access key ID
#     BACKUP_SECRET_ACCESS_KEY   R2 secret access key
#
#   Fly.io (fly secrets set):
#     INTEGRITY_KEY              HMAC key for STIG cache integrity
#     STIGVIEWER_API_KEY         STIGViewer API token
# =============================================================================

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

ok()   { echo -e "${GREEN}✔${RESET}  $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
err()  { echo -e "${RED}✗${RESET}  $*"; exit 1; }
hdr()  { echo -e "\n${BOLD}$*${RESET}"; }

require_cmd() {
  command -v "$1" &>/dev/null || err "Required CLI not found: $1 — install it first."
}

prompt_secret() {
  local var_name="$1"
  local prompt_text="$2"
  local default_val="${3:-}"

  if [[ -n "$default_val" ]]; then
    read -r -p "  $prompt_text [leave blank to keep existing]: " val
    [[ -z "$val" ]] && val="$default_val"
  else
    while [[ -z "${val:-}" ]]; do
      read -r -p "  $prompt_text: " val
      [[ -z "$val" ]] && warn "Value required — try again."
    done
  fi
  eval "$var_name=\"\$val\""
}

# ─── Prerequisites ────────────────────────────────────────────────────────────

require_cmd supabase
require_cmd fly

# ─── 1. Supabase Stripe secrets ───────────────────────────────────────────────

hdr "1/3  Supabase — Stripe billing secrets"
echo "  These are used by the stripe-webhook and checkout-session Edge Functions."

prompt_secret STRIPE_SECRET_KEY       "Stripe secret key      (sk_live_... or sk_test_...)"
prompt_secret STRIPE_WEBHOOK_SECRET   "Stripe webhook secret  (whsec_...)"
prompt_secret STRIPE_PRICE_KHEPRI     "Stripe Price ID — KHEPRI \$50/mo   (price_...)"
prompt_secret STRIPE_PRICE_RA         "Stripe Price ID — RA \$500/mo       (price_...)"
prompt_secret STRIPE_PRICE_ATUM       "Stripe Price ID — ATUM \$2,000/mo   (price_...)"

supabase secrets set \
  STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
  STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" \
  STRIPE_PRICE_KHEPRI="$STRIPE_PRICE_KHEPRI" \
  STRIPE_PRICE_RA="$STRIPE_PRICE_RA" \
  STRIPE_PRICE_ATUM="$STRIPE_PRICE_ATUM"

ok "Stripe secrets set."

# ─── 2. Supabase intel + integration secrets ──────────────────────────────────

hdr "2/3  Supabase — Intel / Integration secrets"

prompt_secret OTX_API_KEY           "AlienVault OTX API key"
prompt_secret SHODAN_API_KEY        "Shodan API key"
prompt_secret KHEPRA_WEBHOOK_SECRET "n8n webhook HMAC secret (any random string, e.g. \$(openssl rand -hex 32))"

echo
echo "  Storage backup worker (Cloudflare R2) — press Enter to skip if not using storage backup:"
read -r -p "  Cloudflare Account ID [skip]: "         BACKUP_ACCOUNT_ID
read -r -p "  R2 Bucket Name [skip]: "                BACKUP_BUCKET_NAME
read -r -p "  R2 Access Key ID [skip]: "              BACKUP_ACCESS_KEY_ID
read -r -p "  R2 Secret Access Key [skip]: "          BACKUP_SECRET_ACCESS_KEY

supabase secrets set \
  OTX_API_KEY="$OTX_API_KEY" \
  SHODAN_API_KEY="$SHODAN_API_KEY" \
  KHEPRA_WEBHOOK_SECRET="$KHEPRA_WEBHOOK_SECRET"

if [[ -n "$BACKUP_BUCKET_NAME" ]]; then
  supabase secrets set \
    BACKUP_ACCOUNT_ID="$BACKUP_ACCOUNT_ID" \
    BACKUP_BUCKET_NAME="$BACKUP_BUCKET_NAME" \
    BACKUP_ACCESS_KEY_ID="$BACKUP_ACCESS_KEY_ID" \
    BACKUP_SECRET_ACCESS_KEY="$BACKUP_SECRET_ACCESS_KEY"
  ok "Storage backup secrets set."
else
  warn "Storage backup secrets skipped."
fi

ok "Intel/integration secrets set."

# ─── 3. Fly.io secrets ────────────────────────────────────────────────────────

hdr "3/3  Fly.io — Backend secrets"

GEN_KEY=$(openssl rand -hex 32)
echo
echo "  Generated INTEGRITY_KEY: $GEN_KEY"
warn "SAVE THIS KEY — it's used for HMAC integrity of the STIG cache."
read -r -p "  Use generated key? [Y/n]: " USE_GEN
if [[ "${USE_GEN:-Y}" =~ ^[Nn] ]]; then
  prompt_secret INTEGRITY_KEY "Custom INTEGRITY_KEY"
else
  INTEGRITY_KEY="$GEN_KEY"
fi

prompt_secret STIGVIEWER_API_KEY "STIGViewer API token"

fly secrets set \
  INTEGRITY_KEY="$INTEGRITY_KEY" \
  STIGVIEWER_API_KEY="$STIGVIEWER_API_KEY"

ok "Fly.io secrets set."

# ─── Done ─────────────────────────────────────────────────────────────────────

echo
echo -e "${BOLD}All secrets configured.${RESET}"
echo "  Next steps:"
echo "    supabase functions deploy            # deploy all Edge Functions"
echo "    fly deploy                           # deploy backend to Fly.io"
echo "    git push origin main                 # triggers Vercel auto-deploy"
echo
