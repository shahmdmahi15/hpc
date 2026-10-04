@echo off
setlocal
title Health and Pain Care Center (HPC) Launcher
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-hpc.ps1"
exit /b %errorlevel%
