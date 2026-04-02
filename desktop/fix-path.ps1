Write-Host "=== Looking for wails.exe ==="
$locations = @(
    "$env:USERPROFILE\go\bin\wails.exe",
    "$env:GOPATH\bin\wails.exe",
    "C:\Users\Admin\go\bin\wails.exe",
    "C:\Go\bin\wails.exe"
)
foreach ($loc in $locations) {
    if (Test-Path $loc) {
        Write-Host "FOUND: $loc"
    }
}

Write-Host ""
Write-Host "=== Current User PATH ==="
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
Write-Host $userPath

Write-Host ""
Write-Host "=== GOPATH ==="
go env GOPATH

Write-Host ""
Write-Host "=== Searching for wails.exe ==="
Get-ChildItem -Path "C:\Users\Admin" -Filter "wails.exe" -Recurse -Depth 5 -ErrorAction SilentlyContinue | Select-Object FullName
