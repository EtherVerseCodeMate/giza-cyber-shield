#!/bin/bash
# deploy-vps.sh — ASAF VPS: Static Dist + Stripe Webhook + Docs
#
# Scope (what this VPS does):
#   ✅ Serve install-asaf.sh + checksums (static, behind TLS)
#   ✅ Serve docs (MCP setup, quickstart)
#   ✅ Stripe webhook receiver (stateless, idempotent Go service)
#   ✅ Optional: release artifact mirror for restricted networks
#
#   ❌ NOT: public ASAF API server (that runs on customer machines)
#   ❌ NOT: Ollama / model weights (customer-local only)
#   ❌ NOT: multi-tenant SaaS (future decision, not now)
#
# Usage: bash deploy-vps.sh
# Prereqs: Go toolchain, SSH access to VPS

set -euo pipefail

VPS_HOST="187.124.225.91"
VPS_USER="${VPS_USER:-asaf}"        # non-root deploy user
DEPLOY_EMAIL="skone@alumni.albany.edu"
SKIP_BASELINE="${SKIP_BASELINE:-0}" # set to 1 if Phase 1 already done
SSH_KEY="${HOME}/.ssh/id_ed25519"

SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -i ${SSH_KEY}"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
log() { printf "${CYAN}[DEPLOY]${RESET} %s\n" "$*"; }
ok()  { printf "${GREEN}[DEPLOY]${RESET} ✓ %s\n" "$*"; }
die() { printf "${RED}[DEPLOY]${RESET} ✗ %s\n" "$*" >&2; exit 1; }

# ── Phase 0: Build webhook service binary ─────────────────────────────────────
log "Building Stripe webhook service..."
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build \
  -trimpath -ldflags="-s -w" \
  -o bin/asaf-webhook-linux-amd64 \
  ./cmd/webhook 2>/dev/null || {
    log "webhook cmd not yet built — skipping binary upload"
    SKIP_WEBHOOK_BIN=1
  }

# ── Phase 1: Security Baseline (idempotent — safe to re-run) ─────────────────
if [ "${SKIP_BASELINE}" = "1" ]; then
  log "Phase 1: Skipping baseline (SKIP_BASELINE=1)"
else
  log "Phase 1: Security baseline (needs root with key auth)..."
  # Note: requires root key auth. If root is locked, set SKIP_BASELINE=1
  ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 \
    -i "${SSH_KEY}" root@${VPS_HOST} << 'BASELINE'
set -e

# Create non-root deploy user if absent
if ! id asaf &>/dev/null; then
  adduser --disabled-password --gecos "ASAF Deploy" asaf
  usermod -aG sudo asaf
  echo "asaf ALL=(ALL) NOPASSWD:/bin/systemctl restart asaf-*" >> /etc/sudoers.d/asaf
fi

# Harden SSH (idempotent sed)
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
systemctl reload ssh

# UFW: default deny, allow only 22/80/443 + Docker subnet → host services
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp  comment 'SSH'
ufw allow 80/tcp  comment 'HTTP (redirect to HTTPS)'
ufw allow 443/tcp comment 'HTTPS'
# Allow NPM Docker containers to reach host-bound services
ufw allow from 172.19.0.0/16 to any port 8080 comment 'Caddy static (Docker→host)'
ufw allow from 172.19.0.0/16 to any port 8081 comment 'Caddy docs (Docker→host)'
ufw allow from 172.19.0.0/16 to any port 4242 comment 'ASAF webhook (Docker→host)'
ufw --force enable

# Automatic security updates
apt-get install -y -qq unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

# Install Caddy (Ubuntu 24.04 / noble)
if ! command -v caddy &>/dev/null; then
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  rm -f /etc/apt/sources.list.d/caddy-stable.list
  echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/ubuntu noble main" \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy
fi

# Create dirs
mkdir -p /var/www/asaf/{releases,docs}
id asaf &>/dev/null && chown -R asaf:asaf /var/www/asaf
mkdir -p /opt/asaf/bin /opt/asaf/secrets
id asaf &>/dev/null && chown -R asaf:asaf /opt/asaf

echo "✓ Security baseline complete"
BASELINE
  ok "Security baseline applied"
fi

