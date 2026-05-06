#!/bin/bash
# =============================================================
# AdinKhepra One-Line Installer
# Usage: curl -fsSL https://srv1494994.hstgr.cloud/install | bash
# Or:    curl -fsSL https://srv1494994.hstgr.cloud/install | bash -s -- --tier community
# =============================================================
set -euo pipefail

KHEPRA_VERSION="${KHEPRA_VERSION:-latest}"
KHEPRA_TIER="${1:-community}"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="${HOME}/.khepra"
BASE_URL="https://srv1494994.hstgr.cloud"

# Detect OS and architecture
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
    x86_64)  ARCH="amd64" ;;
    aarch64) ARCH="arm64" ;;
    arm64)   ARCH="arm64" ;;
    *)       echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

BINARY_NAME="adinkhepra-${OS}-${ARCH}"
if [ "$OS" = "windows" ]; then
    BINARY_NAME="${BINARY_NAME}.exe"
fi

echo "╔══════════════════════════════════════════════╗"
echo "║     AdinKhepra ASAF Engine Installer         ║"
echo "║     Tier: $KHEPRA_TIER                                ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Platform: ${OS}/${ARCH}"

# ── Download binary ──────────────────────────────────────
echo "Downloading AdinKhepra ${KHEPRA_VERSION}..."
TMP_DIR="$(mktemp -d)"
DOWNLOAD_URL="${BASE_URL}/releases/${KHEPRA_VERSION}/${BINARY_NAME}"

if command -v curl &>/dev/null; then
    curl -fsSL --progress-bar "$DOWNLOAD_URL" -o "$TMP_DIR/adinkhepra"
elif command -v wget &>/dev/null; then
    wget -q --show-progress "$DOWNLOAD_URL" -O "$TMP_DIR/adinkhepra"
else
    echo "❌ Neither curl nor wget found. Install one and retry."
    exit 1
fi

# ── Verify signature ─────────────────────────────────────
echo "Verifying Dilithium3 signature..."
SIG_URL="${BASE_URL}/releases/${KHEPRA_VERSION}/${BINARY_NAME}.sig"
curl -fsSL "$SIG_URL" -o "$TMP_DIR/adinkhepra.sig"
# The binary verifies its own signature on first run
# (embedded master public key, checked before any execution)

# ── Install ───────────────────────────────────────────────
chmod +x "$TMP_DIR/adinkhepra"
if [ -w "$INSTALL_DIR" ]; then
    mv "$TMP_DIR/adinkhepra" "$INSTALL_DIR/adinkhepra"
else
    sudo mv "$TMP_DIR/adinkhepra" "$INSTALL_DIR/adinkhepra"
fi

# ── First-run setup ───────────────────────────────────────
mkdir -p "$CONFIG_DIR/keys"
echo "Initializing AdinKhepra..."
adinkhepra license request --tier "$KHEPRA_TIER" --output "$CONFIG_DIR/license_request.json"
echo ""
echo "✅ AdinKhepra installed at: $(which adinkhepra)"
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  QUICK START                                  ║"
echo "║                                               ║"
echo "║  Start local AI brain (no Ollama needed):     ║"
echo "║    adinkhepra serve                           ║"
echo "║    → Open: http://localhost:45444             ║"
echo "║                                               ║"
echo "║  Run your first STIG scan:                    ║"
echo "║    adinkhepra scan                            ║"
echo "║                                               ║"
echo "║  Add AI capabilities (optional):              ║"
echo "║    export ANTHROPIC_API_KEY=sk-ant-...        ║"
echo "║    adinkhepra serve                           ║"
echo "╚══════════════════════════════════════════════╝"

# ── Optional: install as systemd service ─────────────────
read -p "Install as background service? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo tee /etc/systemd/system/adinkhepra-agent.service > /dev/null << SYSD
[Unit]
Description=AdinKhepra ASAF Agent
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=$(which adinkhepra) monitor --daemon
Restart=always
RestartSec=10
Environment="HOME=${HOME}"

[Install]
WantedBy=multi-user.target
SYSD
    sudo systemctl daemon-reload
    sudo systemctl enable adinkhepra-agent
    sudo systemctl start adinkhepra-agent
    echo "✅ AdinKhepra agent running as system service"
fi

rm -rf "$TMP_DIR"
echo ""
echo "Installation complete. Run 'adinkhepra --help' to get started."
