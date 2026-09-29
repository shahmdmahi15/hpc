$desktopPath = [System.Environment]::GetFolderPath('Desktop')
$projectRoot = Split-Path -Parent $PSScriptRoot

$wshShell = New-Object -ComObject WScript.Shell

# 1. Main Application Desktop Shortcut (Silent Launcher)
$shortcutPath = Join-Path $desktopPath "Health & Pain Care Center.lnk"
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$projectRoot\Launch-HPC-App.vbs`""
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Description = "Health & Pain Care Center - Clinic Management System"
$iconPath = Join-Path $projectRoot "public\favicon.ico"
if (Test-Path $iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
}
$shortcut.Save()

# 2. Stop Server Desktop Shortcut
$stopShortcutPath = Join-Path $desktopPath "Stop HPC Server.lnk"
$stopShortcut = $wshShell.CreateShortcut($stopShortcutPath)
$stopShortcut.TargetPath = Join-Path $projectRoot "Stop-HPC.bat"
$stopShortcut.WorkingDirectory = $projectRoot
$stopShortcut.Description = "Stop background HPC Server process"
$stopShortcut.Save()

Write-Host "[SUCCESS] Desktop shortcuts created successfully:" -ForegroundColor Green
Write-Host "  1. $shortcutPath" -ForegroundColor Cyan
Write-Host "  2. $stopShortcutPath" -ForegroundColor Cyan
