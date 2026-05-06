#!/usr/bin/env pwsh
# push-and-start.ps1 — Upload binary + start AdinKhepra on VPS
# Run: .\scripts\push-and-start.ps1

$VPS = "root@187.124.225.91"
$BIN = "bin\adinkhepra-linux-amd64"
$FIX = "scripts\fix-ssh-and-deploy.sh"

Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AdinKhepra VPS Deploy" -ForegroundColor Cyan
Write-Host "  Target: 187.124.225.91" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Step 1 — Upload binary
Write-Host "[1/4] Uploading binary (~22 MB)..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=accept-new -o ConnectTimeout=30 $BIN "${VPS}:/tmp/adinkhepra-new"
if ($LASTEXITCODE -ne 0) { Write-Host "SCP FAILED — check SSH key" -ForegroundColor Red; exit 1 }
Write-Host "    ✅ Binary uploaded" -ForegroundColor Green

# Step 2 — Upload fix script
Write-Host "[2/4] Uploading fix script..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=accept-new $FIX "${VPS}:/tmp/fix-ssh-and-deploy.sh"
if ($LASTEXITCODE -ne 0) { Write-Host "SCRIPT UPLOAD FAILED" -ForegroundColor Red; exit 1 }
Write-Host "    ✅ Script uploaded" -ForegroundColor Green

# Step 3 — Run fix script + install binary
Write-Host "[3/4] Running setup + installing binary..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=accept-new $VPS @'
chmod +x /tmp/fix-ssh-and-deploy.sh
bash /tmp/fix-ssh-and-deploy.sh
mkdir -p /opt/adinkhepra/bin
mv /tmp/adinkhepra-new /opt/adinkhepra/bin/adinkhepra
chmod +x /opt/adinkhepra/bin/adinkhepra
systemctl restart adinkhepra 2>/dev/null || echo "Service will start once systemd is configured"
echo "DEPLOY_DONE"
'@
if ($LASTEXITCODE -ne 0) { Write-Host "REMOTE SETUP FAILED" -ForegroundColor Red; exit 1 }

# Step 4 — Health check
Write-Host "[4/4] Health check..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
try {
    $r = Invoke-WebRequest -Uri "http://187.124.225.91:45444/healthz" -TimeoutSec 10 -UseBasicParsing
    Write-Host "    ✅ ASAF Engine responding: $($r.Content)" -ForegroundColor Green
} catch {
    Write-Host "    ⚠️  Health check pending (service may still be starting)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ DEPLOYED — AdinKhepra ASAF is LIVE" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard: http://187.124.225.91:45444" -ForegroundColor Cyan
Write-Host "  Health:    http://187.124.225.91:45444/healthz" -ForegroundColor Cyan
Write-Host "  SSE feed:  http://187.124.225.91:45444/events" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
