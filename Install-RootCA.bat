@echo off
setlocal
cd /d "%~dp0"
echo ========================================================
echo   Install HPC Root Certificate Authority (Root CA)
echo ========================================================
echo.
if exist "public\rootCA.crt" (
    set "CERT_FILE=public\rootCA.crt"
) else if exist "certificates\rootCA.crt" (
    set "CERT_FILE=certificates\rootCA.crt"
) else (
    echo [ERROR] rootCA.crt not found!
    pause
    exit /b 1
)

echo Installing %CERT_FILE% into Windows Current User Trusted Root Store...
echo If a Windows Security Warning dialog appears, click "Yes" to trust this CA.
echo.
certutil -addstore -f -user "Root" "%CERT_FILE%"
echo.
if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] HPC Root CA successfully installed!
    echo Your browser (Chrome, Edge) will now trust https://localhost:3000 and LAN addresses with a secure padlock.
) else (
    echo [ERROR] Installation failed or was canceled.
)
echo.
pause
