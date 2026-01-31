@echo off
echo ======================================
echo  Diagram App - Windows Build Script
echo ======================================
echo.
echo This script requires Administrator privileges...
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Not running as Administrator!
    echo Restarting with Administrator privileges...
    echo.
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo Running as Administrator ✓
echo.
echo Building Electron app...
echo.

cd /d "%~dp0"
call npm run electron:build:win -- --publish never

if %errorlevel% equ 0 (
    echo.
    echo ======================================
    echo  Build SUCCESS! ✓
    echo ======================================
    echo.
    echo Your .exe file is ready:
    echo %~dp0release\Diagram App-1.0.0-Portable.exe
    echo.
) else (
    echo.
    echo ======================================
    echo  Build FAILED! ✗
    echo ======================================
    echo.
    echo Check the error messages above.
)

echo.
pause
