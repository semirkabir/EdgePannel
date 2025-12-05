# Setup Node.js to run without permission prompts
# This script configures PowerShell to run Node.js/npm without prompts

Write-Host "Configuring Node.js to run without permission prompts..." -ForegroundColor Green

# 1. Set execution policy to RemoteSigned (allows local scripts, requires signed remote scripts)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
Write-Host "[OK] Execution policy set to RemoteSigned" -ForegroundColor Green

# 2. Create PowerShell profile to auto-configure on startup
$profilePath = $PROFILE
$profileDir = Split-Path $profilePath -Parent

if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

# Node.js path
$nodePath = "C:\Users\skabir\Downloads\node-v24.11.1-win-x64\node-v24.11.1-win-x64"

# Profile content lines
$profileLines = @()
$profileLines += "# Auto-configure Node.js PATH"
$profileLines += "`$nodePath = '$nodePath'"
$profileLines += "if (Test-Path `"`$nodePath\node.exe`") {"
$profileLines += "    if (`$env:Path -notlike `"*`$nodePath*`") {"
$profileLines += "        `$env:Path += `";`$nodePath`""
$profileLines += "    }"
$profileLines += "}"
$profileLines += ""
$profileLines += "# Refresh PATH from environment variables"
$profileLines += "`$env:Path = [System.Environment]::GetEnvironmentVariable(`"Path`",`"Machine`") + `";`" + [System.Environment]::GetEnvironmentVariable(`"Path`",`"User`")"

$profileContent = $profileLines -join "`n"

if (Test-Path $profilePath) {
    $existing = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
    if ($existing -and $existing -notlike '*nodePath*') {
        Add-Content -Path $profilePath -Value "`n$profileContent"
        Write-Host "[OK] Added Node.js configuration to existing profile" -ForegroundColor Green
    } else {
        Write-Host "[OK] Profile already configured" -ForegroundColor Yellow
    }
} else {
    Set-Content -Path $profilePath -Value $profileContent
    Write-Host "[OK] Created PowerShell profile with Node.js configuration" -ForegroundColor Green
}

# 3. Refresh PATH in current session
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
if ($env:Path -notlike "*$nodePath*") {
    $env:Path += ";$nodePath"
}

Write-Host ""
Write-Host "[OK] Configuration complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Testing npm..." -ForegroundColor Yellow
npm --version

Write-Host ""
Write-Host "Note: Close and reopen your terminal for all changes to take effect." -ForegroundColor Cyan
Write-Host "Or run: . `$PROFILE to reload the profile in current session." -ForegroundColor Cyan
