# sync_stig_csv.ps1
# Copies STIG_CCI_Map.csv from Product B (PQC-Khepra-MCP) to Product A (khepra protocol),
# recomputes the SHA-256 hash, and updates pkg/stig/data/CHECKSUMS.
#
# Usage:
#   .\scripts\sync_stig_csv.ps1           # copy + update CHECKSUMS
#   .\scripts\sync_stig_csv.ps1 -Check    # verify hashes match without copying
#
# Run as a pre-commit hook:
#   .git/hooks/pre-commit → pwsh -File scripts/sync_stig_csv.ps1 -Check
#
# Exits non-zero if the CSV was modified without updating CHECKSUMS (CI guard).

param(
    [switch]$Check   # Verify only; do not copy or update
)

$ErrorActionPreference = "Stop"

$repoRoot   = Split-Path $PSScriptRoot -Parent
$sourceCSV  = Join-Path $repoRoot "..\PQC-Khepra-MCP\pkg\stig\data\STIG_CCI_Map.csv"
$destCSV    = Join-Path $repoRoot "pkg\stig\data\STIG_CCI_Map.csv"
$checksums  = Join-Path $repoRoot "pkg\stig\data\CHECKSUMS"

function Get-FileSHA256 {
    param([string]$Path)
    $hash = Get-FileHash -Path $Path -Algorithm SHA256
    return $hash.Hash.ToLower()
}

function Read-PinnedHash {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $null }
    $line = Get-Content $Path | Where-Object { $_ -match "STIG_CCI_Map\.csv" } | Select-Object -First 1
    if ($line -match "sha256:([a-f0-9]{64})") { return $Matches[1] }
    return $null
}

if ($Check) {
    # Verify mode: assert the embedded CSV matches CHECKSUMS.
    if (-not (Test-Path $destCSV)) {
        Write-Error "FATAL: $destCSV not found."
        exit 1
    }
    $actual  = Get-FileSHA256 $destCSV
    $pinned  = Read-PinnedHash $checksums
    if ($null -eq $pinned) {
        Write-Error "FATAL: CHECKSUMS file missing or malformed at $checksums"
        exit 1
    }
    if ($actual -ne $pinned) {
        Write-Error @"
STIG CSV checksum mismatch!
  Expected (CHECKSUMS): $pinned
  Actual   (on disk):   $actual

Either:
  (a) Run .\scripts\sync_stig_csv.ps1 to sync from PQC-Khepra-MCP and update CHECKSUMS, or
  (b) Commit the updated CHECKSUMS file if you intentionally updated the CSV.
"@
        exit 1
    }
    Write-Host "OK: STIG_CCI_Map.csv SHA-256 matches CHECKSUMS ($actual)"
    exit 0
}

# Copy mode: sync from Product B and update CHECKSUMS.
if (-not (Test-Path $sourceCSV)) {
    Write-Error @"
Source CSV not found: $sourceCSV
Ensure PQC-Khepra-MCP is cloned as a sibling of the khepra protocol directory.
"@
    exit 1
}

Write-Host "Copying from: $sourceCSV"
Write-Host "         to:  $destCSV"
Copy-Item $sourceCSV $destCSV -Force

$newHash = Get-FileSHA256 $destCSV
Write-Host "SHA-256: $newHash"

# Update CHECKSUMS file.
$content = "sha256:$newHash  STIG_CCI_Map.csv`n"
Set-Content -Path $checksums -Value $content -Encoding utf8 -NoNewline

Write-Host "Updated CHECKSUMS: $checksums"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  git add pkg/stig/data/STIG_CCI_Map.csv pkg/stig/data/CHECKSUMS"
Write-Host "  git commit -m 'sync: update STIG_CCI_Map.csv from PQC-Khepra-MCP [sync-stig-csv]'"
