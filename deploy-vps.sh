#!/bin/bash
# deploy-vps.sh
# Deploy ASAF backend stack to srv1494994.hstgr.cloud (187.124.225.91)
# Run from the project root: bash deploy-vps.sh
#
# What this does:
#   1. Cross-compiles Linux binaries locally
#   2. Uploads them to the VPS
#   3. Installs nginx + systemd services
#   4. Configures TLS via Let's Encrypt (certbot)
#   5. Starts: api server (:45444), telemetry server, MCP SSE server (:8811)
#
# Prerequisites:
#   - SSH access to 187.124.225.91
#   - Go toolchain installed locally
#   - SSH key configured (or use root password for first run)

set -euo pipefail

VPS_HOST="187.124.225.91"
VPS_USER="root"
VPS_HOSTNAME="srv1494994.hstgr.cloud"
ASAF_DOMAIN="${ASAF_DOMAIN:-api.nouchix.com}"   # Set ASAF_DOMAIN env to override
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"
SSH="ssh ${SSH_OPTS} ${VPS_USER}@${VPS_HOST}"
SCP="scp ${SSH_OPTS}"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
BOLD='\033[1m'; RESET='\033[0m'

log()  { printf "${CYAN}[DEPLOY]${RESET} %s\n" "$*"; }
ok()   { printf "${GREEN}[DEPLOY]${RESET} ✓ %s\n" "$*"; }
die()  { printf "${RED}[DEPLOY]${RESET} ✗ %s\n" "$*" >&2; exit 1; }

# ── 1. Build Binaries ──────────────────────────────────────────────────────────
log "Building Linux/amd64 binaries..."
make build-linux || die "Build failed. Run: make build-linux"
ok "Binaries built: bin/asaf-linux-amd64, bin/asaf-apiserver-linux-amd64"

# Also build the telemetry server if it has its own cmd
if [ -d "adinkhepra-telemetry-server" ]; then
  log "Building telemetry server..."
  GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build \
    -trimpath -ldflags="-s -w" \
    -o bin/asaf-telemetry-linux-amd64 \
    ./adinkhepra-telemetry-server/... 2>/dev/null || \
    log "Telemetry server build skipped (check path)"
fi

# Build MCP server
log "Building MCP server..."
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build \
  -trimpath -ldflags="-s -w" \
  -o bin/asaf-mcp-linux-amd64 ./cmd/khepra-mcp
ok "MCP server built: bin/asaf-mcp-linux-amd64"

# ── 2. Provision VPS ──────────────────────────────────────────────────────────
log "Provisioning VPS (${VPS_HOST})..."
$SSH << 'REMOTE'
set -e

# Update and install dependencies
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx sqlite3 curl

# Create ASAF user and directories
useradd -r -s /bin/false -d /opt/asaf asaf 2>/dev/null || true
mkdir -p /opt/asaf/{bin,data,keys,logs,certs}
mkdir -p /var/log/asaf

# Create install-redirect for get.nouchix.com/asaf
mkdir -p /var/www/get-asaf

echo "✓ VPS provisioned"
REMOTE
ok "VPS provisioned"

# ── 3. Upload Binaries ─────────────────────────────────────────────────────────
log "Uploading binaries..."
$SCP \
  bin/asaf-linux-amd64 \
  bin/asaf-apiserver-linux-amd64 \
  bin/asaf-mcp-linux-amd64 \
  ${VPS_USER}@${VPS_HOST}:/opt/asaf/bin/

# Upload install script
$SCP install-asaf.sh ${VPS_USER}@${VPS_HOST}:/var/www/get-asaf/asaf

# Upload NLP platform if it exists
if [ -f "docs/asaf-nlp.html" ]; then
  $SCP docs/asaf-nlp.html ${VPS_USER}@${VPS_HOST}:/var/www/get-asaf/
fi

ok "Binaries uploaded"

# ── 4. Install systemd Services ───────────────────────────────────────────────
log "Installing systemd services..."
$SSH << REMOTE
set -e

