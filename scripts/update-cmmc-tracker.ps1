# =============================================================================
# update-cmmc-tracker.ps1
#
# PowerShell (5.1+) tracker generator for CMMC_TRACKER.md
# Parses all ASAF-GovCloud-SSP control .md files and emits a status table.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/update-cmmc-tracker.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/update-cmmc-tracker.ps1 -Check
#
#   -Check  Diff-check mode: exits 1 if tracker would change
# =============================================================================
[CmdletBinding()]
param([switch]$Check)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Off  # PS5.1 compat - don't error on unset vars

# Resolve repo root
$GitOutput = & git rev-parse --show-toplevel 2>&1
if ($LASTEXITCODE -eq 0) {
    $RepoRoot = $GitOutput.Trim() -replace '/', '\'
    # Handle WSL-style /mnt/c/... paths
    if ($RepoRoot -match '^/mnt/([a-z])/(.*)') {
        $RepoRoot = "$($Matches[1].ToUpper()):\$($Matches[2] -replace '/', '\')"
    }
} else {
    $RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
}

$SSPDir   = Join-Path $RepoRoot "ASAF-GovCloud-SSP"
$Tracker  = Join-Path $RepoRoot "CMMC_TRACKER.md"

# ── Family name table ─────────────────────────────────────────────────────────
$FamilyNames = @{
    '03.01' = 'Access Control (AC)'
    '03.02' = 'Awareness and Training (AT)'
    '03.03' = 'Audit and Accountability (AU)'
    '03.04' = 'Configuration Management (CM)'
    '03.05' = 'Identification and Authentication (IA)'
    '03.06' = 'Incident Response (IR)'
    '03.07' = 'Maintenance (MA)'
    '03.08' = 'Media Protection (MP)'
    '03.09' = 'Personnel Security (PS)'
    '03.10' = 'Physical Protection (PE)'
    '03.11' = 'Risk Assessment (RA)'
    '03.12' = 'Security Assessment (CA)'
    '03.13' = 'System and Communications Protection (SC)'
    '03.14' = 'System and Information Integrity (SI)'
    '03.15' = 'Planning (PL)'
    '03.16' = 'Supply Chain Risk Management (SR)'
    '03.17' = 'System and Services Acquisition (SA)'
}

$DomainAbbr = @{
    '01'='AC';'02'='AT';'03'='AU';'04'='CM';'05'='IA';'06'='IR'
    '07'='MA';'08'='MP';'09'='PS';'10'='PE';'11'='RA';'12'='CA'
    '13'='SC';'14'='SI';'15'='PL';'16'='SR';'17'='SA'
}

# Status labels (text-only for PS5.1 compatibility - renders well in markdown)
$Icons = @{
    'implemented'    = '[PASS]'
    'partial'        = '[PART]'
    'planned'        = '[PLAN]'
    'alternative'    = '[ALT] '
    'not-applicable' = '[N/A] '
    'unknown'        = '[?]  '
}

function Get-CMMCPractice([string]$CtrlId) {
    # CtrlId = "03.01.01"
    $parts   = $CtrlId -split '\.'
    $famNum  = $parts[1]
    $reqNum  = $parts[2]
    $domain  = if ($DomainAbbr.ContainsKey($famNum)) { $DomainAbbr[$famNum] } else { '??' }
    $major   = [int]$parts[0]
    $sub     = [int]$famNum
    $req     = [int]$reqNum
    return "${domain}.L2-${major}.${sub}.${req}"
}

function Get-StatusIcon([string]$Status) {
    if ($Icons.ContainsKey($Status)) { return $Icons[$Status] }
    return $Icons['unknown']
}

# ── Collect statuses ──────────────────────────────────────────────────────────
$CtrlStatus = @{}

Get-ChildItem -Path $SSPDir -Recurse -Filter "SP_800_171_*.md" | Sort-Object FullName | ForEach-Object {
    $fname = $_.BaseName
    if ($fname -match '^SP_800_171_(03\.\d{2}\.\d{2})$') {
        $ctrlId = $Matches[1]
        $content = Get-Content $_.FullName -ErrorAction SilentlyContinue
        $status  = 'unknown'
        foreach ($line in $content) {
            if ($line -match 'Implementation Status:') {
                if ($line -match '(implemented|partial|planned|alternative|not-applicable)') {
                    $status = $Matches[1]
                }
            }
        }
        $CtrlStatus[$ctrlId] = $status
    }
}