# ── Phase 2: Install deploy user SSH key ─────────────────────────────────────
# Key: eban:prod nkyinkyim:v1 (skone@alumni.albany.edu)
ASAF_PUBKEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKJMvbsYQSfBo6tTFKGC7gkr6LXRX+OCMejXIVLWxq8T skone@alumni.albany.edu eban:prod nkyinkyim:v1"

log "Installing SSH key for asaf user..."
# Connect as asaf (key already seeded via console); idempotent — won't duplicate
ssh ${SSH_OPTS} asaf@${VPS_HOST} "
  mkdir -p ~/.ssh
  grep -qF '${ASAF_PUBKEY}' ~/.ssh/authorized_keys 2>/dev/null \
    || echo '${ASAF_PUBKEY}' >> ~/.ssh/authorized_keys
  chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys
"
ok "SSH key confirmed for asaf user"


# Switch to non-root user for remaining steps
SSH="ssh ${SSH_OPTS} ${VPS_USER}@${VPS_HOST}"
SCP="scp ${SSH_OPTS}"

# ── Pre-flight: ensure required directories exist (idempotent) ────────────────
log "Ensuring required directories exist on VPS..."
$SSH "mkdir -p /opt/asaf/bin /opt/asaf/data /opt/asaf/secrets /var/www/asaf/releases /var/www/asaf/docs"
ok "Directories confirmed"

# ── Phase 3: Upload static assets ─────────────────────────────────────────────
log "Uploading static assets..."
$SCP install-asaf.sh ${VPS_USER}@${VPS_HOST}:/var/www/asaf/      # installer script

# Upload ASAF-specific docs only — NOT the entire docs/ dir (may contain private files)
ASAF_DOCS_DIR="docs/public"
if [ -d "${ASAF_DOCS_DIR}" ]; then
  $SCP -r "${ASAF_DOCS_DIR}/." ${VPS_USER}@${VPS_HOST}:/var/www/asaf/docs/
elif [ -f "docs/mcp-setup.md" ]; then
  # Fallback: upload only known safe ASAF doc files
  $SCP docs/mcp-setup.md ${VPS_USER}@${VPS_HOST}:/var/www/asaf/docs/ 2>/dev/null || true
  $SCP docs/asaf-nlp.html ${VPS_USER}@${VPS_HOST}:/var/www/asaf/docs/ 2>/dev/null || true
  $SCP docs/asaf-config.js ${VPS_USER}@${VPS_HOST}:/var/www/asaf/docs/ 2>/dev/null || true
fi

