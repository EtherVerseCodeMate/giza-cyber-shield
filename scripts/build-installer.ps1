# scripts/build-installer.ps1
# AdinKhepra ASAF v1.1.1 — Full Windows installer build pipeline
#
# Prerequisites:
#   - Go 1.22+ with CGO_ENABLED=1
#   - MinGW-w64 gcc (for Fyne)
#   - git
#
# Usage:
#   .\scripts\build-installer.ps1              # build all + package installer
#   .\scripts\build-installer.ps1 -SkipSigning # skip Authenticode signing step

param(
    [switch]$SkipSigning,
    [string]$Version = "1.1.1"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent

Write-Host "=== AdinKhepra ASAF v$Version installer build ===" -ForegroundColor Cyan

# ── 1. Build CLI (CGO_ENABLED=0, FIPS-ready) ──────────────────────────────────
Write-Host "`n[1/6] Building adinkhepra.exe (CLI)..." -ForegroundColor Yellow
$env:CGO_ENABLED = "0"
$env:GOOS = "windows"
$env:GOARCH = "amd64"
& go build -trimpath `
    -ldflags="-s -w -X github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license.AgentVersion=v$Version" `
    -o "$Root\bin\adinkhepra.exe" `
    "$Root\cmd\adinkhepra"
if ($LASTEXITCODE -ne 0) { Write-Error "CLI build failed"; exit 1 }
Write-Host "  OK: bin\adinkhepra.exe" -ForegroundColor Green

# ── 2. Build daemon (CGO_ENABLED=0) ───────────────────────────────────────────
Write-Host "`n[2/6] Building asaf-daemon.exe (daemon)..." -ForegroundColor Yellow
$env:CGO_ENABLED = "0"
& go build -trimpath `
    -ldflags="-s -w" `
    -o "$Root\bin\asaf-daemon.exe" `
    "$Root\cmd\asaf-daemon"
if ($LASTEXITCODE -ne 0) { Write-Error "Daemon build failed"; exit 1 }
Write-Host "  OK: bin\asaf-daemon.exe" -ForegroundColor Green

# ── 3. Build desktop GUI (CGO_ENABLED=1, requires MinGW) ─────────────────────
Write-Host "`n[3/6] Building adinkhepra-desktop.exe (Fyne GUI)..." -ForegroundColor Yellow
$env:CGO_ENABLED = "1"
& go build -trimpath `
    -ldflags="-s -w -H windowsgui" `
    -o "$Root\bin\adinkhepra-desktop.exe" `
    "$Root\cmd\asaf-desktop"
if ($LASTEXITCODE -ne 0) { Write-Error "Desktop build failed"; exit 1 }
Write-Host "  OK: bin\adinkhepra-desktop.exe" -ForegroundColor Green

# ── 4. Copy binaries into installer payload ───────────────────────────────────
Write-Host "`n[4/6] Staging installer payload..." -ForegroundColor Yellow
$payloadDir = "$Root\cmd\installer\payload"
New-Item -ItemType Directory -Force -Path $payloadDir | Out-Null
Copy-Item "$Root\bin\adinkhepra-desktop.exe" "$payloadDir\adinkhepra-desktop.exe" -Force
Copy-Item "$Root\bin\adinkhepra.exe"          "$payloadDir\adinkhepra.exe"         -Force
Copy-Item "$Root\bin\asaf-daemon.exe"         "$payloadDir\asaf-daemon.exe"        -Force
Write-Host "  Payload staged in $payloadDir" -ForegroundColor Green

# ── 5. Build installer wizard (CGO_ENABLED=1, Fyne) ──────────────────────────
Write-Host "`n[5/6] Building AdinKhepra-ASAF-v$Version-Setup.exe..." -ForegroundColor Yellow
$env:CGO_ENABLED = "1"
New-Item -ItemType Directory -Force -Path "$Root\dist\windows" | Out-Null
& go build -trimpath `
    -ldflags="-s -w -H windowsgui" `
    -o "$Root\dist\windows\AdinKhepra-ASAF-v$Version-Setup.exe" `
    "$Root\cmd\installer"
if ($LASTEXITCODE -ne 0) { Write-Error "Installer build failed"; exit 1 }
Write-Host "  OK: dist\windows\AdinKhepra-ASAF-v$Version-Setup.exe" -ForegroundColor Green

# ── 6. Checksums ──────────────────────────────────────────────────────────────
Write-Host "`n[6/6] Computing SHA-256 checksums..." -ForegroundColor Yellow
$checksumFile = "$Root\dist\windows\CHECKSUMS.txt"
"# AdinKhepra ASAF v$Version — Windows Release Checksums" | Out-File $checksumFile -Encoding utf8
"# $(Get-Date -Format 'yyyy-MM-dd')" | Add-Content $checksumFile
"# Algorithm: SHA-256" | Add-Content $checksumFile
""  | Add-Content $checksumFile

$artifacts = @(
    "dist\windows\AdinKhepra-ASAF-v$Version-Setup.exe",
    "bin\adinkhepra-desktop.exe",
    "bin\adinkhepra.exe",
    "bin\asaf-daemon.exe"
)
foreach ($f in $artifacts) {
    $full = "$Root\$f"
    if (Test-Path $full) {
        $hash = (Get-FileHash $full -Algorithm SHA256).Hash.ToLower()
        "$hash  $f" | Add-Content $checksumFile
        Write-Host "  $hash  $f" -ForegroundColor Gray
    }
}

# ── Optional: Authenticode signing ────────────────────────────────────────────
if (-not $SkipSigning) {
    Write-Host "`nAuthenticode signing..." -ForegroundColor Yellow
    Write-Host "  Skipped — EV certificate procurement pending." -ForegroundColor Gray
    Write-Host "  Run signtool.exe manually when cert is available:" -ForegroundColor Gray
    Write-Host "    signtool sign /tr http://timestamp.sectigo.com /td sha256 /fd sha256 /a <exe>" -ForegroundColor Gray
}

Write-Host "`n=== Build complete ===" -ForegroundColor Cyan
Write-Host "  Installer: dist\windows\AdinKhepra-ASAF-v$Version-Setup.exe" -ForegroundColor White
Write-Host "  Checksums: dist\windows\CHECKSUMS.txt" -ForegroundColor White
