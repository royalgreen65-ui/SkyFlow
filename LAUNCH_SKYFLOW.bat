@echo off
setlocal enabledelayedexpansion
title SkyFlow Professional Weather Engine
color 0F

:: --- 1. SETTINGS ---
set "APP_DIR=%~dp0"
set "NODE_EXE=node"
set "BRIDGE_JS=%~dp0bridge.js"

echo ======================================================
echo           SKYFLOW WEATHER ENGINE (v2.3)
echo ======================================================
echo.

:: --- 2. ZIP PROTECTION ---
echo %APP_DIR% | findstr /I "Temp 7z Rar Zip" >nul
if %errorlevel% equ 0 (
    color 0C
    echo [ERROR] DO NOT RUN FROM ZIP!
    echo.
    echo 1. Right-Click 'SkyFlow.zip'
    echo 2. Choose 'Extract All'
    echo 3. Run THIS file from the new folder.
    pause
    exit /b
)

:: --- 3. NODE.JS DETECTION ---
echo [1/3] Locating Engine...
where node >nul 2>&1
if %errorlevel% neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    ) else (
        color 0E
        echo [!] Node.js is missing. 
        echo Opening installer...
        start https://nodejs.org/en/download/prebuilt-installer
        echo Install the 'LTS' version, then run this file again.
        pause
        exit /b
    )
)

:: --- 4. AUTO-INSTALL ---
if not exist "%~dp0node_modules\" (
    echo [2/3] Preparing components (First-time only)...
    cd /d "%~dp0"
    call npm install --quiet --no-audit --no-fund
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Installation failed. Move this folder to C:\SkyFlow and try again.
        pause
        exit /b
    )
)

:: --- 5. THE MAGIC LAUNCH ---
echo [3/3] Igniting Engine...
echo.
echo ------------------------------------------------------
echo DASHBOARD: http://localhost:3000
echo ------------------------------------------------------
echo.

:: We use the absolute path to node and the absolute path to bridge.js
:: This PREVENTS Windows from opening VS Code or Notepad.
start http://localhost:3000
"%NODE_EXE%" "%BRIDGE_JS%"

if %errorlevel% neq 0 (
    echo.
    color 0C
    echo [CRITICAL] The engine stopped unexpectedly.
    echo Make sure you didn't move any files out of the folder!
    pause
)
