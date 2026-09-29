@echo off
setlocal enabledelayedexpansion
title Stop Health & Pain Care Center (HPC)

echo [INFO] Looking for HPC server running on port 3000...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    set "PID=%%a"
    if defined PID (
        echo [INFO] Terminating server process PID !PID! ...
        taskkill /F /PID !PID! >nul 2>&1
    )
)

echo [SUCCESS] HPC Server has been stopped successfully.
timeout /t 2 >nul
exit /b 0
