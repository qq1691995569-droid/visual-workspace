$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskConfig = Get-Content -LiteralPath (Join-Path $taskRoot '.canvas-data/upscale-sharing.json') -Raw | ConvertFrom-Json
if (-not (Get-NetFirewallRule -DisplayName 'Canvas Web LAN' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName 'Canvas Web LAN' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5444 -LocalAddress $taskConfig.bindHost -RemoteAddress LocalSubnet -Profile Domain,Private
}
