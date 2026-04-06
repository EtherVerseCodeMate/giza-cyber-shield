#!/usr/bin/env sh
# install-asaf.sh — ASAF Installer
# Usage: curl -sSL https://get.nouchix.com/asaf | sh
#
# Installs the ASAF binary for your platform.
# Verifies the binary checksum from the signed manifest.
# Requires: curl, sha256sum (Linux) or shasum (macOS)
#
# Environment variables:
#   ASAF_VERSION    - Specific version to install (default: latest)
#   ASAF_DIR        - Install directory (default: ~/.local/bin)
#   ASAF_NO_VERIFY  - Set to 1 to skip checksum verification (not recommended)

set -eu

# ── Configuration ──────────────────────────────────────────────────────────────
GITHUB_ORG="EtherVerseCodeMate"
GITHUB_REPO="giza-cyber-shield"
RELEASES_URL="https://github.com/${GITHUB_ORG}/${GITHUB_REPO}/releases"
BINARY_NAME="asaf"
INSTALL_DIR="${ASAF_DIR:-${HOME}/.local/bin}"

# Colors (safe fallback if no tty)
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; RESET=''
fi

log()  { printf "${CYAN}[ASAF]${RESET} %s\n" "$*"; }
ok()   { printf "${GREEN}[ASAF]${RESET} ✓ %s\n" "$*"; }
warn() { printf "${YELLOW}[ASAF]${RESET} ⚠ %s\n" "$*"; }
die()  { printf "${RED}[ASAF]${RESET} ✗ %s\n" "$*" >&2; exit 1; }

# ── Platform Detection ─────────────────────────────────────────────────────────
detect_platform() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"

  case "${OS}" in
    Linux)  OS_NAME="linux" ;;
    Darwin) OS_NAME="darwin" ;;
    MINGW*|MSYS*|CYGWIN*) OS_NAME="windows" ;;
    *) die "Unsupported operating system: ${OS}" ;;
  esac

  case "${ARCH}" in
    x86_64|amd64) ARCH_NAME="amd64" ;;
    aarch64|arm64) ARCH_NAME="arm64" ;;
    *) die "Unsupported architecture: ${ARCH}" ;;
  esac

  if [ "${OS_NAME}" = "windows" ]; then
    BINARY_FILE="${BINARY_NAME}-${OS_NAME}-${ARCH_NAME}.exe"
    INSTALL_NAME="${BINARY_NAME}.exe"
  else
    BINARY_FILE="${BINARY_NAME}-${OS_NAME}-${ARCH_NAME}"
    INSTALL_NAME="${BINARY_NAME}"
  fi

  log "Detected platform: ${BOLD}${OS_NAME}/${ARCH_NAME}${RESET}"
}

# ── Version Resolution ─────────────────────────────────────────────────────────
resolve_version() {
  if [ -n "${ASAF_VERSION:-}" ]; then
    VERSION="${ASAF_VERSION}"
    log "Installing requested version: ${BOLD}${VERSION}${RESET}"
  else
    log "Resolving latest version..."
    VERSION="$(curl -fsSL \
      "https://api.github.com/repos/${GITHUB_ORG}/${GITHUB_REPO}/releases/latest" \
      | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')"
    [ -n "${VERSION}" ] || die "Could not resolve latest version. Set ASAF_VERSION manually."
    log "Latest version: ${BOLD}${VERSION}${RESET}"
  fi
}

