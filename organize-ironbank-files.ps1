# Organize Sekhem Files for Iron Bank Upload
# Creates proper directory structure with exactly the files you uploaded

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ORGANIZING 23 FILES FOR IRON BANK" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create output directory
$outputDir = "ironbank-upload"
Write-Host "[1/4] Creating output directory: $outputDir" -ForegroundColor Green

if (Test-Path $outputDir) {
    Write-Host "      Cleaning existing directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $outputDir
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
Write-Host "      ✅ Created: $outputDir" -ForegroundColor Green
Write-Host ""

# Create directory structure
Write-Host "[2/4] Creating directory structure..." -ForegroundColor Green

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
    Write-Host "      ✅ Created: $dir" -ForegroundColor White
}
Write-Host ""

# Copy files with proper organization
Write-Host "[3/4] Copying and organizing files..." -ForegroundColor Green

$fileCount = 0

# pkg/agi/ (2 files)
Write-Host "   📁 pkg/agi/" -ForegroundColor Cyan
$agiFiles = @(
    "pkg/agi/engine.go",
    "pkg/agi/engine_test.go"
)
foreach ($file in $agiFiles) {
    if (Test-Path $file) {
        Copy-Item $file "$outputDir/$file"
        Write-Host "      ✅ $(Split-Path $file -Leaf)" -ForegroundColor White
        $fileCount++
    }
    else {
        Write-Host "      ⚠️  Missing: $file" -ForegroundColor Yellow
    }
}

# pkg/maat/ (4 files)
Write-Host "   📁 pkg/maat/" -ForegroundColor Cyan
$maatFiles = @(
    "pkg/maat/anubis.go",
    "pkg/maat/guardian.go",
    "pkg/maat/heka.go",
    "pkg/maat/isfet.go"
)
foreach ($file in $maatFiles) {
    if (Test-Path $file) {
        Copy-Item $file "$outputDir/$file"
        Write-Host "      ✅ $(Split-Path $file -Leaf)" -ForegroundColor White
        $fileCount++
    }
    else {
        Write-Host "      ⚠️  Missing: $file" -ForegroundColor Yellow
    }
}

# pkg/ouroboros/ (3 files)
Write-Host "   📁 pkg/ouroboros/" -ForegroundColor Cyan
$ouroborosFiles = @(
    "pkg/ouroboros/cycle.go",
    "pkg/ouroboros/khopesh.go",
    "pkg/ouroboros/wedjat.go"
)
foreach ($file in $ouroborosFiles) {
    if (Test-Path $file) {
        Copy-Item $file "$outputDir/$file"
        Write-Host "      ✅ $(Split-Path $file -Leaf)" -ForegroundColor White
        $fileCount++
    }
    else {
        Write-Host "      ⚠️  Missing: $file" -ForegroundColor Yellow
    }
}

# pkg/sekhem/ (5 files)
Write-Host "   📁 pkg/sekhem/" -ForegroundColor Cyan
$sekhemFiles = @(
    "pkg/sekhem/aaru.go",
    "pkg/sekhem/aten.go",
    "pkg/sekhem/duat.go",
    "pkg/sekhem/realms.go",
    "pkg/sekhem/triad.go"
)
foreach ($file in $sekhemFiles) {
    if (Test-Path $file) {
        Copy-Item $file "$outputDir/$file"
        $fileName = Split-Path $file -Leaf
        if ($fileName -eq "aaru.go" -or $fileName -eq "aten.go") {
            Write-Host "      ✅ $fileName (NEW)" -ForegroundColor Green
        }
        else {
            Write-Host "      ✅ $fileName" -ForegroundColor White
        }
        $fileCount++
    }
    else {
        Write-Host "      ⚠️  Missing: $file" -ForegroundColor Yellow
    }
}

# pkg/seshat/ (1 file)
Write-Host "   📁 pkg/seshat/" -ForegroundColor Cyan
$seshatFiles = @(
    "pkg/seshat/chronicle.go"
)
foreach ($file in $seshatFiles) {
    if (Test-Path $file) {
        Copy-Item $file "$outputDir/$file"
        Write-Host "      ✅ $(Split-Path $file -Leaf)" -ForegroundColor White
        $fileCount++
    }
    else {
        Write-Host "      ⚠️  Missing: $file" -ForegroundColor Yellow
    }
}

