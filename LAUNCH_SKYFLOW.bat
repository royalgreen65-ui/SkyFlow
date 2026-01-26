@echo off
setlocal enabledelayedexpansion
title SkyFlow Professional Launcher
color 0F

echo ======================================================
echo           SKYFLOW WEATHER ENGINE (v2.2)
echo ======================================================
echo.

:: --- 1. ZIP DETECTION ---
set "CURRENT_DIR=%~dp0"
echo %CURRENT_DIR% | findstr /I "Temp 7z Rar Zip" >nul
if %errorlevel% equ 0 (
    color 0C
    echo [ERROR] RUNNING FROM ZIP.
    echo.
    echo PLEASE: 
    echo 1. Right-Click 'SkyFlow.zip' -> 'Extract All'
    echo 2. Run THIS file from the NEW folder.
    pause
    exit /b
)

:: --- 2. NODE.JS PATH FINDER ---
echo [SYSTEM] Locating Node.js Engine...
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0E
    echo [!] Node.js not found in System Path.
    echo Checking common install locations...
    
    if exist "C:\Program Files\nodejs\node.exe" (
        set "NODE_EXE=C:\Program Files\nodejs\node.exe"
        set "NPM_EXE=C:\Program Files\nodejs\npm.cmd"
    ) else (
        echo [ERROR] Node.js is NOT installed.
        start https://nodejs.org/en/download/prebuilt-installer
        echo.
        echo Please install Node.js, REBOOT, and try again.
        pause
        exit /b
    )
) else (
    for /f "delims=" %%i in ('where node') do set "NODE_EXE=%%i"
    for /f "delims=" %%i in ('where npm') do set "NPM_EXE=%%i"
)

echo [OK] Found Engine: %NODE_EXE%

:: --- 3. AUTO-INSTALL ---
if not exist "node_modules\" (
    echo [SYSTEM] First-time setup: Building components...
    echo Please wait while we prepare the weather engine...
    call "%NPM_EXE%" install --quiet --no-audit --no-fund
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Component build failed. 
        echo Check your internet or move the folder out of OneDrive/Desktop.
        pause
        exit /b
    )
)

:: --- 4. SHORTCUT CREATOR ---
if not exist "%USERPROFILE%\Desktop\SkyFlow Engine.lnk" (
    echo [SYSTEM] Creating Desktop Shortcut...
    set SCRIPT="%TEMP%\SkyFlowShortCut.vbs"
    echo Set oWS = WScript.CreateObject("WScript.Shell") > %SCRIPT%
    echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\SkyFlow Engine.lnk" >> %SCRIPT%
    echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
    echo oLink.TargetPath = "%~f0" >> %SCRIPT%
    echo oLink.WorkingDirectory = "%~dp0" >> %SCRIPT%
    echo oLink.IconLocation = "shell32.dll, 238" >> %SCRIPT%
    echo oLink.Save >> %SCRIPT%
    cscript /nologo %SCRIPT%
    del %SCRIPT%
)

:: --- 5. EXECUTION ---
echo [SYSTEM] Launching SkyFlow Server...
echo ------------------------------------------------------
echo.
:: Using the absolute path to node.exe ensures Windows doesn't ask "what program"
"%NODE_EXE%" bridge.js
if %errorlevel% neq 0 (
    echo.
    echo ------------------------------------------------------
    color 0C
    echo [CRITICAL ERROR] The Engine crashed.
    echo.
    echo TRY THIS: 
    echo 1. Move this folder to C:\SkyFlow
    echo 2. Run this launcher again.
    echo.
    pause
)
