#!/bin/bash
# Deploy CI wrapper – uses environment variables instead of interactive prompts
# Assumes all required secrets are provided as environment variables

set -e

# --- Configuration ---
ORG_NAME="SouHimBou"
DOMAIN="souhimbou-ai.fly.dev"
SUPABASE_DIR="souhimbou_ai/SouHimBou.AI"

echo "🛡️  Setting up $ORG_NAME Security Secrets (CI mode)"

# Supabase Secrets (27)
# Assumes the following env vars are set: STRIPE_SECRET, STRIPE_WEBHOOK, AUTOSEND_KEY, QUO_KEY, QUO_PHONE, QUO_WEBHOOK_SECRET, OTX_KEY, SHODAN_KEY, VT_KEY, ABUSEIPDB_KEY, URLVOID_KEY, OPENAI_KEY, GROK_KEY, DISCORD_PUB_KEY, DISCORD_TOKEN, WH_ALERT, WH_THREAT, WH_STIG, WH_DEPLOY, WH_UPTIME, WH_LICENSE, SITE_URL, KHEPRA_WEBHOOK, KHEPRA_SERVICE

# Set Supabase secrets
npx supabase --workdir "$SUPABASE_DIR" secrets set \
  "STRIPE_SECRET_KEY=$STRIPE_SECRET" \
  "STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK" \
  "AUTOSEND_API_KEY=$AUTOSEND_KEY" \
  "QUO_API_KEY=$QUO_KEY" \
  "QUO_PHONE_NUMBER=$QUO_PHONE" \
  "QUO_WEBHOOK_SECRET=$QUO_WEBHOOK_SECRET" \
  "OTX_API_KEY=$OTX_KEY" \
  "SHODAN_API_KEY=$SHODAN_KEY" \
  "VIRUSTOTAL_API_KEY=$VT_KEY" \
  "ABUSEIPDB_API_KEY=$ABUSEIPDB_KEY" \
  "URLVOID_API_KEY=$URLVOID_KEY" \
  "OPENAI_API_KEY=$OPENAI_KEY" \
  "GROK_API_KEY=$GROK_KEY" \
  "DISCORD_PUBLIC_KEY=$DISCORD_PUB_KEY" \
  "DISCORD_BOT_TOKEN=$DISCORD_TOKEN" \
  "ALERT_WEBHOOK_URL=$WH_ALERT" \
  "THREAT_INTEL_WEBHOOK_URL=$WH_THREAT" \
  "STIG_WEBHOOK_URL=$WH_STIG" \
  "DEPLOY_WEBHOOK_URL=$WH_DEPLOY" \
  "UPTIME_WEBHOOK_URL=$WH_UPTIME" \
  "LICENSE_WEBHOOK_URL=$WH_LICENSE" \
  "SITE_URL=$SITE_URL" \
  "KHEPRA_WEBHOOK_SECRET=$KHEPRA_WEBHOOK" \
  "KHEPRA_SERVICE_SECRET=$KHEPRA_SERVICE"

echo "✅ Supabase secrets set."

# Fly.io Secrets (6)
GEN_KEY=$(openssl rand -hex 32)

fly secrets set \
  "INTEGRITY_KEY=$GEN_KEY" \
  "STIGVIEWER_API_KEY=$STIG_TOKEN" \
  "SUPABASE_URL=https://xjknkjbrjgljuovaazeu.supabase.co" \
  "SUPABASE_SERVICE_ROLE_KEY=$SUPA_SERVICE_KEY" \
  "SUPABASE_JWT_SECRET=$SUPA_JWT" \
  "KHEPRA_SERVICE_SECRET=$KHEPRA_SERVICE"

echo "✅ Fly.io secrets set."

# Vercel Environment Variables (7)
vercel env add NEXT_PUBLIC_SUPABASE_URL production "$SUPABASE_URL"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production "$SUPABASE_ANON_KEY"
vercel env add SUPABASE_SERVICE_ROLE_KEY production "$SUPA_SERVICE_KEY"
vercel env add NEXT_PUBLIC_KHEPRA_API_URL production "https://souhimbou-ai.fly.dev"
vercel env add STRIPE_SECRET_KEY production "$STRIPE_SECRET"
vercel env add STRIPE_WEBHOOK_SECRET production "$STRIPE_WEBHOOK"
vercel env add GROK_API_KEY production "$GROK_KEY"

echo "✅ Vercel env vars set."

echo "🚀 CI deployment configuration complete. Run './scripts/deploy.sh' to start deployment."
