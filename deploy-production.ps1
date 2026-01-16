# Deploy to production
# Run this script: .\deploy-production.ps1

Write-Host "🚀 Deploying to Production..." -ForegroundColor Cyan
Write-Host ""

# Get current branch
$currentBranch = git branch --show-current

Write-Host "ℹ️  Current branch: $currentBranch" -ForegroundColor Yellow
Write-Host ""

# Confirm deployment
Write-Host "⚠️  This will deploy your changes to PRODUCTION (edgepannel.com)" -ForegroundColor Yellow
$confirmation = Read-Host "Are you sure you want to continue? (yes/no)"

if ($confirmation -ne "yes") {
    Write-Host "❌ Deployment cancelled" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "📋 Deployment Steps:" -ForegroundColor Cyan
Write-Host "  1. Switching to production branch" -ForegroundColor Gray
Write-Host "  2. Merging main into production" -ForegroundColor Gray
Write-Host "  3. Pushing to origin" -ForegroundColor Gray
Write-Host "  4. Returning to main branch" -ForegroundColor Gray
Write-Host ""

# Switch to production branch
Write-Host "→ Step 1: Switching to production branch..." -ForegroundColor Yellow
git checkout production
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to switch to production branch" -ForegroundColor Red
    Write-Host "Creating production branch..." -ForegroundColor Yellow
    git checkout -b production
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create production branch" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ Switched to production" -ForegroundColor Green

# Pull latest production changes
Write-Host "→ Pulling latest production changes..." -ForegroundColor Yellow
git pull origin production --no-edit
Write-Host "✅ Production branch updated" -ForegroundColor Green

# Merge main into production
Write-Host "→ Step 2: Merging main into production..." -ForegroundColor Yellow
git merge main -m "Deploy: Merge main into production"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Merge failed! Please resolve conflicts manually." -ForegroundColor Red
    git checkout $currentBranch
    exit 1
}
Write-Host "✅ Merged successfully" -ForegroundColor Green

# Push to origin
Write-Host "→ Step 3: Pushing to origin..." -ForegroundColor Yellow
git push origin production
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Push failed!" -ForegroundColor Red
    git checkout $currentBranch
    exit 1
}
Write-Host "✅ Pushed to production" -ForegroundColor Green

# Return to original branch
Write-Host "→ Step 4: Returning to $currentBranch..." -ForegroundColor Yellow
git checkout $currentBranch
Write-Host "✅ Back on $currentBranch" -ForegroundColor Green

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✨ Deployment Successful!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Dokploy is now deploying your changes to production" -ForegroundColor White
Write-Host "📍 Monitor deployment: https://your-dokploy-url.com" -ForegroundColor Gray
Write-Host "🔗 Production: https://edgepannel.com" -ForegroundColor Gray
Write-Host ""
Write-Host "⏱️  Deployment typically takes 2-5 minutes" -ForegroundColor Yellow
Write-Host ""