# cmd/agent/ (3 files)
Write-Host "   📁 cmd/agent/" -ForegroundColor Cyan
$agentFiles = @(
    "cmd/agent/licensing_api.go",
    "cmd/agent/main.go",
    "cmd/agent/server_test.go"
)
foreach ($file in $agentFiles) {
    if (Test-Path $file) {
        Copy-Item $file "$outputDir/$file"
        Write-Host "      ✅ $(Split-Path $file -Leaf)" -ForegroundColor White
        $fileCount++
    }
    else {
        Write-Host "      ⚠️  Missing: $file" -ForegroundColor Yellow
    }
}

# Root files (4 files)
Write-Host "   📁 Root files" -ForegroundColor Cyan
$rootFiles = @(
    "demo-all-modes.ps1",
    "go.mod",
    "go.sum",
    "hardening_manifest.yaml"
)
foreach ($file in $rootFiles) {
    if (Test-Path $file) {
        Copy-Item $file "$outputDir/$file"
        Write-Host "      ✅ $file" -ForegroundColor White
        $fileCount++
    }
    else {
        Write-Host "      ⚠️  Missing: $file" -ForegroundColor Yellow
    }
}

Write-Host ""

# Create README for the upload directory
Write-Host "[4/4] Creating upload guide..." -ForegroundColor Green

$readme = @"
# Iron Bank Upload - Sekhem Triad

## Files Organized: $fileCount/23

### Directory Structure

ironbank-upload/
  pkg/
    agi/             (2 files)
    maat/            (4 files)
    ouroboros/       (3 files)
    sekhem/          (5 files) - Includes NEW Aaru & Aten
    seshat/          (1 file)
  cmd/
    agent/           (3 files)
  demo-all-modes.ps1
  go.mod
  go.sum
  hardening_manifest.yaml

## Upload Methods

### Method 1: GitHub Web UI (Recommended)

1. Go to: https://github.com/nouchix/adinkhepra-asaf-ironbank
2. Create branch: ``sekhem-triad-organized``
3. For each directory:
   - Navigate to directory in GitHub
   - Click "Add file" → "Upload files"
   - Upload files from corresponding local directory
4. Commit all changes
5. Create Pull Request

### Method 2: Git Command Line

# Clone Iron Bank repo (if not already)
git clone https://github.com/nouchix/adinkhepra-asaf-ironbank.git
cd adinkhepra-asaf-ironbank

# Create branch
git checkout -b sekhem-triad-organized

# Copy files from ironbank-upload
cp -r ../khepra-protocol/ironbank-upload/* .

# Stage and commit
git add -A
git commit -m "feat: Integrate Sekhem Triad (TRL10) - Four Deployment Modes"

# Push
git push origin sekhem-triad-organized

### Method 3: GitHub Desktop

1. Open GitHub Desktop
2. Add Iron Bank repository
3. Create branch: ``sekhem-triad-organized``
4. Copy files from ``ironbank-upload/`` to repo
5. Commit: "feat: Integrate Sekhem Triad (TRL10)"
6. Push to origin

## What's New

**New Realms**:
- ``pkg/sekhem/aaru.go`` - Aaru Realm (Hybrid Mode)
- ``pkg/sekhem/aten.go`` - Aten Realm (Sovereign/Iron Bank Mode)

**Updated Files**:
- ``pkg/sekhem/triad.go`` - Mode selection support
- ``cmd/agent/main.go`` - KHEPRA_MODE environment variable
- ``hardening_manifest.yaml`` - v1.2.0 with Sekhem capabilities

## Next Steps

1. ✅ Files organized in ``ironbank-upload/``
2. ⏳ Upload to Iron Bank repository
3. ⏳ Create Pull Request
4. ⏳ Review and merge

---

**All $fileCount files ready for Iron Bank! 🚀**
"@

$readme | Out-File -FilePath "$outputDir/README.md" -Encoding UTF8
Write-Host "      ✅ README.md created" -ForegroundColor White
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ ORGANIZATION COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Files organized: $fileCount/23" -ForegroundColor Cyan
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
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review files in: $outputDir/" -ForegroundColor White
Write-Host "  2. Upload to Iron Bank repo" -ForegroundColor White
Write-Host "  3. See $outputDir/README.md for upload methods" -ForegroundColor White
Write-Host ""
Write-Host "Ready to upload to Iron Bank! 🎉" -ForegroundColor Green
Write-Host ""
