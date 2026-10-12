# ========================================================
#  HPC Center - Automated Tauri Windows & Android Build Script
# ========================================================
$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  HPC Center - Building Tauri Release Binaries" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

# Set Android SDK and NDK environment variables for Tauri Android CLI
$env:ANDROID_HOME = "C:\Users\shahmdmahi\AppData\Local\Android\Sdk"
$env:NDK_HOME = "C:\Users\shahmdmahi\AppData\Local\Android\Sdk\ndk\30.0.16248370"

# 1. Build Vite Web Frontend
Write-Host "`n[1/4] Building Frontend (pnpm run build)..." -ForegroundColor Yellow
pnpm run build

# 2. Build Tauri Android Release APK
Write-Host "`n[2/4] Building Tauri Android Release APK..." -ForegroundColor Yellow
$SoTarget = Join-Path $ProjectDir "src-tauri\target\aarch64-linux-android\release\libhpc_lib.so"
$JniDir = Join-Path $ProjectDir "src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a"
if (-not (Test-Path $JniDir)) { New-Item -ItemType Directory -Path $JniDir -Force | Out-Null }
if (Test-Path $SoTarget) {
    Copy-Item $SoTarget -Destination (Join-Path $JniDir "libhpc_lib.so") -Force
}

# Run Gradle to package APK cleanly
$AndroidDir = Join-Path $ProjectDir "src-tauri\gen\android"
Set-Location $AndroidDir
.\gradlew.bat assembleArm64Release
Set-Location $ProjectDir

# 3. Build Tauri Windows Installer & Executable
Write-Host "`n[3/4] Building Tauri Windows Release (MSI & EXE)..." -ForegroundColor Yellow
pnpm tauri build

# 4. Copy Release Binaries to local and web distribution
Write-Host "`n[4/4] Copying release binaries..." -ForegroundColor Yellow
$LocalDest = Join-Path $ProjectDir "release_binaries"
if (-not (Test-Path $LocalDest)) { New-Item -ItemType Directory -Path $LocalDest -Force | Out-Null }

# Source paths
$ApkSrc = Join-Path $ProjectDir "src-tauri\gen\android\app\build\outputs\apk\arm64\release\app-arm64-release.apk"
$MsiSrc = Get-ChildItem -Path (Join-Path $ProjectDir "src-tauri\target\release\bundle\msi") -Filter "*.msi" | Select-Object -First 1
$SetupSrc = Get-ChildItem -Path (Join-Path $ProjectDir "src-tauri\target\release\bundle\nsis") -Filter "*-setup.exe" | Select-Object -First 1
$ExeSrc = Join-Path $ProjectDir "src-tauri\target\release\hpc.exe"

# Copy APK
if (Test-Path $ApkSrc) {
    Copy-Item $ApkSrc -Destination (Join-Path $LocalDest "tauri.apk") -Force
    Write-Host "  [OK] tauri.apk copied successfully!" -ForegroundColor Green
}

# Copy MSI
if ($MsiSrc -and (Test-Path $MsiSrc.FullName)) {
    Copy-Item $MsiSrc.FullName -Destination (Join-Path $LocalDest "tauri.msi") -Force
    Write-Host "  [OK] tauri.msi copied successfully!" -ForegroundColor Green
}

# Copy Standalone EXE
if (Test-Path $ExeSrc) {
    Copy-Item $ExeSrc -Destination (Join-Path $LocalDest "tauri.exe") -Force
    Write-Host "  [OK] tauri.exe copied successfully!" -ForegroundColor Green
}

# Copy Setup EXE
if ($SetupSrc -and (Test-Path $SetupSrc.FullName)) {
    Copy-Item $SetupSrc.FullName -Destination (Join-Path $LocalDest "tauri-setup.exe") -Force
    Write-Host "  [OK] tauri-setup.exe copied successfully!" -ForegroundColor Green
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  Build Complete! Binaries are ready in:" -ForegroundColor Green
Write-Host "  Local: $LocalDest" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan
