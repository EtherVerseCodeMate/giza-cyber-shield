#!/bin/bash
# vps-deploy-all.sh — Full KHEPRA Ecosystem Deployment
# VPS: 2.24.105.170 (Ubuntu 24.04 LTS)
# Run as root from /opt/khepra
# IP: SOUHIMBOU DOH KONE LLC, exclusively licensed to SecRed Knowledge Inc.
#
# Services deployed:
#   apiserver     — ERT Engine REST API         :45444  → agent.souhimbou.org
#   agent         — KASA Orchestrator           :9090   (internal)
#   gateway       — SEKHEM Gateway + PQC-WAF    :8443   → gateway.souhimbou.ai
#   khepra-daemon — SouHimBou Privileged Daemon :45445  (localhost only)
#   serve-nlp     — Stargate NLP Engine         :7777   (internal/future)
#   asaf-hub      — ASAF Stargate Hub           :9191   (internal/future)
#   phantom-node  — Blackhole VPN Node          (network layer)
#   khepra-mcp    — PQC-MCP Server              :8080   → mcp.souhimbou.ai ✅ ALREADY LIVE

set -e
cd /opt/khepra

echo "========================================================"
echo "  KHEPRA Ecosystem — Full VPS Deployment"
echo "  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "========================================================"
echo

# ── [1] Build all binaries ──────────────────────────────────────────────────
echo "[1/5] Building binaries..."
mkdir -p bin

build_ok=()
build_fail=()

build_svc() {
    local name=$1
    local tags=$2
    local src=$3
    local out="bin/$name"
    printf "  Building %-20s ... " "$name"
    if go build ${tags:+-tags "$tags"} -o "$out" "$src" 2>/tmp/build-$name.err; then
        echo "OK  ($(du -sh $out | cut -f1))"
        build_ok+=("$name")
    else
        echo "FAIL"
        cat /tmp/build-$name.err | tail -5
        build_fail+=("$name")
    fi
}

build_svc "apiserver"     "saas"    "./cmd/apiserver"
build_svc "agent"         ""        "./cmd/agent"
build_svc "gateway"       ""        "./cmd/gateway"
build_svc "khepra-daemon" ""        "./cmd/khepra-daemon"
build_svc "serve-nlp"     ""        "./cmd/serve-nlp"
build_svc "asaf-hub"      ""        "./cmd/asaf-hub"
build_svc "phantom-node"  ""        "./cmd/phantom-node"
build_svc "sonar"         ""        "./cmd/sonar"

echo
echo "  Built OK:   ${build_ok[*]}"
echo "  Build FAIL: ${build_fail[*]:-none}"
echo

# ── [2] Create systemd unit files ───────────────────────────────────────────
echo "[2/5] Installing systemd unit files..."

ENV_LICENSE="EnvironmentFile=-/opt/khepra/deploy/.env.license"
ENV_MCP="EnvironmentFile=-/opt/khepra/.env.mcp"

install_unit() {
    local name=$1
    local desc=$2
    local exec=$3
    local extra_env=${4:-""}
    cat > /etc/systemd/system/khepra-${name}.service << UNIT
[Unit]
Description=KHEPRA ${desc}
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/khepra
${ENV_LICENSE}
${ENV_MCP}
Environment=TLS_ENABLED=false
${extra_env}
ExecStart=/opt/khepra/bin/${name} ${exec}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=khepra-${name}

[Install]
WantedBy=multi-user.target
UNIT
    echo "  Installed: khepra-${name}.service"
}

install_unit "apiserver"     "ERT Engine REST API (agent.souhimbou.org)" \
    "--port 45444 --tls=false" \
    "Environment=ADINKHEPRA_DEV=0"

install_unit "agent"         "KASA Orchestrator + EA Router" \
    "" \
    "Environment=KASA_PORT=9090"

install_unit "gateway"       "SEKHEM Gateway + PQC-WAF (gateway.souhimbou.ai)" \
    "--addr :8443 --tls=false" \
    ""

install_unit "khepra-daemon" "SouHimBou Privileged Daemon (localhost only)" \
    "--port 45445" \
    "Environment=KHEPRA_DAEMON_BIND=127.0.0.1"

install_unit "serve-nlp"     "ASAF NLP / Stargate Engine" \
    "--port 7777" \
    ""

