@echo off
SETLOCAL EnableDelayedExpansion
TITLE Kosh Innovations Global IT System - Git Push Helper

echo ============================================================================
echo   KOSH INNOVATIONS GLOBAL IT SYSTEM - GIT COMMIT ^& PUSH HELPER
echo ============================================================================
echo.

cd /d "%~dp0"

REM 1. Check if Git is installed
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git is not installed or not in your system PATH.
    echo Please download and install Git from: https://git-scm.com/
    echo.
    pause
    exit /b 1
)

REM 2. Initialize Git repository if .git does not exist
if not exist ".git\" (
    echo [INFO] Initializing new Git repository...
    git init
    git branch -M main
)

REM 3. Check if remote 'origin' is configured
git remote get-url origin >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [INFO] No remote repository ^('origin'^) is configured yet.
    set /p REMOTE_URL="Enter your GitHub/Git repository URL (e.g. https://github.com/user/repo.git): "
    if "!REMOTE_URL!"=="" (
        echo [ERROR] Remote URL cannot be empty.
        pause
        exit /b 1
    )
    git remote add origin "!REMOTE_URL!"
    echo [OK] Remote 'origin' set to !REMOTE_URL!
)

REM 4. Stage all changes
echo.
echo [INFO] Staging all project files...
git add -A

REM 5. Prompt for commit message (or use default if passed as argument)
set "COMMIT_MSG=%~1"
if "!COMMIT_MSG!"=="" (
    set /p COMMIT_MSG="Enter commit message (press Enter for default 'Update Kosh ERP'): "
)
if "!COMMIT_MSG!"=="" (
    set "COMMIT_MSG=Update Kosh ERP"
)

echo.
echo [INFO] Committing changes with message: "!COMMIT_MSG!"...
git commit -m "!COMMIT_MSG!"

REM 6. Push to remote
for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD') do set CURRENT_BRANCH=%%b
echo.
echo [INFO] Pushing branch '!CURRENT_BRANCH!' to origin...
git push -u origin !CURRENT_BRANCH!

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] git push failed. Please check your remote URL, branch permissions, or credentials.
    pause
    exit /b 1
)

echo.
echo [OK] Successfully pushed changes to origin/!CURRENT_BRANCH!!
echo ============================================================================
pause
