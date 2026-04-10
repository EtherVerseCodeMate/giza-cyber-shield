#!/usr/bin/env bash
# github-release.sh — creates a GitHub release and uploads all bin/ artifacts
# Run: GITHUB_TOKEN=ghp_... bash github-release.sh
#
# Get a token at: https://github.com/settings/tokens/new
# Required scopes: repo (full)

set -e

REPO="EtherVerseCodeMate/giza-cyber-shield"
TAG="v1.0.0"
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

# Escape notes for JSON without Python: escape backslashes, quotes, then newlines
NOTES_JSON=$(printf '%s' "$NOTES" \
  | sed 's/\\/\\\\/g' \
  | sed 's/"/\\"/g' \
  | awk '{printf "%s\\n", $0}' \
  | sed 's/\\n$//')

RELEASE=$(curl -sf -X POST \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "{\"tag_name\":\"$TAG\",\"name\":\"$TITLE\",\"body\":\"$NOTES_JSON\",\"draft\":false,\"prerelease\":false}" \
  "$API/repos/$REPO/releases")

RELEASE_ID=$(echo "$RELEASE" | grep '"id"' | head -1 | grep -o '[0-9]*' | head -1)
UPLOAD_URL=$(echo "$RELEASE" | grep '"upload_url"' | head -1 | sed 's/.*"upload_url": *"\([^"]*\)".*/\1/' | sed 's/{.*}//')

echo "      Release ID: $RELEASE_ID"
echo "      Upload URL: $UPLOAD_URL"

# ── Upload assets ─────────────────────────────────────────────────────────────
echo "[3/3] Uploading assets..."

upload() {
  local file="$1"
  local name=$(basename "$file")
  echo "      Uploading $name ($(du -sh "$file" | cut -f1))..."
  curl -sf -X POST \
    -H "$AUTH" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"$file" \
    "${UPLOAD_URL}?name=${name}" > /dev/null
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
