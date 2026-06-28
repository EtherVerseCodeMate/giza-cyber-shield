#!/usr/bin/env bash
# =============================================================================
# cross_compile_arm7.sh
# NouchiX SecRed Knowledge Inc. | ASAF Edge Node - Build Pipeline
# Cross-compiles KASA agent + sonar binaries for Raspberry Pi 2B v1.1 (ARMv7)
#
# Run this on your DEV MACHINE (not the Pi)
# Requires: Go 1.23+, git access to giza-cyber-shield repo
#
# Output: ./dist/arm7/{agent, sonar}
# Transfer: scp ./dist/arm7/* pi@<PI_IP>:/tmp/khepra/
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

banner() {
  echo -e "${CYAN}${BOLD}"
  echo "  ╔═══════════════════════════════════════════════════════╗"
  echo "  ║   ADINKHEPRA ASAF — ARMv7 Cross-Compile Pipeline     ║"
  echo "  ║   Target: Raspberry Pi 2B v1.1 | GOARCH=arm GOARM=7  ║"
  echo "  ║   NouchiX SecRed Knowledge Inc. | USPTO #73565085     ║"
  echo "  ╚═══════════════════════════════════════════════════════╝"
  echo -e "${RESET}"
}

log()  { echo -e "${GREEN}[BUILD]${RESET} $*"; }
warn() { echo -e "${YELLOW}[WARN] ${RESET} $*"; }
fail() { echo -e "${RED}[FAIL] ${RESET} $*"; exit 1; }

# ── Config ────────────────────────────────────────────────────────────────────
MODULE="github.com/EtherVerseCodeMate/giza-cyber-shield"
VERSION="${VERSION:-1.0.0}"
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
DIST_DIR="./dist/arm7"

# ARMv7 cross-compile environment
export GOOS=linux
export GOARCH=arm
export GOARM=7          # ARMv7 = Cortex-A7 (Pi 2B)
export CGO_ENABLED=0    # Static binary, no cgo needed
export GO111MODULE=on

# Common ldflags — strip debug info, embed version metadata
BASE_LDFLAGS="-s -w -extldflags '-static'"

# ── Pre-flight checks ─────────────────────────────────────────────────────────
banner

log "Pre-flight checks..."

command -v go >/dev/null 2>&1 || fail "Go not found. Install Go 1.23+ first."
GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
log "Go version: ${GO_VERSION}"

[[ -f "go.mod" ]] || fail "go.mod not found. Run from repo root: cd path/to/giza-cyber-shield"
[[ -d "vendor" ]] || fail "vendor/ directory missing. Run: go mod vendor"

ACTUAL_MODULE=$(head -1 go.mod | awk '{print $2}')
[[ "${ACTUAL_MODULE}" == "${MODULE}" ]] || \
  warn "Module mismatch: expected ${MODULE}, got ${ACTUAL_MODULE}. Continuing..."

log "Module: ${ACTUAL_MODULE}"
log "Version: ${VERSION} | Build: ${BUILD_DATE} | Ref: ${VCS_REF}"
log "Target: ${GOOS}/${GOARCH} (GOARM=${GOARM}) — Pi 2B Cortex-A7"

# ── Prepare output directory ──────────────────────────────────────────────────
mkdir -p "${DIST_DIR}"
log "Output directory: ${DIST_DIR}"

# ── Build function ────────────────────────────────────────────────────────────
build_binary() {
  local name="$1"
  local entry="$2"
  local extra_ldflags="${3:-}"

  log "Building ${name}..."
  go build \
    -mod=vendor \
    -trimpath \
    -ldflags="${BASE_LDFLAGS} ${extra_ldflags}" \
    -tags=netgo \
    -o "${DIST_DIR}/${name}" \
    "${entry}"

  local size
  size=$(du -sh "${DIST_DIR}/${name}" | cut -f1)
  log "  ✓ ${name} → ${DIST_DIR}/${name} (${size})"
}

# ── Build targets ─────────────────────────────────────────────────────────────
log "Starting ARMv7 build pipeline..."
echo ""

# KASA Autonomous Security Agent — PRIMARY target for Pi deployment
build_binary "agent" "./cmd/agent/..." \
  "-X main.version=${VERSION} -X main.buildDate=${BUILD_DATE}"

# Sonar — Security scanner (Wedjat Eyes STIG/Vuln scanning)
build_binary "sonar" "./cmd/sonar/main.go" \
  "-X main.VERSION=${VERSION} -X main.BUILD_DATE=${BUILD_DATE} -X main.VCS_REF=${VCS_REF}"

# ── Verify binaries ───────────────────────────────────────────────────────────
echo ""
log "Verifying ARM binaries..."
for bin in agent sonar; do
  local_bin="${DIST_DIR}/${bin}"
  if file "${local_bin}" | grep -q "ARM"; then
    log "  ✓ ${bin}: $(file "${local_bin}" | grep -o 'ARM.*')"
  else
    warn "  ${bin}: unexpected format — $(file "${local_bin}")"
  fi
done

# ── Generate checksum manifest ────────────────────────────────────────────────
echo ""
log "Generating SHA256 manifest..."
pushd "${DIST_DIR}" > /dev/null
sha256sum agent sonar > SHA256SUMS
popd > /dev/null
log "  ✓ ${DIST_DIR}/SHA256SUMS"

# ── Transfer instructions ─────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}BUILD COMPLETE — Transfer to Pi with:${RESET}"
echo ""
echo -e "  ${YELLOW}# Copy binaries to Pi${RESET}"
echo -e "  scp -r ${DIST_DIR}/* pi@<PI_IP>:/tmp/khepra/"
echo ""
echo -e "  ${YELLOW}# Or use rsync for resumable transfer${RESET}"
echo -e "  rsync -avz --progress ${DIST_DIR}/ pi@<PI_IP>:/tmp/khepra/"
echo ""
echo -e "  ${YELLOW}# Then on the Pi, run:${RESET}"
echo -e "  sudo bash /home/pi/phantom_provision.sh"
echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════════${RESET}"
