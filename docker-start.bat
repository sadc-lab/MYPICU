@echo off
REM Docker Quick Start Script for Windows
REM This script helps you quickly start the application in Docker

echo ============================================
echo Docker Quick Start for MyPICU Application
echo ============================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo Docker is not installed. Please install Docker Desktop first.
    echo Visit: https://docs.docker.com/desktop/install/windows-install/
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env
    echo .env file created. Please update it with your Supabase credentials.
    echo.
    set /p answer="Edit .env file now? (y/n): "
    if /i "%answer%"=="y" notepad .env
)

echo.
echo What would you like to do?
echo 1) Start production build
echo 2) Start development build (with hot reload)
echo 3) Stop all containers
echo 4) View logs
echo 5) Rebuild and start
echo.

set /p choice="Enter choice (1-5): "

if "%choice%"=="1" (
    echo Starting production build...
    docker-compose up -d
    echo Application started at http://localhost:3000
    echo View logs with: docker-compose logs -f
    pause
) else if "%choice%"=="2" (
    echo Starting development build...
    docker-compose -f docker-compose.dev.yml up
) else if "%choice%"=="3" (
    echo Stopping containers...
    docker-compose down
    docker-compose -f docker-compose.dev.yml down 2>nul
    echo All containers stopped
    pause
) else if "%choice%"=="4" (
    echo Showing logs (Ctrl+C to exit)...
    docker-compose logs -f
) else if "%choice%"=="5" (
    echo Rebuilding and starting...
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    echo Application rebuilt and started at http://localhost:3000
    pause
) else (
    echo Invalid choice
    pause
    exit /b 1
)
