param([switch]$Wait, [int]$OwnerProcessId = 0, [string]$Url = 'http://localhost:5173/')
$ErrorActionPreference='Stop'
if (-not $Wait) {
  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$PSCommandPath`"",'-Wait','-OwnerProcessId',$OwnerProcessId,'-Url',$Url)
  exit 0
}
$radazBuild=Get-Content -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) 'dist\server\radaz-build.json') -Raw | ConvertFrom-Json
$radazExpected=$radazBuild.product
$probeUri = [System.UriBuilder]::new($Url)
$probeUri.Host = '127.0.0.1'
$probeUrl = $probeUri.Uri.AbsoluteUri
foreach ($attempt in 1..90) {
  if ($OwnerProcessId -and -not (Get-Process -Id $OwnerProcessId -ErrorAction SilentlyContinue)) { exit 1 }
  try {
    $radazServed=Invoke-RestMethod "${probeUrl}radaz-runtime.json" -TimeoutSec 3
    if ($radazServed.name -eq 'RADAZ' -and $radazServed.version -eq $radazExpected.version -and $radazServed.buildId -eq $radazBuild.buildId) {
      $response=Invoke-WebRequest $probeUrl -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -eq 200) { Start-Process "${Url}?radaz-build=$($radazBuild.buildId)"; exit 0 }
    }
  } catch {}
  Start-Sleep -Milliseconds 700
}
