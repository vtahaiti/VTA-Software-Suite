$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$results = @()
function Add-Result($Name, $Ok, $Detail) { $script:results += [pscustomobject]@{ Verification = $Name; Etat = $(if($Ok){"OK"}else{"KO"}); Detail = $Detail } }

$envPath = Join-Path $Root ".env"
$nodeModules = Join-Path $Root "node_modules"
Add-Result ".env" (Test-Path $envPath) $envPath
$databaseUrlExists = $false
if (Test-Path $envPath) { $databaseUrlExists = [bool](Select-String -Path $envPath -Pattern "^DATABASE_URL=" -ErrorAction SilentlyContinue) }
Add-Result "DATABASE_URL" $databaseUrlExists "Variable DATABASE_URL dans .env"
Add-Result "node_modules" (Test-Path $nodeModules) $nodeModules
$pgOk = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue
Add-Result "PostgreSQL localhost:5432" $pgOk "Port 5432"
try { $api = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 3; Add-Result "API http://localhost:3001/health" ($api.status -eq "ok") ($api | ConvertTo-Json -Compress) } catch { Add-Result "API http://localhost:3001/health" $false $_.Exception.Message }
try { Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 3 | Out-Null; Add-Result "Web http://localhost:3000" $true "Web accessible" } catch { Add-Result "Web http://localhost:3000" $false $_.Exception.Message }
$results | Format-Table -AutoSize
if ($results.Etat -contains "KO") { exit 1 }
exit 0