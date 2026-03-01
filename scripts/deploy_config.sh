#!/bin/bash
# SouHimBou AI - Deployment Config Helper
# Sets all necessary secrets for Supabase Edge Functions and Fly.io.
# IMPORTANT: No secrets are hardcoded. All values are prompted at runtime.

set -e

# --- Configuration ---
ORG_NAME="SouHimBou"
DOMAIN="souhimbou-ai.fly.dev"
SUPABASE_DIR="souhimbou_ai/SouHimBou.AI"

echo "🛡️ Setting up $ORG_NAME Security Secrets..."
echo ""

# ========================================
# 1. Supabase Edge Function Secrets
# ========================================
echo "📡 Configuring Supabase Edge Functions..."
echo ""

# --- Threat Intelligence ---
read -sp "Enter AlienVault OTX API Key: " OTX_KEY
echo ""
read -sp "Enter Shodan API Key: " SHODAN_KEY
echo ""

# --- Email Delivery (Autosend) ---
read -sp "Enter Autosend API Key (for email alerts): " AUTOSEND_KEY
echo ""

# --- SMS Delivery (Quo / OpenPhone) ---
read -sp "Enter Quo API Key (from quo.com dashboard): " QUO_KEY
echo ""
read -p "Enter Quo Phone Number (e.g. +1234567890): " QUO_PHONE

# --- Webhook ---
read -p "Enter Alert Webhook URL (Discord webhook URL): " WEBHOOK_URL

# --- Discord Bot ---
read -p "Enter Discord Public Key: " DISCORD_PUB_KEY
read -sp "Enter Discord Bot Token: " DISCORD_TOKEN
echo ""

echo ""
echo "Setting Supabase secrets..."

npx supabase --workdir "$SUPABASE_DIR" secrets set \
  "OTX_API_KEY=$OTX_KEY" \
  "SHODAN_API_KEY=$SHODAN_KEY" \
  "AUTOSEND_API_KEY=$AUTOSEND_KEY" \
  "QUO_API_KEY=$QUO_KEY" \
  "QUO_PHONE_NUMBER=$QUO_PHONE" \
  "ALERT_WEBHOOK_URL=$WEBHOOK_URL" \
  "DISCORD_PUBLIC_KEY=$DISCORD_PUB_KEY" \
  "DISCORD_BOT_TOKEN=$DISCORD_TOKEN"

echo "✅ Supabase secrets set."
echo ""

# ========================================
# 2. Fly.io Secrets
# ========================================
echo "🛸 Configuring Fly.io Secure Gateway..."

# Generate a random 32-byte integrity key
GEN_KEY=$(openssl rand -hex 32)
echo "Generated Integrity Key: $GEN_KEY"
echo "⚠️ SAVE THIS KEY: It is used for HMAC integrity of the STIG cache."

read -sp "Enter STIGViewer API Token: " STIG_TOKEN
echo ""

fly secrets set "INTEGRITY_KEY=$GEN_KEY"
fly secrets set "STIGVIEWER_API_KEY=$STIG_TOKEN"
echo "✅ Fly.io secrets set."

echo ""
echo "🚀 All systems configured. Run './scripts/deploy.sh' to deploy."
