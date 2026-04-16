#!/usr/bin/env bash
# =============================================================================
# AdinKhepra Protocol — Trestle Workspace Catalog Bootstrap
# =============================================================================
# Re-downloads NIST catalogs that are gitignored (10MB+ public content),
# applies the trestle v4 / OSCAL schema compatibility patch to 800-171r3,
# and imports them into the compliance-trestle workspace.
#
# Run this once per fresh clone, and any time you need to rebuild catalogs
# from scratch (e.g., after a `git clean -fdx`).
#
# Prerequisites:
#   - compliance-trestle v4.0.1+  (pip install compliance-trestle)
#   - Python 3.8+  (use .venv/Scripts/python on Windows)
#   - curl + jq
#   - Must be run from the workspace root (where .trestle/ lives)
#
# Usage:
#   cd "c:/Users/intel/blackbox/khepra protocol"
#   chmod +x aws-govcloud/scripts/trestle-setup.sh
#   ./aws-govcloud/scripts/trestle-setup.sh [--skip-import]
#
#   --skip-import   Download and patch only; skip `trestle import` (useful if
#                   you want to inspect the fixed JSON before importing).
# =============================================================================

set -euo pipefail

# ── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_err()   { echo -e "${RED}[FAIL]${NC}  $*" >&2; exit 1; }
log_step()  { echo -e "\n${BOLD}${CYAN}══ $* ══${NC}"; }

# ── Argument parsing ───────────────────────────────────────────────────────────
SKIP_IMPORT=false
for arg in "$@"; do
    case "$arg" in
        --skip-import) SKIP_IMPORT=true ;;
        --help|-h)
            grep '^#' "$0" | head -40 | sed 's/^# \?//'
            exit 0
            ;;
        *) log_err "Unknown argument: $arg"; ;;
    esac
done

# ── Guard: must be at workspace root ──────────────────────────────────────────
if [[ ! -f ".trestle/config.ini" ]]; then
    log_err "Must be run from the trestle workspace root (no .trestle/config.ini found here)."
fi

# ── Python resolution ─────────────────────────────────────────────────────────
# On Windows/MINGW64 the system 'python3' may be the Windows Store stub.
# Prefer the project venv, then fall back to the interpreter trestle is using.
if [[ -x ".venv/Scripts/python" ]]; then
    PYTHON=".venv/Scripts/python"
elif [[ -x ".venv/bin/python" ]]; then
    PYTHON=".venv/bin/python"
elif command -v python3 &>/dev/null && python3 -c "import sys; sys.exit(0 if sys.executable else 1)" 2>/dev/null; then
    PYTHON="python3"
elif command -v python &>/dev/null; then
    PYTHON="python"
else
    log_err "Python interpreter not found. Activate the project venv first."
fi
log_info "Using Python: $($PYTHON --version 2>&1) at $($PYTHON -c 'import sys; print(sys.executable)')"

# ── Trestle version check ─────────────────────────────────────────────────────
if ! command -v trestle &>/dev/null; then
    log_warn "trestle not found on PATH. Attempting via python -m trestle…"
    TRESTLE="$PYTHON -m trestle"
else
    TRESTLE="trestle"
    TRESTLE_VER=$(trestle version 2>/dev/null || echo "unknown")
    log_info "compliance-trestle: $TRESTLE_VER"
fi

# ── Catalog download URLs ──────────────────────────────────────────────────────
# NIST OSCAL content — official GitHub release assets (stable URLs, versioned).
# These are large public files; they are gitignored per .gitignore entry:
#   catalogs/    # 10MB+ public NIST content, re-downloadable

NIST_SP_800_53_R5_URL="https://raw.githubusercontent.com/usnistgov/oscal-content/refs/heads/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json"
NIST_SP_800_171_R3_URL="https://raw.githubusercontent.com/usnistgov/oscal-content/refs/heads/main/nist.gov/SP800-171/rev3/json/NIST_SP-800-171_rev3-catalog.json"

