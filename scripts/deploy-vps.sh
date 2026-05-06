#!/bin/bash
# =============================================================
# AdinKhepra VPS Deployment Script
# Uploads binary + restarts service on srv1494994.hstgr.cloud
#
# Usage (from Windows WSL or Git Bash):
#   bash scripts/deploy-vps.sh
#
# Prerequisites:
#   - Linux binary built: bin/adinkhepra-linux-amd64
#   - SSH key configured for root@187.124.225.91
# =============================================================
set -euo pipefail

VPS_HOST="root@187.124.225.91"
VPS_DOMAIN="srv1494994.hstgr.cloud"
BINARY="bin/adinkhepra-linux-amd64"
REMOTE_BIN="/opt/adinkhepra/bin/adinkhepra"
REMOTE_CONFIG="/opt/adinkhepra/config/server.json"

echo "═══════════════════════════════════════════════════════════════"
echo "  🔒 AdinKhepra VPS Deployment — $(date)"
echo "═══════════════════════════════════════════════════════════════"

# ── 1. Pre-flight checks ─────────────────────────────────
if [ ! -f "$BINARY" ]; then
    echo "❌ Binary not found: $BINARY"
    echo "   Build it first:"
    echo "   GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags=\"-s -w\" -o $BINARY ./cmd/adinkhepra"
    exit 1
fi

BINARY_SIZE=$(stat -c%s "$BINARY" 2>/dev/null || stat -f%z "$BINARY" 2>/dev/null || echo "unknown")
echo "  📦 Binary: $BINARY ($BINARY_SIZE bytes)"
echo "  🎯 Target: $VPS_HOST → $REMOTE_BIN"
echo ""

# ── 2. Upload binary ─────────────────────────────────────
echo "  ⏳ Uploading binary..."
scp "$BINARY" "$VPS_HOST:$REMOTE_BIN.new"

# ── 3. Atomic swap + restart on VPS ──────────────────────
echo "  ⏳ Swapping binary and restarting service..."
ssh "$VPS_HOST" bash -s <<'REMOTE_COMMANDS'
set -euo pipefail

REMOTE_BIN="/opt/adinkhepra/bin/adinkhepra"

# Make executable
chmod +x "${REMOTE_BIN}.new"

# Quick sanity check — binary runs without segfault
if ! "${REMOTE_BIN}.new" health 2>/dev/null; then
    echo "⚠️  Binary health check returned non-zero (may be expected if no DAG yet)"
fi

# Atomic swap: old → .bak, new → current
if [ -f "$REMOTE_BIN" ]; then
    mv "$REMOTE_BIN" "${REMOTE_BIN}.bak"
fi
mv "${REMOTE_BIN}.new" "$REMOTE_BIN"

# Ensure directories exist with correct permissions
mkdir -p /var/lib/adinkhepra/{dag,licenses,crl,telemetry}
mkdir -p /var/log/adinkhepra
chown -R www-data:www-data /var/lib/adinkhepra /var/log/adinkhepra

# Update systemd service to use 'watch' command
cat > /etc/systemd/system/adinkhepra.service << 'SYSD'
[Unit]
Description=AdinKhepra ASAF Engine — Security Camera + Flight Recorder
After=network.target
Wants=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/adinkhepra
Environment=KHEPRA_DAG_PATH=/var/lib/adinkhepra/dag
Environment=ADINKHEPRA_DEV=1
ExecStart=/opt/adinkhepra/bin/adinkhepra watch -port 45444
Restart=always
RestartSec=5
StandardOutput=append:/var/log/adinkhepra/asaf.log
StandardError=append:/var/log/adinkhepra/asaf-error.log
# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/adinkhepra /var/log/adinkhepra
PrivateTmp=yes
CapabilityBoundingSet=

[Install]
WantedBy=multi-user.target
SYSD

# Reload and restart
systemctl daemon-reload
systemctl enable adinkhepra
systemctl restart adinkhepra
sleep 2

# Verify it started
if systemctl is-active --quiet adinkhepra; then
    echo "✅ AdinKhepra service is RUNNING"
    # Test health endpoint
    if curl -sf http://127.0.0.1:45444/healthz > /dev/null 2>&1; then
        echo "✅ Health check PASSED"
    else
        echo "⚠️  Health endpoint not responding yet (may need a few seconds)"
    fi