# ── Download & Verify ──────────────────────────────────────────────────────────
download_binary() {
  DOWNLOAD_URL="${RELEASES_URL}/download/${VERSION}/${BINARY_FILE}"
  CHECKSUM_URL="${RELEASES_URL}/download/${VERSION}/checksums.txt"
  TMP_DIR="$(mktemp -d)"
  TMP_BINARY="${TMP_DIR}/${BINARY_FILE}"

  log "Downloading ${BOLD}${BINARY_FILE}${RESET}..."
  log "From: ${DOWNLOAD_URL}"

  if ! curl -fsSL --progress-bar "${DOWNLOAD_URL}" -o "${TMP_BINARY}"; then
    die "Download failed. Check your network or version at:\n  ${RELEASES_URL}"
  fi

  # Checksum verification
  if [ "${ASAF_NO_VERIFY:-0}" = "1" ]; then
    warn "Checksum verification skipped (ASAF_NO_VERIFY=1). Not recommended."
  else
    log "Verifying SHA-256 checksum..."
    CHECKSUMS="${TMP_DIR}/checksums.txt"
    curl -fsSL "${CHECKSUM_URL}" -o "${CHECKSUMS}" 2>/dev/null || {
      warn "Could not fetch checksums.txt — skipping verification."
      warn "To manually verify: sha256sum ${TMP_BINARY}"
      SKIP_VERIFY=1
    }

    if [ "${SKIP_VERIFY:-0}" != "1" ]; then
      EXPECTED="$(grep "${BINARY_FILE}" "${CHECKSUMS}" | awk '{print $1}')"
      if [ -z "${EXPECTED}" ]; then
        warn "No checksum found for ${BINARY_FILE} — skipping verification"
      else
        if command -v sha256sum >/dev/null 2>&1; then
          ACTUAL="$(sha256sum "${TMP_BINARY}" | awk '{print $1}')"
        elif command -v shasum >/dev/null 2>&1; then
          ACTUAL="$(shasum -a 256 "${TMP_BINARY}" | awk '{print $1}')"
        else
          warn "No sha256sum/shasum found — skipping checksum verification"
          ACTUAL="${EXPECTED}"
        fi

        if [ "${ACTUAL}" = "${EXPECTED}" ]; then
          ok "Checksum verified: ${ACTUAL:0:16}..."
        else
          die "Checksum MISMATCH!\n  Expected: ${EXPECTED}\n  Got:      ${ACTUAL}\nDo NOT use this binary. Report to: security@nouchix.com"
        fi
      fi
    fi
  fi

  chmod +x "${TMP_BINARY}"
  VERIFIED_BINARY="${TMP_BINARY}"
}

# ── Install ────────────────────────────────────────────────────────────────────
install_binary() {
  # Create install dir if needed
  if [ ! -d "${INSTALL_DIR}" ]; then
    mkdir -p "${INSTALL_DIR}" || die "Cannot create ${INSTALL_DIR}. Try: mkdir -p ${INSTALL_DIR}"
  fi

  DEST="${INSTALL_DIR}/${INSTALL_NAME}"

  # Check if we need sudo
  if [ -w "${INSTALL_DIR}" ]; then
    cp "${VERIFIED_BINARY}" "${DEST}"
  else
    log "Need elevated permissions to install to ${INSTALL_DIR}"
    sudo cp "${VERIFIED_BINARY}" "${DEST}" || die "Installation failed."
  fi

  ok "Installed: ${BOLD}${DEST}${RESET}"
}

# ── PATH Check ─────────────────────────────────────────────────────────────────
check_path() {
  case ":${PATH}:" in
    *":${INSTALL_DIR}:"*) ;;
    *)
      warn "${INSTALL_DIR} is not in your PATH"
      warn "Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
      printf "\n  ${BOLD}export PATH=\"\$PATH:${INSTALL_DIR}\"${RESET}\n\n"
      ;;
  esac
}

# ── Post-Install ───────────────────────────────────────────────────────────────
print_next_steps() {
  printf "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
  printf "${BOLD}ASAF — Agentic Security Attestation Framework${RESET}\n"
  printf "${BOLD}by NouchiX / Sacred Knowledge Inc${RESET}\n"
  printf "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n\n"

  printf "  ${CYAN}Scan a target:${RESET}\n"
  printf "    ${BOLD}asaf scan --target <host-or-ip>${RESET}\n\n"

  printf "  ${CYAN}Get ADINKHEPRA certified (\$99/mo):${RESET}\n"
  printf "    ${BOLD}asaf certify --target <host> --out report.pdf${RESET}\n\n"

  printf "  ${CYAN}Add to your AI assistant (Claude Code, Cursor):${RESET}\n"
  printf "    ${BOLD}asaf mcp${RESET}\n\n"

  printf "  ${CYAN}Start local NLP Security Platform:${RESET}\n"
  printf "    ${BOLD}asaf serve-nlp${RESET}\n\n"

  printf "  ${CYAN}Documentation:${RESET}\n"
  printf "    https://docs.nouchix.com\n\n"

  printf "  ${CYAN}Security issues:${RESET}\n"
  printf "    security@nouchix.com\n\n"
  printf "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
}

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
  printf "\n${BOLD}${CYAN}Installing ASAF — Agentic Security Attestation Framework${RESET}\n\n"

  detect_platform
  resolve_version
  download_binary
  install_binary
  check_path
  print_next_steps
}

main "$@"
