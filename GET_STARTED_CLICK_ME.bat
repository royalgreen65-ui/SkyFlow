
@echo off
title SkyFlow Easy Installer
echo ======================================================
echo           SKYFLOW EASY INSTALLER (v1.3)
echo ======================================================
echo.
echo 1. Checking for Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] ERROR: Node.js is missing! 
    echo [!] I am opening the website for you. Download "LTS" and install it.
    start https://nodejs.org/
    echo [!] After you install Node.js, run this file again!
    pause
    exit /b
)

echo 2. Installing Bridge & UI components...
call npm install --quiet

echo 3. Creating your Desktop Shortcut...
set SCRIPT="%TEMP%\%RANDOM%-%RANDOM%-%RANDOM%-%RANDOM%.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") >> %SCRIPT%
echo sLinkFile = oWS.ExpandEnvironmentStrings("%%USERPROFILE%%\Desktop\SkyFlow Flight Bridge.lnk") >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = "node.exe" >> %SCRIPT%
echo oLink.Arguments = """%~dp0bridge.js""" >> %SCRIPT%
echo oLink.WorkingDirectory = "%~dp0" >> %SCRIPT%
echo oLink.Description = "Start SkyFlow Bridge and UI" >> %SCRIPT%
echo oLink.IconLocation = "shell32.dll, 43" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%
cscript /nologo %SCRIPT%
del %SCRIPT%

echo.
echo ======================================================
echo DONE! YOU ARE READY TO FLY!
echo.
echo [STEP 1] Go to your DESKTOP.
echo [STEP 2] Double-click "SkyFlow Flight Bridge".
echo.
echo This will open BOTH the bridge and the website for you!
echo ======================================================
echo.
pause