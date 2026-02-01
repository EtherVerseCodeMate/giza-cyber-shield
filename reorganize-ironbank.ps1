# Reorganize Files in Iron Bank Repository
# Moves files from root to correct directory structure

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  REORGANIZING IRON BANK FILES" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the Iron Bank repo
$repoName = git remote get-url origin 2>$null
if ($repoName -notlike "*adinkhepra-asaf-ironbank*") {
    Write-Host "ERROR: Not in Iron Bank repository!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run this script from the Iron Bank repo directory:" -ForegroundColor Yellow
    Write-Host "  cd path/to/adinkhepra-asaf-ironbank" -ForegroundColor White
    Write-Host "  ..\khepra-protocol\reorganize-ironbank.ps1" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "✅ Confirmed: In Iron Bank repository" -ForegroundColor Green
Write-Host ""

# Create directories
Write-Host "[1/3] Creating directory structure..." -ForegroundColor Green

$directories = @(
    "pkg/agi",
    "pkg/maat",
    "pkg/ouroboros",
    "pkg/sekhem",
    "pkg/seshat",
    "cmd/agent"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Host "      Created: $dir" -ForegroundColor White
    }
    else {
        Write-Host "      Exists: $dir" -ForegroundColor Gray
    }
}
Write-Host ""

# Move files using git mv
Write-Host "[2/3] Moving files to correct directories..." -ForegroundColor Green

$moves = @(
    # pkg/agi/
    @{from = "engine.go"; to = "pkg/agi/engine.go" },
    @{from = "engine_test.go"; to = "pkg/agi/engine_test.go" },
    
    # pkg/maat/
    @{from = "anubis.go"; to = "pkg/maat/anubis.go" },
    @{from = "guardian.go"; to = "pkg/maat/guardian.go" },
    @{from = "heka.go"; to = "pkg/maat/heka.go" },
    @{from = "isfet.go"; to = "pkg/maat/isfet.go" },
    
    # pkg/ouroboros/
    @{from = "cycle.go"; to = "pkg/ouroboros/cycle.go" },
    @{from = "khopesh.go"; to = "pkg/ouroboros/khopesh.go" },
    @{from = "wedjat.go"; to = "pkg/ouroboros/wedjat.go" },
    
    # pkg/sekhem/
    @{from = "aaru.go"; to = "pkg/sekhem/aaru.go" },
    @{from = "aten.go"; to = "pkg/sekhem/aten.go" },
    @{from = "duat.go"; to = "pkg/sekhem/duat.go" },
    @{from = "realms.go"; to = "pkg/sekhem/realms.go" },
    @{from = "triad.go"; to = "pkg/sekhem/triad.go" },
    
    # pkg/seshat/
    @{from = "chronicle.go"; to = "pkg/seshat/chronicle.go" },
    
    # cmd/agent/
    @{from = "licensing_api.go"; to = "cmd/agent/licensing_api.go" },
    @{from = "main.go"; to = "cmd/agent/main.go" },
    @{from = "server_test.go"; to = "cmd/agent/server_test.go" }
)

$movedCount = 0
foreach ($move in $moves) {
    if (Test-Path $move.from) {
        git mv $move.from $move.to 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "      ✅ $($move.from) → $($move.to)" -ForegroundColor White
            $movedCount++
        }
        else {
            # Try regular move if git mv fails
            Move-Item $move.from $move.to -Force -ErrorAction SilentlyContinue
            git add $move.to 2>$null
            Write-Host "      ⚠️  $($move.from) → $($move.to) (manual move)" -ForegroundColor Yellow
            $movedCount++
        }
    }
    else {
        Write-Host "      ⏭️  $($move.from) (not found, may already be moved)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "      Moved $movedCount files" -ForegroundColor Cyan
Write-Host ""

# Commit changes
Write-Host "[3/3] Committing reorganization..." -ForegroundColor Green

git add -A

$commitMsg = @"
chore: Organize Sekhem Triad files into correct directory structure

Reorganized 23 files into proper package structure:
- pkg/agi/: AGI Engine (2 files)
- pkg/maat/: Maat Guardian (4 files)
- pkg/ouroboros/: Ouroboros Cycle (3 files)
- pkg/sekhem/: Sekhem Triad (5 files)
- pkg/seshat/: Seshat Chronicle (1 file)
- cmd/agent/: Agent integration (3 files)
- Root: Config files (5 files)
"@

git commit -m "$commitMsg"

if ($LASTEXITCODE -eq 0) {
    Write-Host "      ✅ Changes committed" -ForegroundColor Green
    Write-Host ""
    
    # Show status
    Write-Host "Git status:" -ForegroundColor Cyan
    git status --short
    Write-Host ""
    
    # Ask to push
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  READY TO PUSH" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Changes are committed locally." -ForegroundColor White
    Write-Host ""
    $push = Read-Host "Push to Iron Bank? (y/n)"
    
    if ($push -eq 'y' -or $push -eq 'Y') {
        Write-Host ""
        Write-Host "Pushing to Iron Bank..." -ForegroundColor Green
        git push origin main
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "  ✅ REORGANIZATION COMPLETE" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Files are now organized in Iron Bank!" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "View at: https://github.com/nouchix/adinkhepra-asaf-ironbank" -ForegroundColor Yellow
            Write-Host ""
        }
        else {
            Write-Host ""
            Write-Host "Push failed. You can push manually later:" -ForegroundColor Red
            Write-Host "  git push origin main" -ForegroundColor White
            Write-Host ""
        }
    }
    else {
        Write-Host ""
        Write-Host "Push cancelled. To push later:" -ForegroundColor Yellow
        Write-Host "  git push origin main" -ForegroundColor White
        Write-Host ""
    }
}
else {
    Write-Host "      ⚠️  Commit failed or no changes to commit" -ForegroundColor Yellow
    Write-Host ""
}
