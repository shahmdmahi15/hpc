@echo off
setlocal enabledelayedexpansion
title Health & Pain Care Center (HPC) Launcher

cd /d "%~dp0"

echo ========================================================
echo   Health & Pain Care Center - System Launcher
echo   Local LAN & Offline Production Mode
echo ========================================================
echo.

:: 1. Check if server is already running on port 3000
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] HPC Server is already active on port 3000.
    goto LaunchBrowser
)

:: 2. If not running, start server in background bound to 0.0.0.0 (for LAN + local access)
echo [INFO] Starting HPC production server on 0.0.0.0:3000 ...
start /B "" pnpm run start -- -H 0.0.0.0 -p 3000 > "%TEMP%\hpc-server.log" 2>&1

:: 3. Wait for server to become responsive
echo [INFO] Waiting for application to initialize ...
set /a attempts=0
:WaitLoop
timeout /t 1 /nobreak >nul
set /a attempts+=1
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Server is online!
    goto LaunchBrowser
)
if %attempts% lss 25 goto WaitLoop

echo [WARNING] Server initialization took longer than expected. Opening anyway...

:LaunchBrowser
:: 4. Locate Chrome or Edge for standalone desktop app mode
set BROWSER_CMD=
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_CMD=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_CMD=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_CMD=%LocalAppData%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_CMD=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_CMD=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
)

if defined BROWSER_CMD (
    echo [INFO] Launching HPC in desktop application window ...
    start "" "!BROWSER_CMD!" --app=http://localhost:3000 --window-size=1400,900 --user-data-dir="%LOCALAPPDATA%\HPC_Desktop_Profile"
) else (
    echo [INFO] Opening default browser ...
    start http://localhost:3000
)

exit /b 0
