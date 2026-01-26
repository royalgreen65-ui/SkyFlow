@echo off
setlocal enabledelayedexpansion
title SkyFlow Easy Installer
color 0F

echo ======================================================
echo           SKYFLOW EASY INSTALLER (v1.8)
echo ======================================================
echo.

:: --- THE ZIP TRAP CHECK ---
:: This detects if the user is running from 7-Zip, WinRAR, or Windows Temp folders.
set "CURRENT_DIR=%~dp0"
echo %CURRENT_DIR% | findstr /I "Temp 7z Rar Zip" >nul
if %errorlevel% equ 0 (
    color 0C
    echo ######################################################
    echo #               !!! CRITICAL ERROR !!!               #
    echo ######################################################
    echo #                                                    #
    echo #  YOU ARE RUNNING FROM INSIDE A ZIP FILE!           #
    echo #                                                    #
    echo #  Node.js cannot find files inside a ZIP.           #
    echo #                                                    #
    echo #  FIX STEPS:                                        #
    echo #  1. Close this window.                             #
    echo #  2. Go to your Downloads folder.                   #
    echo #  3. Right-Click the SkyFlow .zip file.             #
    echo #  4. Choose "EXTRACT ALL..."                        #
    echo #  5. Open the UNZIPPED folder and run this again.   #
    echo #                                                    #
    echo ######################################################
    echo.
    echo Path detected: %CURRENT_DIR%
    pause
    exit /b
)

echo [OK] Folder is extracted correctly.
echo.

:: --- STEP 1: NODE CHECK ---
echo [STEP 1] Checking for Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    color 0E
    echo [!] ERROR: Node.js is missing! 
    echo [!] Opening the official Node.js website for you...
    start https://nodejs.org/en/download/prebuilt-installer
    echo.
    echo PLEASE: Download the "LTS" version, install it, and RESTART this file.
    pause
    exit /b
)
echo [OK] Node.js is ready.

:: --- STEP 2: DEPENDENCIES ---
echo [STEP 2] Installing engine components...
if not exist "package.json" (
    color 0C
    echo [ERROR] package.json is missing. You didn't extract everything!
    pause
    exit /b
)
call npm install --quiet
echo [OK] Components installed.

:: --- STEP 3: LAUNCHER ---
echo [STEP 3] Creating your Desktop Icon...
set "LAUNCHER=%~dp0run-bridge.bat"
(
echo @echo off
echo title SkyFlow Engine
echo cd /d "%%~dp0"
echo echo Starting SkyFlow...
echo node bridge.js
echo if %%errorlevel%% neq 0 (
echo    echo.
echo    echo [!] CRASH DETECTED.
echo    echo This usually happens if you moved the file out of its folder.
echo    pause
echo )
) > "%LAUNCHER%"

:: --- STEP 4: VBS SHORTCUT ---
set SCRIPT="%TEMP%\SkyFlowShortCut.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") > %SCRIPT%
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\SkyFlow Engine.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = "%LAUNCHER%" >> %SCRIPT%
echo oLink.WorkingDirectory = "%~dp0" >> %SCRIPT%
echo oLink.IconLocation = "shell32.dll, 238" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%
cscript /nologo %SCRIPT%
del %SCRIPT%

echo.
echo ======================================================
echo ✅ SUCCESS! INSTALLATION COMPLETE!
echo ======================================================
echo.
echo 1. Close this window.
echo 2. Go to your Desktop.
echo 3. Open the "SkyFlow Engine" (Cloud Icon).
echo.
pause