install_unit "asaf-hub"      "ASAF Stargate Hub" \
    "--port 9191" \
    ""

install_unit "phantom-node"  "Blackhole VPN Node" \
    "" \
    "AmbientCapabilities=CAP_NET_ADMIN CAP_NET_RAW"

systemctl daemon-reload
echo

# ── [3] Enable + start all services ─────────────────────────────────────────
echo "[3/5] Enabling and starting services..."
for svc in apiserver agent gateway khepra-daemon serve-nlp asaf-hub phantom-node; do
    if [ -f "/opt/khepra/bin/$svc" ]; then
        systemctl enable khepra-${svc} 2>/dev/null
        systemctl restart khepra-${svc} 2>/dev/null
        sleep 1
        status=$(systemctl is-active khepra-${svc} 2>/dev/null || echo "failed")
        printf "  %-20s → %s\n" "khepra-${svc}" "$status"
    else
        echo "  khepra-${svc}: SKIP (binary not built)"
    fi
done
echo

# ── [4] Update Caddyfile ────────────────────────────────────────────────────
echo "[4/5] Updating Caddyfile..."
# IMPORTANT: The Caddy Docker container (deploy-caddy-1) mounts its Caddyfile from
# /opt/khepra/PQC-Khepra-MCP/deploy/Caddyfile — NOT /opt/khepra/deploy/Caddyfile.
# The 'deploy' project prefix in the container name confirms the compose was run from
# the PQC-Khepra-MCP/deploy/ directory. Always write to the correct mount source.
CADDYFILE="/opt/khepra/PQC-Khepra-MCP/deploy/Caddyfile"


if ! grep -q "agent.souhimbou.org" /opt/khepra/deploy/Caddyfile; then
cat >> /opt/khepra/deploy/Caddyfile << 'CADDY'

# -- agent.souhimbou.org — khepra-apiserver ERT Engine REST API --
agent.souhimbou.org {
    reverse_proxy localhost:45444 {
        flush_interval -1
    }
    @cors_preflight method OPTIONS
    handle @cors_preflight {
        header Access-Control-Allow-Origin *
        header Access-Control-Allow-Methods *
        header Access-Control-Allow-Headers *
        header Access-Control-Max-Age 86400
        respond 204
    }
    header {
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        Access-Control-Allow-Origin *
    }
}
CADDY
    echo "  Added: agent.souhimbou.org → :45444"
else
    echo "  Already present: agent.souhimbou.org"
fi

if ! grep -q "gateway.souhimbou.ai" /opt/khepra/deploy/Caddyfile; then
cat >> /opt/khepra/deploy/Caddyfile << 'CADDY'

# -- gateway.souhimbou.ai — SEKHEM Gateway + PQC-WAF --
gateway.souhimbou.ai {
    reverse_proxy localhost:8443 {
        flush_interval -1
    }
    header {
        Access-Control-Allow-Origin *
    }
}
CADDY
    echo "  Added: gateway.souhimbou.ai → :8443"
fi

# Reload Caddy with updated config
docker exec deploy-caddy-1 caddy reload --config /etc/caddy/Caddyfile 2>&1 && echo "  Caddy reloaded OK" || echo "  Caddy reload FAILED — check config"
echo

# ── [5] Status summary ──────────────────────────────────────────────────────
echo "[5/5] Service status summary:"
echo "  ┌─────────────────────────────────────────────────────────────┐"
for svc in apiserver agent gateway khepra-daemon serve-nlp asaf-hub phantom-node; do
    status=$(systemctl is-active khepra-${svc} 2>/dev/null || echo "not-deployed")
    printf "  │  %-20s  %-10s                        │\n" "khepra-${svc}" "$status"
done
echo "  │  deploy-khepra-mcp-1    $(docker inspect deploy-khepra-mcp-1 --format '{{.State.Status}}' 2>/dev/null || echo 'unknown')                              │"
echo "  └─────────────────────────────────────────────────────────────┘"

echo
echo "Ports in use:"
ss -tlnp | grep -E ':45444|:45445|:8443|:9090|:7777|:9191|:8080' || echo "  (none of the expected ports are listening yet)"

echo
echo "========================================================"
echo "  Deployment complete — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "========================================================"
