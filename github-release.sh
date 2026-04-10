#!/usr/bin/env bash
# github-release.sh — creates a GitHub release and uploads all bin/ artifacts
# Run: GITHUB_TOKEN=ghp_... bash github-release.sh
#
# Get a token at: https://github.com/settings/tokens/new
# Required scopes: repo (full)

set -e

REPO="EtherVerseCodeMate/giza-cyber-shield"
TAG="v1.0.1"
TITLE="ASAF v1.0.0 — Track 1"
NOTES="First revenue-ready release.

Changes:
- certify CLI: polls scan status endpoint for real Scan ID, Score, Passed/Failed controls
- Stripe webhook: HMAC-SHA256 via STRIPE_WEBHOOK_SECRET — stops license spoofing
- Scan enrichment: Shodan (CVEs, banners, open ports) + APIVoid (domain blacklist, 80+ engines)
- OpenRouter LLM fallback: cloud AI when no local model is present
- License revocation: subscription cancellation wired end-to-end"

# ── Auth ──────────────────────────────────────────────────────────────────────
if [ -z "$GITHUB_TOKEN" ]; then
  echo "[ERROR] Set GITHUB_TOKEN=ghp_... before running"
  echo "  Get one at: https://github.com/settings/tokens/new?scopes=repo"
  exit 1
fi

AUTH="Authorization: Bearer $GITHUB_TOKEN"
API="https://api.github.com"

# ── Delete existing release if it exists (re-run safe) ───────────────────────
echo "[1/3] Checking for existing release..."
EXISTING=$(curl -sf -H "$AUTH" \
  "$API/repos/$REPO/releases/tags/$TAG" | grep '"id"' | head -1 | grep -o '[0-9]*' | head -1 || true)

if [ -n "$EXISTING" ]; then
  echo "      Deleting existing release $EXISTING..."
  curl -sf -X DELETE -H "$AUTH" "$API/repos/$REPO/releases/$EXISTING"
fi

# ── Create release ────────────────────────────────────────────────────────────
echo "[2/3] Creating release $TAG..."

# Write JSON to temp file — avoids all shell escaping issues
cat > /tmp/asaf_release.json << 'ENDJSON'
{
  "tag_name": "v1.0.1",
  "name": "ASAF v1.0.0 - Track 1",
  "body": "First revenue-ready release.\n\nChanges:\n- certify CLI: polls scan status for real Scan ID, Score, Passed/Failed controls\n- Stripe webhook: HMAC-SHA256 via STRIPE_WEBHOOK_SECRET - stops license spoofing\n- Scan enrichment: Shodan (CVEs, banners, ports) + APIVoid (domain blacklist, 80+ engines)\n- OpenRouter LLM fallback: cloud AI when no local model is present\n- License revocation: subscription cancellation wired end-to-end",
  "draft": false,
  "prerelease": false
}
ENDJSON

RELEASE=$(curl -sS -X POST \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d @/tmp/asaf_release.json \
  -w "\nHTTP_STATUS:%{http_code}" \
  "$API/repos/$REPO/releases")

HTTP_STATUS=$(echo "$RELEASE" | grep "HTTP_STATUS:" | tail -1 | cut -d: -f2)
RELEASE=$(echo "$RELEASE" | grep -v "HTTP_STATUS:")

if [ "$HTTP_STATUS" != "201" ]; then
  echo "[ERROR] GitHub returned HTTP $HTTP_STATUS. Full response:"
  echo "$RELEASE"
  exit 1
fi

RELEASE_ID=$(echo "$RELEASE" | grep '"id"' | head -1 | grep -o '[0-9]*' | head -1)
UPLOAD_URL=$(echo "$RELEASE" | grep '"upload_url"' | head -1 \
  | sed 's/.*"upload_url": *"\([^"]*\)".*/\1/' \
  | sed 's/{.*}//' \
  | tr -d '\r\n')

echo "      Release ID: $RELEASE_ID"
echo "      Upload URL: $UPLOAD_URL"

# ── Upload assets ─────────────────────────────────────────────────────────────
echo "[3/3] Uploading assets..."

upload() {
  local file="$1"
  local name=$(basename "$file")
  echo "      Uploading $name ($(du -sh "$file" | cut -f1))..."
  HTTP=$(curl -S -X POST \
    -H "$AUTH" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"$file" \
    -w "%{http_code}" \
    -o /dev/null \
    "${UPLOAD_URL}?name=${name}")
  if [ "$HTTP" != "201" ]; then
    echo "      [ERROR] Upload failed HTTP $HTTP for $name"
    exit 1
  fi
  echo "      ✓ $name"
}

upload bin/asaf-linux-amd64
upload bin/asaf-linux-arm64
upload bin/asaf-darwin-amd64
upload bin/asaf-darwin-arm64
upload bin/asaf-windows-amd64.exe
upload bin/asaf-apiserver-linux-amd64
upload bin/asaf-webhook-linux-amd64
upload bin/checksums.txt

echo ""
echo "========================================"
echo "  Release published:"
echo "  https://github.com/$REPO/releases/tag/$TAG"
echo "========================================"
