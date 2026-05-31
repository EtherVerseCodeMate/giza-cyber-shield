#!/usr/bin/env bash
# =============================================================================
# trestle-assemble.sh
#
# Assembles the ASAF OSCAL System Security Plan from the trestle markdown
# author workspace (ASAF-GovCloud-SSP/) into system-security-plan.json.
#
# Wraps: compliance-trestle (https://github.com/oscal-compass/compliance-trestle)
#
# Usage:
#   ./scripts/trestle-assemble.sh [--validate-only]
#
#   --validate-only   Skip assembly, only validate existing SSP JSON if present
#
# Prerequisites:
#   pip install compliance-trestle  (auto-installed if missing in CI)
#   trestle workspace initialized at repo root (trestle.conf or .trestle/)
# =============================================================================

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || dirname "$(dirname "$(realpath "$0")")")"
SSP_NAME="ASAF-GovCloud-SSP"
SSP_OUT="system-security-plan"
VALIDATE_ONLY="${1:-}"

echo "=== ASAF Trestle SSP Assembly ==="
echo "    Root : ${REPO_ROOT}"
echo "    SSP  : ${SSP_NAME}"
echo "    Out  : ${SSP_OUT}.json"
echo ""

# ── Ensure compliance-trestle is installed ────────────────────────────────────
if ! command -v trestle &>/dev/null; then
  echo "📦 Installing compliance-trestle..."
  pip install compliance-trestle --quiet
fi

TRESTLE_VERSION="$(trestle version 2>/dev/null | head -1 || echo 'unknown')"
echo "🔧 Using trestle ${TRESTLE_VERSION}"

# ── Initialize trestle workspace if not present ───────────────────────────────
if [[ ! -f "${REPO_ROOT}/.trestle/config.yml" ]] && [[ ! -f "${REPO_ROOT}/trestle.conf" ]]; then
  echo "🏗  Initializing trestle workspace at ${REPO_ROOT}..."
  (cd "${REPO_ROOT}" && trestle init --verbose)
fi

# ── Validate-only mode ────────────────────────────────────────────────────────
if [[ "$VALIDATE_ONLY" == "--validate-only" ]]; then
  SSP_JSON="${REPO_ROOT}/system-security-plans/${SSP_OUT}/${SSP_OUT}.json"
  if [[ ! -f "$SSP_JSON" ]]; then
    echo "⚠️  No assembled SSP found at ${SSP_JSON} — run without --validate-only first"
    exit 1
  fi
  echo "🔍 Validating ${SSP_JSON}..."
  (cd "${REPO_ROOT}" && trestle validate -f "$SSP_JSON" -t system-security-plan)
  echo "✅ SSP OSCAL validation passed"
  exit 0
fi

# ── Import catalog if not present ────────────────────────────────────────────
# The profile references trestle://catalogs/NIST_SP-800-171_rev3/catalog.json
# If the catalog hasn't been fetched into the trestle workspace yet, fetch it.
CATALOG_PATH="${REPO_ROOT}/catalogs/NIST_SP-800-171_rev3/catalog.json"
if [[ ! -f "$CATALOG_PATH" ]]; then
  echo "📥 Fetching NIST SP 800-171 Rev 3 catalog..."
  (cd "${REPO_ROOT}" && \
    trestle href fetch \
      --href https://raw.githubusercontent.com/oscal-compass/oscal-content/main/nist.gov/SP800-171/rev3/SP_800-171_rev3_catalog.json \
      --caching \
      -t catalog \
      -n NIST_SP-800-171_rev3 2>/dev/null || \
    trestle import \
      -f https://raw.githubusercontent.com/oscal-compass/oscal-content/main/nist.gov/SP800-171/rev3/SP_800-171_rev3_catalog.json \
      -o NIST_SP-800-171_rev3 \
      -t catalog)
  echo "✅ Catalog imported: ${CATALOG_PATH}"
fi

# ── Import profile if not in trestle workspace ────────────────────────────────
PROFILE_PATH="${REPO_ROOT}/profiles/ASAF-CMMC-L2/profile.json"
if [[ ! -f "${REPO_ROOT}/profiles/ASAF-CMMC-L2/profile.json" ]]; then
  echo "❌ Profile not found: ${PROFILE_PATH}"
  exit 1
fi
echo "✅ Profile: ${PROFILE_PATH}"

# ── Run trestle author ssp-assemble ──────────────────────────────────────────
echo ""
echo "🔧 Assembling SSP from trestle markdown workspace..."
(cd "${REPO_ROOT}" && \
  trestle author ssp-assemble \
    -n "${SSP_NAME}" \
    -o "${SSP_OUT}" \
    -p "ASAF-CMMC-L2" \
    --verbose)

ASSEMBLED_JSON="${REPO_ROOT}/system-security-plans/${SSP_OUT}/${SSP_OUT}.json"

if [[ ! -f "$ASSEMBLED_JSON" ]]; then
  echo "❌ Assembly failed — ${ASSEMBLED_JSON} not found"
  exit 1
fi

echo ""
echo "✅ Assembled: ${ASSEMBLED_JSON}"

# ── Validate the assembled OSCAL JSON ────────────────────────────────────────
echo ""
echo "🔍 Validating OSCAL schema..."
(cd "${REPO_ROOT}" && trestle validate -f "$ASSEMBLED_JSON" -t system-security-plan)
echo "✅ OSCAL validation passed"

# ── Print summary ─────────────────────────────────────────────────────────────
SSP_SIZE=$(wc -c < "$ASSEMBLED_JSON" | tr -d ' ')
echo ""
echo "=== Assembly Complete ==="
echo "    Output  : ${ASSEMBLED_JSON}"
echo "    Size    : ${SSP_SIZE} bytes"
echo "    Commit  : $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
echo "    Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
