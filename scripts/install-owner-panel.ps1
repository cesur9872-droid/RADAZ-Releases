# Local owner-only installation. This script is never included in customer Setup.
$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ownerAppRoot = Join-Path $env:LOCALAPPDATA 'RADAZ-Owner'
$ownerCode = Join-Path $ownerAppRoot 'billing'
$ownerPublic = Join-Path $ownerAppRoot 'public'
New-Item -ItemType Directory -Force -Path $ownerCode,$ownerPublic | Out-Null
$ownerIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $ownerAppRoot /inheritance:r /grant:r "*$($ownerIdentity):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' /T /Q | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Sahib paneli üçün Windows icazələri qurulmadı.' }
foreach ($ownerFile in @('owner-console.mjs','owner-vault.mjs','owner-settings.mjs','commerce.mjs','publish-policy.mjs','owner-ui.js','owner.html','open-owner.ps1','README.md')) {
    Copy-Item -LiteralPath (Join-Path $sourceRoot "billing\$ownerFile") -Destination (Join-Path $ownerCode $ownerFile) -Force
}
foreach ($ownerFile in @('radaz-wordmark.svg','license-public.json')) {
    Copy-Item -LiteralPath (Join-Path $sourceRoot "public\$ownerFile") -Destination (Join-Path $ownerPublic $ownerFile) -Force
}
$ownerShell = New-Object -ComObject WScript.Shell
$ownerShortcut = $ownerShell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'RADAZ Sahib Paneli.lnk'))
$ownerShortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$ownerShortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $ownerCode 'open-owner.ps1') + '"'
$ownerShortcut.WorkingDirectory = $ownerCode
$ownerShortcut.Description = 'RADAZ şəxsi ödəniş və qiymət idarəetməsi'
$ownerShortcut.Save()
Write-Output 'RADAZ Sahib Paneli şəxsi qısayolu yaradıldı.'
