$gobin = "$env:USERPROFILE\go\bin"
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$gobin*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$gobin", "User")
    Write-Host "Added $gobin to User PATH (permanent)"
} else {
    Write-Host "$gobin already in PATH"
}
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
Write-Host ""
Write-Host "Installing Wails CLI..."
go install github.com/wailsapp/wails/v2/cmd/wails@latest
Write-Host ""
wails version
Write-Host ""
Write-Host "Done! You can now run: wails dev"
