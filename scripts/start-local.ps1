$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ApiPort = 3001
$WebPort = 3000
$LoginUrl = "http://localhost:3000/login"
$ApiLog = Join-Path $Root "logs\api-local.log"
$WebLog = Join-Path $Root "logs\web-local.log"
$ApiErr = Join-Path $Root "logs\api-local.err.log"
$WebErr = Join-Path $Root "logs\web-local.err.log"

function Write-Step($Message) { Write-Host "[VTA ERP] $Message" -ForegroundColor Cyan }
function Test-Port($Port) { return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) }
function Stop-ProjectProcess($ProcessId) {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  if (-not $proc) { return $false }
  $cmd = [string]$proc.CommandLine
  $isProjectProcess = $cmd -like "*$Root*" -or $cmd -like "*npm-cli.js*run dev:api*" -or $cmd -like "*npm-cli.js*run dev:web*" -or $cmd -like "*next*dev*" -or $cmd -like "*nest*start*"
  $isNodeStack = $proc.Name -in @("node.exe", "npm.cmd", "cmd.exe", "powershell.exe")
  if ($isProjectProcess -or ($isNodeStack -and $cmd -like "*VTA-Software-Suite*")) {
    Write-Step "Arret du processus local VTA (PID $ProcessId, $($proc.Name))."
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    return $true
  }
  return $false
}
function Stop-PortOwner($Port) {
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    $ownerId = $connection.OwningProcess
    if (-not (Stop-ProjectProcess $ownerId)) {
      $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $ownerId" -ErrorAction SilentlyContinue
      if ($proc) { Write-Warning "Le port $Port est utilise par $($proc.Name) (PID $ownerId). Fermez ce processus puis relancez local:start." }
    }
  }
}
function Wait-Http($Url, $Seconds) {
  $limit = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $limit) {
    try { Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null; return $true } catch { Start-Sleep -Seconds 1 }
  }
  return $false
}

Set-Location $Root
New-Item -ItemType Directory -Force -Path (Join-Path $Root "logs") | Out-Null

Write-Step "Verification de PostgreSQL sur localhost:5432."
$pg = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue
if (-not $pg) { Write-Warning "PostgreSQL ne repond pas sur localhost:5432. Lancez PostgreSQL localement ou docker compose up -d." }

Write-Step "Liberation des ports 3000 et 3001 si un ancien serveur VTA les occupe."
Stop-PortOwner $WebPort
Stop-PortOwner $ApiPort
Start-Sleep -Seconds 3

if (Test-Port $WebPort) { throw "Le port 3000 est encore occupe par un processus non arrete." }
if (Test-Port $ApiPort) { throw "Le port 3001 est encore occupe par un processus non arrete." }

Write-Step "Demarrage de l'API sur http://localhost:3001."
Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev:api" -WorkingDirectory $Root -RedirectStandardOutput $ApiLog -RedirectStandardError $ApiErr -WindowStyle Hidden

Write-Step "Demarrage du Web sur http://localhost:3000."
Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev:web" -WorkingDirectory $Root -RedirectStandardOutput $WebLog -RedirectStandardError $WebErr -WindowStyle Hidden

Write-Step "Attente de l'API et du Web."
$apiOk = Wait-Http "http://localhost:3001/health" 45
$webOk = Wait-Http "http://localhost:3000" 60

if ($apiOk) { Write-Host "API OK: http://localhost:3001/health" -ForegroundColor Green } else { Write-Warning "API non joignable. Voir logs\api-local.err.log" }
if ($webOk) { Write-Host "Web OK: http://localhost:3000" -ForegroundColor Green } else { Write-Warning "Web non joignable. Voir logs\web-local.err.log" }

Write-Step "Ouverture du navigateur sur $LoginUrl"
Start-Process $LoginUrl
Write-Host "VTA ERP est lance. Utilisez npm run local:stop pour tout arreter." -ForegroundColor Green