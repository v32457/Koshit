@echo off
SETLOCAL EnableDelayedExpansion
TITLE Kosh Innovations Global IT System - Local Launcher

echo ============================================================================
echo   KOSH INNOVATIONS GLOBAL IT SYSTEM - STANDALONE WINDOWS LAUNCHER
echo ============================================================================
echo.

REM Change working directory to the folder where this .bat file is located
cd /d "%~dp0"

REM 1. Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in your system PATH.
    echo Please download and install Node.js ^(v20 LTS or newer^) from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Detected Node.js version: %NODE_VER%

REM 2. Create .env file from .env.example if .env does not exist
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Creating local .env file from .env.example...
        copy /Y ".env.example" ".env" >nul
    ) else (
        echo [INFO] Creating default .env file...
        echo GEMINI_API_KEY=your_gemini_api_key_here> ".env"
    )
)

REM 3. Install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo.
    echo [INFO] First-time setup: Installing npm packages...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] npm install failed. Please check your internet connection and try again.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully.
) else (
    echo [OK] Dependencies found in node_modules.
)

REM 4. Ensure HMR (Hot Module Reload) is enabled for local standalone use
set DISABLE_HMR=false

echo.
echo [INFO] Starting Kosh Innovations Global IT System on http://localhost:3000 ...
echo [INFO] Opening default browser in 3 seconds...
echo [INFO] Press Ctrl+C in this window to stop the server.
echo ============================================================================
echo.

REM Launch browser after a short delay in background
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

REM Start the Vite development server on port 3000
call npm run dev

pause
