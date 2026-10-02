@echo off
setlocal
title Stop Health and Pain Care Center (HPC)
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-hpc.ps1"
exit /b %errorlevel%
