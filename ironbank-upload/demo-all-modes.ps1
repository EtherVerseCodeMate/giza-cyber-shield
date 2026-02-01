# Sekhem Triad - All Deployment Modes Demo
# Demonstrates Edge, Hybrid, Sovereign, and Iron Bank modes

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SEKHEM TRIAD - UNIFIED PRODUCT LINE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Mode 1: Edge Mode (Duat Realm only)
Write-Host "[1/4] Testing EDGE MODE (Duat Realm only)..." -ForegroundColor Green
Write-Host "      Use Case: SaaS Endpoints ($29/endpoint)" -ForegroundColor Yellow
$env:KHEPRA_MODE = "edge"
Start-Process -FilePath ".\bin\khepra-agent-sekhem.exe" -NoNewWindow -PassThru
Start-Sleep -Seconds 5
Write-Host "      ✅ Edge Mode running on http://localhost:45444" -ForegroundColor Green
Write-Host ""

# Mode 2: Hybrid Mode (Duat + Aaru Realms)
Write-Host "[2/4] Testing HYBRID MODE (Duat + Aaru Realms)..." -ForegroundColor Green
Write-Host "      Use Case: Hybrid Cloud ($49/endpoint)" -ForegroundColor Yellow
$env:KHEPRA_MODE = "hybrid"
Start-Process -FilePath ".\bin\khepra-agent-sekhem.exe" -ArgumentList "-port 45445" -NoNewWindow -PassThru
Start-Sleep -Seconds 5
Write-Host "      ✅ Hybrid Mode running on http://localhost:45445" -ForegroundColor Green
Write-Host ""

# Mode 3: Sovereign Mode (All realms, air-gapped)
Write-Host "[3/4] Testing SOVEREIGN MODE (All realms, air-gapped)..." -ForegroundColor Green
Write-Host "      Use Case: Air-Gapped Enterprise ($99/endpoint)" -ForegroundColor Yellow
$env:KHEPRA_MODE = "sovereign"
Start-Process -FilePath ".\bin\khepra-agent-sekhem.exe" -ArgumentList "-port 45446" -NoNewWindow -PassThru
Start-Sleep -Seconds 5
Write-Host "      ✅ Sovereign Mode running on http://localhost:45446" -ForegroundColor Green
Write-Host ""

# Mode 4: Iron Bank Mode (All realms, DoD compliance)
Write-Host "[4/4] Testing IRON BANK MODE (All realms, DoD compliance)..." -ForegroundColor Green
Write-Host "      Use Case: DoD/IC (Enterprise pricing)" -ForegroundColor Yellow
$env:KHEPRA_MODE = "ironbank"
Start-Process -FilePath ".\bin\khepra-agent-sekhem.exe" -ArgumentList "-port 45447" -NoNewWindow -PassThru
Start-Sleep -Seconds 5
Write-Host "      ✅ Iron Bank Mode running on http://localhost:45447" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ALL MODES RUNNING" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Edge Mode:      http://localhost:45444/healthz" -ForegroundColor White
Write-Host "Hybrid Mode:    http://localhost:45445/healthz" -ForegroundColor White
Write-Host "Sovereign Mode: http://localhost:45446/healthz" -ForegroundColor White
Write-Host "Iron Bank Mode: http://localhost:45447/healthz" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop all instances" -ForegroundColor Yellow
Write-Host ""

# Wait for user input
Read-Host "Press Enter to stop all instances"

# Stop all instances
Get-Process | Where-Object { $_.ProcessName -like "*khepra*" } | Stop-Process -Force
Write-Host "All instances stopped" -ForegroundColor Green