$Total            = $CtrlStatus.Count
$CountImplemented = @($CtrlStatus.Values | Where-Object { $_ -eq 'implemented' }).Count
$CountPartial     = @($CtrlStatus.Values | Where-Object { $_ -eq 'partial'     }).Count
$CountPlanned     = @($CtrlStatus.Values | Where-Object { $_ -eq 'planned'     }).Count
$CountAlt         = @($CtrlStatus.Values | Where-Object { $_ -eq 'alternative' }).Count
$CountNA          = @($CtrlStatus.Values | Where-Object { $_ -eq 'not-applicable' }).Count
$CountUnknown     = $Total - $CountImplemented - $CountPartial - $CountPlanned - $CountAlt - $CountNA

$ScoreNum = ($CountImplemented + $CountAlt + $CountNA) * 1.0 + $CountPartial * 0.5
$ScorePct = if ($Total -gt 0) { [math]::Round($ScoreNum / $Total * 100, 1) } else { 0 }

$GitSha = try { (& git rev-parse --short HEAD 2>&1).Trim() } catch { 'unknown' }
if ($LASTEXITCODE -ne 0) { $GitSha = 'unknown' }
$GeneratedAt = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')

# (no icon vars needed - using text labels directly in sb.AppendLine calls below)

# ── Build CMMC_TRACKER.md content ─────────────────────────────────────────────
$sb = New-Object System.Text.StringBuilder

$null = $sb.AppendLine("<!-- AUTO-GENERATED - DO NOT EDIT MANUALLY")
$null = $sb.AppendLine("     Source: ASAF-GovCloud-SSP/**/*.md")
$null = $sb.AppendLine("     Generator: scripts/update-cmmc-tracker.ps1 (Windows) / update-cmmc-tracker.sh (Linux CI)")
$null = $sb.AppendLine("     Regenerate: powershell -ExecutionPolicy Bypass -File scripts/update-cmmc-tracker.ps1")
$null = $sb.AppendLine("     Last updated: $GeneratedAt (commit $GitSha)")
$null = $sb.AppendLine("-->")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("# CMMC Level 2 Compliance Tracker - AdinKhepra / ASAF")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("**System**: AdinKhepra Secure Application Framework (ASAF)")
$null = $sb.AppendLine("**Organization**: SecRed Knowledge Inc. (NouchiX)")
$null = $sb.AppendLine("**Framework**: NIST SP 800-171 Rev 3 / CMMC Level 2")
$null = $sb.AppendLine("**Classification**: CUI // SP-CMMC")
$null = $sb.AppendLine("**Last Updated**: ``$GeneratedAt`` (commit ``$GitSha``)")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("---")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("## Summary Scorecard")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("| Metric | Count |")
$null = $sb.AppendLine("|--------|------:|")
$null = $sb.AppendLine("| [PASS] Implemented | **$CountImplemented** |")
$null = $sb.AppendLine("| [PART] Partial | **$CountPartial** |")
$null = $sb.AppendLine("| [PLAN] Planned | **$CountPlanned** |")
$null = $sb.AppendLine("| [ALT]  Alternative | **$CountAlt** |")
$null = $sb.AppendLine("| [N/A]  Not Applicable | **$CountNA** |")
$null = $sb.AppendLine("| **Total Controls** | **$Total** |")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("**Compliance Score**: ``${ScorePct}%`` *(implemented + alt + N/A = full credit; partial = 0.5 credit)*")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("> **Note**: CMMC Level 2 requires all 110 NIST SP 800-171 Rev 2 practices at")
$null = $sb.AppendLine("> ``implemented`` or ``alternative``. Rev 3 adds additional controls (03.01.16,")
$null = $sb.AppendLine("> 03.01.18, 03.01.20, 03.01.22) beyond the 110 required for CMMC L2.")
$null = $sb.AppendLine("> Current status reflects self-attestation only - C3PAO assessment not yet conducted.")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("---")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("## Controls by Family")

