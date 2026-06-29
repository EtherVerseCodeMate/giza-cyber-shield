#!/usr/bin/env bash
# build.sh — Drop-in replacement for `make && make setup-mirror`
# Works in Git Bash on Windows, WSL2, or any Linux shell.
# Usage:
#   bash build.sh              # build all binaries (community)
#   bash build.sh daemon       # build asaf-daemon only
#   bash build.sh mirror       # build Docker mirror image only
#   bash build.sh all          # binaries + mirror
#   bash build.sh clean        # remove bin/

set -e

TARGET="${1:-all}"
VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "v2.0.0-dev")
LDFLAGS="-s -w -X main.Version=${VERSION}"
TAGS="-tags community"
CGO="CGO_ENABLED=0"

green()  { echo -e "\033[32m$*\033[0m"; }
yellow() { echo -e "\033[33m$*\033[0m"; }
red()    { echo -e "\033[31m$*\033[0m"; }
banner() { echo ""; green "══════════════════════════════════════════════════"; green "  $*"; green "══════════════════════════════════════════════════"; echo ""; }

build_cli() {
    yellow "🏗️  Building adinkhepra CLI..."
    eval "$CGO go build $TAGS -ldflags=\"$LDFLAGS\" -o bin/adinkhepra ./cmd/adinkhepra"
    green "   ✓ bin/adinkhepra"
}

build_daemon() {
    yellow "⚡ Building asaf-daemon..."
    eval "$CGO go build $TAGS -ldflags=\"$LDFLAGS\" -o bin/asaf-daemon ./cmd/asaf-daemon"
    green "   ✓ bin/asaf-daemon"
}

build_mcp() {
    yellow "🔐 Building khepra-mcp..."
    eval "$CGO go build $TAGS -ldflags=\"$LDFLAGS\" -o bin/khepra-mcp ./cmd/khepra-mcp"
    green "   ✓ bin/khepra-mcp"
}

build_api() {
    yellow "🌐 Building apiserver..."
    eval "$CGO go build $TAGS -ldflags=\"$LDFLAGS\" -o bin/apiserver ./cmd/apiserver"
    green "   ✓ bin/apiserver"
}

setup_mirror() {
    banner "Building RHEL 9 Mirror Image"
    yellow "📦 Running: docker build -t asaf-mirror-rhel9:local -f Dockerfile.mirror ."
    docker build \
        -t ghcr.io/nouchix/asaf-mirror-rhel9:latest \
        -t asaf-mirror-rhel9:local \
        -f Dockerfile.mirror \
        .
    green "   ✓ asaf-mirror-rhel9:local"
    echo ""
    green "   Push to GHCR:  docker push ghcr.io/nouchix/asaf-mirror-rhel9:latest"
}

build_all_binaries() {
    banner "Building ASAF Sovereign Stack  (${VERSION})"
    mkdir -p bin

    build_cli    || yellow "   ⚠ CLI build failed"
    build_daemon || yellow "   ⚠ daemon build failed"

    # MCP — community-tagged, include if present
    if [ -d "./cmd/khepra-mcp" ]; then build_mcp; fi

    # apiserver requires -tags saas — skip in community builds
    if [ -d "./cmd/apiserver" ]; then
        yellow "   ⏭  apiserver skipped (requires -tags saas, not community)"
    fi

    echo ""
    ls -lh bin/ 2>/dev/null || true
    green "✅ Build complete."
}

case "$TARGET" in
    cli)    mkdir -p bin && build_cli ;;
    daemon) mkdir -p bin && build_daemon ;;
    mcp)    mkdir -p bin && build_mcp ;;
    api)    mkdir -p bin && build_api ;;
    mirror) setup_mirror ;;
    clean)
        yellow "🧹 Cleaning..."
        rm -rf bin/adinkhepra bin/asaf-daemon bin/khepra-mcp bin/apiserver
        green "   ✓ clean"
        ;;
    all|*)
        build_all_binaries
        setup_mirror
        ;;
esac
