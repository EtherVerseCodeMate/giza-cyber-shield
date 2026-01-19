# =============================================================================
# KHEPRA PROTOCOL - FLY.IO DEPLOYMENT SCRIPT
# =============================================================================
# Run this script to deploy SouHimBou AI to Fly.io
# Prerequisites: Install Fly CLI (curl -L https://fly.io/install.sh | sh)
# =============================================================================

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  KHEPRA PROTOCOL - FLY.IO DEPLOYMENT" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if fly is installed
if (-not (Get-Command fly -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Fly CLI not installed. Install it first:" -ForegroundColor Red
    Write-Host "  iwr https://fly.io/install.ps1 -useb | iex" -ForegroundColor Yellow
    exit 1
}

# Check authentication
Write-Host "[1/5] Checking Fly.io authentication..." -ForegroundColor Yellow
fly auth whoami
if ($LASTEXITCODE -ne 0) {
    Write-Host "[INFO] Please authenticate with Fly.io..." -ForegroundColor Yellow
    fly auth login
}

# Launch app if not exists
Write-Host ""
Write-Host "[2/5] Initializing app 'souhimbou-ai'..." -ForegroundColor Yellow
fly apps list | Select-String "souhimbou-ai"
if ($LASTEXITCODE -ne 0) {
    fly launch --name souhimbou-ai --no-deploy --region iad
}

# Set all secrets
Write-Host ""
Write-Host "[3/5] Setting secrets..." -ForegroundColor Yellow

# ============================================================================
# SUPABASE CONFIGURATION
# ============================================================================
fly secrets set SUPABASE_URL="https://xjknkjbrjgljuovaazeu.supabase.co"
fly secrets set SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhqa25ramJyamdsanVvdmFhemV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NTMzNDksImV4cCI6MjA3MTQyOTM0OX0.ioWr3_viAbWJHAaHnBxQrzSXtgUlcAAjrPWEsoSh6sk"

# ============================================================================
# TELEMETRY CONFIGURATION
# ============================================================================
fly secrets set TELEMETRY_SERVER_URL="https://telemetry.souhimbou.org"

# ML-DSA-65 (Dilithium3) public key for license verification (hex encoded, 1952 bytes)
fly secrets set LICENSE_MASTER_PUBLIC_KEY="33d83c0f0c15946fdc89363981dc685799d72fc8971cc00568a4c31ec8825c580b2ab7ea24d0bfa65a855c1009020b421e57b9f475b7cf74dfc50705f1de02b3b122714228b63c8626722f71dcb5402416c532c05e75f4af6fd8f8d4336e05bb147d795d"

# ============================================================================
# OPTIONAL SECRETS (Set these manually if needed)
# ============================================================================
# Uncomment and set these if you have them:

# Stripe (for billing - set if you have Stripe account)
# fly secrets set STRIPE_SECRET_KEY="sk_live_YOUR_STRIPE_KEY"
# fly secrets set STRIPE_WEBHOOK_SECRET="whsec_YOUR_WEBHOOK_SECRET"

# OpenAI (for Papyrus LLM - set if using OpenAI)
# fly secrets set OPENAI_API_KEY="sk-YOUR_OPENAI_KEY"

# Anthropic Claude (alternative to OpenAI)
# fly secrets set ANTHROPIC_API_KEY="sk-ant-YOUR_ANTHROPIC_KEY"

Write-Host "[INFO] Secrets configured successfully!" -ForegroundColor Green

# Create volume if not exists
Write-Host ""
Write-Host "[4/5] Creating persistent volume..." -ForegroundColor Yellow
fly volumes list | Select-String "souhimbou_data"
if ($LASTEXITCODE -ne 0) {
    fly volumes create souhimbou_data --region iad --size 10
}

# Deploy
Write-Host ""
Write-Host "[5/5] Deploying to Fly.io..." -ForegroundColor Yellow
fly deploy

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your app is live at: https://souhimbou-ai.fly.dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "  fly logs           - View logs"
Write-Host "  fly status         - Check status"
Write-Host "  fly ssh console    - SSH into machine"
Write-Host "  fly scale count 2  - Scale to 2 machines"
Write-Host ""
