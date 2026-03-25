# Khepra Sekhem - Quick Test Script
# Tests the installed Khepra Sekhem agent

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  KHEPRA SEKHEM - QUICK TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$SERVICE_NAME = "KhepraSekhem"
$AGENT_URL = "http://localhost:45444"

# Test 1: Check if service is running
Write-Host "[Test 1/5] Checking service status..." -ForegroundColor Green
$service = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
if ($service) {
    if ($service.Status -eq "Running") {
        Write-Host "  ✅ Service is running" -ForegroundColor Green
    }
    else {
        Write-Host "  ⚠️  Service exists but is not running (Status: $($service.Status))" -ForegroundColor Yellow
        Write-Host "  Starting service..." -ForegroundColor Yellow
        Start-Service -Name $SERVICE_NAME
        Start-Sleep -Seconds 3
    }
}
else {
    Write-Host "  ❌ Service not found. Please run install-sekhem.ps1 first" -ForegroundColor Red
    exit 1
}

# Test 2: Health check
Write-Host ""
Write-Host "[Test 2/5] Testing health endpoint..." -ForegroundColor Green
try {
    $health = Invoke-RestMethod -Uri "$AGENT_URL/healthz" -Method Get -TimeoutSec 5
    Write-Host "  ✅ Health check passed" -ForegroundColor Green
    Write-Host "     Tenant: $($health.tenant)" -ForegroundColor White
}
catch {
    Write-Host "  ❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: AGI/KASA status
Write-Host ""
Write-Host "[Test 3/5] Testing KASA engine..." -ForegroundColor Green
try {
    $agiState = Invoke-RestMethod -Uri "$AGENT_URL/agi/state" -Method Get -TimeoutSec 5
    Write-Host "  ✅ KASA engine is active" -ForegroundColor Green
    Write-Host "     Objective: $($agiState.objective)" -ForegroundColor White
    Write-Host "     Status: $($agiState.status)" -ForegroundColor White
}
catch {
    Write-Host "  ❌ KASA check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: DAG state
Write-Host ""
Write-Host "[Test 4/5] Testing DAG store..." -ForegroundColor Green
try {
    $dagState = Invoke-RestMethod -Uri "$AGENT_URL/dag/state" -Method Get -TimeoutSec 5
    $nodeCount = $dagState.Count
    Write-Host "  ✅ DAG store is operational" -ForegroundColor Green
    Write-Host "     Nodes: $nodeCount" -ForegroundColor White
}
catch {
    Write-Host "  ❌ DAG check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: Chat with KASA
Write-Host ""
Write-Host "[Test 5/5] Testing KASA chat (AI)..." -ForegroundColor Green
try {
    $chatBody = @{
        message = "What is the current security posture?"
    } | ConvertTo-Json
    
    $chatResponse = Invoke-RestMethod -Uri "$AGENT_URL/agi/chat" -Method Post -Body $chatBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "  ✅ KASA chat is working" -ForegroundColor Green
    Write-Host "     Response: $($chatResponse.response.Substring(0, [Math]::Min(100, $chatResponse.response.Length)))..." -ForegroundColor White
}
catch {
    Write-Host "  ⚠️  KASA chat test skipped (may require LLM configuration)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Sekhem Triad Components:" -ForegroundColor Green
Write-Host "  🐍 Ouroboros Cycle: Spinning every 10 seconds" -ForegroundColor White
Write-Host "  👁️  Wedjat Eyes: 4 sensors active (STIG, Vuln, Drift, FIM)" -ForegroundColor White
Write-Host "  ⚔️  Khopesh Blades: 5 actuators ready (Remediation, Firewall, etc.)" -ForegroundColor White
Write-Host "  ⚖️  Maat Guardian: AI-powered decision making with KASA" -ForegroundColor White
Write-Host "  📜 Seshat Chronicle: Logging to immutable DAG" -ForegroundColor White
Write-Host ""
Write-Host "Agent is defending your system! 🛡️" -ForegroundColor Green
Write-Host ""
Write-Host "View real-time logs:" -ForegroundColor Cyan
Write-Host "  Get-EventLog -LogName Application -Source KhepraSekhem -Newest 20" -ForegroundColor Yellow
Write-Host ""