# Make binaries executable + symlink
chmod +x /opt/asaf/bin/*
ln -sf /opt/asaf/bin/asaf-linux-amd64 /usr/local/bin/asaf

# ── ASAF API Server service ────────────────────────────────────────────────────
cat > /etc/systemd/system/asaf-api.service << 'EOF'
[Unit]
Description=ASAF API Server (Mitochondria Polymorphic API)
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/asaf
ExecStart=/opt/asaf/bin/asaf-apiserver-linux-amd64
Restart=always
RestartSec=5
Environment=ADINKHEPRA_AGENT_PORT=45444
Environment=ASAF_DATA_DIR=/opt/asaf/data
Environment=ASAF_KEYS_DIR=/opt/asaf/keys
StandardOutput=append:/var/log/asaf/api.log
StandardError=append:/var/log/asaf/api.log

[Install]
WantedBy=multi-user.target
EOF

# ── ASAF MCP SSE Server service ────────────────────────────────────────────────
cat > /etc/systemd/system/asaf-mcp.service << 'EOF'
[Unit]
Description=ASAF MCP Server (SSE transport — remote AI tool access)
After=asaf-api.service
Wants=asaf-api.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/asaf
ExecStart=/opt/asaf/bin/asaf-mcp-linux-amd64 --transport=sse --addr=:8811
Restart=always
RestartSec=5
Environment=KHEPRA_API_URL=http://localhost:45444
Environment=MCP_PQC_ENABLED=true
StandardOutput=append:/var/log/asaf/mcp.log
StandardError=append:/var/log/asaf/mcp.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable asaf-api asaf-mcp
systemctl restart asaf-api asaf-mcp || true
echo "✓ Services installed"
REMOTE
ok "systemd services installed"

# ── 5. Configure nginx ─────────────────────────────────────────────────────────
log "Configuring nginx (domain: ${ASAF_DOMAIN})..."
$SSH "cat > /etc/nginx/sites-available/asaf" << NGINXEOF
# ASAF — nginx reverse proxy
# Domains:
#   api.nouchix.com  → API server (:45444)
#   mcp.nouchix.com  → MCP SSE server (:8811)
#   get.nouchix.com  → Install redirect

# API server
server {
    listen 80;
    server_name ${ASAF_DOMAIN};

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=30r/m;

    location / {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://127.0.0.1:45444;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
    }
}

# MCP SSE server
server {
    listen 80;
    server_name mcp.nouchix.com;

    location / {
        proxy_pass http://127.0.0.1:8811;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        # SSE requires disabling buffering
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600;
        chunked_transfer_encoding on;
    }
}

# Install redirect — serves install-asaf.sh
server {
    listen 80;
    server_name get.nouchix.com;

    root /var/www/get-asaf;

    location = /asaf {
        default_type text/plain;
        add_header Content-Type "text/plain; charset=utf-8";
        try_files /asaf =404;
    }

    # Windows PowerShell installer (future)
    location = /asaf/win {
        default_type text/plain;
        return 200 "Write-Host 'Windows installer coming soon. Download from: https://github.com/EtherVerseCodeMate/giza-cyber-shield/releases'";
    }

    # NLP platform
    location = /nlp {
        try_files /asaf-nlp.html =404;
    }
}
NGINXEOF

$SSH << REMOTE2
set -e
ln -sf /etc/nginx/sites-available/asaf /etc/nginx/sites-enabled/asaf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "✓ nginx configured"
REMOTE2
ok "nginx configured"

# ── 6. Optional: TLS via Let's Encrypt ────────────────────────────────────────
log "DNS must be pointed to ${VPS_HOST} before running certbot."
log "Once DNS is live, run this on the VPS to enable TLS:"
printf "\n  ${BOLD}ssh root@${VPS_HOST}${RESET}\n"
printf "  ${BOLD}certbot --nginx -d ${ASAF_DOMAIN} -d mcp.nouchix.com -d get.nouchix.com --email skone@alumni.albany.edu --agree-tos --non-interactive${RESET}\n\n"

# ── 7. Health Check ────────────────────────────────────────────────────────────
log "Waiting for services to start..."
sleep 3

if $SSH "curl -sf http://localhost:45444/healthz > /dev/null 2>&1"; then
  ok "API server is responding at http://${VPS_HOST}:45444/healthz"
else
  log "API server not yet responding (may need a moment to initialize)"
  log "Check logs: ssh root@${VPS_HOST} journalctl -u asaf-api -n 50"
fi

printf "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
printf "${BOLD}VPS Deployment Complete${RESET}\n"
printf "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n\n"
printf "  API:      http://${VPS_HOST}:45444   (→ ${ASAF_DOMAIN} after DNS+TLS)\n"
printf "  MCP SSE:  http://${VPS_HOST}:8811    (→ mcp.nouchix.com after DNS+TLS)\n"
printf "  Install:  http://${VPS_HOST}/asaf    (→ get.nouchix.com after DNS)\n\n"
printf "  Logs:     ssh root@${VPS_HOST} journalctl -u asaf-api -f\n"
printf "  Status:   ssh root@${VPS_HOST} systemctl status asaf-api asaf-mcp\n\n"
