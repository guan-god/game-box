@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo [INFO] Checking npm...
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
) else (
  echo [INFO] node_modules found, skip install.
)

echo [INFO] Starting dev server...
call npm run dev -- --host 0.0.0.0