# Upload brand images (Souhimbou, ADINKHEPRA, SecRed seal)
# Images go into docs/images/ because the docs site roots at /var/www/asaf/docs/
if [ -d "static/images" ]; then
  $SSH "mkdir -p /var/www/asaf/docs/images"
  $SCP static/images/*.png ${VPS_USER}@${VPS_HOST}:/var/www/asaf/docs/images/ 2>/dev/null || true
  $SCP static/images/*.jpg ${VPS_USER}@${VPS_HOST}:/var/www/asaf/docs/images/ 2>/dev/null || true
  ok "Brand images uploaded to docs/images/"
fi

# Upload release artifacts if built
if [ -d "bin" ] && ls bin/asaf-* &>/dev/null; then
  $SCP bin/asaf-* ${VPS_USER}@${VPS_HOST}:/var/www/asaf/releases/
  $SCP bin/checksums.txt ${VPS_USER}@${VPS_HOST}:/var/www/asaf/releases/ 2>/dev/null || true
fi

# Upload webhook binary (non-fatal — binary may already exist on VPS)
if [ "${SKIP_WEBHOOK_BIN:-0}" = "0" ] && [ -f "bin/asaf-webhook-linux-amd64" ]; then
  $SCP bin/asaf-webhook-linux-amd64 ${VPS_USER}@${VPS_HOST}:/opt/asaf/bin/ \
    || log "webhook binary upload skipped (already exists on VPS — OK)"
  $SSH "chmod +x /opt/asaf/bin/asaf-webhook-linux-amd64" 2>/dev/null || true
fi


ok "Assets uploaded"

# ── Phase 4: Caddyfile ────────────────────────────────────────────────────────
log "Configuring Caddy..."
$SSH "sudo tee /etc/caddy/Caddyfile" << 'CADDYEOF'
# ASAF static file server — runs on local ports only.
# NPM (nginx-proxy-manager) handles TLS and external routing.
# get.nouchix.com  → NPM → :8080
# docs.nouchix.com → NPM → :8081

:8080 {
    root * /var/www/asaf

    @installer path /install-asaf.sh
    header @installer Content-Type "text/plain; charset=utf-8"

    @wininstaller path /win
    respond @wininstaller `Invoke-WebRequest -Uri 'https://get.nouchix.com/releases/asaf-windows-amd64.exe' -OutFile asaf.exe` 200

    @releases path /releases/*
    file_server @releases browse

    file_server browse
}

:8081 {
    root * /var/www/asaf/docs
    file_server browse
}
CADDYEOF

# Restart Caddy — non-fatal under set -e (use subshell)
if $SSH "sudo caddy validate --config /etc/caddy/Caddyfile 2>&1 && sudo systemctl enable caddy && sudo systemctl restart caddy 2>&1"; then
  ok "Caddy configured and restarted"
else
  log "Caddy restart failed — diagnosing..."
  $SSH "journalctl -xeu caddy.service --no-pager 2>/dev/null | tail -15" || true
  $SSH "ss -tlnp 2>/dev/null | grep -E ':80|:443'" || true
  log "Caddyfile is written. Fix Caddy on VPS then: sudo systemctl restart caddy"
fi


# ── Phase 5: Stripe Webhook systemd service ───────────────────────────────────
log "Installing Stripe webhook service..."
$SSH "sudo tee /etc/systemd/system/asaf-webhook.service" << 'SVCEOF'
[Unit]
Description=ASAF Stripe Webhook Receiver
After=network.target

[Service]
Type=simple
User=asaf
WorkingDirectory=/opt/asaf
EnvironmentFile=/opt/asaf/secrets/webhook.env
ExecStart=/opt/asaf/bin/asaf-webhook-linux-amd64 --addr=:4242
Restart=always
RestartSec=5
# No filesystem write access outside data dir
ReadWritePaths=/opt/asaf/data
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SVCEOF

$SSH << 'SVCSETUP'
sudo systemctl daemon-reload
sudo systemctl enable asaf-webhook
# Only start if binary exists
[ -f /opt/asaf/bin/asaf-webhook-linux-amd64 ] && sudo systemctl restart asaf-webhook || true
SVCSETUP
ok "Webhook service installed"

# ── Phase 6: Secrets reminder ─────────────────────────────────────────────────
printf "\n${BOLD}━━━ Secrets Setup (manual — do not put in git) ━━━${RESET}\n"
printf "SSH into the VPS and create /opt/asaf/secrets/webhook.env:\n\n"
printf "  ${CYAN}ssh ${VPS_USER}@${VPS_HOST}${RESET}\n"
printf "  ${CYAN}sudo tee /opt/asaf/secrets/webhook.env << 'EOF'${RESET}\n"
printf "  STRIPE_WEBHOOK_SECRET=whsec_...\n"
printf "  STRIPE_SECRET_KEY=sk_live_...\n"
printf "  ASAF_NOTIFY_EMAIL=support@nouchix.com\n"
printf "  EOF\n"
printf "  ${CYAN}sudo chmod 600 /opt/asaf/secrets/webhook.env${RESET}\n\n"

# ── Phase 7: Next.js Dashboard Docker Container ───────────────────────────────
# Builds Dockerfile.dashboard locally, streams image to VPS, runs on :3000.
# NPM (nginx-proxy-manager) on the VPS then proxies adinkhepra.com → :3000.
DEPLOY_DASHBOARD="${DEPLOY_DASHBOARD:-1}"
if [ "${DEPLOY_DASHBOARD}" = "0" ]; then
  log "Phase 7: Skipping dashboard deploy (DEPLOY_DASHBOARD=0)"
else
  log "Phase 7: Building Next.js dashboard image..."

  if ! command -v docker &>/dev/null; then
    log "Docker not found locally — skipping dashboard build (DEPLOY_DASHBOARD=0 to suppress)"
  else
    # Git short SHA for image tag; fall back to 'latest'
    GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo latest)"
    DASHBOARD_IMAGE="asaf-dashboard:${GIT_SHA}"
    DASHBOARD_APP_URL="${DASHBOARD_APP_URL:-https://adinkhepra.com}"
    DASHBOARD_API_URL="${DASHBOARD_API_URL:-https://agent.souhimbou.org}"

    docker build \
      -f Dockerfile.dashboard \
      --build-arg NEXT_PUBLIC_APP_URL="${DASHBOARD_APP_URL}" \
      --build-arg NEXT_PUBLIC_ASAF_API_URL="${DASHBOARD_API_URL}" \
      --build-arg NEXT_PUBLIC_ASAF_SCAN_PROFILE="nemoclaw" \
      -t "${DASHBOARD_IMAGE}" \
      -t "asaf-dashboard:latest" \
      . || die "Dashboard Docker build failed — fix and re-run with DEPLOY_DASHBOARD=1"

    log "Streaming image to VPS (this may take a minute)..."
    docker save "asaf-dashboard:latest" \
      | ssh ${SSH_OPTS} ${VPS_USER}@${VPS_HOST} \
          "docker load \
           && docker stop asaf-dashboard 2>/dev/null || true \
           && docker rm   asaf-dashboard 2>/dev/null || true \
           && docker run -d \
                --name asaf-dashboard \
                --restart always \
                -p 127.0.0.1:3000:3000 \
                --network mesh_nouchix-dmz \
                 --env-file /opt/asaf/secrets/dashboard.env \
                asaf-dashboard:latest" \
      && ok "Dashboard container running on VPS :3000 (image: ${DASHBOARD_IMAGE})" \
      || log "Dashboard deploy failed — container may need manual start on VPS"

    # Print dashboard.env template if file doesn't exist yet on VPS
    if ! $SSH "test -f /opt/asaf/secrets/dashboard.env" 2>/dev/null; then
      printf "\n${BOLD}━━━ Dashboard Secrets (create on VPS first-time) ━━━${RESET}\n"
      printf "  ${CYAN}ssh ${VPS_USER}@${VPS_HOST}${RESET}\n"
      printf "  ${CYAN}tee /opt/asaf/secrets/dashboard.env << 'EOF'${RESET}\n"
      printf "  STRIPE_SECRET_KEY=sk_live_...\n"
      printf "  STRIPE_PRICE_ID=price_...   # one-time \$99 price from Stripe Dashboard\n"
      printf "  NEXT_PUBLIC_APP_URL=${DASHBOARD_APP_URL}\n"
      printf "  NEXT_PUBLIC_ASAF_API_URL=${DASHBOARD_API_URL}\n"
      printf "  ASAF_ALLOW_EVAL_WITHOUT_LICENSE=true\n"
      printf "  EOF\n"
      printf "  ${CYAN}chmod 600 /opt/asaf/secrets/dashboard.env${RESET}\n\n"
      printf "  Then restart the container:\n"
      printf "  ${CYAN}docker restart asaf-dashboard${RESET}\n\n"
    fi
  fi
fi

printf "${BOLD}━━━ DNS (point these to ${VPS_HOST}) ━━━${RESET}\n"
printf "  get.nouchix.com     A  ${VPS_HOST}\n"
printf "  docs.nouchix.com    A  ${VPS_HOST}\n"
printf "  webhook.nouchix.com A  ${VPS_HOST}\n"
printf "  adinkhepra.com      A  ${VPS_HOST}\n\n"

printf "${BOLD}━━━ NPM (nginx-proxy-manager) — add proxy host ━━━${RESET}\n"
printf "  NPM runs in Docker — use host gateway IP 172.19.0.1, NOT 127.0.0.1\n\n"
printf "  1. Open NPM admin: http://${VPS_HOST}:81\n"
printf "  2. Proxy Hosts → Add Proxy Host for each domain:\n"
printf "       adinkhepra.com      http  172.19.0.1  3000  (dashboard)\n"
printf "       get.nouchix.com     http  172.19.0.1  8080  (installer/releases)\n"
printf "       docs.nouchix.com    http  172.19.0.1  8081  (docs)\n"
printf "       webhook.nouchix.com http  172.19.0.1  4242  (Stripe webhook)\n"
printf "  3. SSL tab on each: Request Let's Encrypt cert\n\n"

printf "${GREEN}✓ VPS deploy complete${RESET}\n"
printf "  Static:    https://get.nouchix.com/asaf (after DNS)\n"
printf "  Docs:      https://docs.nouchix.com\n"
printf "  Webhook:   https://webhook.nouchix.com (Stripe → here)\n"
printf "  Dashboard: https://adinkhepra.com (after NPM + DNS)\n"
