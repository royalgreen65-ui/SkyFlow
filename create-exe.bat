@echo off
title SkyFlow Bridge Builder
echo ==========================================
echo SKYFLOW BRIDGE EXECUTABLE BUILDER
echo ==========================================
echo.
echo Checking for Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! Please install it from https://nodejs.org/
    pause
    exit /b
)

echo [1/3] Installing project dependencies...
call npm install

echo [2/3] Installing compiler (pkg)...
call npm install -g pkg

echo [3/3] Compiling bridge.js into skyflow-bridge.exe...
call pkg bridge.js --targets node16-win-x64 --output skyflow-bridge.exe

echo.
echo ==========================================
echo SUCCESS! skyflow-bridge.exe has been created.
echo Move this file to your FSX computer and run it.
echo ==========================================
pause