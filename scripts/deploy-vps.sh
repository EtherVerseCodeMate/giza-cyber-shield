#!/bin/bash
# =============================================================
# AdinKhepra VPS Deployment
# Uploads binary + restarts service on srv1494994.hstgr.cloud
#
# Usage (from Git Bash, WSL, or PowerShell with ssh):
#   bash scripts/deploy-vps.sh
# =============================================================
set -euo pipefail

VPS_HOST="root@187.124.225.91"
VPS_DOMAIN="srv1494994.hstgr.cloud"
BINARY="bin/adinkhepra-linux-amd64"
REMOTE_BIN="/opt/adinkhepra/bin/adinkhepra"

echo "═══════════════════════════════════════════════════════════════"
echo "  🔒 AdinKhepra VPS Deployment — $(date)"
echo "═══════════════════════════════════════════════════════════════"

# ── 1. Pre-flight ─────────────────────────────────────────
if [ ! -f "$BINARY" ]; then
    echo "❌ Binary not found: $BINARY"
    echo "   Build first:"
    echo "   GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags='-s -w' -o $BINARY ./cmd/adinkhepra"
    exit 1
fi

BINARY_SIZE=$(wc -c < "$BINARY" 2>/dev/null || echo "unknown")
echo "  📦 Binary: $BINARY ($BINARY_SIZE bytes)"
echo "  🎯 Target: $VPS_HOST"
echo ""

# ── 2. Upload binary ─────────────────────────────────────
echo "  ⏳ Uploading binary..."
scp "$BINARY" "$VPS_HOST:${REMOTE_BIN}.new"
echo "  ✅ Upload complete"

# ── 3. Atomic swap + restart ─────────────────────────────
echo "  ⏳ Deploying on VPS..."
ssh "$VPS_HOST" bash -s <<'DEPLOY'
set -euo pipefail

REMOTE_BIN="/opt/adinkhepra/bin/adinkhepra"

chmod +x "${REMOTE_BIN}.new"

# Atomic swap
if [ -f "$REMOTE_BIN" ]; then
    mv "$REMOTE_BIN" "${REMOTE_BIN}.bak"
fi
mv "${REMOTE_BIN}.new" "$REMOTE_BIN"

# Ensure directories exist
mkdir -p /var/lib/adinkhepra/{dag,licenses,crl,telemetry}
mkdir -p /var/log/adinkhepra

# Create/update systemd service
cat > /etc/systemd/system/adinkhepra.service << 'SYSD'
[Unit]
Description=AdinKhepra ASAF Engine — Security Camera + Flight Recorder
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/adinkhepra
Environment=KHEPRA_DAG_PATH=/var/lib/adinkhepra/dag
ExecStart=/opt/adinkhepra/bin/adinkhepra watch -port 45444
Restart=always
RestartSec=5
StandardOutput=append:/var/log/adinkhepra/asaf.log
StandardError=append:/var/log/adinkhepra/asaf-error.log
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
SYSD

systemctl daemon-reload
systemctl enable adinkhepra
systemctl restart adinkhepra
sleep 2

if systemctl is-active --quiet adinkhepra; then
    echo "✅ AdinKhepra service is RUNNING"
    curl -sf http://127.0.0.1:45444/healthz 2>/dev/null && echo "" || echo "⚠️  Health endpoint warming up..."
else
    echo "❌ Service failed"
    journalctl -u adinkhepra --no-pager -n 15
    exit 1
fi
DEPLOY

# ── 4. Verify ────────────────────────────────────────────
echo ""
echo "  ⏳ Verifying public endpoint..."
sleep 2
if curl -sf "http://$VPS_DOMAIN:45444/healthz" 2>/dev/null; then
    echo ""
    echo "  ✅ PUBLIC ENDPOINT LIVE"
else
    echo "  ⚠️  Direct endpoint not responding (may need Caddy/firewall)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ DEPLOYMENT COMPLETE"
echo ""
echo "  🌐 Dashboard:  http://$VPS_DOMAIN:45444"
echo "  📊 ASAF Feed:  http://$VPS_DOMAIN:45444/api/asaf/stream"
echo "  🧠 G0DM0D3:    http://$VPS_DOMAIN:45444/api/g0dm0d3/status"
echo "  🔍 DAG:        http://$VPS_DOMAIN:45444/api/dag/nodes"
echo "  ❤️  Health:     http://$VPS_DOMAIN:45444/healthz"
echo ""
echo "  📋 Logs: ssh $VPS_HOST 'journalctl -u adinkhepra -f'"
echo "═══════════════════════════════════════════════════════════════"
