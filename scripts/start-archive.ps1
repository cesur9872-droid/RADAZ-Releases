$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$statusUrl = 'http://127.0.0.1:8766/status'
try {
  $status = Invoke-RestMethod -Uri $statusUrl -TimeoutSec 2
  if ($status.version -eq 1) { exit 0 }
} catch {}
$pythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
if (-not $pythonCommand) { throw 'Python 3.10+ is required for the RADAZ permanent archive.' }
$pythonPath = $pythonCommand.Source
$scriptPath = Join-Path $projectRoot 'bridge\radaz_archive.py'
$logDirectory = Join-Path $env:USERPROFILE 'AppData\Local\RADAZ\Logs'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
Start-Process -FilePath $pythonPath -WindowStyle Hidden -WorkingDirectory $projectRoot -ArgumentList @("`"$scriptPath`"") -RedirectStandardError (Join-Path $logDirectory 'archive-error.log') -RedirectStandardOutput (Join-Path $logDirectory 'archive.log')
foreach ($attempt in 1..20) {
  Start-Sleep -Milliseconds 300
  try { $status = Invoke-RestMethod -Uri $statusUrl -TimeoutSec 1; if ($status.version -eq 1) { exit 0 } } catch {}
}
throw "RADAZ archive did not start. Check $logDirectory\archive-error.log"
