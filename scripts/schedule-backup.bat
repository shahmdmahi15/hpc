@echo off
title HPC Automated Backup Scheduler
cd /d "%~dp0\.."
echo Setting up daily automated database backup in Windows Task Scheduler...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0schedule-backup.ps1"
echo.
pause
