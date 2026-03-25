# Khepra Sekhem - Uninstaller
# Run as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  KHEPRA SEKHEM - UNINSTALLER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[ERROR] This script must be run as Administrator!" -ForegroundColor Red
    exit 1
}

$SERVICE_NAME = "KhepraSekhem"
$INSTALL_DIR = "C:\Program Files\Khepra"

Write-Host "[1/3] Stopping service..." -ForegroundColor Green
$service = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
if ($service) {
    Stop-Service -Name $SERVICE_NAME -Force -ErrorAction SilentlyContinue
    Write-Host "  Service stopped" -ForegroundColor White
}

Write-Host "[2/3] Removing service..." -ForegroundColor Green
if ($service) {
    sc.exe delete $SERVICE_NAME | Out-Null
    Write-Host "  Service removed" -ForegroundColor White
}
else {
    Write-Host "  Service not found (already removed)" -ForegroundColor Yellow
}

Write-Host "[3/3] Removing installation directory..." -ForegroundColor Green
if (Test-Path $INSTALL_DIR) {
    Remove-Item -Path $INSTALL_DIR -Recurse -Force
    Write-Host "  Directory removed" -ForegroundColor White
}
else {
    Write-Host "  Directory not found (already removed)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  UNINSTALL COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
