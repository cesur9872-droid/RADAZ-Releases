$ErrorActionPreference='Stop'
$radazRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $radazRoot
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22.13+ from nodejs.org first.' }
if (-not (Get-Command python.exe -ErrorAction SilentlyContinue)) { throw 'Install Python 3.10+ from python.org first.' }
$nodeVersion = & node -p 'process.versions.node'
if ([version]$nodeVersion -lt [version]'22.13.0') { throw 'Node.js 22.13+ is required.' }
& corepack pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
& python -c 'from PIL import Image'
if ($LASTEXITCODE -ne 0) { & python -m pip install 'Pillow>=10,<13'; if ($LASTEXITCODE -ne 0) { throw 'Pillow installation failed.' } }
Write-Host 'Setup complete. Run START-RADAZ.cmd.'
