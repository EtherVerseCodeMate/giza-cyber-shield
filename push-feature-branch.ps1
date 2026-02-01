# Push Sekhem Triad to Feature Branch
# Creates a feature branch and pushes there, then you can create a PR

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PUSH TO FEATURE BRANCH" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$branchName = "feature/sekhem-triad-trl10"

Write-Host "[1/5] Creating feature branch: $branchName..." -ForegroundColor Green
git checkout -b $branchName 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "      Branch already exists, switching to it..." -ForegroundColor Yellow
    git checkout $branchName
}
Write-Host "      ✅ On branch: $branchName" -ForegroundColor Green
Write-Host ""

Write-Host "[2/5] Ensuring all changes are committed..." -ForegroundColor Green
git status --short
Write-Host ""

Write-Host "[3/5] Fetching Iron Bank repository..." -ForegroundColor Green
git fetch ironbank
Write-Host "      ✅ Fetched" -ForegroundColor Green
Write-Host ""

Write-Host "[4/5] Reviewing commits to push..." -ForegroundColor Green
git log --oneline -10
Write-Host ""

Write-Host "[5/5] Pushing feature branch to Iron Bank..." -ForegroundColor Yellow
Write-Host ""
Write-Host "      This will push to: https://github.com/nouchix/adinkhepra-asaf-ironbank" -ForegroundColor White
Write-Host "      Branch: $branchName" -ForegroundColor White
Write-Host ""
$confirm = Read-Host "      Continue? (y/n)"

if ($confirm -eq 'y' -or $confirm -eq 'Y') {
    Write-Host ""
    Write-Host "      Pushing to Iron Bank..." -ForegroundColor Green
    git push ironbank "${branchName}:${branchName}" --force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  ✅ SUCCESSFULLY PUSHED FEATURE BRANCH" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  1. Create Pull Request:" -ForegroundColor White
        Write-Host "     https://github.com/nouchix/adinkhepra-asaf-ironbank/compare/main...$branchName" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  2. Use PULL_REQUEST.md as the PR description" -ForegroundColor White
        Write-Host ""
        Write-Host "  3. Title: 'feat: Integrate Sekhem Triad (TRL10) - Four Deployment Modes'" -ForegroundColor White
        Write-Host ""
        Write-Host "  4. Review and merge the PR" -ForegroundColor White
        Write-Host ""
        
        # Switch back to main
        Write-Host "Switching back to main branch..." -ForegroundColor Cyan
        git checkout main
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
        Write-Host ""
    }
}
else {
    Write-Host ""
    Write-Host "Push cancelled." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To push later:" -ForegroundColor Cyan
    Write-Host "  git push ironbank $branchName --force" -ForegroundColor White
    Write-Host ""
    
    # Switch back to main
    Write-Host "Switching back to main branch..." -ForegroundColor Cyan
    git checkout main
    Write-Host ""
}