else
    echo "❌ Service failed to start"
    journalctl -u adinkhepra --no-pager -n 20
    exit 1
fi
REMOTE_COMMANDS

# ── 4. Update Nginx config to include ASAF routes ────────
echo "  ⏳ Updating Nginx configuration..."
ssh "$VPS_HOST" bash -s <<'NGINX_UPDATE'
set -euo pipefail

DOMAIN="srv1494994.hstgr.cloud"
KHEPRA_PORT=45444

# Only update if the config doesn't already have ASAF routes
if ! grep -q "asaf/stream" /etc/nginx/sites-available/adinkhepra 2>/dev/null; then
    cat > /etc/nginx/sites-available/adinkhepra << NGINXCONF
# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=30r/m;
limit_req_zone \$binary_remote_addr zone=ui_limit:10m rate=60r/m;

server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # TLS (cert managed by certbot)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;

    # Dashboard UI
    location / {
        limit_req zone=ui_limit burst=20 nodelay;
        proxy_pass http://127.0.0.1:$KHEPRA_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
    }

    # AdinKhepra API (rate-limited)
    location /api/ {
        limit_req zone=api_limit burst=10 nodelay;
        proxy_pass http://127.0.0.1:$KHEPRA_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header Authorization \$http_authorization;
    }

    # ASAF SSE stream (no timeout, no buffering)
    location /api/asaf/stream {
        proxy_pass http://127.0.0.1:$KHEPRA_PORT;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding on;
    }

    # DAG SSE stream (no timeout)
    location /api/dag/stream {
        proxy_pass http://127.0.0.1:$KHEPRA_PORT;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        chunked_transfer_encoding on;
    }

    # G0DM0D3 AI chat (longer timeout for LLM responses)
    location /api/g0dm0d3/ {
        limit_req zone=api_limit burst=5 nodelay;
        proxy_pass http://127.0.0.1:$KHEPRA_PORT;
        proxy_read_timeout 120s;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # Health check (no rate limit)
    location /healthz {
        proxy_pass http://127.0.0.1:$KHEPRA_PORT;
    }

    # Telemetry beacon
    location /beacon {
        limit_req zone=api_limit burst=5 nodelay;
        proxy_pass http://127.0.0.1:$KHEPRA_PORT;
    }

    # CRL (license revocation list) — public, cacheable
    location /crl {
        proxy_pass http://127.0.0.1:$KHEPRA_PORT;
        add_header Cache-Control "public, max-age=3600";
    }
}
NGINXCONF

    ln -sf /etc/nginx/sites-available/adinkhepra /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    if nginx -t 2>/dev/null; then
        systemctl reload nginx
        echo "✅ Nginx updated with ASAF + G0DM0D3 routes"
    else
        echo "❌ Nginx config test failed"
        nginx -t
    fi
else
    echo "✅ Nginx already has ASAF routes — skipping"
fi
NGINX_UPDATE

# ── 5. Verify public endpoint ────────────────────────────
echo ""
echo "  ⏳ Verifying public endpoint..."
sleep 3
if curl -sf "https://$VPS_DOMAIN/healthz" > /dev/null 2>&1; then
    HEALTH=$(curl -sf "https://$VPS_DOMAIN/healthz")
    echo "  ✅ PUBLIC ENDPOINT LIVE: https://$VPS_DOMAIN/healthz"
    echo "     Response: $HEALTH"
else
    echo "  ⚠️  Public endpoint not responding — check Nginx/Certbot"
    echo "     Try: ssh $VPS_HOST 'curl -s http://127.0.0.1:45444/healthz'"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ DEPLOYMENT COMPLETE"
echo ""
echo "  🌐 Dashboard:  https://$VPS_DOMAIN"
echo "  📊 ASAF Feed:  https://$VPS_DOMAIN/api/asaf/stream"
echo "  🧠 G0DM0D3:    https://$VPS_DOMAIN/api/g0dm0d3/status"
echo "  🔍 DAG:        https://$VPS_DOMAIN/api/dag/nodes"
echo "  ❤️  Health:     https://$VPS_DOMAIN/healthz"
echo ""
echo "  📋 Logs: ssh $VPS_HOST 'journalctl -u adinkhepra -f'"
echo "═══════════════════════════════════════════════════════════════"
