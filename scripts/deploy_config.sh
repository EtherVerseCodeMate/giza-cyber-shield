#!/bin/bash
# SouHimBou AI - Deployment Config Helper
# This script helps you set up all necessary secrets for the DoD-compliant stack.
# IMPORTANT: No secrets are hardcoded. All values are prompted at runtime.

set -e

# --- Configuration ---
ORG_NAME="SouHimBou"
DOMAIN="souhimbou-ai.fly.dev"
SUPABASE_DIR="souhimbou_ai/SouHimBou.AI"

echo "🛡️ Setting up $ORG_NAME Security Secrets..."

# 1. Supabase Setup
echo "📡 Configuring Supabase Edge Functions..."
read -sp "Enter AlienVault OTX API Key: " OTX_KEY
echo ""
read -sp "Enter Shodan API Key: " SHODAN_KEY
echo ""

npx supabase --workdir "$SUPABASE_DIR" secrets set "OTX_API_KEY=$OTX_KEY"
npx supabase --workdir "$SUPABASE_DIR" secrets set "SHODAN_API_KEY=$SHODAN_KEY"
echo "✅ Supabase secrets set."

# 2. Fly.io Setup
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

echo "🚀 All systems configured. Run 'fly deploy' or 'npx supabase functions deploy --all' to finalize."
