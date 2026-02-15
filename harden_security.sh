#!/bin/bash
# ==============================================================================
# SOUHIMBOU AI - PRODUCTION SECURITY HARDENING & SECRET MIGRATION
# Date: 2026-02-15
# Objective: Move hardcoded values to encrypted secret stores.
# ==============================================================================

set -e # Exit on error

echo "🛡️ Starting Security Hardening..."

# 1. FLY.IO SECRETS (Dashboard)
echo "✈️ Configuring Fly.io Secrets..."
# Extract the ANON_KEY from fly.dashboard.toml for migration
ANON_KEY=$(grep "NEXT_PUBLIC_SUPABASE_ANON_KEY" fly.dashboard.toml | cut -d'"' -f2)
if [ -n "$ANON_KEY" ]; then
    echo "🔒 Moving Supabase Anon Key to Fly secrets..."
    fly secrets set NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" --app souhimbou-dashboard
    echo "✅ Fly secrets updated."
else
    echo "⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY not found in fly.dashboard.toml"
fi

# 2. CLOUDFLARE WORKERS SECRETS (Telemetry)
echo "🌩️ Configuring Cloudflare Wrangler Secrets..."
# These secrets MUST be set manually as they are not currently hardcoded (WHICH IS GOOD)
# But they need to be initialized for the environment.
echo "⚠️  CRITICAL: You must now enter the values for the following secrets when prompted:"
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put ADMIN_API_KEY
wrangler secret put JWT_SECRET
wrangler secret put KHEPRA_SERVICE_SECRET
wrangler secret put SUPABASE_SERVICE_KEY

# 3. SECRET ROTATION POLICY (Instructions)
echo "🔄 Secret Rotation Instructions:"
echo "----------------------------------------------------------------"
echo "AWS GovCloud: Ensure Secrets Manager 'Automatic Rotation' is enabled"
echo "for 'souhimbou-protocol/database' (current setting: 30 days)."
echo ""
echo "Dilithium3 Keys: Telemetry public key in wrangler.toml should be"
echo "migrated to a secret if you plan to rotate more than once per year."
echo "----------------------------------------------------------------"

echo "✨ Hardening execution complete. Please manually verify deployment logs."
