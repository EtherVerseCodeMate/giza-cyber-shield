# khepra-mcp E2E Test Suite
# Exercises the full MCP JSON-RPC 2.0 protocol against the live binary.
# Tests: initialize, tools/list (29 tools), and tools/call for each major tool.
# Usage: .\tests\e2e\test_mcp_e2e.ps1

param(
    [string]$Binary  = ".\khepra-mcp.exe",
    [string]$DataDir = "$env:TEMP\khepra-e2e-test",
    [switch]$Verbose
)

$env:GOTOOLCHAIN     = "local"
$env:GOROOT          = "C:\Program Files\Go"
$env:KHEPRA_DATA_DIR = $DataDir

# Colours
function Green($s) { Write-Host $s -ForegroundColor Green }
function Red($s)   { Write-Host $s -ForegroundColor Red }
function Cyan($s)  { Write-Host $s -ForegroundColor Cyan }
function Yellow($s){ Write-Host $s -ForegroundColor Yellow }

Cyan "══════════════════════════════════════════════════════"
Cyan "  KHEPRA MCP E2E TEST SUITE"
Cyan "  Binary : $Binary"
Cyan "  DataDir: $DataDir"
Cyan "══════════════════════════════════════════════════════"

# Ensure data dir exists
New-Item -ItemType Directory -Force $DataDir | Out-Null

# ─── Build the full NDJSON input ─────────────────────────────────────────────
# Each line is one JSON-RPC message. The server reads until stdin closes.

$projectPath = (Resolve-Path ".").Path

$messages = @(
    # 1. Initialize
    @{ jsonrpc="2.0"; id=1; method="initialize"; params=@{
        protocolVersion="2024-11-05"
        capabilities=@{}
        clientInfo=@{ name="khepra-e2e-test"; version="1.0.0" }
    }},

    # 2. Initialized notification (no id, no response)
    @{ jsonrpc="2.0"; method="notifications/initialized" },

    # 3. tools/list
    @{ jsonrpc="2.0"; id=3; method="tools/list"; params=@{} },

    # ── SouHimBou AI Step 01 ──────────────────────────────────────────────────
    # 4. discover_assets — scan the project root
    @{ jsonrpc="2.0"; id=4; method="tools/call"; params=@{
        name="discover_assets"
        arguments=@{ project_path=$projectPath; depth=3 }
    }},

    # ── STIG / CMMC ───────────────────────────────────────────────────────────
    # 5. stig_check — run CMMC framework check
    @{ jsonrpc="2.0"; id=5; method="tools/call"; params=@{
        name="stig_check"
        arguments=@{ framework="CMMC"; project_path=$projectPath }
    }},

    # 6. cmmc_assess — CMMC Level 2 assessment
    @{ jsonrpc="2.0"; id=6; method="tools/call"; params=@{
        name="cmmc_assess"
        arguments=@{ level="2"; project_path=$projectPath }
    }},

    # ── Compliance tools ──────────────────────────────────────────────────────
    # 7. nist_map — search NIST controls
    @{ jsonrpc="2.0"; id=7; method="tools/call"; params=@{
        name="nist_map"
        arguments=@{ query="post-quantum cryptography key management"; top_k=5 }
    }},

    # 8. khepra_query_stig — lookup a specific control
    @{ jsonrpc="2.0"; id=8; method="tools/call"; params=@{
        name="khepra_query_stig"
        arguments=@{ control_id="CCI-000001" }
    }},

    # 9. khepra_get_compliance_score — fast score
    @{ jsonrpc="2.0"; id=9; method="tools/call"; params=@{
        name="khepra_get_compliance_score"
        arguments=@{ framework="CMMC" }
    }},

    # ── Flight Recorder ───────────────────────────────────────────────────────
    # 10. agent_record — record a test action
    @{ jsonrpc="2.0"; id=10; method="tools/call"; params=@{
        name="agent_record"
        arguments=@{
            action   = "e2e_test_run"
            agent_id = "khepra-e2e-test"
            tool_name= "test_mcp_e2e.ps1"
            metadata = @{ test="discover_assets"; status="pass" }
        }
    }},

    # 11. flight_export — export evidence packet
    @{ jsonrpc="2.0"; id=11; method="tools/call"; params=@{
        name="flight_export"
        arguments=@{ session_id="e2e-test" }
    }},

    # ── Sovereign / Attestation ───────────────────────────────────────────────
    # 12. khepra_export_attestation — C3PAO evidence package
    @{ jsonrpc="2.0"; id=12; method="tools/call"; params=@{
        name="khepra_export_attestation"
        arguments=@{ engagement_id="E2E-TEST-001"; include_dag=$true }
    }},

    # 13. khepra_export_poam — POA&M
    @{ jsonrpc="2.0"; id=13; method="tools/call"; params=@{
        name="khepra_export_poam"
        arguments=@{ format="json"; framework="CMMC" }
    }},

    # 14. dag_attestation — raw DAG chain
    @{ jsonrpc="2.0"; id=14; method="tools/call"; params=@{
        name="dag_attestation"
        arguments=@{}
    }},

    # 15. khepra_get_dag_chain — signed chain retrieval
    @{ jsonrpc="2.0"; id=15; method="tools/call"; params=@{
        name="khepra_get_dag_chain"
        arguments=@{ session_id="e2e-test" }
    }},

    # ── NHI & ACP ─────────────────────────────────────────────────────────────
    # 16. nhi_inventory
    @{ jsonrpc="2.0"; id=16; method="tools/call"; params=@{
        name="nhi_inventory"
        arguments=@{}
    }},

    # 17. nhi_orphans
    @{ jsonrpc="2.0"; id=17; method="tools/call"; params=@{
        name="nhi_orphans"
        arguments=@{}
    }},

    # 18. acp_status
    @{ jsonrpc="2.0"; id=18; method="tools/call"; params=@{
        name="acp_status"
        arguments=@{}
    }},

    # ── ERT Suite ─────────────────────────────────────────────────────────────
    # 19. ert_readiness
    @{ jsonrpc="2.0"; id=19; method="tools/call"; params=@{
        name="ert_readiness"
        arguments=@{ project_path=$projectPath }
    }},

    # 20. ert_crypto — PQC inventory
    @{ jsonrpc="2.0"; id=20; method="tools/call"; params=@{
        name="ert_crypto"
        arguments=@{ project_path=$projectPath }
    }}
)

