$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
Set-Location "D:\NEUROSTACK\PROJECTS\task-management\desktop"
Set-Location "frontend"; npx vite build 2>&1 | Select-Object -Last 3; Set-Location ".."
go build ./... 2>&1
if ($LASTEXITCODE -eq 0) { Write-Host "BUILD OK" } else { Write-Host "BUILD FAILED" }