# Temporary download targets (Windows-safe absolute paths)
TMPDIR_TRESTLE="${TEMP:-/tmp}"
# On MINGW64, convert Windows TEMP to a path curl can write to
if [[ "$TMPDIR_TRESTLE" == *"\\"* ]]; then
    # Windows path — make it forward-slash for bash builtins, but keep for python
    TMPDIR_TRESTLE_FWD="${TMPDIR_TRESTLE//\\//}"
else
    TMPDIR_TRESTLE_FWD="$TMPDIR_TRESTLE"
fi

CATALOG_800_53_TMP="${TMPDIR_TRESTLE_FWD}/nist-800-53r5.json"
CATALOG_800_171_RAW="${TMPDIR_TRESTLE_FWD}/nist-800-171r3-raw.json"
CATALOG_800_171_FIXED="${TMPDIR_TRESTLE_FWD}/nist-800-171r3-fixed.json"

echo ""
echo "============================================================"
echo "  ADINKHEPRA — TRESTLE CATALOG BOOTSTRAP"
echo "  Workspace: $(pwd)"
echo "  Date:      $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "  Python:    $PYTHON"
echo "============================================================"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
log_step "Step 1 — Download NIST SP 800-53 Rev 5"
# ══════════════════════════════════════════════════════════════════════════════

log_info "Downloading from NIST OSCAL content repository…"
if curl -fsSL --retry 3 --retry-delay 5 \
    -o "$CATALOG_800_53_TMP" \
    "$NIST_SP_800_53_R5_URL"; then
    SIZE=$(wc -c < "$CATALOG_800_53_TMP" 2>/dev/null || echo "?")
    log_ok "NIST SP 800-53 Rev 5 downloaded (${SIZE} bytes)"
else
    log_err "Failed to download NIST SP 800-53 Rev 5. Check network / URL."
fi

# Basic sanity: must be valid JSON with a catalog key
if ! $PYTHON -c "
import json, sys
with open(r'${CATALOG_800_53_TMP}') as f:
    data = json.load(f)
assert 'catalog' in data, 'No catalog key found'
ctrl_count = len(data.get('catalog',{}).get('groups',[]))
print(f'  Catalog groups: {ctrl_count}')
"; then
    log_err "Downloaded SP 800-53 JSON failed sanity check."
fi
log_ok "SP 800-53 Rev 5 JSON structure validated."

# ══════════════════════════════════════════════════════════════════════════════
log_step "Step 2 — Download NIST SP 800-171 Rev 3"
# ══════════════════════════════════════════════════════════════════════════════

log_info "Downloading from NIST OSCAL content repository…"
if curl -fsSL --retry 3 --retry-delay 5 \
    -o "$CATALOG_800_171_RAW" \
    "$NIST_SP_800_171_R3_URL"; then
    SIZE=$(wc -c < "$CATALOG_800_171_RAW" 2>/dev/null || echo "?")
    log_ok "NIST SP 800-171 Rev 3 downloaded (${SIZE} bytes)"
else
    log_err "Failed to download NIST SP 800-171 Rev 3. Check network / URL."
fi

# ══════════════════════════════════════════════════════════════════════════════
log_step "Step 3 — Apply trestle v4 compatibility patch to 800-171r3"
# ══════════════════════════════════════════════════════════════════════════════
#
# Root cause: NIST's 800-171r3 OSCAL file contains params with empty string ""
# for the 'label' field. trestle v4 validates label against the OSCAL schema
# regex ^[^\n]+$ which requires 1+ non-newline characters.
#
# Known affected params:
#   groups[0].controls[7].params[3]   (control 03.01.08)
#   groups[0].controls[9].params[1]   (control 03.01.10)
#
# Fix: replace empty label strings with the param's id value.
# This patch is idempotent — safe to run multiple times.

log_info "Applying empty-label compatibility patch…"

$PYTHON - <<'PYEOF'
import json, sys

CATALOG_IN  = "${CATALOG_800_171_RAW}"
CATALOG_OUT = "${CATALOG_800_171_FIXED}"

