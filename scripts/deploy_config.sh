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

# --- SMS Delivery (Twilio) ---
read -p "Enter Twilio Account SID: " TWILIO_SID
read -sp "Enter Twilio Auth Token: " TWILIO_TOKEN
echo ""
read -p "Enter Twilio Phone Number (e.g. +1234567890): " TWILIO_PHONE

# --- Webhook ---
read -p "Enter Alert Webhook URL (Slack/Discord/PagerDuty): " WEBHOOK_URL

echo ""
echo "Setting Supabase secrets..."

npx supabase --workdir "$SUPABASE_DIR" secrets set \
  "OTX_API_KEY=$OTX_KEY" \
  "SHODAN_API_KEY=$SHODAN_KEY" \
  "AUTOSEND_API_KEY=$AUTOSEND_KEY" \
  "TWILIO_ACCOUNT_SID=$TWILIO_SID" \
  "TWILIO_AUTH_TOKEN=$TWILIO_TOKEN" \
  "TWILIO_PHONE_NUMBER=$TWILIO_PHONE" \
  "ALERT_WEBHOOK_URL=$WEBHOOK_URL"

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
