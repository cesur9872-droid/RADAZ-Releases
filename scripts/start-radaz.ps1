param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$radazPort = if ($env:RADAZ_PORT) { [int]$env:RADAZ_PORT } else { 5173 }
if ($radazPort -lt 1 -or $radazPort -gt 65535) { throw 'RADAZ portu duzgun deyil.' }
$url = "http://localhost:$radazPort/"
$probeUrl = "http://127.0.0.1:$radazPort/"
$hasSource = Test-Path -LiteralPath (Join-Path $projectRoot 'app\page.tsx')
$expected = Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'public\product.json') | ConvertFrom-Json
Set-Location -LiteralPath $projectRoot

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
  Write-Host 'RADAZ-i acmaq ucun Node.js 22.13 ve ya daha yeni versiya lazimdir.' -ForegroundColor Red
  Write-Host 'Node.js: https://nodejs.org'
  exit 1
}

function Test-RadazServer {
  try {
    $served = Invoke-RestMethod -Uri "${probeUrl}product.json" -TimeoutSec 5
    if ($served.name -ne 'RADAZ' -or $served.version -ne $expected.version -or $served.licenseRequired -ne $expected.licenseRequired) { return $false }
    $response = Invoke-WebRequest -UseBasicParsing -Uri $probeUrl -TimeoutSec 5
    return $response.StatusCode -eq 200
  } catch { return $false }
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'start-archive.ps1')
if ($LASTEXITCODE -ne 0) { Write-Warning 'Daimi arxiv xidmeti baslamadi; viewer brauzer arxivi ile davam edir.' }

if (Test-RadazServer) {
  Write-Host 'RADAZ serveri artiq isleyir. Movcud sehife acilir.' -ForegroundColor Green
  if (-not $NoBrowser) { Start-Process $url }
  exit 0
}
if (Get-NetTCPConnection -State Listen -LocalPort $radazPort -ErrorAction SilentlyContinue) {
  Write-Host "$radazPort portu mesguldur. Evvelki RADAZ server penceresini baglayib yeniden acin." -ForegroundColor Red
  exit 1
}

# Source checkouts build the current files; distributed ZIPs are already built.
# Normal workstation startup never enters Vite's development/optimizer loop.
if ($hasSource) {
  Write-Host 'RADAZ-in cari fayllari hazirlanir...'
  & node (Join-Path $PSScriptRoot 'run-framework.mjs') build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'dist\server\index.js'))) {
  Write-Error 'Hazir RADAZ fayllari tapilmadi. Release ZIP paketini yeniden acin.'
  exit 1
}

Write-Host 'RADAZ lokal serveri acilir...'
Write-Host "Brauzer unvani: $url"
$browserWaiter = $null
try {
  if (-not $NoBrowser) {
    $browserWaiter = Start-Process powershell.exe -WindowStyle Hidden -PassThru -ArgumentList @(
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
      "`"$(Join-Path $PSScriptRoot 'wait-release-browser.ps1')`"", '-Wait',
      '-OwnerProcessId', $PID, '-Url', $url
    )
  }
  & node (Join-Path $PSScriptRoot 'start-release.mjs')
  $radazExitCode = $LASTEXITCODE
} finally {
  if ($browserWaiter -and -not $browserWaiter.HasExited) { $browserWaiter.Kill() }
}
exit $radazExitCode
