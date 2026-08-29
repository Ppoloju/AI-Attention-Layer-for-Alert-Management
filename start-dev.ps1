$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$staleProcesses = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($procId in $staleProcesses) {
  if ($procId -and $procId -match '^\d+$') {
    Write-Host "Stopping stale process on port 3000 (PID $procId)"
    Stop-Process -Id $procId -Force
  }
}

Write-Host "Starting SignalFlow stack..."
Write-Host "This will start PostgreSQL, Redis, the backend worker, and the Next.js frontend."

npm run dev