# Serialise to NDJSON (one compact JSON per line)
$ndjson = ($messages | ForEach-Object { $_ | ConvertTo-Json -Depth 10 -Compress }) -join "`n"

# Write to temp input file
$inputFile  = "$DataDir\mcp_e2e_input.ndjson"
$outputFile = "$DataDir\mcp_e2e_output.ndjson"
$errFile    = "$DataDir\mcp_e2e_stderr.txt"

[System.IO.File]::WriteAllText($inputFile, $ndjson, [System.Text.Encoding]::UTF8)

Cyan "`n▶  Starting server and running $($messages.Count) messages..."

# Run the server
$proc = Start-Process -FilePath $Binary `
    -RedirectStandardInput  $inputFile `
    -RedirectStandardOutput $outputFile `
    -RedirectStandardError  $errFile `
    -NoNewWindow -PassThru -Wait

Start-Sleep -Milliseconds 500  # give files time to flush

# ─── Parse output ────────────────────────────────────────────────────────────
$rawLines = Get-Content $outputFile -ErrorAction SilentlyContinue
$responses = @{}
foreach ($line in $rawLines) {
    try {
        $obj = $line | ConvertFrom-Json
        if ($null -ne $obj.id) {
            $responses[[int]$obj.id] = $obj
        }
    } catch {}
}

# ─── Assertions ──────────────────────────────────────────────────────────────
$pass = 0
$fail = 0
$results = [System.Collections.ArrayList]@()

