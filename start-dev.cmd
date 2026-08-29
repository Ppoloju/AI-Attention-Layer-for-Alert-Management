@echo off
cd /d "%~dp0"
for /f "tokens=5" %%p in ('netstat -ano -p tcp ^| findstr :3000') do (
  if not "%%p"=="" (
    echo Stopping stale process on port 3000 (PID %%p)
    taskkill /PID %%p /F >nul 2>&1
  )
)

npm run dev
