# Refresh PATH in current PowerShell session
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Write-Host "PATH refreshed! Testing npm..." -ForegroundColor Green
npm --version



