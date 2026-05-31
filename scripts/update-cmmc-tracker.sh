#!/usr/bin/env bash
# =============================================================================
# update-cmmc-tracker.sh
#
# Regenerates CMMC_TRACKER.md from the ASAF-GovCloud-SSP control markdown files.
# Run automatically by the pre-commit git hook and the compliance-ssp GitHub Action.
#
# Usage:
#   ./scripts/update-cmmc-tracker.sh [--check]
#
#   --check   Diff-only mode: exits 1 if CMMC_TRACKER.md would change (CI gate)
#
# Dependencies: bash, git, grep, awk, date — no pip/trestle required
# =============================================================================

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || dirname "$(dirname "$(realpath "$0")")")"
SSP_DIR="${REPO_ROOT}/ASAF-GovCloud-SSP"
TRACKER="${REPO_ROOT}/CMMC_TRACKER.md"
CHECK_MODE="${1:-}"

# ── NIST 800-171 Rev 3 family names ──────────────────────────────────────────
declare -A FAMILY_NAMES=(
  ["03.01"]="Access Control (AC)"
  ["03.02"]="Awareness and Training (AT)"
  ["03.03"]="Audit and Accountability (AU)"
  ["03.04"]="Configuration Management (CM)"
  ["03.05"]="Identification and Authentication (IA)"
  ["03.06"]="Incident Response (IR)"
  ["03.07"]="Maintenance (MA)"
  ["03.08"]="Media Protection (MP)"
  ["03.09"]="Personnel Security (PS)"
  ["03.10"]="Physical Protection (PE)"
  ["03.11"]="Risk Assessment (RA)"
  ["03.12"]="Security Assessment (CA)"
  ["03.13"]="System and Communications Protection (SC)"
  ["03.14"]="System and Information Integrity (SI)"
  ["03.15"]="Planning (PL)"
  ["03.16"]="Supply Chain Risk Management (SR)"
  ["03.17"]="System and Services Acquisition (SA)"
)

# ── CMMC L2 Practice ID mapping (NIST 800-171 control → CMMC practice) ───────
# Format: SP_800_171_03.XX.YY → AC.L2-3.X.Y (CMMC 2.0 Level 2 practices)
# CMMC L2 = all 110 NIST 800-171 Rev 2 controls, mapped 1:1
# Rev 3 adds new controls (03.01.16, 03.01.18, etc.) — those are CMMC L2+ scope
cmmc_practice() {
  local ctrl="$1"  # e.g. SP_800_171_03.01.01
  # Strip prefix, convert 03.01.01 → 3.1.1
  local nums="${ctrl#SP_800_171_}"  # 03.01.01
  local family="${nums%.*}"         # 03.01
  local req="${nums##*.}"           # 01

  # Remove leading zeros
  local fam_num="${family#0}"       # 3.01
  fam_num="${fam_num//.0/.}"        # 3.1
  fam_num="${fam_num%.*}.${fam_num##*.}"
  local req_num="${req#0}"          # 1

  # CMMC domain abbreviation from family
  local domain_num="${family%%.*}"  # 03
  domain_num="${domain_num#0}"      # 3
  local domain_abbr
  case "$domain_num" in
    1)  domain_abbr="AC" ;;
    2)  domain_abbr="AT" ;;
    3)  domain_abbr="AU" ;;
    4)  domain_abbr="CM" ;;
    5)  domain_abbr="IA" ;;
    6)  domain_abbr="IR" ;;
    7)  domain_abbr="MA" ;;
    8)  domain_abbr="MP" ;;
    9)  domain_abbr="PS" ;;
    10) domain_abbr="PE" ;;
    11) domain_abbr="RA" ;;
    12) domain_abbr="CA" ;;
    13) domain_abbr="SC" ;;
    14) domain_abbr="SI" ;;
    15) domain_abbr="PL" ;;
    16) domain_abbr="SR" ;;
    17) domain_abbr="SA" ;;
    *)  domain_abbr="??" ;;
  esac

  echo "${domain_abbr}.L2-${fam_num}.${req_num}"
}

# Status emoji
status_icon() {
  case "$1" in
    implemented)    echo "✅" ;;
    partial)        echo "🔶" ;;
    planned)        echo "⬜" ;;
    alternative)    echo "🔷" ;;
    not-applicable) echo "➖" ;;
    *)              echo "❓" ;;
  esac
}

# ── Collect data ──────────────────────────────────────────────────────────────
declare -A CTRL_STATUS
declare -A CTRL_FILE

