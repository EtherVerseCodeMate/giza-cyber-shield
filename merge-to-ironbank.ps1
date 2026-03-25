# Merge to Iron Bank Repository
# This script pushes the Sekhem Triad implementation to the Iron Bank repo

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MERGING TO IRON BANK REPOSITORY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Add Iron Bank remote if not exists
Write-Host "[1/6] Adding Iron Bank remote..." -ForegroundColor Green
git remote add ironbank https://github.com/nouchix/adinkhepra-asaf-ironbank.git 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "      Remote 'ironbank' already exists" -ForegroundColor Yellow
    git remote set-url ironbank https://github.com/nouchix/adinkhepra-asaf-ironbank.git
}
Write-Host "      ✅ Iron Bank remote configured" -ForegroundColor Green
Write-Host ""

# Step 2: Fetch Iron Bank repository
Write-Host "[2/6] Fetching Iron Bank repository..." -ForegroundColor Green
git fetch ironbank
Write-Host "      ✅ Fetched Iron Bank repository" -ForegroundColor Green
Write-Host ""

# Step 3: Stage all changes
Write-Host "[3/6] Staging changes..." -ForegroundColor Green
git add -A
Write-Host "      ✅ All changes staged" -ForegroundColor Green
Write-Host ""

# Step 4: Commit changes
Write-Host "[4/6] Committing changes..." -ForegroundColor Green
$commitMessage = @"
feat: Integrate Sekhem Triad (TRL10) - Four Deployment Modes

BREAKING CHANGE: Adds Sekhem Triad autonomous framework with four deployment modes

## Summary
- Implemented all three realms (Duat, Aaru, Aten)
- Added four deployment modes (Edge, Hybrid, Sovereign, Iron Bank)
- Updated hardening manifest to v1.2.0
- Single binary supports all modes via KHEPRA_MODE env var

## New Features
- Duat Realm: Foundational defense (10s cycle, 4 eyes, 5 blades)
- Aaru Realm: Network coordination (60s cycle, edge node management)
- Aten Realm: Strategic orchestration (5min cycle, compliance frameworks)
- Mode selection: Edge/Hybrid/Sovereign/Iron Bank

## Compliance
- RHEL-09-STIG-V1R3
- NIST 800-53 Rev 5
- CMMC Level 3
- Air-gapped support (Sovereign mode)

## Files Added
- pkg/sekhem/aaru.go - Aaru Realm
- pkg/sekhem/anouchix.comten.go - Aten Realm
- docs/IMPLEMENTATION_COMPLETE.md
- docs/MERGE_STATUS.md
- PULL_REQUEST.md

## Files Modified
- pkg/sekhem/triad.go - Mode selection
- cmd/agent/main.go - Mode support
- hardening_manifest.yaml - v1.2.0 with Sekhem

Closes #1 - Sekhem Triad Integration
"@

git commit -m "$commitMessage"
Write-Host "      ✅ Changes committed" -ForegroundColor Green
Write-Host ""

# Step 5: Show what will be pushed
Write-Host "[5/6] Changes to be pushed:" -ForegroundColor Green
git log --oneline -5
Write-Host ""

# Step 6: Push to Iron Bank
Write-Host "[6/6] Pushing to Iron Bank repository..." -ForegroundColor Yellow
Write-Host ""
Write-Host "      This will push to: https://github.com/nouchix/adinkhepra-asaf-ironbank" -ForegroundColor White
Write-Host ""
$confirm = Read-Host "      Continue? (y/n)"

if ($confirm -eq 'y' -or $confirm -eq 'Y') {
    Write-Host ""
    Write-Host "      Pushing to Iron Bank main branch..." -ForegroundColor Green
    git push ironbank main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  ✅ SUCCESSFULLY PUSHED TO IRON BANK" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Create Pull Request at:" -ForegroundColor White
        Write-Host "     https://github.com/nouchix/adinkhepra-asaf-ironbank/pulls" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  2. Use PULL_REQUEST.md as the PR description" -ForegroundColor White
        Write-Host ""
        Write-Host "  3. Review and merge the PR" -ForegroundColor White
        Write-Host ""
    }
    else {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "  ❌ PUSH FAILED" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "You may need to:" -ForegroundColor Yellow
        Write-Host "  1. Authenticate with GitHub" -ForegroundColor White
        Write-Host "  2. Check repository permissions" -ForegroundColor White
        Write-Host "  3. Resolve any conflicts" -ForegroundColor White
        Write-Host ""
    }
}
else {
    Write-Host ""
    Write-Host "Push cancelled. Changes are committed locally." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To push manually later:" -ForegroundColor Cyan
    Write-Host "  git push ironbank main" -ForegroundColor White
    Write-Host ""
}
