#!/bin/bash
# =============================================================
# AdinKhepra VPS Deployment — Hostinger srv1494994
# Run as root: ssh root@187.124.225.91
# bash <(curl -s https://raw.githubusercontent.com/.../setup_vps.sh)
# OR: scp this file, then chmod +x setup_vps.sh && ./setup_vps.sh
# =============================================================
set -euo pipefail
DOMAIN="srv1494994.hstgr.cloud"
EMAIL="cyber@nouchix.com"          # For Let's Encrypt cert
KHEPRA_PORT=45444
TELEMETRY_PORT=8443
DEPLOY_DIR="/opt/adinkhepra"
DATA_DIR="/var/lib/adinkhepra"
LOG_DIR="/var/log/adinkhepra"

echo "================================================"
echo " AdinKhepra VPS Setup — $(date)"
echo "================================================"

# ── 1. System baseline ────────────────────────────
apt-get update -qq
apt-get install -y nginx certbot python3-certbot-nginx ufw fail2ban \
    curl wget git jq unzip ca-certificates gnupg2 --no-install-recommends

# ── 2. Firewall (keep SSH open!) ──────────────────
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH — NEVER REMOVE
ufw allow 80/tcp    # HTTP (cert challenge + redirect)
ufw allow 443/tcp   # HTTPS
ufw allow 45444/tcp # AdinKhepra API (rate-limited via nginx)
# Internal only — do not expose directly:
# ufw allow 8443/tcp  # Telemetry (nginx proxied only)
ufw --force enable
echo "✅ Firewall configured"

# ── 3. Fail2ban ───────────────────────────────────
cat > /etc/fail2ban/jail.local << 'FAIL2BAN'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5
[sshd]
enabled = true
[nginx-http-auth]
enabled = true
FAIL2BAN
systemctl restart fail2ban
echo "✅ Fail2ban configured"

# ── 4. Directory structure ────────────────────────
mkdir -p "$DEPLOY_DIR"/{bin,config,static}
mkdir -p "$DATA_DIR"/{dag,licenses,crl,telemetry}
mkdir -p "$LOG_DIR"
chmod 700 "$DATA_DIR"
echo "✅ Directories created"

# ── 5. Upload binaries (from your build machine) ──
# After running this script, upload your binaries:
#   scp bin/adinkhepra.exe root@187.124.225.91:/opt/adinkhepra/bin/adinkhepra
#   scp bin/apiserver.exe  root@187.124.225.91:/opt/adinkhepra/bin/apiserver
# The script creates placeholder check
if [ ! -f "$DEPLOY_DIR/bin/adinkhepra" ]; then
    echo "⚠️  Binary not yet uploaded. Upload and re-run, or continue setup."
    touch "$DEPLOY_DIR/bin/adinkhepra"
    touch "$DEPLOY_DIR/bin/apiserver"
fi
chmod +x "$DEPLOY_DIR"/bin/*

# ── 6. Config file ────────────────────────────────
cat > "$DEPLOY_DIR/config/server.json" << SERVERCONF
{
  "api_port": $KHEPRA_PORT,
  "telemetry_port": $TELEMETRY_PORT,
  "data_dir": "$DATA_DIR",
  "log_dir": "$LOG_DIR",
  "domain": "$DOMAIN",
  "offline_mode": false,
  "ai_provider": "anthropic",
  "ai_model": "claude-sonnet-4-6",
  "license_check_interval_hours": 24,
  "crl_ipfs_refresh_hours": 6,
  "dag_flush_interval_seconds": 5
}
SERVERCONF

# ── 7. Systemd service — AdinKhepra API ──────────
cat > /etc/systemd/system/adinkhepra.service << 'SYSD'
[Unit]
Description=AdinKhepra ASAF Engine
After=network.target
Wants=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/adinkhepra
ExecStart=/opt/adinkhepra/bin/adinkhepra serve \
    --config /opt/adinkhepra/config/server.json \
    --port 45444
Restart=always
RestartSec=5
StandardOutput=append:/var/log/adinkhepra/api.log
StandardError=append:/var/log/adinkhepra/api-error.log
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

# ── 8. Nginx config ───────────────────────────────
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

    # TLS (cert installed by certbot below)
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

    # G0DM0D3 / Dashboard UI
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

    # AdinKhepra API
    location /api/ {
        limit_req zone=api_limit burst=10 nodelay;
        proxy_pass http://127.0.0.1:$KHEPRA_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        # Auth header passthrough
        proxy_set_header Authorization \$http_authorization;
    }

    # DAG Server-Sent Events (no timeout)
    location /api/dag/stream {
        proxy_pass http://127.0.0.1:$KHEPRA_PORT;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        chunked_transfer_encoding on;
    }

    # Telemetry beacon endpoint (anonymous, rate-limited)
    location /beacon {
        limit_req zone=api_limit burst=5 nodelay;
        proxy_pass http://127.0.0.1:$TELEMETRY_PORT;
    }

    # CRL (license revocation list) — public
    location /crl {
        proxy_pass http://127.0.0.1:$TELEMETRY_PORT;
        add_header Cache-Control "public, max-age=3600";
    }
}
NGINXCONF

ln -sf /etc/nginx/sites-available/adinkhepra /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "✅ Nginx configured"

# ── 9. TLS certificate ────────────────────────────
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    -m "$EMAIL" --redirect || echo "⚠️  Certbot failed — run manually"

# ── 10. www-data ownership ────────────────────────
chown -R www-data:www-data "$DATA_DIR" "$LOG_DIR"
chown -R root:www-data "$DEPLOY_DIR"
chmod -R g+r "$DEPLOY_DIR"
echo "✅ Permissions set"

# ── 11. Enable and start services ─────────────────
systemctl daemon-reload
systemctl enable adinkhepra
systemctl start adinkhepra || echo "⚠️  Start failed — upload binary first"
echo "✅ Services enabled"

# ── 12. Log rotation ──────────────────────────────
cat > /etc/logrotate.d/adinkhepra << 'LOGROTATE'
/var/log/adinkhepra/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    postrotate
        systemctl reload adinkhepra || true
    endscript
}
LOGROTATE

echo ""
echo "================================================"
echo " SETUP COMPLETE"
echo " Dashboard: https://$DOMAIN"
echo " API:       https://$DOMAIN/api/"
echo " Telemetry: https://$DOMAIN/beacon"
echo ""
echo " NEXT: Upload your binaries:"
echo "   scp bin/adinkhepra root@187.124.225.91:/opt/adinkhepra/bin/"
echo "   scp bin/apiserver  root@187.124.225.91:/opt/adinkhepra/bin/"
echo "   systemctl restart adinkhepra"
echo "================================================"
