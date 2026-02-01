# Push Only Sekhem Changes (Shallow Push)
# Creates a new orphan branch with only Sekhem files to avoid pushing entire history

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LIGHTWEIGHT SEKHEM PUSH" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Issue: Repository too large (1.84 GB) - GitHub timeout" -ForegroundColor Yellow
Write-Host "Solution: Create lightweight branch with only Sekhem files" -ForegroundColor Green
Write-Host ""

$branchName = "sekhem-triad-lightweight"

Write-Host "[1/7] Fetching Iron Bank main..." -ForegroundColor Green
git fetch ironbank main
Write-Host "      ✅ Fetched" -ForegroundColor Green
Write-Host ""

Write-Host "[2/7] Creating new branch from Iron Bank main..." -ForegroundColor Green
git checkout -b $branchName ironbank/main --no-track
Write-Host "      ✅ Branch created from Iron Bank" -ForegroundColor Green
Write-Host ""

Write-Host "[3/7] Copying Sekhem files from main..." -ForegroundColor Green
git checkout main -- pkg/sekhem/aaru.go 2>$null
git checkout main -- pkg/sekhem/aten.go 2>$null
git checkout main -- pkg/sekhem/triad.go 2>$null
git checkout main -- cmd/agent/main.go 2>$null
git checkout main -- hardening_manifest.yaml 2>$null
git checkout main -- PULL_REQUEST.md 2>$null
git checkout main -- EXECUTIVE_SUMMARY.md 2>$null
git checkout main -- READY_TO_MERGE.md 2>$null
git checkout main -- MERGE_CHECKLIST.md 2>$null
git checkout main -- docs/IMPLEMENTATION_COMPLETE.md 2>$null
git checkout main -- docs/MERGE_STATUS.md 2>$null
git checkout main -- docs/IRONBANK_SEKHEM_MERGE.md 2>$null
git checkout main -- demo-all-modes.ps1 2>$null
git checkout main -- install-sekhem.ps1 2>$null
Write-Host "      ✅ Sekhem files copied" -ForegroundColor Green
Write-Host ""

Write-Host "[4/7] Staging Sekhem changes..." -ForegroundColor Green
git add -A
Write-Host "      ✅ Changes staged" -ForegroundColor Green
Write-Host ""

Write-Host "[5/7] Committing Sekhem Triad..." -ForegroundColor Green
$commitMessage = @"
feat: Integrate Sekhem Triad (TRL10) - Four Deployment Modes

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
- pkg/sekhem/aten.go - Aten Realm
- docs/IMPLEMENTATION_COMPLETE.md
- EXECUTIVE_SUMMARY.md

## Files Modified
- pkg/sekhem/triad.go - Mode selection
- cmd/agent/main.go - Mode support
- hardening_manifest.yaml - v1.2.0
"@

git commit -m "$commitMessage"
Write-Host "      ✅ Committed" -ForegroundColor Green
Write-Host ""

Write-Host "[6/7] Reviewing changes..." -ForegroundColor Green
git log --oneline -1
git diff --stat ironbank/main
Write-Host ""

Write-Host "[7/7] Pushing lightweight branch..." -ForegroundColor Yellow
Write-Host ""
Write-Host "      This is a LIGHTWEIGHT push (only Sekhem files, not full history)" -ForegroundColor White
Write-Host "      Branch: $branchName" -ForegroundColor White
Write-Host ""
$confirm = Read-Host "      Push now? (y/n)"

if ($confirm -eq 'y' -or $confirm -eq 'Y') {
    Write-Host ""
    Write-Host "      Pushing..." -ForegroundColor Green
    
    # Increase git buffer size for large pushes
    git config http.postBuffer 524288000
    
    git push ironbank "${branchName}:${branchName}" --force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  ✅ SUCCESSFULLY PUSHED!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Create Pull Request:" -ForegroundColor Cyan
        Write-Host "https://github.com/nouchix/adinkhepra-asaf-ironbank/compare/main...$branchName" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Use PULL_REQUEST.md as the description" -ForegroundColor White
        Write-Host ""
    }
    else {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "  ❌ PUSH STILL FAILED" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "Alternative: Create PR manually by uploading files to GitHub" -ForegroundColor Yellow
        Write-Host ""
    }
    
    # Switch back to main
    Write-Host "Switching back to main..." -ForegroundColor Cyan
    git checkout main
    Write-Host ""
}
else {
    Write-Host ""
    Write-Host "Push cancelled." -ForegroundColor Yellow
    Write-Host ""
    # Switch back to main
    git checkout main
    Write-Host ""
}
