#!/bin/bash
# npm-configure.sh — Run ON THE VPS to configure Nginx Proxy Manager proxy hosts
# Usage: bash /tmp/npm-configure.sh <npm_email> <npm_password>
# Example: bash /tmp/npm-configure.sh admin@example.com changeme

set -euo pipefail

NPM_URL="http://localhost:81"
NPM_EMAIL="${1:-}"
NPM_PASS="${2:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; RESET='\033[0m'
log() { printf "${CYAN}[NPM]${RESET} %s\n" "$*"; }
ok()  { printf "${GREEN}[NPM]${RESET} ✓ %s\n" "$*"; }
die() { printf "${RED}[NPM]${RESET} ✗ %s\n" "$*" >&2; exit 1; }

[ -z "$NPM_EMAIL" ] && die "Usage: $0 <npm_email> <npm_password>"
[ -z "$NPM_PASS"  ] && die "Usage: $0 <npm_email> <npm_password>"

# ── 1. Get auth token ─────────────────────────────────────────────────────────
log "Authenticating with NPM at ${NPM_URL}..."
TOKEN=$(curl -sf -X POST "${NPM_URL}/api/tokens" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"${NPM_EMAIL}\",\"secret\":\"${NPM_PASS}\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
[ -z "$TOKEN" ] && die "Auth failed — check credentials"
ok "Authenticated (token: ${TOKEN:0:20}...)"

AUTH="-H \"Authorization: Bearer ${TOKEN}\""

# ── 2. Helper: create or skip proxy host ──────────────────────────────────────
create_proxy() {
  local domain="$1"
  local fwd_host="$2"
  local fwd_port="$3"

  # Check if host already exists
  EXISTING=$(curl -sf "${NPM_URL}/api/nginx/proxy-hosts" \
    -H "Authorization: Bearer ${TOKEN}" \
    | python3 -c "
import sys, json
hosts = json.load(sys.stdin)
for h in hosts:
    if '${domain}' in h.get('domain_names', []):
        print(h['id'])
        break
" 2>/dev/null || true)

  if [ -n "$EXISTING" ]; then
    ok "Proxy host for ${domain} already exists (id=${EXISTING}) — skipping"
    return
  fi

  log "Creating proxy host: ${domain} → ${fwd_host}:${fwd_port}"
  RESULT=$(curl -sf -X POST "${NPM_URL}/api/nginx/proxy-hosts" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "{
      \"domain_names\": [\"${domain}\"],
      \"forward_scheme\": \"http\",
      \"forward_host\": \"${fwd_host}\",
      \"forward_port\": ${fwd_port},
      \"access_list_id\": 0,
      \"certificate_id\": 0,
      \"ssl_forced\": false,
      \"caching_enabled\": false,
      \"block_exploits\": true,
      \"allow_websocket_upgrade\": true,
      \"http2_support\": false,
      \"hsts_enabled\": false,
      \"hsts_subdomains\": false,
      \"locations\": []
    }")
  ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "?")
  ok "Created: ${domain} → ${fwd_host}:${fwd_port} (id=${ID})"
}

# ── 3. Configure all required proxy hosts ─────────────────────────────────────
#  get.nouchix.com  → Caddy static server on :8080
create_proxy "get.nouchix.com"     "172.19.0.1" 8080

#  docs.nouchix.com → Caddy docs server on :8081
create_proxy "docs.nouchix.com"    "172.19.0.1" 8081

#  webhook.nouchix.com → ASAF Stripe webhook on :4242
create_proxy "webhook.nouchix.com" "172.19.0.1" 4242

#  adinkhepra.com → Next.js dashboard container on :3000
create_proxy "adinkhepra.com"      "172.19.0.1" 3000

# ── 4. Show final state ───────────────────────────────────────────────────────
echo ""
log "Current proxy hosts:"
curl -sf "${NPM_URL}/api/nginx/proxy-hosts" \
  -H "Authorization: Bearer ${TOKEN}" \
  | python3 -c "
import sys, json
hosts = json.load(sys.stdin)
for h in hosts:
    print('  [{}] {} → {}:{} (enabled={})'.format(
        h['id'],
        ','.join(h.get('domain_names', [])),
        h['forward_host'],
        h['forward_port'],
        not h.get('disabled', True)
    ))
"

echo ""
ok "NPM configuration complete"
echo ""
echo "Next: add SSL certs in NPM for each domain — or run this to request Let's Encrypt:"
echo "  Open http://187.124.225.91:81 → Proxy Hosts → Edit each → SSL tab → Let's Encrypt"
