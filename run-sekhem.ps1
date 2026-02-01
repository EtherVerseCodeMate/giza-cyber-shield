# Khepra Sekhem - Local Test (No Admin Required)
# Run this to test the agent locally without installing as a service

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  KHEPRA SEKHEM - LOCAL TEST MODE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$BIN_PATH = ".\bin\khepra-agent-sekhem.exe"

# Check if binary exists
if (-not (Test-Path $BIN_PATH)) {
    Write-Host "[ERROR] Binary not found: $BIN_PATH" -ForegroundColor Red
    Write-Host "Please build it first:" -ForegroundColor Yellow
    Write-Host "  go build -o bin/khepra-agent-sekhem.exe ./cmd/agent" -ForegroundColor White
    exit 1
}

Write-Host "Starting Khepra Sekhem Agent..." -ForegroundColor Green
Write-Host ""
Write-Host "Sekhem Triad Components:" -ForegroundColor Cyan
Write-Host "  🐍 Ouroboros Cycle - Eternal feedback loop" -ForegroundColor White
Write-Host "  👁️  Wedjat Eyes - 4 sensors (STIG, Vuln, Drift, FIM)" -ForegroundColor White
Write-Host "  ⚔️  Khopesh Blades - 5 actuators (Remediation, Firewall, etc.)" -ForegroundColor White
Write-Host "  ⚖️  Maat Guardian - AI-powered decision making" -ForegroundColor White
Write-Host "  📜 Seshat Chronicle - Immutable DAG audit trail" -ForegroundColor White
Write-Host ""
Write-Host "Agent will listen on: http://localhost:45444" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start the agent
& $BIN_PATH
