<#
.SYNOPSIS
    Automated Database Backup Runner for Health & Pain Care Center (HPC).
.DESCRIPTION
    Safely creates an offline SQLite snapshot with WAL checkpointing, GZIP compression,
    and pushes the commit to GitHub / local NAS / USB storage.
#>

[CmdletBinding()]
param (
    [switch]$PushToGit = $true,
    [string]$NasPath = "",
    [string]$UsbPath = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Set-Location -Path $ProjectRoot

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   HPC Automated Database Backup & GitHub Sync Routine   " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$ArgsList = @("scripts/backup-db.ts")
if ($PushToGit) {
    $ArgsList += "--push"
}

try {
    & npx tsx @ArgsList
    if ($LASTEXITCODE -ne 0) {
        throw "Backup script exited with error code $LASTEXITCODE"
    }
    Write-Host "`n✓ Database backup and GitHub synchronization finished successfully!" -ForegroundColor Green
}
catch {
    Write-Host "`n✗ Backup routine encountered an error: $_" -ForegroundColor Red
    exit 1
}
