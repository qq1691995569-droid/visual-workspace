param([switch]$CpuOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$basePython = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$visionPython = Join-Path $projectRoot '.canvas-runtime/vision-env/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $visionPython)) { & $basePython -m venv (Join-Path $projectRoot '.canvas-runtime/vision-env') }
if ($CpuOnly) { & $visionPython -m pip install 'torch==2.11.0' 'torchvision==0.26.0' }
else { & $visionPython -m pip install 'torch==2.11.0+cu128' 'torchvision==0.26.0+cu128' --index-url https://download.pytorch.org/whl/cu128 }
if ($LASTEXITCODE -ne 0) { throw 'CUDA runtime installation failed' }
& $visionPython -m pip install 'rembg[cpu]==2.0.69' spandrel
if ($LASTEXITCODE -ne 0) { throw 'Vision packages installation failed' }
$comfyPath = Join-Path $projectRoot '.canvas-runtime/ComfyUI'
if (-not (Test-Path -LiteralPath $comfyPath)) { git clone --depth 1 https://github.com/Comfy-Org/ComfyUI.git $comfyPath }
if ($LASTEXITCODE -ne 0) { throw 'ComfyUI checkout failed' }
git -C $comfyPath fetch --depth 1 origin b1a247c9cf9dbfda4b2c0a0c1d50950667eeaa0c
if ($LASTEXITCODE -ne 0) { throw 'ComfyUI revision fetch failed' }
git -C $comfyPath checkout --detach b1a247c9cf9dbfda4b2c0a0c1d50950667eeaa0c
if ($LASTEXITCODE -ne 0) { throw 'ComfyUI revision checkout failed' }
$apiRequirements = Join-Path $projectRoot '.canvas-runtime/comfy-api-requirements.txt'
Get-Content (Join-Path $comfyPath 'requirements.txt') | Where-Object { $_ -notmatch '^comfyui-(workflow-templates|embedded-docs)' } | Set-Content $apiRequirements -Encoding utf8
& $visionPython -m pip install -r $apiRequirements
if ($LASTEXITCODE -ne 0) { throw 'ComfyUI dependencies installation failed' }
& $visionPython (Join-Path $PSScriptRoot 'download-vision-models.py')
if ($LASTEXITCODE -ne 0) { throw 'Model download incomplete' }
Write-Output 'Local vision engines installed. Restart the canvas service and run sample checks.'
