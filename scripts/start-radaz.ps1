$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$url = 'http://localhost:5173/'
$hasSource = Test-Path -LiteralPath (Join-Path $projectRoot 'app\page.tsx')
$lockPath = Join-Path $projectRoot '.vinext\dev\lock.json'

Set-Location -LiteralPath $projectRoot
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'start-archive.ps1')
if ($LASTEXITCODE -ne 0) { Write-Warning 'Daimi arxiv xidmeti baslamadi; viewer brauzer arxivi ile davam edir.' }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'RADAZ-i acmaq ucun Node.js 22.13 ve ya daha yeni versiya lazimdir.' -ForegroundColor Red
  Write-Host 'Node.js: https://nodejs.org'
  exit 1
}

function Test-RadazServer {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

if (Test-RadazServer) {
  Write-Host 'RADAZ serveri artiq isleyir. Movcud sehife acilir.' -ForegroundColor Green
  Start-Process $url
  exit 0
}

if ($hasSource -and (Test-Path -LiteralPath $lockPath)) {
  $lock = $null
  try { $lock = Get-Content -Raw -LiteralPath $lockPath | ConvertFrom-Json } catch {}
  $running = if ($lock -and $lock.pid) { Get-Process -Id ([int]$lock.pid) -ErrorAction SilentlyContinue } else { $null }

  if ($running) {
    Write-Host 'Evvelki RADAZ prosesi baslanir. Server gozlenilir...'
    foreach ($attempt in 1..30) {
      Start-Sleep -Seconds 1
      if (Test-RadazServer) {
        Write-Host 'RADAZ hazirdir.' -ForegroundColor Green
        Start-Process $url
        exit 0
      }
    }
    Write-Host "RADAZ prosesi isleyir, lakin server cavab vermir (PID: $($lock.pid))." -ForegroundColor Red
    Write-Host 'Task Manager-de hemin prosesi baglayib START-RADAZ.cmd faylini yeniden acin.'
    exit 1
  }

  Remove-Item -LiteralPath $lockPath -Force
  Write-Host 'Kohne server qeydi temizlendi.'
}

Write-Host 'RADAZ lokal serveri acilir...'
Write-Host "Brauzer unvani: $url"

$browserCommand = @"
`$url = '$url'
foreach (`$attempt in 1..180) {
  Start-Sleep -Seconds 1
  try {
    `$response = Invoke-WebRequest -UseBasicParsing -Uri `$url -TimeoutSec 3
    if (`$response.StatusCode -ge 200 -and `$response.StatusCode -lt 500) {
      Start-Process `$url
      exit 0
    }
  } catch {}
}
"@

Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
  '-NoProfile',
  '-Command',
  $browserCommand
)

if ($hasSource) {
  & corepack pnpm dev
} elseif (Test-Path -LiteralPath (Join-Path $projectRoot 'dist\server\wrangler.json')) {
  & node (Join-Path $PSScriptRoot 'start-release.mjs')
} else {
  Write-Error 'RADAZ fayllari tapilmadi. Paketi yeniden acin.'
  exit 1
}
exit $LASTEXITCODE
