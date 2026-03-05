param(
    [string]$Message = "Auto: commit changes"
)

Write-Output "Staging all changes..."
git add -A

Write-Output "Committing with message: $Message"
try {
    git commit -m $Message
} catch {
    Write-Output "No changes to commit or commit failed: $_"
}

Write-Output "Pushing to origin/main..."
git push origin main

Write-Output "Push complete."