# The f-string above won't expand inside a heredoc; use env interpolation:
import os
CATALOG_IN  = os.environ.get("_TRESTLE_RAW",  "${CATALOG_800_171_RAW}")
CATALOG_OUT = os.environ.get("_TRESTLE_FIXED", "${CATALOG_800_171_FIXED}")

# The heredoc approach doesn't expand shell variables reliably in all shells.
# Fall back: write the paths directly.
PYEOF

# Use a proper python invocation with paths passed via environment
_TRESTLE_RAW="$CATALOG_800_171_RAW" \
_TRESTLE_FIXED="$CATALOG_800_171_FIXED" \
$PYTHON - <<'PYEOF'
import json, os, sys

catalog_in  = os.environ["_TRESTLE_RAW"]
catalog_out = os.environ["_TRESTLE_FIXED"]

with open(catalog_in, encoding="utf-8") as f:
    data = json.load(f)

patch_count = 0

def fix_params(obj, path=""):
    global patch_count
    if isinstance(obj, list):
        for i, item in enumerate(obj):
            fix_params(item, f"{path}[{i}]")
    elif isinstance(obj, dict):
        if "params" in obj:
            for param in obj["params"]:
                if isinstance(param, dict) and param.get("label", "SENTINEL") == "":
                    old = param["label"]
                    param["label"] = param.get("id", "unlabeled")
                    patch_count += 1
                    print(f"  Patched param '{param.get('id')}': label '' → '{param['label']}'")
        for key, val in obj.items():
            if key != "params":
                fix_params(val, f"{path}.{key}")

fix_params(data)

