# Install Node.js for Current User Only
# This script installs Node.js to the user's AppData directory and adds it to the user PATH

Write-Host "Installing Node.js LTS for current user..." -ForegroundColor Green

# Install using winget with user scope
winget install OpenJS.NodeJS.LTS --scope user --accept-package-agreements --accept-source-agreements

Write-Host "`nWaiting for installation to complete..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Find Node.js installation path
$nodePath = "$env:LOCALAPPDATA\Programs\nodejs"
if (-not (Test-Path "$nodePath\node.exe")) {
    # Try alternative location
    $nodePath = "$env:USERPROFILE\AppData\Local\Programs\nodejs"
}

if (Test-Path "$nodePath\node.exe") {
    Write-Host "Node.js found at: $nodePath" -ForegroundColor Green
    
    # Add to user PATH if not already there
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -notlike "*$nodePath*") {
        Write-Host "Adding Node.js to user PATH..." -ForegroundColor Yellow
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$nodePath", "User")
        Write-Host "PATH updated successfully!" -ForegroundColor Green
    } else {
        Write-Host "Node.js is already in PATH" -ForegroundColor Green
    }
    
    Write-Host "`nInstallation complete!" -ForegroundColor Green
    Write-Host "Please close and reopen your terminal, then run:" -ForegroundColor Yellow
    Write-Host "  node --version" -ForegroundColor Cyan
    Write-Host "  npm --version" -ForegroundColor Cyan
} else {
    Write-Host "Node.js installation not found. Please restart your terminal and try again." -ForegroundColor Red
}




