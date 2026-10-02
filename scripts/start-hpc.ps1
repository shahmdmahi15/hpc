# Health & Pain Care Center (HPC) - Production Server Launcher
$ErrorActionPreference = "SilentlyContinue"

$port = 3000
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$projectRoot\package.json")) {
    $projectRoot = $PSScriptRoot
}
$pidFile = "$projectRoot\.hpc.pid"

# Determine SSL status
$hasSsl = (Test-Path "$projectRoot\certificates\server.key") -and (Test-Path "$projectRoot\certificates\server.crt")
$scheme = if ($hasSsl) { "https" } else { "http" }

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Health & Pain Care Center - System Launcher" -ForegroundColor Cyan
Write-Host "  Mode: Production ($($scheme.ToUpper()))" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# Helper to check if our HPC server is healthy
function Test-HpcHealth {
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
    
    # Try HTTPS first if SSL is configured, otherwise fallback to HTTP
    $urls = @(
        "$($scheme)://127.0.0.1:$port/_hpc_health",
        "https://127.0.0.1:$port/_hpc_health",
        "http://127.0.0.1:$port/_hpc_health"
    ) | Select-Object -Unique

    foreach ($url in $urls) {
        try {
            $wc = New-Object System.Net.WebClient
            $wc.Headers.Add("User-Agent", "HPC-Launcher")
            $json = $wc.DownloadString($url)
            if ($json -match '"app"\s*:\s*"hpc"') {
                return $true
            }
        } catch {}
    }
    return $false
}

# Helper to get PIDs listening on port 3000
function Get-PortPids {
    param([int]$targetPort)
    $pids = @()
    try {
        $conns = Get-NetTCPConnection -LocalPort $targetPort -State Listen -ErrorAction SilentlyContinue
        if ($conns) {
            foreach ($c in $conns) {
                if ($c.OwningProcess -and $c.OwningProcess -ne 0) {
                    $pids += $c.OwningProcess
                }
            }
        }
    } catch {
        # Fallback to netstat if Get-NetTCPConnection is unavailable
        $netstat = netstat -ano | findstr ":$targetPort " | findstr "LISTENING"
        foreach ($line in $netstat) {
            $parts = ($line -split '\s+') | Where-Object { $_ -ne '' }
            if ($parts.Count -ge 5) {
                $pidVal = [int]$parts[4]
                if ($pidVal -gt 0) { $pids += $pidVal }
            }
        }
    }
    return ($pids | Select-Object -Unique)
}

