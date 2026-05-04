@echo off
setlocal
cd /d "%~dp0"

echo [INFO] Forest Jungle Chess Launcher
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found. Please install Node.js first.
  exit /b 1
)

if not exist node_modules (
  echo [INFO] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    exit /b 1
  )
)

echo [INFO] Starting dev server...
call npm run dev -- --host 0.0.0.0
