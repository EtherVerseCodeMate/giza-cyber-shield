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
}
else {
    Write-Host "[WARN] .env.demo.local not found — using existing environment" -ForegroundColor Yellow
}

# ── Verify license ──────────────────────────────────────────────────────────────
$tiersFile = Join-Path $env:USERPROFILE ".khepra\tiers.json"
if (Test-Path $tiersFile) {
    $tier = (Get-Content $tiersFile | ConvertFrom-Json).tier
    $exp = (Get-Content $tiersFile | ConvertFrom-Json).expires_at
    Write-Host "[LICENSE] $tier tier | expires $exp" -ForegroundColor Green
}
else {
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

# ── Start apiserver (REST API :45444) ────────────────────────────────────────────────────
$apiserverExe = Join-Path $BinDir "apiserver.exe"
if (Test-Path $apiserverExe) {
    Write-Host "[START] apiserver.exe → http://localhost:45444" -ForegroundColor Cyan
    # ── CRITICAL: --tls=false prevents main.go:208-212 from overriding --port to 8080 ──
    # Without this, TLS defaults to true, TLS_DOMAIN is empty → port forced to 8080.
    $env:TLS_ENABLED = "false"
    # KHEPRA_SERVICE_SECRET: HMAC-SHA256 shared secret for apiserver <-> khepra-mcp auth.
    # NOT the license key. NOT the ML-DSA-65 signing key. Internal inter-service auth only.
    if (-not $env:KHEPRA_SERVICE_SECRET) {
        $env:KHEPRA_SERVICE_SECRET = "khepra-dev-" + [System.Guid]::NewGuid().ToString("N")
        Write-Host "[ENV] KHEPRA_SERVICE_SECRET generated for dev session (inter-service auth)" -ForegroundColor DarkGray
    }
    Start-Process -FilePath $apiserverExe `
        -ArgumentList "--port", "45444", "--tls=false" `
        -WorkingDirectory $ScriptDir `
        -WindowStyle Minimized
    Start-Sleep -Milliseconds 2500
    # Health check with retries (startup takes ~2s for SEKHEM/DAG init)
    $retries = 0
    $apiserverUp = $false
    while ($retries -lt 6 -and -not $apiserverUp) {
        try {
            $null = Invoke-WebRequest -Uri "http://localhost:45444/healthz" -TimeoutSec 2 -UseBasicParsing
            Write-Host "[OK] apiserver healthy on :45444" -ForegroundColor Green
            $apiserverUp = $true
        }
        catch {
            $retries++
            Start-Sleep -Milliseconds 800
        }
    }
    if (-not $apiserverUp) {
        Write-Host "[WARN] apiserver not responding on :45444 — check the apiserver window for errors" -ForegroundColor Yellow
    }
}
else {
    Write-Host "[WARN] apiserver.exe not found at $apiserverExe" -ForegroundColor Yellow
    Write-Host "       Build: go build -o bin/apiserver.exe ./cmd/apiserver" -ForegroundColor DarkGray
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
}
else {
    Write-Host "[WARN] adinkhepra.exe not found — DAG viewer will not stream" -ForegroundColor Yellow
    Write-Host "       Build with: go build -o bin/adinkhepra.exe ./cmd/adinkhepra" -ForegroundColor DarkGray
}

# ── Verify VPS target is reachable ─────────────────────────────────────────────
$dvwaTarget = "http://2.24.105.170:4280"
Write-Host "[CHECK] Testing VPS target: $dvwaTarget" -ForegroundColor DarkGray
try {
    $r = Invoke-WebRequest -Uri $dvwaTarget -TimeoutSec 5 -UseBasicParsing
    Write-Host "[OK] DVWA target reachable ($($r.StatusCode))" -ForegroundColor Green
}
catch {
    Write-Host "[WARN] DVWA target unreachable — check VPS / Docker status" -ForegroundColor Yellow
    Write-Host "       SSH: ssh root@2.24.105.170 'docker ps | grep dvwa'" -ForegroundColor DarkGray
}

# ── Serve console from http://localhost:3000 (CORS fix) ─────────────────────────
# Browsers send Origin: null for file:// — blocked by CORS on agent.souhimbou.ai.
# Serving from http://localhost:3000 sets Origin: http://localhost:3000 which IS
# in the AllowedOrigins list — all API calls to agent.souhimbou.ai succeed.
# $consoleFile = Join-Path $ScriptDir "KHEPRA_OPERATOR_CONSOLE.html"
$claudeKey = $env:ANTHROPIC_API_KEY
$consoleUrl = "http://localhost:3000/KHEPRA_OPERATOR_CONSOLE.html" + $(if ($claudeKey) { "?key=$claudeKey" } else { "" })

Write-Host ""
Write-Host "[HTTP] Starting console server on http://localhost:3000" -ForegroundColor Cyan

# Start the HTTP server as a background job
$serverJob = Start-Job -ScriptBlock {
    param($rootDir)
    $listener = [System.Net.HttpListener]::new()
    $listener.Prefixes.Add("http://localhost:3000/")
    $listener.Start()
    while ($listener.IsListening) {
        try {
            $ctx = $listener.GetContext()
            $req = $ctx.Request
            $res = $ctx.Response
            # CORS headers for all requests
            $res.Headers.Add("Access-Control-Allow-Origin", "*")
            # Resolve path — default to KHEPRA_OPERATOR_CONSOLE.html
            $rawPath = $req.Url.LocalPath.TrimStart('/')
            if ([string]::IsNullOrEmpty($rawPath)) { $rawPath = "KHEPRA_OPERATOR_CONSOLE.html" }
            $filePath = Join-Path $rootDir $rawPath
            if (Test-Path $filePath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $mime = switch ($ext) {
                    ".html" { "text/html; charset=utf-8" }
                    ".js" { "application/javascript" }
                    ".css" { "text/css" }
                    ".json" { "application/json" }
                    default { "application/octet-stream" }
                }
                $res.ContentType = $mime
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            else {
                $res.StatusCode = 404
                $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $res.OutputStream.Write($body, 0, $body.Length)
            }
            $res.OutputStream.Close()
        }
        catch { }
    }
} -ArgumentList $ScriptDir

Start-Sleep -Milliseconds 600
Write-Host "[OK] Console server running at http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "  Console URL: $consoleUrl" -ForegroundColor White
Write-Host "  API:         https://agent.souhimbou.ai" -ForegroundColor White
Write-Host "  MCP Server:  https://mcp.souhimbou.ai" -ForegroundColor White
if ($claudeKey) {
    Write-Host "  Imhotep:     Claude key injected" -ForegroundColor Green
}
else {
    Write-Host "  Imhotep:     No ANTHROPIC_API_KEY — Ollama or scripted fallback" -ForegroundColor Yellow
}
Write-Host ""

# Open browser
Start-Process $consoleUrl

Write-Host "Demo running. Close this window or press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

# Keep alive until Ctrl+C
try {
    while ($true) { Start-Sleep -Seconds 5 }
}
finally {
    Stop-Job  -Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job -Job $serverJob -ErrorAction SilentlyContinue
    Write-Host "[STOP] Console server stopped." -ForegroundColor DarkGray
}
