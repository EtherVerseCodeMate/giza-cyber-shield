#!/bin/bash
# =============================================================================
# KHEPRA PROTOCOL - FLY.IO DEPLOYMENT SCRIPT
# =============================================================================
# Run: chmod +x deploy-fly.sh && ./deploy-fly.sh
# Prerequisites: Install Fly CLI (curl -L https://fly.io/install.sh | sh)
# =============================================================================

set -e

echo "================================================"
echo "  KHEPRA PROTOCOL - FLY.IO DEPLOYMENT"
echo "================================================"
echo ""

# Check if fly is installed
if ! command -v fly &> /dev/null; then
    echo "[ERROR] Fly CLI not installed. Install it first:"
    echo "  curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Check authentication
echo "[1/5] Checking Fly.io authentication..."
fly auth whoami || fly auth login

# Launch app if not exists
echo ""
echo "[2/5] Initializing app 'souhimbou-ai'..."
if ! fly apps list | grep -q "souhimbou-ai"; then
    fly launch --name souhimbou-ai --no-deploy --region iad
fi

# Set all secrets
echo ""
echo "[3/5] Setting secrets..."

# ============================================================================
# SUPABASE CONFIGURATION
# ============================================================================
fly secrets set \
  SUPABASE_URL="https://xjknkjbrjgljuovaazeu.supabase.co" \
  SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhqa25ramJyamdsanVvdmFhemV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NTMzNDksImV4cCI6MjA3MTQyOTM0OX0.ioWr3_viAbWJHAaHnBxQrzSXtgUlcAAjrPWEsoSh6sk"

# ============================================================================
# TELEMETRY CONFIGURATION
# ============================================================================
fly secrets set \
  TELEMETRY_SERVER_URL="https://telemetry.souhimbou.org" \
  LICENSE_MASTER_PUBLIC_KEY="33d83c0f0c15946fdc89363981dc685799d72fc8971cc00568a4c31ec8825c580b2ab7ea24d0bfa65a855c1009020b421e57b9f475b7cf74dfc50705f1de02b3b122714228b63c8626722f71dcb5402416c532c05e75f4af6fd8f8d4336e05bb147d795d"

# ============================================================================
# STRIPE (Billing & Payments)
# ============================================================================
fly secrets set \
  STRIPE_SECRET_KEY="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"

# ============================================================================
# LLM PROVIDERS (Papyrus AI)
# ============================================================================
fly secrets set \
  OPENAI_API_KEY="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" \
  XAI_API_KEY="xai-iHX2T97lmeQHRfMNCSvNnnNzbsoiQBumONnJnRdkGd4xbzXaHSIhEGHlgNPGUD8pcYzH20zdsm8p87HG"

echo "[INFO] Secrets configured successfully!"

# Create volume if not exists
echo ""
echo "[4/5] Creating persistent volume..."
if ! fly volumes list | grep -q "souhimbou_data"; then
    fly volumes create souhimbou_data --region iad --size 10
fi

# Deploy
echo ""
echo "[5/5] Deploying to Fly.io..."
fly deploy

echo ""
echo "================================================"
echo "  DEPLOYMENT COMPLETE!"
echo "================================================"
echo ""
echo "Your app is live at: https://souhimbou-ai.fly.dev"
echo ""
echo "Useful commands:"
echo "  fly logs           - View logs"
echo "  fly status         - Check status"
echo "  fly ssh console    - SSH into machine"
echo "  fly scale count 2  - Scale to 2 machines"
echo ""
