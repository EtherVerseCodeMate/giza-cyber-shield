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
read -p "Enter Shodan API Key: "bq60NDzJcG0PC0fuJV3pK9RzC08mytbX

supabase secrets set OTX_API_KEY=0a43b57e4123e53b55124127a4d2954fa8c2561bb48abc67c6162750d6acda41
supabase secrets set SHODAN_API_KEY=bq60NDzJcG0PC0fuJV3pK9RzC08mytbX
echo "✅ Supabase secrets set."

# 2. Fly.io Setup
echo "🛸 Configuring Fly.io Secure Gateway..."

# Generate a random 32-byte integrity key if not provided
GEN_KEY=$(openssl rand -hex 32)
echo "Generated Integrity Key: $GEN_KEY"
echo "⚠️ SAVE THIS KEY: It is used for HMAC integrity of the STIG cache."

read -p "Enter STIGViewer API Token: " ss_token_app_stigviewer_41d672fe2f5a468474a6e5a25c00e93d9b7a3c9f69fdb701

fly secrets set INTEGRITY_KEY=$GEN_KEY
fly secrets set STIGVIEWER_API_KEY=ss_token_app_stigviewer_41d672fe2f5a468474a6e5a25c00e93d9b7a3c9f69fdb701
echo "✅ Fly.io secrets set."

echo "🚀 All systems configured. Run './fly deploy' or 'supabase functions deploy' to finalize."
