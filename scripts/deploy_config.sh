#!/bin/bash
# SouHimBou AI - Deployment Config Helper
# This script helps you set up all necessary secrets for the DoD-compliant stack.

set -e

# --- Configuration ---
ORG_NAME="SouHimBou"
DOMAIN="souhimbou-ai.fly.dev"

echo "🛡️ Setting up $ORG_NAME Security Secrets..."

# 1. Supabase Setup
echo "📡 Configuring Supabase Edge Functions..."
read -p "Enter AlienVault OTX API Key: "0a43b57e4123e53b55124127a4d2954fa8c2561bb48abc67c6162750d6acda41
read -p "Enter Shodan API Key: "SHODAN_REDACTED

supabase secrets set OTX_API_KEY=0a43b57e4123e53b55124127a4d2954fa8c2561bb48abc67c6162750d6acda41
supabase secrets set SHODAN_API_KEY=SHODAN_REDACTED
echo "✅ Supabase secrets set."

# 2. Fly.io Setup
echo "🛸 Configuring Fly.io Secure Gateway..."

# Generate a random 32-byte integrity key if not provided
GEN_KEY=$(openssl rand -hex 32)
echo "Generated Integrity Key: $GEN_KEY"
echo "⚠️ SAVE THIS KEY: It is used for HMAC integrity of the STIG cache."

read -p "Enter STIGViewer API Token: " STIGVIEWER_REDACTED

fly secrets set INTEGRITY_KEY=$GEN_KEY
fly secrets set STIGVIEWER_API_KEY=STIGVIEWER_REDACTED
echo "✅ Fly.io secrets set."

echo "🚀 All systems configured. Run './fly deploy' or 'supabase functions deploy' to finalize."