while IFS= read -r -d '' mdfile; do
  filename="$(basename "$mdfile" .md)"
  # Match SP_800_171_03.XX.YY
  if [[ "$filename" =~ ^SP_800_171_(03\.[0-9]{2}\.[0-9]{2})$ ]]; then
    ctrl_id="${BASH_REMATCH[1]}"
    # Extract implementation status line
    status_line="$(grep -i "Implementation Status:" "$mdfile" 2>/dev/null | tail -1 || true)"
    status="$(echo "$status_line" | grep -oiE '(implemented|partial|planned|alternative|not-applicable)' | head -1 || echo 'unknown')"
    CTRL_STATUS["$ctrl_id"]="$status"
    CTRL_FILE["$ctrl_id"]="$mdfile"
  fi
done < <(find "$SSP_DIR" -name "SP_800_171_*.md" -print0 | sort -z)

TOTAL=${#CTRL_STATUS[@]}
COUNT_IMPLEMENTED=$(printf '%s\n' "${CTRL_STATUS[@]}" | grep -c "^implemented$" || true)
COUNT_PARTIAL=$(printf '%s\n' "${CTRL_STATUS[@]}" | grep -c "^partial$" || true)
COUNT_PLANNED=$(printf '%s\n' "${CTRL_STATUS[@]}" | grep -c "^planned$" || true)
COUNT_ALT=$(printf '%s\n' "${CTRL_STATUS[@]}" | grep -c "^alternative$" || true)
COUNT_NA=$(printf '%s\n' "${CTRL_STATUS[@]}" | grep -c "^not-applicable$" || true)
COUNT_UNKNOWN=$(( TOTAL - COUNT_IMPLEMENTED - COUNT_PARTIAL - COUNT_PLANNED - COUNT_ALT - COUNT_NA ))

# Score: implemented=1.0, partial=0.5, alternative=1.0, not-applicable=1.0, planned=0, unknown=0
SCORE_NUM=$(echo "scale=4; ($COUNT_IMPLEMENTED + $COUNT_ALT + $COUNT_NA) * 1.0 + $COUNT_PARTIAL * 0.5" | bc)
SCORE_PCT=$(echo "scale=1; if ($TOTAL > 0) $SCORE_NUM / $TOTAL * 100 else 0" | bc)

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
GENERATED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# ── Build CMMC_TRACKER.md ──────────────────────────────────────────────────────
TMPFILE="$(mktemp)"
trap 'rm -f "$TMPFILE"' EXIT

cat >> "$TMPFILE" << HEADER
<!--
  AUTO-GENERATED — DO NOT EDIT MANUALLY
  Source: ASAF-GovCloud-SSP/**/*.md
  Generator: scripts/update-cmmc-tracker.sh
  Regenerate: make cmmc-tracker
  Last updated: ${GENERATED_AT} (commit ${GIT_SHA})
-->

# CMMC Level 2 Compliance Tracker — AdinKhepra / ASAF

**System**: AdinKhepra Secure Application Framework (ASAF)
**Organization**: SecRed Knowledge Inc. (NouchiX)
**Framework**: NIST SP 800-171 Rev 3 / CMMC Level 2
**Classification**: CUI // SP-CMMC
**Last Updated**: \`${GENERATED_AT}\` (commit \`${GIT_SHA}\`)

---

## Summary Scorecard

| Metric | Count |
|--------|------:|
| ✅ Implemented | **${COUNT_IMPLEMENTED}** |
| 🔶 Partial | **${COUNT_PARTIAL}** |
| ⬜ Planned | **${COUNT_PLANNED}** |
| 🔷 Alternative | **${COUNT_ALT}** |
| ➖ Not Applicable | **${COUNT_NA}** |
| ❓ Unknown | **${COUNT_UNKNOWN}** |
| **Total Controls** | **${TOTAL}** |

**Compliance Score**: \`${SCORE_PCT}%\` *(implemented + alt + N/A = full credit; partial = 0.5 credit)*

> [!NOTE]
> CMMC Level 2 requires **all 110 NIST SP 800-171 Rev 2** practices at \`implemented\` or \`alternative\`.
> Rev 3 adds additional controls (e.g., 03.01.16, 03.01.18, 03.01.20, 03.01.22) beyond the 110 required for CMMC L2.
> Current status reflects self-attestation only — C3PAO assessment has not been conducted.

---

## Controls by Family

HEADER

# Sort family keys
readarray -t SORTED_FAMILIES < <(printf '%s\n' "${!FAMILY_NAMES[@]}" | sort)

for family in "${SORTED_FAMILIES[@]}"; do
  family_name="${FAMILY_NAMES[$family]}"

  # Get controls in this family
  readarray -t FAMILY_CTRLS < <(printf '%s\n' "${!CTRL_STATUS[@]}" | grep "^${family}\." | sort)

  if [[ ${#FAMILY_CTRLS[@]} -eq 0 ]]; then
    continue
  fi

  fam_impl=0
  fam_partial=0
  fam_planned=0

  cat >> "$TMPFILE" << FAM_HEADER

### ${family} — ${family_name}

| Control | CMMC Practice | Status | SSP Link |
|---------|--------------|:------:|----------|
FAM_HEADER

  for ctrl in "${FAMILY_CTRLS[@]}"; do
    status="${CTRL_STATUS[$ctrl]}"
    icon="$(status_icon "$status")"
    practice="$(cmmc_practice "SP_800_171_${ctrl}")"
    rel_path="ASAF-GovCloud-SSP/SP_800_171_${family}/SP_800_171_${ctrl}.md"
    ctrl_display="${ctrl}"

    echo "| \`${ctrl_display}\` | \`${practice}\` | ${icon} \`${status}\` | [SSP](${rel_path}) |" >> "$TMPFILE"

    case "$status" in
      implemented|alternative|not-applicable) (( fam_impl++ )) ;;
      partial) (( fam_partial++ )) ;;
      *) (( fam_planned++ )) ;;
    esac
  done

  fam_total=${#FAMILY_CTRLS[@]}
  fam_score=$(echo "scale=0; ($fam_impl * 100 + $fam_partial * 50) / $fam_total" | bc)
  echo "" >> "$TMPFILE"
  echo "**Family score**: ${fam_score}% (${fam_impl}/${fam_total} complete, ${fam_partial} partial)" >> "$TMPFILE"
done

cat >> "$TMPFILE" << LEGEND

---

## Legend

| Icon | Status | Meaning |
|------|--------|---------|
| ✅ | \`implemented\` | Control fully implemented and operational |
| 🔶 | \`partial\` | Implementation in progress or partially deployed |
| ⬜ | \`planned\` | Implementation planned but not yet started |
| 🔷 | \`alternative\` | Alternative implementation satisfies requirement |
| ➖ | \`not-applicable\` | Control not applicable to this system boundary |

## How This File Is Updated

This file is **automatically regenerated** whenever any SSP control file changes:

- **Git hook** (\`.githooks/pre-commit\`): Runs on every \`git commit\` that touches \`ASAF-GovCloud-SSP/\`
- **GitHub Action** (\`.github/workflows/compliance-ssp.yml\`): Runs on every push to \`main\` + weekly schedule
- **Manual**: \`make cmmc-tracker\`

To update a control's status, edit the **Implementation Status** line in the corresponding
\`ASAF-GovCloud-SSP/SP_800_171_XX.YY/SP_800_171_XX.YY.md\` file:

\`\`\`markdown
#### Implementation Status: implemented
\`\`\`

Valid values: \`implemented\` | \`partial\` | \`planned\` | \`alternative\` | \`not-applicable\`

---

*Generated by [scripts/update-cmmc-tracker.sh](scripts/update-cmmc-tracker.sh) — do not edit manually.*
LEGEND

# ── Check mode: diff and exit ─────────────────────────────────────────────────
if [[ "$CHECK_MODE" == "--check" ]]; then
  if diff -q "$TRACKER" "$TMPFILE" > /dev/null 2>&1; then
    echo "✅ CMMC_TRACKER.md is up to date"
    exit 0
  else
    echo "❌ CMMC_TRACKER.md is out of date. Run: make cmmc-tracker"
    diff "$TRACKER" "$TMPFILE" | head -40 || true
    exit 1
  fi
fi

# ── Write tracker ─────────────────────────────────────────────────────────────
cp "$TMPFILE" "$TRACKER"
echo "✅ CMMC_TRACKER.md updated (${TOTAL} controls: ${COUNT_IMPLEMENTED} implemented, ${COUNT_PARTIAL} partial, ${COUNT_PLANNED} planned) — score: ${SCORE_PCT}%"

# ── Regression check: warn if implemented count dropped vs. last commit ───────
if git show HEAD:"$(git ls-files --full-name "$TRACKER" 2>/dev/null || echo CMMC_TRACKER.md)" > /tmp/tracker_prev.md 2>/dev/null; then
  PREV_IMPL=$(grep -c "^| \`.*\` | \`.*\` | ✅" /tmp/tracker_prev.md 2>/dev/null || echo 0)
  if [[ "$COUNT_IMPLEMENTED" -lt "$PREV_IMPL" ]]; then
    echo "⚠️  REGRESSION: implemented count dropped from ${PREV_IMPL} to ${COUNT_IMPLEMENTED}" >&2
    exit 2
  fi
fi
