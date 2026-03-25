# Organize Sekhem Files for Iron Bank Upload
# Simple version - just organizes files

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ORGANIZING 23 FILES FOR IRON BANK" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create output directory
$outputDir = "ironbank-upload"
Write-Host "[1/3] Creating output directory: $outputDir" -ForegroundColor Green

if (Test-Path $outputDir) {
    Remove-Item -Recurse -Force $outputDir
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
Write-Host "      Created: $outputDir" -ForegroundColor White
Write-Host ""

# Create directory structure
Write-Host "[2/3] Creating directory structure..." -ForegroundColor Green

$directories = @(
    "$outputDir/pkg/agi",
    "$outputDir/pkg/maat",
    "$outputDir/pkg/ouroboros",
    "$outputDir/pkg/sekhem",
    "$outputDir/pkg/seshat",
    "$outputDir/cmd/agent"
)

foreach ($dir in $directories) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}
Write-Host "      Created all directories" -ForegroundColor White
Write-Host ""

# Copy files
Write-Host "[3/3] Copying files..." -ForegroundColor Green

$fileCount = 0

# pkg/agi/ (2 files)
Write-Host "   pkg/agi/" -ForegroundColor Cyan
Copy-Item "pkg/agi/engine.go" "$outputDir/pkg/agi/engine.go" -ErrorAction SilentlyContinue
Copy-Item "pkg/agi/engine_test.go" "$outputDir/pkg/agi/engine_test.go" -ErrorAction SilentlyContinue
$fileCount += 2

# pkg/maat/ (4 files)
Write-Host "   pkg/maat/" -ForegroundColor Cyan
Copy-Item "pkg/maat/anubis.go" "$outputDir/pkg/maat/anubis.go" -ErrorAction SilentlyContinue
Copy-Item "pkg/maat/guardian.go" "$outputDir/pkg/maat/guardian.go" -ErrorAction SilentlyContinue
Copy-Item "pkg/maat/heka.go" "$outputDir/pkg/maat/heka.go" -ErrorAction SilentlyContinue
Copy-Item "pkg/maat/isfet.go" "$outputDir/pkg/maat/isfet.go" -ErrorAction SilentlyContinue
$fileCount += 4

# pkg/ouroboros/ (3 files)
Write-Host "   pkg/ouroboros/" -ForegroundColor Cyan
Copy-Item "pkg/ouroboros/cycle.go" "$outputDir/pkg/ouroboros/cycle.go" -ErrorAction SilentlyContinue
Copy-Item "pkg/ouroboros/khopesh.go" "$outputDir/pkg/ouroboros/khopesh.go" -ErrorAction SilentlyContinue
Copy-Item "pkg/ouroboros/wedjat.go" "$outputDir/pkg/ouroboros/wedjat.go" -ErrorAction SilentlyContinue
$fileCount += 3

# pkg/sekhem/ (5 files)
Write-Host "   pkg/sekhem/" -ForegroundColor Cyan
Copy-Item "pkg/sekhem/aaru.go" "$outputDir/pkg/sekhem/aaru.go" -ErrorAction SilentlyContinue
Copy-Item "pkg/sekhem/aten.go" "$outputDir/pkg/sekhem/aten.go" -ErrorAction SilentlyContinue
Copy-Item "pkg/sekhem/duat.go" "$outputDir/pkg/sekhem/duat.go" -ErrorAction SilentlyContinue
Copy-Item "pkg/sekhem/realms.go" "$outputDir/pkg/sekhem/realms.go" -ErrorAction SilentlyContinue
Copy-Item "pkg/sekhem/triad.go" "$outputDir/pkg/sekhem/triad.go" -ErrorAction SilentlyContinue
$fileCount += 5

# pkg/seshat/ (1 file)
Write-Host "   pkg/seshat/" -ForegroundColor Cyan
Copy-Item "pkg/seshat/chronicle.go" "$outputDir/pkg/seshat/chronicle.go" -ErrorAction SilentlyContinue
$fileCount += 1

# cmd/agent/ (3 files)
Write-Host "   cmd/agent/" -ForegroundColor Cyan
Copy-Item "cmd/agent/licensing_api.go" "$outputDir/cmd/agent/licensing_api.go" -ErrorAction SilentlyContinue
Copy-Item "cmd/agent/main.go" "$outputDir/cmd/agent/main.go" -ErrorAction SilentlyContinue
Copy-Item "cmd/agent/server_test.go" "$outputDir/cmd/agent/server_test.go" -ErrorAction SilentlyContinue
$fileCount += 3

# Root files (4 files)
Write-Host "   Root files" -ForegroundColor Cyan
Copy-Item "demo-all-modes.ps1" "$outputDir/demo-all-modes.ps1" -ErrorAction SilentlyContinue
Copy-Item "go.mod" "$outputDir/go.mod" -ErrorAction SilentlyContinue
Copy-Item "go.sum" "$outputDir/go.sum" -ErrorAction SilentlyContinue
Copy-Item "hardening_manifest.yaml" "$outputDir/hardening_manifest.yaml" -ErrorAction SilentlyContinue
$fileCount += 4

Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ORGANIZATION COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Files organized: $fileCount" -ForegroundColor Cyan
Write-Host "Output directory: $outputDir/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Directory breakdown:" -ForegroundColor White
Write-Host "  pkg/agi/         2 files" -ForegroundColor White
Write-Host "  pkg/maat/        4 files" -ForegroundColor White
Write-Host "  pkg/ouroboros/   3 files" -ForegroundColor White
Write-Host "  pkg/sekhem/      5 files (NEW: aaru.go, aten.go)" -ForegroundColor Green
Write-Host "  pkg/seshat/      1 file" -ForegroundColor White
Write-Host "  cmd/agent/       3 files" -ForegroundColor White
Write-Host "  Root files       4 files" -ForegroundColor White
Write-Host ""
Write-Host "Next: Upload ironbank-upload/ to Iron Bank repository" -ForegroundColor Yellow
Write-Host ""
