# Run once in an elevated PowerShell on the host computer.
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskConfig = Get-Content -LiteralPath (Join-Path $taskRoot '.canvas-data/upscale-sharing.json') -Raw | ConvertFrom-Json
if (-not (Get-NetFirewallRule -DisplayName 'Canvas Upscale LAN' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName 'Canvas Upscale LAN' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5443 -LocalAddress $taskConfig.bindHost -RemoteAddress LocalSubnet -Profile Domain,Private
}
