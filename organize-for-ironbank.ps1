# Organize Sekhem Triad Files for Iron Bank
# Creates proper directory structure and copies files

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ORGANIZING SEKHEM FILES FOR IRON BANK" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create output directory
$outputDir = "ironbank-upload"
Write-Host "[1/5] Creating output directory: $outputDir" -ForegroundColor Green

if (Test-Path $outputDir) {
    Write-Host "      Cleaning existing directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $outputDir
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
Write-Host "      ✅ Created: $outputDir" -ForegroundColor Green
Write-Host ""

# Create directory structure
Write-Host "[2/5] Creating directory structure..." -ForegroundColor Green

$directories = @(
    "$outputDir/pkg/sekhem",
    "$outputDir/pkg/maat",
    "$outputDir/pkg/ouroboros",
    "$outputDir/pkg/seshat",
    "$outputDir/pkg/agi",
    "$outputDir/cmd/agent",
    "$outputDir/docs"
)

foreach ($dir in $directories) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Write-Host "      ✅ $dir" -ForegroundColor White
}
Write-Host ""

# Copy Sekhem files
Write-Host "[3/5] Copying Sekhem framework files..." -ForegroundColor Green

$sekhemFiles = @(
    @{src = "pkg/sekhem/aaru.go"; dst = "$outputDir/pkg/sekhem/aaru.go" },
    @{src = "pkg/sekhem/aten.go"; dst = "$outputDir/pkg/sekhem/aten.go" },
    @{src = "pkg/sekhem/duat.go"; dst = "$outputDir/pkg/sekhem/duat.go" },
    @{src = "pkg/sekhem/realms.go"; dst = "$outputDir/pkg/sekhem/realms.go" },
    @{src = "pkg/sekhem/triad.go"; dst = "$outputDir/pkg/sekhem/triad.go" }
)

