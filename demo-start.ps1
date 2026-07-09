# demo-start.ps1 — KHEPRA Demo Launcher
# July 10, 2026 — F6S Pitch Pulse: Security & Defense
# Usage: .\demo-start.ps1
# Requires: .env.demo.local in the same directory (or set env vars manually)
# IP: SOUHIMBOU DOH KONE LLC, exclusively licensed to SecRed Knowledge Inc.

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "  ██╗  ██╗██╗  ██╗███████╗██████╗ ██████╗  █████╗ " -ForegroundColor Cyan
Write-Host "  ██║ ██╔╝██║  ██║██╔════╝██╔══██╗██╔══██╗██╔══██╗" -ForegroundColor Cyan
Write-Host "  █████╔╝ ███████║█████╗  ██████╔╝██████╔╝███████║" -ForegroundColor Cyan
Write-Host "  ██╔═██╗ ██╔══██║██╔══╝  ██╔═══╝ ██╔══██╗██╔══██║" -ForegroundColor Cyan
Write-Host "  ██║  ██╗██║  ██║███████╗██║     ██║  ██║██║  ██║" -ForegroundColor Cyan
Write-Host "  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  AdinKhepra ASAF — Demo Launcher" -ForegroundColor White
Write-Host "  NouchiX / SecRed Knowledge Inc. | USPTO #73565085" -ForegroundColor DarkGray
Write-Host ""

# ── Load environment ────────────────────────────────────────────────────────────
$envFile = Join-Path $ScriptDir ".env.demo.local"
if (Test-Path $envFile) {
    Write-Host "[ENV] Loading $envFile" -ForegroundColor DarkGray
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $k = $matches[1].Trim()
            $v = $matches[2].Trim().Trim('"')
            [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
        }
    }
} else {
    Write-Host "[WARN] .env.demo.local not found — using existing environment" -ForegroundColor Yellow
}

# ── Verify license ──────────────────────────────────────────────────────────────
$tiersFile = Join-Path $env:USERPROFILE ".khepra\tiers.json"
if (Test-Path $tiersFile) {
    $tier = (Get-Content $tiersFile | ConvertFrom-Json).tier
    $exp  = (Get-Content $tiersFile | ConvertFrom-Json).expires_at
    Write-Host "[LICENSE] $tier tier | expires $exp" -ForegroundColor Green
} else {
    Write-Host "[LICENSE] WARNING: ~/.khepra/tiers.json not found — running in Community mode" -ForegroundColor Yellow
}

# ── Kill any leftover processes on our ports ────────────────────────────────────
@(45444, 8443) | ForEach-Object {
    $port = $_
    $procs = netstat -ano | Select-String ":$port " | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Where-Object { $_ -match '^\d+$' } | Select-Object -Unique
    $procs | ForEach-Object {
        try { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } catch {}
    }
}

$BinDir = Join-Path $ScriptDir "bin"

# ── Start apiserver (REST API :45444) ───────────────────────────────────────────
$apiserverExe = Join-Path $BinDir "apiserver.exe"
if (Test-Path $apiserverExe) {
    Write-Host "[START] apiserver.exe → http://localhost:45444" -ForegroundColor Cyan
    Start-Process -FilePath $apiserverExe `
        -ArgumentList "--port", "45444" `
        -WorkingDirectory $ScriptDir `
        -WindowStyle Minimized
    Start-Sleep -Milliseconds 1500
    # Health check
    try {
        $hc = Invoke-WebRequest -Uri "http://localhost:45444/healthz" -TimeoutSec 3 -UseBasicParsing
        Write-Host "[OK] apiserver healthy" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] apiserver not responding yet — may still be starting" -ForegroundColor Yellow
    }
} else {
    Write-Host "[WARN] apiserver.exe not found at $apiserverExe — API will be in scripted mode" -ForegroundColor Yellow
    Write-Host "       Build with: go build -o bin/apiserver.exe ./cmd/apiserver" -ForegroundColor DarkGray
}

# ── Start adinkhepra watch server (DAG viewer :8443) ───────────────────────────
$watchExe = Join-Path $BinDir "adinkhepra.exe"
if (Test-Path $watchExe) {
    Write-Host "[START] adinkhepra watch → http://localhost:8443" -ForegroundColor Cyan
    Start-Process -FilePath $watchExe `
        -ArgumentList "watch", "-port", "8443" `
        -WorkingDirectory $ScriptDir `
        -WindowStyle Minimized
    Start-Sleep -Milliseconds 800
} else {
    Write-Host "[WARN] adinkhepra.exe not found — DAG viewer will not stream" -ForegroundColor Yellow
    Write-Host "       Build with: go build -o bin/adinkhepra.exe ./cmd/adinkhepra" -ForegroundColor DarkGray
}

# ── Verify VPS target is reachable ─────────────────────────────────────────────
$dvwaTarget = "http://2.24.105.170:4280"
Write-Host "[CHECK] Testing VPS target: $dvwaTarget" -ForegroundColor DarkGray
try {
    $r = Invoke-WebRequest -Uri $dvwaTarget -TimeoutSec 5 -UseBasicParsing
    Write-Host "[OK] DVWA target reachable ($($r.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "[WARN] DVWA target unreachable — check VPS / Docker status" -ForegroundColor Yellow
    Write-Host "       SSH: ssh root@2.24.105.170 'docker ps | grep dvwa'" -ForegroundColor DarkGray
}

# ── Open the console ────────────────────────────────────────────────────────────
$consoleFile = Join-Path $ScriptDir "KHEPRA_OPERATOR_CONSOLE.html"
Write-Host ""
Write-Host "[LAUNCH] Opening KHEPRA Operator Console..." -ForegroundColor Green
Write-Host ""
Write-Host "  Target:     $dvwaTarget" -ForegroundColor White
Write-Host "  API:        http://localhost:45444" -ForegroundColor White
Write-Host "  MCP Server: http://mcp.souhimbou.ai" -ForegroundColor White
Write-Host "  Console:    $consoleFile" -ForegroundColor White
Write-Host ""

if (Test-Path $consoleFile) {
    $claudeKey = $env:ANTHROPIC_API_KEY
    if ($claudeKey) {
        # Inject key as URL param — CFG.claudeKey reads it via URLSearchParams
        $consoleUri = "file:///" + ($consoleFile -replace '\\', '/') + "?key=$claudeKey"
        Write-Host "[IMHOTEP] Claude key injected into console URL" -ForegroundColor Green
        Start-Process $consoleUri
    } else {
        Write-Host "[WARN] No ANTHROPIC_API_KEY found — Imhotep will use scripted fallback" -ForegroundColor Yellow
        Start-Process $consoleFile
    }
} else {
    Write-Host "[ERROR] Console file not found: $consoleFile" -ForegroundColor Red
}

Write-Host "Demo environment started. Press Ctrl+C to stop background processes." -ForegroundColor DarkGray
Write-Host ""
