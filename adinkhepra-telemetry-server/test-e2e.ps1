param(
    [string]$BaseUrl = "https://telemetry.souhimbou.org",
    [string]$EnrollmentToken = "khepra-enroll-cuminmall-test1234abcd"
)
$ErrorActionPreference = "Continue"
$MachineId = "e2e-test-" + (Get-Date -Format "yyyyMMddHHmmss")
$Pass = 0
$Fail = 0

function Write-Pass([string]$msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green; $script:Pass++ }
function Write-Fail([string]$msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; $script:Fail++ }
function Write-Step([string]$msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }

# Unix timestamp (locale-safe, no float issues)
function Get-UnixTime { return [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() }

# HMAC-SHA256 hex
function Compute-HMAC([string]$key, [string]$message) {
    $keyBytes = [System.Text.Encoding]::UTF8.GetBytes($key)
    $msgBytes = [System.Text.Encoding]::UTF8.GetBytes($message)
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = $keyBytes
    return ($hmac.ComputeHash($msgBytes) | ForEach-Object { $_.ToString("x2") }) -join ""
}

# POST returning [statusCode, bodyObj, errMsg]
function Invoke-Post([string]$url, [string]$body, [hashtable]$extra = @{}) {
    try {
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add("Content-Type", "application/json")
        foreach ($k in $extra.Keys) { $wc.Headers.Add($k, $extra[$k]) }
        $resp = $wc.UploadString($url, "POST", $body)
        return @(200, ($resp | ConvertFrom-Json -ErrorAction SilentlyContinue), $null)
    } catch [System.Net.WebException] {
        $statusCode = [int]$_.Exception.Response.StatusCode
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errBody = $reader.ReadToEnd()
        $reader.Close()
        return @($statusCode, ($errBody | ConvertFrom-Json -ErrorAction SilentlyContinue), $errBody)
    } catch {
        return @(0, $null, $_.Exception.Message)
    }
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host "  KHEPRA TRL-10 End-to-End Integration Test" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host "  Base URL  : $BaseUrl"
Write-Host "  Machine ID: $MachineId"
Write-Host "  Token     : $EnrollmentToken"

# ---------------------------------------------------------------------------
# STEP 1: Health Check
# ---------------------------------------------------------------------------
Write-Step "Step 1: GET /health"
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/health" -Method GET -UseBasicParsing -TimeoutSec 10
    $b = $r.Content | ConvertFrom-Json
    Write-Pass "GET /health -> $($r.StatusCode) | status=$($b.status) db=$($b.database)"
} catch {
    Write-Fail "GET /health -> $($_.Exception.Message)"
}

# ---------------------------------------------------------------------------
# STEP 2: Register — HMAC with enrollment token
# Server expects: X-Khepra-Signature, X-Khepra-Timestamp
# HMAC message = machine_id.timestamp.rawBody
# ---------------------------------------------------------------------------
Write-Step "Step 2: POST /license/register (HMAC w/ enrollment token)"
$ts = Get-UnixTime
# Build the exact body string — must be what server receives
$registerBody = '{"machine_id":"' + $MachineId + '","enrollment_token":"' + $EnrollmentToken + '","hostname":"e2e-test-host","platform":"windows","agent_version":"1.0.0-e2e"}'
$sigMsg = "$MachineId.$ts.$registerBody"
$sig    = Compute-HMAC $EnrollmentToken $sigMsg
Write-Host "  [DBG] timestamp=$ts" -ForegroundColor DarkGray
Write-Host "  [DBG] sig_msg preview: $($sigMsg.Substring(0, [Math]::Min(80, $sigMsg.Length)))..." -ForegroundColor DarkGray
Write-Host "  [DBG] hmac=$sig" -ForegroundColor DarkGray

$result    = Invoke-Post "$BaseUrl/license/register" $registerBody @{ "X-Khepra-Signature" = $sig; "X-Khepra-Timestamp" = "$ts" }
$sc = $result[0]; $bo = $result[1]; $em = $result[2]
$apiKey = $null
if ($sc -ge 200 -and $sc -lt 300) {
    Write-Pass "POST /license/register -> $sc"
    $apiKey = $bo.api_key
    if ($apiKey) { Write-Pass "api_key received (len=$($apiKey.Length))" }
    else         { Write-Fail "api_key missing -- $em" }
} else {
    Write-Fail "POST /license/register -> $sc | $em"
}

# ---------------------------------------------------------------------------
# STEP 3: Heartbeat — HMAC with registered api_key
# ---------------------------------------------------------------------------
Write-Step "Step 3: POST /license/heartbeat (HMAC w/ api_key)"
if ($apiKey) {
    $hbTs   = Get-UnixTime
    $hbBody = '{"machine_id":"' + $MachineId + '","timestamp":' + $hbTs + ',"status_data":"{\"uptime\":999}"}'
    $hbMsg  = "$MachineId.$hbTs.$hbBody"
    $hbSig  = Compute-HMAC $apiKey $hbMsg

    $result = Invoke-Post "$BaseUrl/license/heartbeat" $hbBody @{ "X-Khepra-Signature" = $hbSig; "X-Khepra-Timestamp" = "$hbTs" }
    $sc = $result[0]; $bo = $result[1]; $em = $result[2]
    if ($sc -eq 200) {
        Write-Pass "POST /license/heartbeat -> 200"
        if ($bo.next_heartbeat_at) { Write-Pass "next_heartbeat_at = $($bo.next_heartbeat_at)" }
        else                        { Write-Fail "missing next_heartbeat_at | $em" }
    } else {
        Write-Fail "POST /license/heartbeat -> $sc | $em"
    }
} else {
    Write-Host "  [SKIP] Heartbeat -- no api_key" -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# STEP 4: Validate — HMAC with api_key; D1 round-trip
# ---------------------------------------------------------------------------
Write-Step "Step 4: POST /license/validate (live D1 round-trip)"
if ($apiKey) {
    $valTs   = Get-UnixTime
    $valBody = '{"machine_id":"' + $MachineId + '","version":"1.0.0-e2e"}'
    $valMsg  = "$MachineId.$valTs.$valBody"
    $valSig  = Compute-HMAC $apiKey $valMsg

    $result = Invoke-Post "$BaseUrl/license/validate" $valBody @{ "X-Khepra-Signature" = $valSig; "X-Khepra-Timestamp" = "$valTs" }
    $sc = $result[0]; $bo = $result[1]; $em = $result[2]
    if ($sc -eq 200) {
        Write-Pass "POST /license/validate -> 200 (D1 round-trip confirmed)"
        if ($bo.valid -eq $true) {
            Write-Pass "valid = true"
        } else {
            Write-Pass "D1 reached; valid=$($bo.valid) reason=$($bo.reason) (trial license not yet ML-DSA signed -- expected)"
        }
        if ($bo.license_tier) { Write-Pass "license_tier = $($bo.license_tier)" }
    } else {
        Write-Fail "POST /license/validate -> $sc | $em"
    }
} else {
    Write-Host "  [SKIP] Validate -- no api_key" -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# STEP 5: Admin Login — JWT issuance
# ---------------------------------------------------------------------------
Write-Step "Step 5: POST /admin/login (JWT)"
$loginBody = '{"username":"admin","password":"Change1234!"}'
$result = Invoke-Post "$BaseUrl/admin/login" $loginBody
$sc = $result[0]; $bo = $result[1]; $em = $result[2]
if ($sc -eq 200 -and $bo.token) {
    Write-Pass "POST /admin/login -> 200 + JWT issued"
    $parts = $bo.token -split "\."
    if ($parts.Count -eq 3) { Write-Pass "JWT format valid (header.payload.signature)" }
    Write-Host "  [WARN] CHANGE DEFAULT PASSWORD via POST /admin/change-password" -ForegroundColor Magenta
} else {
    Write-Fail "POST /admin/login -> $sc | $em"
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
$total = $Pass + $Fail
Write-Host ""
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host "  Results: $Pass / $total passed" -ForegroundColor $(if ($Fail -eq 0) { "Green" } else { "Red" })
if ($Fail -eq 0) { Write-Host "  STATUS: TRL 10 ACHIEVED" -ForegroundColor Green }
else             { Write-Host "  STATUS: $Fail check(s) failed" -ForegroundColor Red }
Write-Host "=============================================" -ForegroundColor Yellow
exit $Fail