foreach ($file in $sekhemFiles) {
    if (Test-Path $file.src) {
        Copy-Item $file.src $file.dst
        Write-Host "      ✅ $(Split-Path $file.dst -Leaf)" -ForegroundColor White
    }
    else {
        Write-Host "      ⚠️  Missing: $($file.src)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Copy Maat Guardian files
Write-Host "[4/5] Copying dependency files..." -ForegroundColor Green

$maatFiles = @(
    @{src = "pkg/maat/guardian.go"; dst = "$outputDir/pkg/maat/guardian.go" },
    @{src = "pkg/maat/isfet.go"; dst = "$outputDir/pkg/maat/isfet.go" },
    @{src = "pkg/maat/heka.go"; dst = "$outputDir/pkg/maat/heka.go" },
    @{src = "pkg/maat/anubis.go"; dst = "$outputDir/pkg/maat/anubis.go" }
)

foreach ($file in $maatFiles) {
    if (Test-Path $file.src) {
        Copy-Item $file.src $file.dst
        Write-Host "      ✅ maat/$(Split-Path $file.dst -Leaf)" -ForegroundColor White
    }
    else {
        Write-Host "      ⚠️  Missing: $($file.src)" -ForegroundColor Yellow
    }
}

$ouroborosFiles = @(
    @{src = "pkg/ouroboros/cycle.go"; dst = "$outputDir/pkg/ouroboros/cycle.go" },
    @{src = "pkg/ouroboros/wedjat.go"; dst = "$outputDir/pkg/ouroboros/wedjat.go" },
    @{src = "pkg/ouroboros/khopesh.go"; dst = "$outputDir/pkg/ouroboros/khopesh.go" }
)

foreach ($file in $ouroborosFiles) {
    if (Test-Path $file.src) {
        Copy-Item $file.src $file.dst
        Write-Host "      ✅ ouroboros/$(Split-Path $file.dst -Leaf)" -ForegroundColor White
    }
    else {
        Write-Host "      ⚠️  Missing: $($file.src)" -ForegroundColor Yellow
    }
}

$seshatFiles = @(
    @{src = "pkg/seshat/chronicle.go"; dst = "$outputDir/pkg/seshat/chronicle.go" }
)

foreach ($file in $seshatFiles) {
    if (Test-Path $file.src) {
        Copy-Item $file.src $file.dst
        Write-Host "      ✅ seshat/$(Split-Path $file.dst -Leaf)" -ForegroundColor White
    }
    else {
        Write-Host "      ⚠️  Missing: $($file.src)" -ForegroundColor Yellow
    }
}

$agiFiles = @(
    @{src = "pkg/agi/engine.go"; dst = "$outputDir/pkg/agi/engine.go" }
)

foreach ($file in $agiFiles) {
    if (Test-Path $file.src) {
        Copy-Item $file.src $file.dst
        Write-Host "      ✅ agi/$(Split-Path $file.dst -Leaf)" -ForegroundColor White
    }
    else {
        Write-Host "      ⚠️  Missing: $($file.src)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Copy integration files
Write-Host "[5/5] Copying integration and documentation..." -ForegroundColor Green

$integrationFiles = @(
    @{src = "cmd/agent/main.go"; dst = "$outputDir/cmd/agent/main.go" },
    @{src = "hardening_manifest.yaml"; dst = "$outputDir/hardening_manifest.yaml" },
    @{src = "PULL_REQUEST.md"; dst = "$outputDir/PULL_REQUEST.md" },
    @{src = "EXECUTIVE_SUMMARY.md"; dst = "$outputDir/EXECUTIVE_SUMMARY.md" },
    @{src = "READY_TO_MERGE.md"; dst = "$outputDir/READY_TO_MERGE.md" },
    @{src = "MERGE_CHECKLIST.md"; dst = "$outputDir/MERGE_CHECKLIST.md" },
    @{src = "README.ironbank.md"; dst = "$outputDir/README.ironbank.md" },
    @{src = "demo-all-modes.ps1"; dst = "$outputDir/demo-all-modes.ps1" },
    @{src = "install-sekhem.ps1"; dst = "$outputDir/install-sekhem.ps1" },
    @{src = "docs/IMPLEMENTATION_COMPLETE.md"; dst = "$outputDir/docs/IMPLEMENTATION_COMPLETE.md" },
    @{src = "docs/MERGE_STATUS.md"; dst = "$outputDir/docs/MERGE_STATUS.md" },
    @{src = "docs/IRONBANK_SEKHEM_MERGE.md"; dst = "$outputDir/docs/IRONBANK_SEKHEM_MERGE.md" },
    @{src = "docs/SEKHEM_TRL10_COMPLETE.md"; dst = "$outputDir/docs/SEKHEM_TRL10_COMPLETE.md" }
)

foreach ($file in $integrationFiles) {
    if (Test-Path $file.src) {
        Copy-Item $file.src $file.dst
        Write-Host "      ✅ $(Split-Path $file.dst -Leaf)" -ForegroundColor White
    }
    else {
        Write-Host "      ⚠️  Missing: $($file.src)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Create upload instructions
Write-Host "Creating upload instructions..." -ForegroundColor Green

$instructions = @"
# IRON BANK UPLOAD INSTRUCTIONS

## Directory Structure Created

``````
ironbank-upload/
├── pkg/
│   ├── sekhem/          (5 files)
│   ├── maat/            (4 files)
│   ├── ouroboros/       (3 files)
│   ├── seshat/          (1 file)
│   └── agi/             (1 file)
├── cmd/
│   └── agent/           (1 file)
├── docs/                (4 files)
├── hardening_manifest.yaml
├── PULL_REQUEST.md
├── EXECUTIVE_SUMMARY.md
├── README.ironbank.md
└── demo-all-modes.ps1
``````

## Upload to GitHub

### Option 1: GitHub Web UI

1. Go to: https://github.com/nouchix/adinkhepra-asaf-ironbank
2. Create branch: ``sekhem-triad-organized``
3. For each directory:
   - Navigate to the directory in GitHub
   - Click "Add file" → "Upload files"
   - Upload all files from the corresponding local directory
4. Create Pull Request

### Option 2: Git Command Line

``````bash
# Navigate to Iron Bank repo
cd path/to/adinkhepra-asaf-ironbank

# Create and checkout branch
git checkout -b sekhem-triad-organized

# Copy files from ironbank-upload
cp -r ../khepra-protocol/ironbank-upload/* .

# Stage and commit
git add -A
git commit -m "feat: Integrate Sekhem Triad (TRL10) - Organized Structure"

# Push
git push origin sekhem-triad-organized
``````

### Option 3: GitHub Desktop

1. Open GitHub Desktop
2. Add Iron Bank repository
3. Create new branch: ``sekhem-triad-organized``
4. Copy files from ``ironbank-upload/`` to Iron Bank repo
5. Commit changes
6. Push to origin

## Files Organized

**Core Framework** (14 files):
- pkg/sekhem: 5 files
- pkg/maat: 4 files
- pkg/ouroboros: 3 files
- pkg/seshat: 1 file
- pkg/agi: 1 file

**Integration** (2 files):
- cmd/agent/main.go
- hardening_manifest.yaml

**Documentation** (10+ files):
- docs/: 4 files
- Root: 6 files

**Total**: 26+ files ready for upload

## Next Steps

1. ✅ Files organized in ``ironbank-upload/``
2. ⏳ Upload to Iron Bank repository
3. ⏳ Create Pull Request
4. ⏳ Use PULL_REQUEST.md as description
5. ⏳ Review and merge

---

**All files are ready in the ``ironbank-upload/`` directory!**
"@

$instructions | Out-File -FilePath "$outputDir/UPLOAD_INSTRUCTIONS.md" -Encoding UTF8
Write-Host "      ✅ UPLOAD_INSTRUCTIONS.md" -ForegroundColor White
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ ORGANIZATION COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Files organized in: $outputDir/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Directory structure:" -ForegroundColor White
Write-Host "  pkg/sekhem/      - 5 files (Sekhem framework)" -ForegroundColor White
Write-Host "  pkg/maat/        - 4 files (Maat Guardian)" -ForegroundColor White
Write-Host "  pkg/ouroboros/   - 3 files (Ouroboros Cycle)" -ForegroundColor White
Write-Host "  pkg/seshat/      - 1 file  (Seshat Chronicle)" -ForegroundColor White
Write-Host "  pkg/agi/         - 1 file  (AGI Engine)" -ForegroundColor White
Write-Host "  cmd/agent/       - 1 file  (Agent integration)" -ForegroundColor White
Write-Host "  docs/            - 4 files (Documentation)" -ForegroundColor White
Write-Host "  Root files       - 6 files (Manifest, README, scripts)" -ForegroundColor White
Write-Host ""
Write-Host "Total: 25+ files ready for upload" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review files in $outputDir/" -ForegroundColor White
Write-Host "  2. Upload to Iron Bank repository" -ForegroundColor White
Write-Host "  3. See UPLOAD_INSTRUCTIONS.md for details" -ForegroundColor White
Write-Host ""
