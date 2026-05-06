#!/bin/bash
# ================================================================
# PASTE THIS ENTIRE BLOCK INTO THE HOSTINGER VPS CONSOLE
# Fixes the recurrent SSH lockout + deploys AdinKhepra
# ================================================================
set -euo pipefail

echo "═══════════════════════════════════════════════════════════════"
echo "  🔧 AdinKhepra VPS Fix — $(date)"
echo "═══════════════════════════════════════════════════════════════"

# ── 1. FIX THE RECURRENT SSH LOCKOUT ─────────────────────
echo ""
echo "[1/6] Fixing SSH access (the recurrent problem)..."

# Allow SSH from ANY IP (not locked to Tailscale IP)
# This is safe because we still have key-only auth
ufw allow 22/tcp comment 'SSH - open'

# Also ensure Tailscale traffic is always allowed
ufw allow in on tailscale0 comment 'Tailscale'

# Open AdinKhepra port
ufw allow 45444/tcp comment 'AdinKhepra ASAF'

# Open ports for existing services
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 8443/tcp comment 'ASAF API'

# Remove any old restrictive SSH rules that lock to specific IPs
# (These are what cause the lockout after IP changes)
# List and delete any SSH rules restricted to specific IPs
ufw status numbered | grep "22/tcp.*ALLOW.*[0-9]" | grep -v "Anywhere" | while read -r line; do
    rule_num=$(echo "$line" | grep -oP '^\[\K[0-9]+')
    if [ -n "$rule_num" ]; then
        echo "  Removing restrictive SSH rule #${rule_num}: $line"
        yes | ufw delete "$rule_num" 2>/dev/null || true
    fi
done

# Disable password auth, force key-only (security hardening)
if ! grep -q "^PasswordAuthentication no" /etc/ssh/sshd_config; then
    sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
    systemctl reload sshd 2>/dev/null || systemctl reload ssh 2>/dev/null || true
fi

echo "✅ SSH fixed — open to all IPs, key-only auth"
ufw status | head -20

# ── 2. PREPARE ADINKHEPRA DIRECTORIES ────────────────────
echo ""
echo "[2/6] Creating AdinKhepra directories..."
mkdir -p /opt/adinkhepra/{bin,config,static}
mkdir -p /var/lib/adinkhepra/{dag,licenses,crl,telemetry}
mkdir -p /var/log/adinkhepra
chmod 700 /var/lib/adinkhepra
echo "✅ Directories ready"

# ── 3. CREATE SYSTEMD SERVICE (watch command) ────────────
echo ""
echo "[3/6] Installing AdinKhepra systemd service..."
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
echo "✅ Systemd service installed"

# ── 4. ADD CADDY REVERSE PROXY ROUTES ────────────────────
echo ""
echo "[4/6] Checking Caddy configuration..."

# Check if Caddy is configured and add AdinKhepra routes
CADDYFILE="/etc/caddy/Caddyfile"
if [ -f "$CADDYFILE" ]; then
    if ! grep -q "45444" "$CADDYFILE"; then
        echo "  Adding AdinKhepra reverse proxy to Caddy..."
        # Back up existing config
        cp "$CADDYFILE" "${CADDYFILE}.bak.$(date +%Y%m%d)"
        
        # Append AdinKhepra route block
        cat >> "$CADDYFILE" << 'CADDY'

# AdinKhepra ASAF Engine — Security Camera + Flight Recorder
:45444 {
    reverse_proxy localhost:45444
}
CADDY
        echo "  ✅ Caddy routes added"
    else
        echo "  ✅ Caddy already has AdinKhepra routes"
    fi
else
    echo "  ⚠️  No Caddyfile found at $CADDYFILE — will serve directly on :45444"
fi

# ── 5. CONFIGURE LOG ROTATION ────────────────────────────
echo ""
echo "[5/6] Configuring log rotation..."
cat > /etc/logrotate.d/adinkhepra << 'LOGROTATE'
/var/log/adinkhepra/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    postrotate
        systemctl reload adinkhepra 2>/dev/null || true
    endscript
}
LOGROTATE
echo "✅ Log rotation configured"

# ── 6. STATUS REPORT ─────────────────────────────────────
echo ""
echo "[6/6] Final status..."
echo ""
echo "  Services:"
echo "    asaf-api:     $(systemctl is-active asaf-api 2>/dev/null || echo 'not found')"
echo "    asaf-webhook: $(systemctl is-active asaf-webhook 2>/dev/null || echo 'not found')"
echo "    caddy:        $(systemctl is-active caddy 2>/dev/null || echo 'not found')"
echo "    cloudflared:  $(systemctl is-active cloudflared 2>/dev/null || echo 'not found')"
echo "    tailscaled:   $(systemctl is-active tailscaled 2>/dev/null || echo 'not found')"
echo "    docker:       $(systemctl is-active docker 2>/dev/null || echo 'not found')"
echo "    adinkhepra:   $(systemctl is-active adinkhepra 2>/dev/null || echo 'not installed yet')"
echo ""
echo "  Disk: $(df -h / | tail -1 | awk '{print $3 "/" $2 " used (" $5 ")"}')"
echo "  RAM:  $(free -h | grep Mem | awk '{print $3 "/" $2 " used"}')"
echo ""
echo "  Docker containers: $(docker ps -q 2>/dev/null | wc -l) running"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ VPS FIXED"
echo ""
echo "  SSH is now open to all IPs (key-only auth enforced)"
echo "  AdinKhepra systemd service is installed"
echo ""
echo "  NEXT: From your Windows machine, upload the binary:"
echo "    scp bin/adinkhepra-linux-amd64 root@187.124.225.91:/opt/adinkhepra/bin/adinkhepra"
echo "    ssh root@187.124.225.91 'chmod +x /opt/adinkhepra/bin/adinkhepra && systemctl restart adinkhepra'"
echo ""
echo "  Then verify:"
echo "    curl http://187.124.225.91:45444/healthz"
echo "═══════════════════════════════════════════════════════════════"