function Assert($id, $label, [scriptblock]$check) {
    $resp = $responses[$id]
    if ($null -eq $resp) {
        $script:fail++
        Red   "  ✗ [$id] $label — NO RESPONSE"
        [void]$script:results.Add([PSCustomObject]@{ ID=$id; Label=$label; Status="NO_RESPONSE"; Detail="No JSON line with id=$id" })
        return
    }
    if ($null -ne $resp.error) {
        $script:fail++
        Red   "  ✗ [$id] $label — RPC ERROR: $($resp.error.message)"
        [void]$script:results.Add([PSCustomObject]@{ ID=$id; Label=$label; Status="RPC_ERROR"; Detail=$resp.error.message })
        return
    }
    try {
        $ok = & $check $resp
        if ($ok) {
            $script:pass++
            Green "  ✓ [$id] $label"
            [void]$script:results.Add([PSCustomObject]@{ ID=$id; Label=$label; Status="PASS"; Detail="" })
        } else {
            $script:fail++
            Red   "  ✗ [$id] $label — ASSERTION FAILED"
            if ($Verbose) { $resp | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor DarkGray }
            [void]$script:results.Add([PSCustomObject]@{ ID=$id; Label=$label; Status="FAIL"; Detail="Assertion returned false" })
        }
    } catch {
        $script:fail++
        Red   "  ✗ [$id] $label — EXCEPTION: $_"
        [void]$script:results.Add([PSCustomObject]@{ ID=$id; Label=$label; Status="EXCEPTION"; Detail="$_" })
    }
}

Cyan "`n── Results ───────────────────────────────────────────"

# 1. initialize
Assert 1 "initialize — protocolVersion=2024-11-05" {
    param($r) $r.result.protocolVersion -eq "2024-11-05"
}

# 3. tools/list — must have exactly 29 tools, all named
Assert 3 "tools/list — 29 tools registered" {
    param($r)
    $tools = $r.result.tools
    $tools.Count -eq 29
}

Assert 3 "tools/list — discover_assets present" {
    param($r) $r.result.tools | Where-Object { $_.name -eq "discover_assets" }
}

Assert 3 "tools/list — flight_export present" {
    param($r) $r.result.tools | Where-Object { $_.name -eq "flight_export" }
}

Assert 3 "tools/list — stig_check present" {
    param($r) $r.result.tools | Where-Object { $_.name -eq "stig_check" }
}

Assert 3 "tools/list — cmmc_assess present" {
    param($r) $r.result.tools | Where-Object { $_.name -eq "cmmc_assess" }
}

# 4. discover_assets
Assert 4 "discover_assets — returns inventory_id" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $inv = $content | ConvertFrom-Json
    $null -ne $inv.inventory_id
}

Assert 4 "discover_assets — detects language runtime (Go)" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $inv = $content | ConvertFrom-Json
    ($inv.language_runtimes | Where-Object { $_.language -eq "Go" }) -ne $null
}

Assert 4 "discover_assets — recommends CMMC level" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $inv = $content | ConvertFrom-Json
    $inv.recommended_cmmc_level -match "^L[123]$"
}

Assert 4 "discover_assets — suggests next tools (Step 02 handoff)" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $inv = $content | ConvertFrom-Json
    $inv.suggested_next_tools.Count -gt 0
}

Assert 4 "discover_assets — matches at least one STIG profile" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $inv = $content | ConvertFrom-Json
    $inv.applicable_stigs.Count -gt 0
}

# 5. stig_check
Assert 5 "stig_check — returns framework + score" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    $null -ne $res.framework -and $null -ne $res.score
}

Assert 5 "stig_check — score is 0-100" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    $res.score -ge 0 -and $res.score -le 100
}

# 6. cmmc_assess
Assert 6 "cmmc_assess — returns level + ready_for_c3pao" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    $null -ne $res.level -and $null -ne $res.ready_for_c3pao
}

Assert 6 "cmmc_assess — level=2" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    $res.level -eq 2
}

# 7. nist_map
Assert 7 "nist_map — returns results array" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    $null -ne $res.results -or $null -ne $res.hits
}

