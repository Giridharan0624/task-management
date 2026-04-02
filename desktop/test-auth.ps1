# Test 1: Resolve Employee ID
Write-Host "=== Test: Resolve Employee ID ==="
try {
    $response = Invoke-RestMethod -Uri "https://3syc4x99a7.execute-api.ap-south-1.amazonaws.com/prod/resolve-employee?employeeId=NS-26FA95" -Method Get
    Write-Host "Resolved email: $($response.email)"
} catch {
    Write-Host "Failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host "Body: $($reader.ReadToEnd())"
    }
}
