$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = $env:CANVAS_PYTHON
if (-not $pythonPath) {
  $pythonPath = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
}
$packagesPath = Join-Path $projectRoot '.canvas-runtime/packages'
$modelsPath = Join-Path $projectRoot '.canvas-runtime/models'
& $pythonPath -m pip install --target $packagesPath 'rembg[cpu]==2.0.69'
if ($LASTEXITCODE -ne 0) { throw 'Failed to install local cutout runtime' }
New-Item -ItemType Directory -Force $modelsPath | Out-Null
$modelPath = Join-Path $modelsPath 'u2netp.onnx'
if (-not (Test-Path -LiteralPath $modelPath)) {
  Invoke-WebRequest -Uri 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx' -OutFile $modelPath
}
if ((Get-FileHash -LiteralPath $modelPath -Algorithm MD5).Hash -ne '8E83CA70E441AB06C318D82300C84806') {
  throw 'Model checksum mismatch. Replace the model before using local cutout.'
}
Write-Output 'Local cutout runtime ready (u2netp, CPU).'