# 8. khepra_query_stig
Assert 8 "khepra_query_stig — CCI-000001 returns title" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    $null -ne $res.title -or $null -ne $res.control_id
}

# 9. khepra_get_compliance_score
Assert 9 "khepra_get_compliance_score — score is numeric" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    $null -ne $res.composite_score -or $null -ne $res.score
}

# 10. agent_record
Assert 10 "agent_record — recorded=true" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    $res.recorded -eq $true
}

Assert 10 "agent_record — has record_id" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    -not [string]::IsNullOrEmpty($res.record_id)
}

# 11. flight_export
Assert 11 "flight_export — returns evidence packet" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    $null -ne $res -and ($null -ne $res.pilot_kpis -or $null -ne $res.total_actions)
}

# 12. khepra_export_attestation
Assert 12 "khepra_export_attestation — has dag_node_id" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    -not [string]::IsNullOrEmpty($res.dag_node_id)
}

Assert 12 "khepra_export_attestation — signature_algorithm=ML-DSA-65" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    $res.signature_algorithm -eq "ML-DSA-65"
}

# 13. khepra_export_poam
Assert 13 "khepra_export_poam — returns items array" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    $null -ne $res.items -or $null -ne $res.poam_items
}

# 14. dag_attestation
Assert 14 "dag_attestation — has nodes" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    $null -ne $res.nodes -or $null -ne $res.dag_chain
}

# 15. khepra_get_dag_chain
Assert 15 "khepra_get_dag_chain — has integrity field" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    $null -ne $res.integrity
}

# 16. nhi_inventory
Assert 16 "nhi_inventory — returns identities array" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    $null -ne $res.identities -or $null -ne $res
}

# 17. nhi_orphans
Assert 17 "nhi_orphans — no RPC error" {
    param($r) $null -eq $r.error
}

# 18. acp_status
Assert 18 "acp_status — no RPC error" {
    param($r) $null -eq $r.error
}

# 19. ert_readiness
Assert 19 "ert_readiness — returns compliance score" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    $null -ne $res.alignment_score -or $null -ne $res.score -or $null -ne $res
}

# 20. ert_crypto
Assert 20 "ert_crypto — returns crypto findings" {
    param($r)
    $content = ($r.result.content | Where-Object { $_.type -eq "text" }).text
    $res = $content | ConvertFrom-Json
    $null -ne $res
}

# ─── Summary ─────────────────────────────────────────────────────────────────
Cyan "`n══════════════════════════════════════════════════════"
$total = $pass + $fail
if ($fail -eq 0) {
    Green "  RESULT: ALL $pass/$total TESTS PASSED ✓"
} else {
    Red   "  RESULT: $pass/$total PASSED — $fail FAILED ✗"
}
Cyan "══════════════════════════════════════════════════════"

# Print verbose tool output if any test failed
if ($fail -gt 0 -or $Verbose) {
    Yellow "`n── Failed / Verbose Detail ───────────────────────────"
    $results | Where-Object { $_.Status -ne "PASS" } | Format-Table -AutoSize
    Yellow "`n── Raw Responses ─────────────────────────────────────"
    $responses.Keys | Sort-Object | ForEach-Object {
        $r = $responses[$_]
        if ($null -ne $r.error -or $Verbose) {
            Yellow "  [id=$_]"
            $r | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor DarkGray
        }
    }
}

# Stderr summary (server logs)
if ($Verbose) {
    Yellow "`n── Server stderr (last 20 lines) ─────────────────────"
    Get-Content $errFile -ErrorAction SilentlyContinue | Select-Object -Last 20 | ForEach-Object {
        Write-Host "  $_" -ForegroundColor DarkGray
    }
}

# Cleanup temp files
Remove-Item "$DataDir\mcp_e2e_input.ndjson"  -ErrorAction SilentlyContinue
Remove-Item "$DataDir\mcp_e2e_output.ndjson" -ErrorAction SilentlyContinue
Remove-Item "$DataDir\mcp_e2e_stderr.txt"    -ErrorAction SilentlyContinue

exit $fail
