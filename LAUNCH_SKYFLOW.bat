@echo off
setlocal enabledelayedexpansion
title SkyFlow All-In-One Launcher
color 0F

echo ======================================================
echo           SKYFLOW WEATHER ENGINE (v2.1)
echo ======================================================
echo.

:: --- 1. ZIP DETECTION ---
set "CURRENT_DIR=%~dp0"
echo %CURRENT_DIR% | findstr /I "Temp 7z Rar Zip" >nul
if %errorlevel% equ 0 (
    color 0C
    echo [ERROR] ZIP FILE DETECTED.
    echo.
    echo PLEASE: 
    echo 1. Right-Click the SkyFlow.zip
    echo 2. Choose 'Extract All...'
    echo 3. Run this file from the NEW folder.
    echo.
    pause
    exit /b
)

:: --- 2. ONEDRIVE DETECTION ---
echo %CURRENT_DIR% | findstr /I "OneDrive" >nul
if %errorlevel% equ 0 (
    color 0E
    echo [WARNING] ONEDRIVE DETECTED.
    echo.
    echo Flight Simulators often block tools running in OneDrive.
    echo If the app fails to connect to your sim, move this folder
    echo to your C:\ drive directly (e.g. C:\SkyFlow).
    echo.
)

:: --- 3. NODE.JS DETECTION ---
echo [SYSTEM] Checking for Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    color 0E
    echo [!] MISSING: Node.js is not installed.
    echo.
    start https://nodejs.org/en/download/prebuilt-installer
    echo Please install Node.js (LTS), RESTART your PC, and run this again.
    pause
    exit /b
)

:: --- 4. AUTO-INSTALLER ---
if not exist "node_modules\" (
    echo [SYSTEM] First-time setup: Fetching engine components...
    echo This might take a minute. Please wait...
    :: We use a more aggressive install here to force registry updates
    call npm install --no-audit --no-fund --loglevel=error
    if %errorlevel% neq 0 (
        color 0C
        echo.
        echo [ERROR] Installation failed. 
        echo Check your internet connection or try running as Administrator.
        pause
        exit /b
    )
    echo [OK] Components installed.
)

:: --- 5. LAUNCH ENGINE ---
echo [SYSTEM] Starting SkyFlow Engine...
echo.
echo ------------------------------------------------------
node bridge.js
if %errorlevel% neq 0 (
    echo.
    echo ------------------------------------------------------
    color 0C
    echo [CRITICAL ERROR] The Engine has stopped.
    echo If you see 'Module Not Found', delete the 'node_modules' folder and run this again.
    echo.
    pause
)
