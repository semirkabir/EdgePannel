# Fix .env security issue
# Run this script: .\fix-env-security.ps1

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
Write-Host "🚨 SECURITY FIX: Removing .env from Git" -ForegroundColor Red
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
Write-Host ""

# Confirm with user
Write-Host "⚠️  This will:" -ForegroundColor Yellow
Write-Host "   1. Remove .env from git tracking (keeps your local file)" -ForegroundColor Gray
Write-Host "   2. Commit the .gitignore update" -ForegroundColor Gray
Write-Host "   3. Push changes to GitHub" -ForegroundColor Gray
Write-Host ""
Write-Host "Your local .env file will NOT be deleted!" -ForegroundColor Green
Write-Host ""

$confirmation = Read-Host "Continue? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Host "❌ Cancelled" -ForegroundColor Red
    exit 0
}

Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "ℹ️  No .env file found in current directory" -ForegroundColor Yellow
    exit 0
}

# Remove from git tracking (but keep local file)
Write-Host "→ Step 1: Removing .env from git tracking..." -ForegroundColor Yellow
git rm --cached .env 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ .env removed from git tracking" -ForegroundColor Green
}
else {
    Write-Host "⚠️  .env may not have been tracked" -ForegroundColor Yellow
}

# Verify .env still exists locally
if (Test-Path ".env") {
    Write-Host "✅ Your local .env file is safe" -ForegroundColor Green
}
else {
    Write-Host "❌ ERROR: .env file was deleted!" -ForegroundColor Red
    exit 1
}

# Stage .gitignore
Write-Host ""
Write-Host "→ Step 2: Staging .gitignore changes..." -ForegroundColor Yellow
git add .gitignore
Write-Host "✅ .gitignore staged" -ForegroundColor Green

# Commit
Write-Host ""
Write-Host "→ Step 3: Committing changes..." -ForegroundColor Yellow
git commit -m "Security fix: Remove .env from git tracking and update .gitignore"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Changes committed" -ForegroundColor Green
}
else {
    Write-Host "⚠️  Commit may have failed or nothing to commit" -ForegroundColor Yellow
}

# Push to main
Write-Host ""
Write-Host "→ Step 4: Pushing to GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Pushed to GitHub" -ForegroundColor Green
}
else {
    Write-Host "❌ Push failed" -ForegroundColor Red
    Write-Host "You may need to push manually: git push origin main" -ForegroundColor Yellow
}

# Check if .env was in git history
Write-Host ""
Write-Host "→ Checking git history for .env..." -ForegroundColor Yellow
$history = git log --all --oneline -- .env 2>$null
if ($history) {
    Write-Host "⚠️  WARNING: .env found in git history!" -ForegroundColor Red
    Write-Host ""
    Write-Host "This means your secrets may have been exposed on GitHub!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Git commits containing .env:" -ForegroundColor Yellow
    $history | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
}
else {
    Write-Host "✅ .env not found in git history - you're safe!" -ForegroundColor Green
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Security Fix Complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

if ($history) {
    Write-Host "🔴 CRITICAL NEXT STEPS:" -ForegroundColor Red
    Write-Host ""
    Write-Host "Your .env WAS in git history. You MUST:" -ForegroundColor Yellow
    Write-Host "  1. Rotate ALL API keys and secrets immediately" -ForegroundColor Red
    Write-Host "  2. Change database passwords" -ForegroundColor Red
    Write-Host "  3. Generate new OAuth credentials" -ForegroundColor Red
    Write-Host "  4. Update Dokploy environment variables" -ForegroundColor Red
    Write-Host ""
    Write-Host "See ENV_SECURITY_FIX.md for detailed instructions" -ForegroundColor Yellow
}
else {
    Write-Host "ℹ️  Your secrets were never committed to git - you're safe!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Going forward:" -ForegroundColor Cyan
    Write-Host "  • .env is now ignored by git" -ForegroundColor White
    Write-Host "  • Changes to .env won't appear in git status" -ForegroundColor White
    Write-Host "  • Your secrets stay on your local machine only" -ForegroundColor White
}

Write-Host ""
Write-Host "Test it:" -ForegroundColor Yellow
Write-Host "  1. Make a change to .env" -ForegroundColor Gray
Write-Host "  2. Run: git status" -ForegroundColor Gray
Write-Host "  3. .env should NOT appear in the output" -ForegroundColor Gray
Write-Host ""
