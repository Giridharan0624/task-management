$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
Set-Location "D:\NEUROSTACK\PROJECTS\task-management\desktop"
go mod tidy 2>&1
wails build 2>&1
if ($LASTEXITCODE -eq 0) {
    $exe = Get-Item "build\bin\taskflow-desktop.exe" -ErrorAction SilentlyContinue
    Write-Host "BUILD SUCCESS - $([math]::Round($exe.Length / 1MB, 2)) MB"
} else {
    Write-Host "BUILD FAILED"
}