function Start-HpcServer {
    Write-Host "[INFO] Locating server runtime..." -ForegroundColor Cyan
    $pnpmPath = (Get-Command "pnpm" -ErrorAction SilentlyContinue).Source
    $npmPath = (Get-Command "npm" -ErrorAction SilentlyContinue).Source
    $tsxPath = "$projectRoot\node_modules\.bin\tsx.cmd"
    $nodePath = (Get-Command "node" -ErrorAction SilentlyContinue).Source
    
    $serverProc = $null
    
    if (Test-Path $tsxPath) {
        Write-Host "[INFO] Starting server via tsx on 0.0.0.0:$port ($scheme) ..." -ForegroundColor Cyan
        $serverProc = Start-Process -FilePath $tsxPath -ArgumentList "server.ts","-H","0.0.0.0","-p","$port" -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
    } elseif ($pnpmPath) {
        Write-Host "[INFO] Starting server via pnpm on 0.0.0.0:$port ($scheme) ..." -ForegroundColor Cyan
        $serverProc = Start-Process -FilePath $pnpmPath -ArgumentList "run","start","--","-H","0.0.0.0","-p","$port" -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
    } elseif ($npmPath) {
        Write-Host "[INFO] Starting server via npm on 0.0.0.0:$port ($scheme) ..." -ForegroundColor Cyan
        $serverProc = Start-Process -FilePath $npmPath -ArgumentList "run","start","--","-H","0.0.0.0","-p","$port" -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
    } elseif ($nodePath) {
        Write-Host "[INFO] Starting server via node on 0.0.0.0:$port ($scheme) ..." -ForegroundColor Cyan
        $serverProc = Start-Process -FilePath $nodePath -ArgumentList "server.ts","-H","0.0.0.0","-p","$port" -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
    }
    
    if ($serverProc -and $serverProc.Id) {
        Set-Content -Path $pidFile -Value $serverProc.Id -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host "[INFO] Waiting for HPC Server to initialize ..." -ForegroundColor Cyan
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $online = $false
    
    while ($sw.Elapsed.TotalSeconds -lt 35) {
        Start-Sleep -Seconds 1
        if (Test-HpcHealth) {
            $online = $true
            break
        }
    }
    
    if ($online) {
        Write-Host "[SUCCESS] HPC Server is online and verified healthy!" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Server initialization is taking longer than expected." -ForegroundColor Yellow
        Write-Host "[INFO] Server process PID: $($serverProc.Id)" -ForegroundColor DarkGray
    }
}

function Launch-HpcBrowser {
    $browserBin = $null
    $browserName = ""
    $url = "$($scheme)://localhost:$port"
    
    $chromePaths = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
    )
    $edgePaths = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:LocalAppData\Microsoft\Edge\Application\msedge.exe"
    )
    $bravePaths = @(
        "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe",
        "$env:LocalAppData\BraveSoftware\Brave-Browser\Application\brave.exe"
    )
    
    foreach ($p in $chromePaths) {
        if (Test-Path $p) { $browserBin = $p; $browserName = "Google Chrome"; break }
    }
    if (-not $browserBin) {
        foreach ($p in $edgePaths) {
            if (Test-Path $p) { $browserBin = $p; $browserName = "Microsoft Edge"; break }
        }
    }
    if (-not $browserBin) {
        foreach ($p in $bravePaths) {
            if (Test-Path $p) { $browserBin = $p; $browserName = "Brave Browser"; break }
        }
    }
    
    if ($browserBin) {
        Write-Host "[INFO] Launching HPC in $browserName application window at $url ..." -ForegroundColor Green
        $profileDir = "$env:LOCALAPPDATA\HPC_Desktop_Profile"
        Start-Process -FilePath $browserBin -ArgumentList "--app=$url","--window-size=1440,900","--user-data-dir=`"$profileDir`""
    } else {
        Write-Host "[INFO] Opening HPC in default browser at $url ..." -ForegroundColor Green
        Start-Process $url
    }
}

# --- MAIN EXECUTION FLOW ---
$listeningPids = Get-PortPids -targetPort $port

if ($listeningPids -and $listeningPids.Count -gt 0) {
    Write-Host "[INFO] Port $port is currently occupied. Verifying service..." -ForegroundColor Yellow
    
    if (Test-HpcHealth) {
        Write-Host "[INFO] HPC Server is already active and healthy on port $port!" -ForegroundColor Green
        Launch-HpcBrowser
        exit 0
    } else {
        Write-Host "[WARNING] Port $port is held by an unknown or unresponsive process." -ForegroundColor Yellow
        Write-Host "[ACTION] Terminating conflicting process(es) to reclaim port $port..." -ForegroundColor Yellow
        
        foreach ($p in $listeningPids) {
            Write-Host "  - Terminating PID: $p (and child tree)..." -ForegroundColor Red
            try {
                Stop-Process -Id $p -Force -Recurse -ErrorAction SilentlyContinue
            } catch {}
            cmd.exe /c "taskkill /F /T /PID $p >nul 2>&1"
        }
        
        Start-Sleep -Seconds 2
        
        # Re-check port
        $remainingPids = Get-PortPids -targetPort $port
        if ($remainingPids -and $remainingPids.Count -gt 0) {
            foreach ($p in $remainingPids) {
                cmd.exe /c "taskkill /F /T /PID $p >nul 2>&1"
            }
            Start-Sleep -Seconds 1
        }
        
        Start-HpcServer
        Launch-HpcBrowser
    }
} else {
    Write-Host "[INFO] Port $port is clear." -ForegroundColor Green
    Start-HpcServer
    Launch-HpcBrowser
}
