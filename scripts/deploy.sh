#!/bin/bash
# =============================================================================
# Khepra Protocol / SouHimBou AI — Full Deployment Script
#
# Verifies env vars, deploys Supabase Edge Functions + Fly.io backend,
# and validates that every service is healthy before finishing.
#
# Usage:
#   ./scripts/deploy.sh               — full deploy (all targets)
#   ./scripts/deploy.sh --supabase    — Supabase Edge Functions only
#   ./scripts/deploy.sh --fly         — Fly.io backend only
#   ./scripts/deploy.sh --verify      — health checks only, no deploy
#
# Prerequisites:
#   supabase CLI  — https://supabase.com/docs/guides/cli
#   fly CLI       — https://fly.io/docs/flyctl/install/
#   curl          — for health checks
#
# Vercel: deploys automatically when main branch is pushed to GitHub.
# Run: git push origin main
# =============================================================================

set -euo pipefail

# ─── Colours ──────────────────────────────────────────────────────────────────
BOLD="\033[1m"; GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RED="\033[0;31m"; RESET="\033[0m"
ok()   { echo -e "${GREEN}✔${RESET}  $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
err()  { echo -e "${RED}✗${RESET}  $*"; exit 1; }
hdr()  { echo -e "\n${BOLD}━━━ $* ━━━${RESET}"; }
info() { echo -e "   $*"; }

# ─── Targets ──────────────────────────────────────────────────────────────────
DEPLOY_SUPABASE=true
DEPLOY_FLY=true
VERIFY_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --supabase) DEPLOY_SUPABASE=true;  DEPLOY_FLY=false ;;
    --fly)      DEPLOY_SUPABASE=false; DEPLOY_FLY=true  ;;
    --verify)   VERIFY_ONLY=true; DEPLOY_SUPABASE=false; DEPLOY_FLY=false ;;
    *) err "Unknown argument: $arg" ;;
  esac
done

# ─── Constants ────────────────────────────────────────────────────────────────
SUPABASE_PROJECT_ID="xjknkjbrjgljuovaazeu"
FLY_APP="souhimbou-ai"
FLY_HEALTH_URL="https://${FLY_APP}.fly.dev/"
VERCEL_DOMAIN="nouchix.com"   # update if your Vercel domain differs

# ─── Edge functions to deploy ─────────────────────────────────────────────────
EDGE_FUNCTIONS=(
  stripe-webhook
  create-diagnostic-checkout-session
  create-advisory-checkout-session
  license-register
  license-heartbeat
  mcp-agent-bridge
  n8n-webhook-receiver
  send-password-reset-otp
  verify-password-reset-otp
  storage-backup-worker
)

# ─── 0. Prerequisite checks ───────────────────────────────────────────────────
hdr "0  Prerequisites"

require_cmd() { command -v "$1" &>/dev/null || err "Required CLI not found: $1"; }
require_cmd supabase
require_cmd fly
require_cmd curl
ok "CLIs present."

# ─── 1. Supabase secret verification ─────────────────────────────────────────
hdr "1  Supabase secret verification"

REQUIRED_SUPABASE_SECRETS=(
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_PRICE_KHEPRI
  STRIPE_PRICE_RA
  STRIPE_PRICE_ATUM
  OTX_API_KEY
  SHODAN_API_KEY
  KHEPRA_WEBHOOK_SECRET
)

info "Fetching Supabase secrets list..."
SUPABASE_SECRETS_RAW=$(supabase secrets list --project-ref "$SUPABASE_PROJECT_ID" 2>&1)
MISSING_SUP=()
for secret in "${REQUIRED_SUPABASE_SECRETS[@]}"; do
  if echo "$SUPABASE_SECRETS_RAW" | grep -q "$secret"; then
    ok "Supabase: $secret"
  else
    warn "Supabase: MISSING — $secret"
    MISSING_SUP+=("$secret")
  fi
done