foreach ($family in ($FamilyNames.Keys | Sort-Object)) {
    $familyName = $FamilyNames[$family]
    $familyCtrls = @($CtrlStatus.Keys | Where-Object { $_ -like "$family.*" } | Sort-Object)
    if ($familyCtrls.Count -eq 0) { continue }

    $famImpl = 0; $famPartial = 0
    $famTotal = $familyCtrls.Count

    $null = $sb.AppendLine("")
    $null = $sb.AppendLine("### $family - $familyName")
    $null = $sb.AppendLine("")
    $null = $sb.AppendLine("| Control | CMMC Practice | Status | SSP Link |")
    $null = $sb.AppendLine("|---------|--------------|:------:|----------|")

    foreach ($ctrl in $familyCtrls) {
        $status   = $CtrlStatus[$ctrl]
        $icon     = Get-StatusIcon $status
        $practice = Get-CMMCPractice $ctrl
        $relPath  = "ASAF-GovCloud-SSP/SP_800_171_$family/SP_800_171_${ctrl}.md"
        $null = $sb.AppendLine("| ``$ctrl`` | ``$practice`` | $icon ``$status`` | [SSP]($relPath) |")

        if ($status -in @('implemented','alternative','not-applicable')) { $famImpl++ }
        elseif ($status -eq 'partial') { $famPartial++ }
    }

    $famScore = if ($famTotal -gt 0) { [math]::Round(($famImpl * 100 + $famPartial * 50) / $famTotal) } else { 0 }
    $null = $sb.AppendLine("")
    $null = $sb.AppendLine("**Family score**: ${famScore}% ($famImpl/$famTotal complete, $famPartial partial)")
}

$null = $sb.AppendLine("")
$null = $sb.AppendLine("---")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("## Legend")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("| Icon | Status | Meaning |")
$null = $sb.AppendLine("|------|--------|---------|")
$null = $sb.AppendLine("| [PASS] | ``implemented`` | Control fully implemented and operational |")
$null = $sb.AppendLine("| [PART] | ``partial`` | Implementation in progress or partially deployed |")
$null = $sb.AppendLine("| [PLAN] | ``planned`` | Implementation planned but not yet started |")
$null = $sb.AppendLine("| [ALT]  | ``alternative`` | Alternative implementation satisfies requirement |")
$null = $sb.AppendLine("| [N/A]  | ``not-applicable`` | Control not applicable to this system boundary |")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("## How This File Is Updated")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("This file is **automatically regenerated** whenever any SSP control file changes:")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("- **Git hook** (``.githooks/pre-commit``): Auto-regenerates on ``git commit`` touching ``ASAF-GovCloud-SSP/``")
$null = $sb.AppendLine("- **GitHub Action** (``.github/workflows/compliance-ssp.yml``): On push to main + weekly schedule")
$null = $sb.AppendLine("- **Manual (Windows)**: ``powershell -ExecutionPolicy Bypass -File scripts/update-cmmc-tracker.ps1``")
$null = $sb.AppendLine("- **Manual (Linux/CI)**: ``bash scripts/update-cmmc-tracker.sh``  OR  ``make cmmc-tracker``")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("To update a control's status, edit the **Implementation Status** line in the corresponding")
$null = $sb.AppendLine("``ASAF-GovCloud-SSP/SP_800_171_XX.YY/SP_800_171_XX.YY.md`` file and change the value:")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("Valid values: ``implemented`` | ``partial`` | ``planned`` | ``alternative`` | ``not-applicable``")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("---")
$null = $sb.AppendLine("")
$null = $sb.AppendLine("*Generated by [scripts/update-cmmc-tracker.ps1](scripts/update-cmmc-tracker.ps1)*")

$content = $sb.ToString()

# ── Check mode ────────────────────────────────────────────────────────────────
if ($Check) {
    if (Test-Path $Tracker) {
        $existing    = [System.IO.File]::ReadAllText($Tracker)
        $existingNorm = $existing -replace 'Last updated: [^\r\n]+', 'TIMESTAMP'
        $newNorm      = $content  -replace 'Last updated: [^\r\n]+', 'TIMESTAMP'
        if ($existingNorm -eq $newNorm) {
            Write-Host "PASS: CMMC_TRACKER.md is up to date"
            exit 0
        } else {
            Write-Host "FAIL: CMMC_TRACKER.md is out of date. Run: powershell -ExecutionPolicy Bypass -File scripts/update-cmmc-tracker.ps1"
            exit 1
        }
    } else {
        Write-Host "FAIL: CMMC_TRACKER.md does not exist."
        exit 1
    }
}

# ── Write tracker ─────────────────────────────────────────────────────────────
[System.IO.File]::WriteAllText($Tracker, $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "CMMC_TRACKER.md updated ($Total controls: $CountImplemented implemented, $CountPartial partial, $CountPlanned planned) - score: ${ScorePct}%"
