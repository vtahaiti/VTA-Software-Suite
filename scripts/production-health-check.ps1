param(
  [string]$WebUrl = "https://vtaerp.com",
  [string]$AdminUrl = "https://admin.vtaerp.com",
  [string]$ApiUrl = "https://api.vtaerp.com",
  [string]$SuperAdminEmail = $env:SUPER_ADMIN_EMAIL,
  [string]$SuperAdminPassword = $env:SUPER_ADMIN_PASSWORD
)

$ErrorActionPreference = "Stop"

function Test-HttpOk {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 20 -UseBasicParsing
    return [pscustomobject]@{ url = $Url; ok = $response.StatusCode -ge 200 -and $response.StatusCode -lt 400; status = $response.StatusCode }
  } catch {
    return [pscustomobject]@{ url = $Url; ok = $false; status = $_.Exception.Message }
  }
}

function Invoke-JsonPost {
  param([string]$Url, [object]$Body)
  Invoke-RestMethod -Uri $Url -Method Post -ContentType "application/json" -Body ($Body | ConvertTo-Json -Compress) -TimeoutSec 30
}

$checks = @()
$checks += Test-HttpOk "$WebUrl"
$checks += Test-HttpOk "$AdminUrl/admin/login"
$checks += Test-HttpOk "$ApiUrl/health"

$ready = Invoke-RestMethod -Uri "$ApiUrl/health/ready" -TimeoutSec 30
$checks += [pscustomobject]@{ url = "$ApiUrl/health/ready"; ok = $ready.status -eq "ok"; status = "migrations=$($ready.migrations); uptime=$($ready.uptimeSeconds)s" }

if ($SuperAdminEmail -and $SuperAdminPassword) {
  $login = Invoke-JsonPost "$ApiUrl/auth/login" @{ email = $SuperAdminEmail; password = $SuperAdminPassword; rememberMe = $true }
  $stats = Invoke-RestMethod -Uri "$ApiUrl/platform/stats" -Headers @{ Authorization = "Bearer $($login.accessToken)" } -TimeoutSec 30
  $checks += [pscustomobject]@{ url = "$ApiUrl/platform/stats"; ok = $login.user.role -eq "SUPER_ADMIN"; status = "tenants=$($stats.totalTenants); role=$($login.user.role)" }
} else {
  $checks += [pscustomobject]@{ url = "$ApiUrl/platform/stats"; ok = $false; status = "SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD non definis" }
}

$checks | Format-Table -AutoSize

if ($checks.ok -contains $false) {
  exit 1
}
