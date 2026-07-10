$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
function Write-Step($Message) { Write-Host "[VTA ERP] $Message" -ForegroundColor Cyan }
function Stop-ProjectProcess($ProcessId) {
  if ($ProcessId -eq $PID) { return }
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  if (-not $proc) { return }
  if ($proc.Name -eq "powershell.exe") { return }
  $cmd = [string]$proc.CommandLine
  if ($cmd -like "*$Root*" -or $cmd -like "*npm-cli.js*run dev:api*" -or $cmd -like "*npm-cli.js*run dev:web*" -or $cmd -like "*next*dev*" -or $cmd -like "*nest*start*") {
    Write-Step "Arret du processus VTA (PID $ProcessId, $($proc.Name))."
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  }
}
function Stop-Port($Port) {
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) { Stop-ProjectProcess $connection.OwningProcess }
}
Write-Step "Arret des processus lies a VTA ERP."
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -in @("node.exe", "cmd.exe") -and ([string]$_.CommandLine -like "*$Root*" -or [string]$_.CommandLine -like "*npm-cli.js*run dev:api*" -or [string]$_.CommandLine -like "*npm-cli.js*run dev:web*") } | ForEach-Object { Stop-ProjectProcess $_.ProcessId }
Stop-Port 3000
Stop-Port 3001
Write-Host "VTA ERP local est arrete. Ports 3000 et 3001 liberes si occupes par VTA." -ForegroundColor Green
exit 0