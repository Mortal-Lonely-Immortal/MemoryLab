# Start demo: isolated MySQL on 3307 + Spring Boot on 8080
param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$mysqlHome = 'C:\Program Files\MySQL\MySQL Server 8.0\bin'
$mysqld = Join-Path $mysqlHome 'mysqld.exe'
$mysql = Join-Path $mysqlHome 'mysql.exe'
$dataDir = Join-Path $root '.mysql\data'
$jar = Join-Path $root 'backend\target\memory-app-0.1.0.jar'
$runDir = Join-Path $root '.run'

New-Item -ItemType Directory -Force -Path $runDir | Out-Null

function Test-Port([int]$port) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $client.Connect('127.0.0.1', $port)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

if (-not (Test-Path $mysqld)) {
    throw "MySQL not found: $mysqld"
}

if (-not (Test-Path $jar)) {
    Write-Host 'Building backend jar...'
    Push-Location (Join-Path $root 'backend')
    try { mvn -DskipTests package } finally { Pop-Location }
}

if (-not (Test-Port 3307)) {
    if (-not (Test-Path (Join-Path $dataDir 'mysql'))) {
        Write-Host 'Initializing isolated MySQL data directory (first run)...'
        New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
        & $mysqld --initialize-insecure "--datadir=$dataDir" '--basedir=C:\Program Files\MySQL\MySQL Server 8.0'
    }
    Write-Host 'Starting isolated MySQL on port 3307...'
    $mysqlArgs = @("--datadir=$dataDir", '--port=3307', '--mysqlx=0', '--bind-address=127.0.0.1')
    Start-Process -FilePath $mysqld -ArgumentList $mysqlArgs -WindowStyle Hidden | Out-Null

    $ready = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Port 3307) { $ready = $true; break }
    }
    if (-not $ready) {
        throw "MySQL did not start in 40s. See $dataDir\*.err"
    }
}

& $mysql --host=127.0.0.1 --port=3307 --user=root -e "CREATE DATABASE IF NOT EXISTS memory_app DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;" 2>$null

if (-not (Test-Port 8080)) {
    Write-Host 'Starting backend on port 8080...'
    $dsUrl = 'jdbc:mysql://127.0.0.1:3307/memory_app?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false'
    $appArgs = @('-jar', $jar, "--spring.datasource.url=$dsUrl", '--spring.datasource.username=root', '--spring.datasource.password=', "--logging.file.name=$runDir\backend.log")
    Start-Process -FilePath 'java' -ArgumentList $appArgs -WorkingDirectory (Join-Path $root 'backend') -WindowStyle Hidden | Out-Null

    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 1
        try {
            $resp = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8080/api/v1/settings' -TimeoutSec 2
            if ($resp.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
    }
    if (-not $ready) {
        throw "Backend did not start in 60s. See $runDir\backend.err.log"
    }
}

Write-Host ''
Write-Host 'Memory App is running: http://127.0.0.1:8080' -ForegroundColor Green
Write-Host 'Stop with: .\stop-demo.ps1'
if (-not $NoBrowser) {
    Start-Process 'http://127.0.0.1:8080'
}
