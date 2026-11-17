# Stop the demo environment
$root = $PSScriptRoot
$mysqlAdmin = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqladmin.exe'

$javaProcs = Get-CimInstance Win32_Process -Filter "Name = 'java.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like '*memory-app-0.1.0.jar*' }

if ($javaProcs) {
    foreach ($p in $javaProcs) {
        Write-Host "Stopping backend process $($p.ProcessId)"
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host 'No Memory App java process found.'
}

if (Test-Path $mysqlAdmin) {
    Write-Host 'Stopping isolated MySQL on port 3307...'
    & $mysqlAdmin --host=127.0.0.1 --port=3307 --user=root shutdown 2>$null
}

Write-Host 'Stopped.' -ForegroundColor Green
