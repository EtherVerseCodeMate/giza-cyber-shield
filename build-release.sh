#!/usr/bin/env bash
# build-release.sh — Track 1 release build script
# Run from project root in MINGW64:  bash build-release.sh

set -e

VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "v1.0.0")
LDFLAGS="-s -w -X main.Version=${VERSION}"

echo "========================================"
echo "  ASAF Track 1 Release Build — ${VERSION}"
echo "========================================"

mkdir -p bin

build() {
  local os=$1 arch=$2 out=$3
  echo "  [BUILD] ${os}/${arch} → ${out}"
  CGO_ENABLED=0 GOOS=${os} GOARCH=${arch} \
    go build -trimpath -ldflags "${LDFLAGS}" \
    -o "${out}" ./cmd/adinkhepra
}

# CLI — all platforms
build linux   amd64 bin/asaf-linux-amd64
build linux   arm64 bin/asaf-linux-arm64
build darwin  amd64 bin/asaf-darwin-amd64
build darwin  arm64 bin/asaf-darwin-arm64
build windows amd64 bin/asaf-windows-amd64.exe

# Server + webhook (Linux only — VPS deployment)
echo "  [BUILD] linux/amd64 → bin/asaf-apiserver-linux-amd64"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
  go build -trimpath -ldflags "${LDFLAGS}" \
  -o bin/asaf-apiserver-linux-amd64 ./cmd/apiserver

echo "  [BUILD] linux/amd64 → bin/asaf-webhook-linux-amd64"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
  go build -trimpath -ldflags "${LDFLAGS}" \
  -o bin/asaf-webhook-linux-amd64 ./cmd/webhook

# Checksums
echo ""
echo "  [SHA256] Generating checksums..."
cd bin
sha256sum \
  asaf-linux-amd64 asaf-linux-arm64 \
  asaf-darwin-amd64 asaf-darwin-arm64 \
  asaf-windows-amd64.exe \
  asaf-apiserver-linux-amd64 asaf-webhook-linux-amd64 \
  > checksums.txt
cd ..

echo ""
echo "========================================"
echo "  Release artifacts ready in bin/"
echo "========================================"
ls -lh bin/asaf-* bin/checksums.txt
echo ""
echo "Next steps:"
echo "  1. git tag ${VERSION} && git push origin ${VERSION}"
echo "  2. gh release create ${VERSION} bin/asaf-* bin/checksums.txt \\"
echo "       --title 'ASAF ${VERSION} — Track 1' \\"
echo "       --notes 'First revenue-ready release. Includes Shodan/APIVoid scan enrichment, Stripe webhook HMAC, OpenRouter LLM fallback.'"
echo "  3. scp bin/asaf-apiserver-linux-amd64 root@agent.souhimbou.org:/opt/asaf/"
echo "  4. scp bin/asaf-webhook-linux-amd64   root@agent.souhimbou.org:/opt/asaf/"
echo "  5. ssh root@agent.souhimbou.org systemctl restart asaf-gateway asaf-webhook"
