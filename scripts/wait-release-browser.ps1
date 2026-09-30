param([switch]$Wait)
$ErrorActionPreference='Stop'
if (-not $Wait) {
  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$PSCommandPath`"",'-Wait')
  exit 0
}
$radazExpected=Get-Content -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) 'public\product.json') -Raw | ConvertFrom-Json
foreach ($attempt in 1..90) {
  try {
    $radazServed=Invoke-RestMethod 'http://localhost:5173/product.json' -TimeoutSec 1
    if ($radazServed.version -eq $radazExpected.version -and $radazServed.licenseRequired -eq $radazExpected.licenseRequired) {
      $response=Invoke-WebRequest 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) { Start-Process 'http://localhost:5173/'; exit 0 }
    }
  } catch {}
  Start-Sleep -Milliseconds 700
}
