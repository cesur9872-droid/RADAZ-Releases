$ErrorActionPreference = 'Stop'
$ownerApplication = Split-Path -Parent $MyInvocation.MyCommand.Path
$radazInstall = Join-Path $env:LOCALAPPDATA 'Programs\RADAZ'
$ownerNode = $null
if (Test-Path -LiteralPath (Join-Path $radazInstall 'active.json')) {
    $activeVersion = (Get-Content -LiteralPath (Join-Path $radazInstall 'active.json') -Raw | ConvertFrom-Json).version
    if ($activeVersion -match '^\d+\.\d+\.\d+$') {
        $candidate = Join-Path $radazInstall "versions\$activeVersion\runtime\node\node.exe"
        if (Test-Path -LiteralPath $candidate) { $ownerNode = $candidate }
    }
}
if (-not $ownerNode) { $ownerNode = (Get-Command node.exe -ErrorAction Stop).Source }
Start-Process -FilePath $ownerNode -ArgumentList ('"' + (Join-Path $ownerApplication 'owner-console.mjs') + '"') -WorkingDirectory $ownerApplication -WindowStyle Hidden
