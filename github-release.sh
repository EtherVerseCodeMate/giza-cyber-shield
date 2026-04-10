#!/usr/bin/env bash
# github-release.sh — creates a GitHub release and uploads all bin/ artifacts
# Run: GITHUB_TOKEN=ghp_... bash github-release.sh
#
# Get a token at: https://github.com/settings/tokens/new
# Required scopes: repo (full)
#
# SAFE TO RE-RUN: if release already exists, reuses it (never deletes).
# GitHub permanently locks a tag once a published release is deleted against it.

set -e

REPO="EtherVerseCodeMate/giza-cyber-shield"
TAG="v1.1.0"

AUTH="Authorization: Bearer $GITHUB_TOKEN"
API="https://api.github.com"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "[ERROR] Set GITHUB_TOKEN=ghp_... before running"
  echo "  Get one at: https://github.com/settings/tokens/new?scopes=repo"
  exit 1
fi

# ── Tag: create if missing ────────────────────────────────────────────────────
echo "[1/3] Ensuring tag $TAG exists on remote..."
if ! git rev-parse "$TAG" >/dev/null 2>&1; then
  git tag "$TAG"
fi
git push origin "$TAG" 2>/dev/null || true   # no-op if already pushed

# ── Release: reuse if exists, create if not ───────────────────────────────────
echo "[2/3] Getting or creating release $TAG..."

EXISTING_JSON=$(curl -sS -H "$AUTH" \
  "$API/repos/$REPO/releases/tags/$TAG")

RELEASE_ID=$(echo "$EXISTING_JSON" | grep -m1 '"id"' | grep -o '[0-9]*' | head -1)

if [ -n "$RELEASE_ID" ]; then
  echo "      Reusing existing release $RELEASE_ID"
  RELEASE="$EXISTING_JSON"
else
  echo "      Creating new release..."
  cat > /tmp/asaf_release.json << 'ENDJSON'
{
  "tag_name": "v1.1.0",
  "name": "ASAF v1.1.0 - Track 1",
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
    echo "[ERROR] GitHub returned HTTP $HTTP_STATUS:"
    echo "$RELEASE"
    exit 1
  fi
  RELEASE_ID=$(echo "$RELEASE" | grep -m1 '"id"' | grep -o '[0-9]*' | head -1)
  echo "      Created release $RELEASE_ID"
fi

UPLOAD_URL=$(echo "$RELEASE" | grep '"upload_url"' | head -1 \
  | sed 's/.*"upload_url": *"\([^"]*\)".*/\1/' \
  | sed 's/{.*}//' \
  | tr -d '\r\n')

echo "      Upload URL: $UPLOAD_URL"

# ── Upload assets ─────────────────────────────────────────────────────────────
echo "[3/3] Uploading assets..."

upload() {
  local file="$1"
  local name
  name=$(basename "$file")
  echo "      Uploading $name..."
  HTTP=$(curl -sS -X POST \
    -H "$AUTH" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"$file" \
    -w "%{http_code}" \
    -o /tmp/upload_resp.json \
    "${UPLOAD_URL}?name=${name}")
  if [ "$HTTP" = "201" ]; then
    echo "      ✓ $name"
  elif [ "$HTTP" = "422" ]; then
    echo "      ⚠ $name already uploaded (skipping)"
  else
    echo "      [ERROR] Upload failed HTTP $HTTP for $name:"
    cat /tmp/upload_resp.json
    exit 1
  fi
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
