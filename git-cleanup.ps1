# Git Repository Cleanup Script
# Fixes "confused by unstable object source data" errors

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GIT REPOSITORY CLEANUP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/5] Stopping any running agents..." -ForegroundColor Green
Get-Process | Where-Object { $_.ProcessName -like "*khepra*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "[2/5] Cleaning git index..." -ForegroundColor Green
git reset HEAD

Write-Host "[3/5] Running git garbage collection..." -ForegroundColor Green
git gc --prune=now

Write-Host "[4/5] Verifying repository integrity..." -ForegroundColor Green
git fsck --full

Write-Host "[5/5] Re-adding files..." -ForegroundColor Green
git add -A

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  CLEANUP COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now commit your changes:" -ForegroundColor Cyan
Write-Host "  git commit -m 'Your message'" -ForegroundColor Yellow
Write-Host ""
