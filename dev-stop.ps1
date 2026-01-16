# Stop local development environment
# Run this script: .\dev-stop.ps1

Write-Host "🛑 Stopping EdgePannel Local Development Environment..." -ForegroundColor Cyan
Write-Host ""

# Stop Docker containers
Write-Host "📦 Stopping Docker containers..." -ForegroundColor Yellow
docker-compose down

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ All containers stopped" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some containers may still be running" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Development environment stopped" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "ℹ️  To completely remove database data, run:" -ForegroundColor Gray
Write-Host "   docker-compose down -v" -ForegroundColor Gray
Write-Host ""
