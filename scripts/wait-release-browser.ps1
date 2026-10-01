param([switch]$Wait, [int]$OwnerProcessId = 0, [string]$Url = 'http://localhost:5173/')
$ErrorActionPreference='Stop'
if (-not $Wait) {
  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$PSCommandPath`"",'-Wait','-OwnerProcessId',$OwnerProcessId,'-Url',$Url)
  exit 0
}
$radazExpected=Get-Content -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) 'public\product.json') -Raw | ConvertFrom-Json
$probeUri = [System.UriBuilder]::new($Url)
$probeUri.Host = '127.0.0.1'
$probeUrl = $probeUri.Uri.AbsoluteUri
foreach ($attempt in 1..90) {
  if ($OwnerProcessId -and -not (Get-Process -Id $OwnerProcessId -ErrorAction SilentlyContinue)) { exit 1 }
  try {
    $radazServed=Invoke-RestMethod "${probeUrl}product.json" -TimeoutSec 3
    if ($radazServed.name -eq 'RADAZ' -and $radazServed.version -eq $radazExpected.version -and $radazServed.licenseRequired -eq $radazExpected.licenseRequired) {
      $response=Invoke-WebRequest $probeUrl -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -eq 200) { Start-Process $Url; exit 0 }
    }
  } catch {}
  Start-Sleep -Milliseconds 700
}
