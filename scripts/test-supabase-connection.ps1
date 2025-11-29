# PowerShell script to test Supabase connection
Write-Host "`n🔍 Testing Supabase Connection...`n" -ForegroundColor Cyan

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    exit 1
}

# Read DATABASE_URL from .env
$envContent = Get-Content ".env" -Raw
$dbUrlMatch = [regex]::Match($envContent, 'DATABASE_URL=(.+)')

if (-not $dbUrlMatch.Success) {
    Write-Host "❌ DATABASE_URL not found in .env file!" -ForegroundColor Red
    exit 1
}

$dbUrl = $dbUrlMatch.Groups[1].Value.Trim()

Write-Host "📋 Connection String Format:" -ForegroundColor Yellow
$dbUrlHidden = $dbUrl -replace ':[^:@]+@', ':****@'
Write-Host $dbUrlHidden -ForegroundColor Gray
Write-Host ""

# Check for common issues
$issues = @()

if ($dbUrl -match '\[YOUR-PASSWORD\]') {
    $issues += "❌ Password placeholder [YOUR-PASSWORD] not replaced"
}

if ($dbUrl -notmatch ':5432') {
    $issues += "⚠️  Not using port 5432 (direct connection)"
}

if ($dbUrl -match 'pooler') {
    $issues += "❌ Using pooler connection (should use direct connection)"
}

if ($dbUrl -notmatch 'db\.') {
    $issues += "⚠️  Connection string format might be incorrect"
}

# Check if Supabase project reference is present
if ($dbUrl -match 'onwkzqbrmrskazfitshr') {
    Write-Host "✅ Supabase project reference found: onwkzqbrmrskazfitshr" -ForegroundColor Green
} else {
    $issues += "⚠️  Supabase project reference might be incorrect"
}

if ($issues.Count -eq 0) {
    Write-Host "✅ Connection string format looks correct!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔧 Next steps:" -ForegroundColor Cyan
    Write-Host "1. Verify your Supabase project is active" -ForegroundColor Yellow
    Write-Host "2. Check if password has special characters (may need URL encoding)" -ForegroundColor Yellow
    Write-Host "3. Try resetting your database password in Supabase" -ForegroundColor Yellow
    Write-Host "4. Check Supabase status: https://status.supabase.com" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  Issues found:" -ForegroundColor Yellow
    foreach ($issue in $issues) {
        Write-Host "   $issue" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Run this to fix:" -ForegroundColor Cyan
    Write-Host "   node scripts/fix-database-url.js" -ForegroundColor Green
}

Write-Host ""

