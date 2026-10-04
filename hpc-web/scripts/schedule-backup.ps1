<#
.SYNOPSIS
    Installs a Windows Scheduled Task for Daily Automated HPC Database Backups.
.DESCRIPTION
    Configures Windows Task Scheduler to run the backup script daily at 23:59 (11:59 PM).
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$TaskName = "HPC_Clinical_Database_Backup"
$RunnerScript = Join-Path $ScriptDir "backup-database.ps1"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Configuring Windows Task Scheduler for HPC Backups     " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$Action = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$RunnerScript`""

try {
    # Check if task already exists and remove previous version
    schtasks.exe /query /tn "$TaskName" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Updating existing scheduled task '$TaskName'..." -ForegroundColor Cyan
        schtasks.exe /delete /tn "$TaskName" /f
    }

    # Register task to run every day at 23:59
    schtasks.exe /create /tn "$TaskName" /tr "$Action" /sc daily /st 23:59 /f /rl highest
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✓ Windows Scheduled Task '$TaskName' created successfully!" -ForegroundColor Green
        Write-Host "  Schedule: Daily at 11:59 PM (23:59)" -ForegroundColor White
        Write-Host "  Action:   $Action" -ForegroundColor Gray
    } else {
        throw "Failed to create scheduled task via schtasks."
    }
}
catch {
    Write-Host "`n✗ Error creating scheduled task: $_" -ForegroundColor Red
    Write-Host "  Note: You may need to run this PowerShell console as Administrator." -ForegroundColor Yellow
}
