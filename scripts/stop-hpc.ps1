# Health & Pain Care Center (HPC) - Server Shutdown
$ErrorActionPreference = "SilentlyContinue"

$port = 3000
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$projectRoot\package.json")) {
    $projectRoot = $PSScriptRoot
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Health & Pain Care Center - System Shutdown" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$killedCount = 0

# 1. Terminate process recorded in .hpc.pid file
$pidFile = "$projectRoot\.hpc.pid"
if (Test-Path $pidFile) {
    try {
        $recPid = [int](Get-Content $pidFile -Raw).Trim()
        if ($recPid -gt 0) {
            $proc = Get-Process -Id $recPid -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "[ACTION] Terminating recorded HPC process (PID: $recPid)..." -ForegroundColor Yellow
                Stop-Process -Id $recPid -Force -Recurse -ErrorAction SilentlyContinue
                cmd.exe /c "taskkill /F /T /PID $recPid >nul 2>&1"
                $killedCount++
            }
        }
    } catch {}
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

# 2. Terminate any remaining process listening on port 3000
try {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conns) {
        foreach ($c in $conns) {
            $p = $c.OwningProcess
            if ($p -and $p -ne 0) {
                Write-Host "[ACTION] Terminating process PID $p listening on port $port..." -ForegroundColor Yellow
                Stop-Process -Id $p -Force -Recurse -ErrorAction SilentlyContinue
                cmd.exe /c "taskkill /F /T /PID $p >nul 2>&1"
                $killedCount++
            }
        }
    }
} catch {
    $netstat = netstat -ano | findstr ":$port " | findstr "LISTENING"
    foreach ($line in $netstat) {
        $parts = ($line -split '\s+') | Where-Object { $_ -ne '' }
        if ($parts.Count -ge 5) {
            $p = [int]$parts[4]
            if ($p -gt 0) {
                cmd.exe /c "taskkill /F /T /PID $p >nul 2>&1"
                $killedCount++
            }
        }
    }
}

# 3. Verify port 3000 is cleared
$cleared = $false
for ($i = 0; $i -lt 5; $i++) {
    Start-Sleep -Seconds 1
    $rem = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $rem) {
        $cleared = $true
        break
    }
}

if ($cleared) {
    Write-Host "[SUCCESS] Port $port is clear." -ForegroundColor Green
} else {
    Write-Host "[WARNING] Some connections on port $port may still be lingering." -ForegroundColor Yellow
}

if ($killedCount -gt 0) {
    Write-Host "[SUCCESS] HPC Server has been stopped successfully." -ForegroundColor Green
} else {
    Write-Host "[INFO] No active HPC process was found running on port $port." -ForegroundColor Cyan
}

Start-Sleep -Seconds 1