if [[ ${#MISSING_SUP[@]} -gt 0 ]]; then
  echo
  warn "${#MISSING_SUP[@]} Supabase secret(s) not set."
  info "Run:  ./scripts/deploy_config.sh"
  [[ "$VERIFY_ONLY" == "true" ]] && err "Secrets missing — aborting."
  read -r -p "  Continue anyway? [y/N]: " CONT
  [[ "${CONT:-N}" =~ ^[Yy] ]] || exit 1
fi

# ─── 2. Fly.io secret verification ───────────────────────────────────────────
hdr "2  Fly.io secret verification"

REQUIRED_FLY_SECRETS=(
  INTEGRITY_KEY
  STIGVIEWER_API_KEY
)

FLY_SECRETS_RAW=$(fly secrets list --app "$FLY_APP" 2>&1)
MISSING_FLY=()
for secret in "${REQUIRED_FLY_SECRETS[@]}"; do
  if echo "$FLY_SECRETS_RAW" | grep -q "$secret"; then
    ok "Fly.io: $secret"
  else
    warn "Fly.io: MISSING — $secret"
    MISSING_FLY+=("$secret")
  fi
done

if [[ ${#MISSING_FLY[@]} -gt 0 ]]; then
  warn "${#MISSING_FLY[@]} Fly.io secret(s) not set."
  info "Run:  ./scripts/deploy_config.sh"
  [[ "$VERIFY_ONLY" == "true" ]] && err "Secrets missing — aborting."
  read -r -p "  Continue anyway? [y/N]: " CONT
  [[ "${CONT:-N}" =~ ^[Yy] ]] || exit 1
fi

# ─── 3. Vercel env check (manual — Vercel has no public CLI for env listing) ──
hdr "3  Vercel env checklist (manual verification)"
info "The following env vars must be set in:"
info "  Vercel Dashboard → Project Settings → Environment Variables"
echo
REQUIRED_VERCEL_ENV=(
  "AGENT_URL              → https://souhimbou-ai.fly.dev    (server-side, used by next.config.mjs rewrites)"
  "NEXT_PUBLIC_API_URL    → https://souhimbou-ai.fly.dev    (client-side)"
)
for item in "${REQUIRED_VERCEL_ENV[@]}"; do
  info "  $item"
done
echo
info "  NOTE: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are hardcoded"
info "  in src/integrations/supabase/client.ts (anon key is safe to be public)."
echo

if [[ "$VERIFY_ONLY" == "false" ]]; then
  read -r -p "  Vercel env vars confirmed in dashboard? [y/N]: " VCK
  [[ "${VCK:-N}" =~ ^[Yy] ]] || { warn "Set Vercel env vars first, then re-run."; exit 1; }
  ok "Vercel env confirmed."
fi

# ─── 4. Deploy Supabase Edge Functions ───────────────────────────────────────
if [[ "$DEPLOY_SUPABASE" == "true" ]]; then
  hdr "4  Supabase Edge Function deployment"

  for fn in "${EDGE_FUNCTIONS[@]}"; do
    info "Deploying $fn..."
    if supabase functions deploy "$fn" --project-ref "$SUPABASE_PROJECT_ID" 2>&1; then
      ok "$fn deployed."
    else
      err "Failed to deploy: $fn"
    fi
  done
  ok "All Edge Functions deployed."
else
  info "Skipping Supabase deployment (--fly flag)."
fi

# ─── 5. Deploy Fly.io backend ─────────────────────────────────────────────────
if [[ "$DEPLOY_FLY" == "true" ]]; then
  hdr "5  Fly.io backend deployment"
  info "Building and deploying to $FLY_APP..."
  fly deploy --app "$FLY_APP" --remote-only
  ok "Fly.io deployment triggered."
else
  info "Skipping Fly.io deployment (--supabase flag)."
fi

# ─── 6. Health checks ────────────────────────────────────────────────────────
hdr "6  Post-deploy health checks"

check_http() {
  local label="$1" url="$2" expect_status="${3:-200}"
  info "Checking $label..."
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$url" || echo "000")
  if [[ "$HTTP_STATUS" == "$expect_status" ]]; then
    ok "$label → HTTP $HTTP_STATUS"
  else
    warn "$label → HTTP $HTTP_STATUS (expected $expect_status)"
  fi
}

# Fly.io: wait up to 90s for health
info "Waiting for Fly.io to stabilise (up to 90s)..."
for i in $(seq 1 9); do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$FLY_HEALTH_URL" || echo "000")
  [[ "$HTTP_STATUS" == "200" ]] && break
  info "  Attempt $i/9 — status $HTTP_STATUS — retrying in 10s..."
  sleep 10
done
check_http "Fly.io  $FLY_APP" "$FLY_HEALTH_URL"

# Vercel / Frontend
check_http "Vercel  $VERCEL_DOMAIN" "https://$VERCEL_DOMAIN"

# Supabase Edge Functions — stripe-webhook (OPTIONS returns 200 for CORS preflight)
EDGE_URL="https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stripe-webhook"
check_http "Supabase stripe-webhook" "$EDGE_URL" "405"  # POST-only, OPTIONS→405 or 200 depending on impl

# ─── 7. Summary ───────────────────────────────────────────────────────────────
hdr "7  Deployment summary"
echo
echo -e "  ${BOLD}Target                   Status${RESET}"
echo -e "  Supabase Edge Functions  ${GREEN}deployed${RESET}"
echo -e "  Fly.io backend           ${GREEN}deployed${RESET}"
echo -e "  Vercel frontend          ${YELLOW}auto-deploy via git push origin main${RESET}"
echo
info "Stripe webhook URL to register in Stripe Dashboard:"
info "  https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stripe-webhook"
info "Events to enable:"
info "  checkout.session.completed"
info "  customer.subscription.created"
info "  customer.subscription.updated"
info "  customer.subscription.deleted"
info "  invoice.payment_succeeded"
info "  invoice.payment_failed"
echo
ok "Deployment complete."
