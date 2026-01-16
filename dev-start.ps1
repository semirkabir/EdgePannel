# Quick start local development environment
# Run this script: .\dev-start.ps1

Write-Host "🚀 Starting EdgePannel Local Development Environment..." -ForegroundColor Cyan

# Check if Docker is running
Write-Host "`n📦 Checking Docker..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Start PostgreSQL database
Write-Host "`n🗄️  Starting PostgreSQL database..." -ForegroundColor Yellow
docker-compose up -d
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database started successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to start database" -ForegroundColor Red
    exit 1
}

# Wait for database to be ready
Write-Host "`n⏳ Waiting for database to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "Please create a .env file with your environment variables." -ForegroundColor Yellow
    exit 1
}

# Run database migrations
Write-Host "`n🔄 Running database migrations..." -ForegroundColor Yellow
npx prisma migrate dev
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migrations completed successfully" -ForegroundColor Green
} else {
    Write-Host "⚠️  Migration warnings (this is usually okay)" -ForegroundColor Yellow
}

# Generate Prisma Client
Write-Host "`n🔨 Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Prisma Client generated" -ForegroundColor Green
}

# Show current branch
Write-Host "`n📌 Current Git Branch:" -ForegroundColor Yellow
git branch --show-current
Write-Host ""

# Display status
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✨ Local Development Environment Ready!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 Database: localhost:5432" -ForegroundColor White
Write-Host "🌐 Starting dev server..." -ForegroundColor White
Write-Host ""
Write-Host "➡️  Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

# Start the development server
npm run dev
