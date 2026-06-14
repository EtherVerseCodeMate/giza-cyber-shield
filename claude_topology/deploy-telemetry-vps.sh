#!/bin/bash
# deploy-telemetry-vps.sh
# Deploys the Go telemetry server to Hostinger VPS
# Replaces Cloudflare Workers + D1 with sovereign VPS infrastructure
# Solves the FedRAMP blocker for DoD customers

VPS="root@187.124.225.91"
REMOTE_DIR="/opt/adinkhepra-telemetry"
BINARY_NAME="telemetry-server"
DOMAIN="telemetry.souhimbou.ai"

echo "╔══════════════════════════════════════════════════╗"
echo "║  Telemetry Server → VPS Deployment               ║"
echo "║  Replacing Cloudflare Workers                    ║"
echo "╚══════════════════════════════════════════════════╝"

# Step 1: Build for Linux
echo "[1/5] Building telemetry server for Linux..."
cd adinkhepra-telemetry-server 2>/dev/null || cd apps/telemetry
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 \
  go build -ldflags="-s -w" \
  -o "bin/$BINARY_NAME-linux-amd64" \
  ./...
echo "  ✅ Built: bin/$BINARY_NAME-linux-amd64"

# Step 2: Upload
echo "[2/5] Uploading to VPS..."
ssh $VPS "mkdir -p $REMOTE_DIR/bin $REMOTE_DIR/data"
scp "bin/$BINARY_NAME-linux-amd64" "$VPS:$REMOTE_DIR/bin/$BINARY_NAME"
ssh $VPS "chmod +x $REMOTE_DIR/bin/$BINARY_NAME"
echo "  ✅ Uploaded"

# Step 3: Config
echo "[3/5] Writing config..."
ssh $VPS "cat > $REMOTE_DIR/config.json << 'CONF'
{
  \"port\": 8443,
  \"data_dir\": \"$REMOTE_DIR/data\",
  \"master_pubkey_path\": \"$REMOTE_DIR/master_dilithium.pub\",
  \"enable_crl\": true,
  \"crl_path\": \"$REMOTE_DIR/data/crl.json\",
  \"allowed_origins\": [\"https://adinkhepra.com\", \"https://srv1494994.hstgr.cloud\"],
  \"rate_limit_per_min\": 30
}
CONF"

# Step 4: Systemd service
echo "[4/5] Installing systemd service..."
ssh $VPS "cat > /etc/systemd/system/adinkhepra-telemetry.service << 'SYSD'
[Unit]
Description=AdinKhepra Telemetry Server (sovereign)
After=network.target

[Service]
Type=simple
WorkingDirectory=$REMOTE_DIR
ExecStart=$REMOTE_DIR/bin/$BINARY_NAME --config $REMOTE_DIR/config.json
Restart=always
RestartSec=10
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=$REMOTE_DIR/data
StandardOutput=append:/var/log/adinkhepra/telemetry.log
StandardError=append:/var/log/adinkhepra/telemetry-error.log

[Install]
WantedBy=multi-user.target
SYSD
systemctl daemon-reload
systemctl enable adinkhepra-telemetry
systemctl start adinkhepra-telemetry"

# Step 5: Nginx config for telemetry subdomain
echo "[5/5] Configuring nginx for $DOMAIN..."
ssh $VPS "cat > /etc/nginx/sites-available/adinkhepra-telemetry << 'NGINX'
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.3 TLSv1.2;

    add_header Strict-Transport-Security 'max-age=63072000' always;

    location /beacon {
        limit_req zone=api_limit burst=5 nodelay;
        proxy_pass http://127.0.0.1:8443;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /crl {
        proxy_pass http://127.0.0.1:8443;
        add_header Cache-Control 'public, max-age=3600';
    }

    location /healthz {
        proxy_pass http://127.0.0.1:8443;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/adinkhepra-telemetry /etc/nginx/sites-enabled/
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m cyber@nouchix.com || echo 'Certbot: run manually if DNS not propagated yet'
nginx -t && systemctl reload nginx"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  TELEMETRY SERVER DEPLOYED                        ║"
echo "║                                                   ║"
echo "║  Endpoint: https://$DOMAIN                       ║"
echo "║  Beacon: https://$DOMAIN/beacon                 ║"
echo "║  CRL: https://$DOMAIN/crl                       ║"
echo "║                                                   ║"
echo "║  NEXT STEPS:                                      ║"
echo "║  1. Update DNS: $DOMAIN A → 187.124.225.91       ║"
echo "║  2. Test: curl https://$DOMAIN/healthz            ║"
echo "║  3. Update BEACON_URL in CLI config               ║"
echo "║  4. Decommission Cloudflare Worker (wrangler.toml)║"
echo "╚══════════════════════════════════════════════════╝"
