#!/bin/bash
# Run as root after Docker is installed
# Usage: ssh root@187.124.225.91 'bash -s' < scripts/vps-finalize.sh

set -e

echo "=== 1. asaf-api systemd service ==="
cat > /etc/systemd/system/asaf-api.service << 'EOF'
[Unit]
Description=ASAF API Server
After=network.target

[Service]
Type=simple
User=asaf
WorkingDirectory=/opt/asaf
EnvironmentFile=/opt/asaf/secrets/dashboard.env
ExecStart=/opt/asaf/bin/asaf-linux-amd64 serve --addr=:45444
Restart=always
RestartSec=5
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable asaf-api
echo "OK: asaf-api service registered"

echo "=== 2. Directories & ownership ==="
mkdir -p /opt/asaf/bin /opt/asaf/secrets /opt/asaf/data
chown -R asaf:asaf /opt/asaf
echo "OK: /opt/asaf ready"

echo "=== 3. Firewall: open ASAF API port ==="
ufw allow 45444/tcp comment 'ASAF API' 2>/dev/null && echo "OK: port 45444 open" || echo "UFW not active — skipping"

echo "=== 4. Verify ==="
docker --version
systemctl is-enabled asaf-api
systemctl is-enabled asaf-webhook
groups asaf
ls -la /opt/asaf/bin/

echo ""
echo "=== ALL DONE — VPS is deploy-ready ==="