with open(catalog_out, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

print(f"  Total patches applied: {patch_count}")
if patch_count == 0:
    print("  (No empty labels found — NIST may have fixed upstream)")
sys.exit(0)
PYEOF

log_ok "Compatibility patch applied → ${CATALOG_800_171_FIXED}"

# ══════════════════════════════════════════════════════════════════════════════
log_step "Step 4 — Validate patched catalogs"
# ══════════════════════════════════════════════════════════════════════════════

for catalog_file in "$CATALOG_800_53_TMP" "$CATALOG_800_171_FIXED"; do
    log_info "Validating JSON structure: $(basename $catalog_file)…"
    $PYTHON -c "
import json, sys
path = sys.argv[1]
with open(path, encoding='utf-8') as f:
    data = json.load(f)
assert 'catalog' in data
cat = data['catalog']
assert 'metadata' in cat
assert 'groups' in cat or 'controls' in cat, 'No groups or controls'
groups = cat.get('groups', [])
print(f'  Groups: {len(groups)}, Metadata title: {cat[\"metadata\"].get(\"title\",\"?\")}')
    " "$catalog_file" || log_err "Validation failed for $catalog_file"
    log_ok "$(basename $catalog_file) passed structure validation."
done

if [[ "$SKIP_IMPORT" == "true" ]]; then
    log_warn "--skip-import set. Skipping trestle import steps."
    echo ""
    log_info "Fixed catalog is at: $CATALOG_800_171_FIXED"
    log_info "Raw 800-53 catalog:  $CATALOG_800_53_TMP"
    echo ""
    echo "To import manually:"
    echo "  trestle import -f $CATALOG_800_53_TMP -o NIST_SP-800-53_rev5"
    echo "  trestle import -f $CATALOG_800_171_FIXED -o NIST_SP-800-171_rev3"
    exit 0
fi

# ══════════════════════════════════════════════════════════════════════════════
log_step "Step 5 — Import NIST SP 800-53 Rev 5 into trestle workspace"
# ══════════════════════════════════════════════════════════════════════════════

CATALOG_53_NAME="NIST_SP-800-53_rev5"
if [[ -d "catalogs/${CATALOG_53_NAME}" ]]; then
    log_warn "catalogs/${CATALOG_53_NAME} already exists — skipping import."
    log_info "To re-import, delete catalogs/${CATALOG_53_NAME} first."
else
    log_info "Importing NIST SP 800-53 Rev 5…"
    if $TRESTLE import -f "$CATALOG_800_53_TMP" -o "$CATALOG_53_NAME"; then
        log_ok "NIST SP 800-53 Rev 5 imported as '${CATALOG_53_NAME}'."
    else
        log_err "trestle import failed for 800-53 Rev 5."
    fi
fi

# ══════════════════════════════════════════════════════════════════════════════
log_step "Step 6 — Import NIST SP 800-171 Rev 3 (patched) into trestle workspace"
# ══════════════════════════════════════════════════════════════════════════════

CATALOG_171_NAME="NIST_SP-800-171_rev3"
if [[ -d "catalogs/${CATALOG_171_NAME}" ]]; then
    log_warn "catalogs/${CATALOG_171_NAME} already exists — skipping import."
    log_info "To re-import, delete catalogs/${CATALOG_171_NAME} first."
else
    log_info "Importing NIST SP 800-171 Rev 3 (patched)…"
    if $TRESTLE import -f "$CATALOG_800_171_FIXED" -o "$CATALOG_171_NAME"; then
        log_ok "NIST SP 800-171 Rev 3 imported as '${CATALOG_171_NAME}'."
    else
        log_err "trestle import failed for 800-171 Rev 3."
    fi
fi

# ══════════════════════════════════════════════════════════════════════════════
log_step "Step 7 — Validate imported catalogs in workspace"
# ══════════════════════════════════════════════════════════════════════════════

VALIDATE_FAILED=false

for cat_name in "$CATALOG_53_NAME" "$CATALOG_171_NAME"; do
    log_info "Validating catalog: ${cat_name}…"
    if $TRESTLE validate -t catalog --name "$cat_name" 2>&1 | grep -q "VALID"; then
        log_ok "catalog ${cat_name} — VALID"
    else
        OUTPUT=$($TRESTLE validate -t catalog --name "$cat_name" 2>&1 || true)
        log_warn "catalog ${cat_name} validation output:"
        echo "$OUTPUT" | head -20
        VALIDATE_FAILED=true
    fi
done

# ══════════════════════════════════════════════════════════════════════════════
log_step "Step 8 — Validate ASAF-CMMC-L2 profile resolves against 800-171r3"
# ══════════════════════════════════════════════════════════════════════════════

PROFILE_NAME="ASAF-CMMC-L2"
if [[ -d "profiles/${PROFILE_NAME}" ]]; then
    log_info "Validating profile: ${PROFILE_NAME}…"
    if $TRESTLE validate -t profile --name "$PROFILE_NAME" 2>&1 | grep -q "VALID"; then
        log_ok "profile ${PROFILE_NAME} — VALID"
    else
        OUTPUT=$($TRESTLE validate -t profile --name "$PROFILE_NAME" 2>&1 || true)
        log_warn "Profile validation output:"
        echo "$OUTPUT" | head -20
        VALIDATE_FAILED=true
    fi
else
    log_warn "profiles/${PROFILE_NAME} not found — skipping profile validation."
    log_info "If this is a fresh clone, the profile may not yet exist. Run:"
    log_info "  trestle author ssp-generate --profile ${PROFILE_NAME} --output ASAF-GovCloud-SSP"
fi

# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "============================================================"
if [[ "$VALIDATE_FAILED" == "true" ]]; then
    echo -e "  ${YELLOW}BOOTSTRAP COMPLETE WITH WARNINGS${NC}"
    echo "  One or more validations produced warnings — check output above."
else
    echo -e "  ${GREEN}BOOTSTRAP COMPLETE — ALL VALIDATIONS PASSED${NC}"
fi
echo ""
echo "  Catalogs available in workspace:"
echo "    catalogs/NIST_SP-800-53_rev5/"
echo "    catalogs/NIST_SP-800-171_rev3/"
echo ""
echo "  Next steps:"
echo "    1. trestle validate -t profile --name ASAF-CMMC-L2"
echo "    2. trestle author ssp-assemble \\"
echo "         --markdown ASAF-GovCloud-SSP \\"
echo "         --output ASAF-GovCloud-SSP \\"
echo "         --regenerate"
echo "    3. Continue populating SSP Markdown in ASAF-GovCloud-SSP/"
echo "============================================================"
echo ""
