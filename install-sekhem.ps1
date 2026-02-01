# Khepra Sekhem - Windows Installation Script
# Run as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  KHEPRA SEKHEM - TRL10 INSTALLER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[ERROR] This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Configuration
$INSTALL_DIR = "C:\Program Files\Khepra"
$BIN_PATH = "$INSTALL_DIR\khepra-agent-sekhem.exe"
$SERVICE_NAME = "KhepraSekhem"
$SERVICE_DISPLAY_NAME = "Khepra Sekhem Agent (TRL10)"
$SERVICE_DESCRIPTION = "Autonomous cyber defense with Sekhem Triad framework - AI-powered threat detection and response"

Write-Host "[1/6] Creating installation directory..." -ForegroundColor Green
if (-not (Test-Path $INSTALL_DIR)) {
    New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
}

Write-Host "[2/6] Copying binary..." -ForegroundColor Green
$sourceBinary = ".\bin\khepra-agent-sekhem.exe"
if (-not (Test-Path $sourceBinary)) {
    Write-Host "[ERROR] Binary not found: $sourceBinary" -ForegroundColor Red
    Write-Host "Please build the binary first: go build -o bin/khepra-agent-sekhem.exe ./cmd/agent" -ForegroundColor Yellow
    exit 1
}
Copy-Item $sourceBinary $BIN_PATH -Force

Write-Host "[3/6] Creating data directories..." -ForegroundColor Green
$dataDir = "$INSTALL_DIR\data"
$dagDir = "$dataDir\dag"
$logsDir = "$dataDir\logs"
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
New-Item -ItemType Directory -Path $dagDir -Force | Out-Null
New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

Write-Host "[4/6] Creating configuration file..." -ForegroundColor Green
$configContent = @"
# Khepra Sekhem Configuration
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# Agent Settings
KHEPRA_AGENT_PORT=45444
KHEPRA_TENANT=default

# License Settings (optional)
# KHEPRA_LICENSE_SERVER=https://telemetry.souhimbou.org
# KHEPRA_ENROLLMENT_TOKEN=your-token-here

# Data Paths
KHEPRA_DATA_DIR=$dataDir
KHEPRA_DAG_DIR=$dagDir
KHEPRA_LOGS_DIR=$logsDir
"@
$configPath = "$INSTALL_DIR\config.env"
$configContent | Out-File -FilePath $configPath -Encoding UTF8

Write-Host "[5/6] Checking for existing service..." -ForegroundColor Green
$existingService = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "  Stopping existing service..." -ForegroundColor Yellow
    Stop-Service -Name $SERVICE_NAME -Force -ErrorAction SilentlyContinue
    Write-Host "  Removing existing service..." -ForegroundColor Yellow
    sc.exe delete $SERVICE_NAME | Out-Null
    Start-Sleep -Seconds 2
}

Write-Host "[6/6] Installing Windows service..." -ForegroundColor Green
# Create the service using sc.exe (more reliable than New-Service for custom executables)
sc.exe create $SERVICE_NAME binPath= "`"$BIN_PATH`"" start= auto DisplayName= "$SERVICE_DISPLAY_NAME" | Out-Null

if ($LASTEXITCODE -eq 0) {
    # Set service description
    sc.exe description $SERVICE_NAME "$SERVICE_DESCRIPTION" | Out-Null
    
    # Configure service recovery options (restart on failure)
    sc.exe failure $SERVICE_NAME reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  INSTALLATION COMPLETE!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Installation Details:" -ForegroundColor Cyan
    Write-Host "  Location: $INSTALL_DIR" -ForegroundColor White
    Write-Host "  Binary: $BIN_PATH" -ForegroundColor White
    Write-Host "  Service: $SERVICE_NAME" -ForegroundColor White
    Write-Host "  Port: 45444" -ForegroundColor White
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Start the service:" -ForegroundColor White
    Write-Host "     Start-Service -Name $SERVICE_NAME" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  2. Check service status:" -ForegroundColor White
    Write-Host "     Get-Service -Name $SERVICE_NAME" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  3. View logs:" -ForegroundColor White
    Write-Host "     Get-EventLog -LogName Application -Source $SERVICE_NAME -Newest 50" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  4. Test the agent:" -ForegroundColor White
    Write-Host "     curl http://localhost:45444/healthz" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Sekhem Triad is ready to defend! 🛡️" -ForegroundColor Green
    Write-Host ""
}
else {
    Write-Host ""
    Write-Host "[ERROR] Service installation failed!" -ForegroundColor Red
    Write-Host "Error code: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}
