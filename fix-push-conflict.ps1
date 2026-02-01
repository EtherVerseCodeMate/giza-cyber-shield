# Fix Non-Fast-Forward Push Issue
# Pulls Iron Bank changes and rebases our commits on top

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESOLVING PUSH CONFLICT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] Fetching latest Iron Bank changes..." -ForegroundColor Green
git fetch ironbank
Write-Host "      ✅ Fetched" -ForegroundColor Green
Write-Host ""

Write-Host "[2/4] Rebasing our commits on top of Iron Bank..." -ForegroundColor Green
Write-Host "      This will replay our Sekhem commits on top of Iron Bank's latest" -ForegroundColor Yellow
Write-Host ""

git rebase ironbank/main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "      ✅ Rebase successful" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "[3/4] Reviewing changes to push..." -ForegroundColor Green
    git log --oneline ironbank/main..HEAD
    Write-Host ""
    
    Write-Host "[4/4] Pushing to Iron Bank..." -ForegroundColor Yellow
    Write-Host ""
    $confirm = Read-Host "      Push now? (y/n)"
    
    if ($confirm -eq 'y' -or $confirm -eq 'Y') {
        git push ironbank main
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "  ✅ SUCCESSFULLY PUSHED TO IRON BANK" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Next: Create Pull Request at:" -ForegroundColor Cyan
            Write-Host "https://github.com/nouchix/adinkhepra-asaf-ironbank/pulls" -ForegroundColor Yellow
            Write-Host ""
        }
        else {
            Write-Host ""
            Write-Host "Push failed. You may need to force push:" -ForegroundColor Red
            Write-Host "  git push ironbank main --force" -ForegroundColor Yellow
            Write-Host ""
        }
    }
    else {
        Write-Host ""
        Write-Host "Push cancelled. To push later:" -ForegroundColor Yellow
        Write-Host "  git push ironbank main" -ForegroundColor White
        Write-Host ""
    }
}
else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ⚠️ REBASE CONFLICTS" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "There are conflicts to resolve." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To resolve:" -ForegroundColor Cyan
    Write-Host "  1. Fix conflicts in the files listed above" -ForegroundColor White
    Write-Host "  2. git add <resolved-files>" -ForegroundColor White
    Write-Host "  3. git rebase --continue" -ForegroundColor White
    Write-Host ""
    Write-Host "Or to abort:" -ForegroundColor Cyan
    Write-Host "  git rebase --abort" -ForegroundColor White
    Write-Host ""
}
