Write-Host "Checking for changes..."
git status

$confirmation = Read-Host "Do you want to stage all changes and push to Sync with Dokploy? (y/n)"
if ($confirmation -ne 'y') {
    Write-Host "Aborted."
    exit
}

$message = Read-Host "Enter commit message (Press Enter for default)"
if ([string]::IsNullOrWhiteSpace($message)) {
    $message = "Update " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
}

Write-Host "Staging changes..."
git add .

Write-Host "Committing..."
git commit -m "$message"

Write-Host "Pushing to origin..."
git push

Write-Host "Done! Your code has been pushed. Dokploy should detect the change and build safely."
