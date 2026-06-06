APP?=adinkhepra
AGENT?=adinkhepra-agent
GATEWAY?=khepra-gateway

all: build

build:
	go mod tidy
	go build -o bin/$(APP) ./cmd/adinkhepra
	go build -o bin/$(AGENT) ./cmd/agent
	go build -o bin/$(GATEWAY) ./cmd/gateway

run-agent: build
	ADINKHEPRA_AGENT_PORT=45444 ./bin/$(AGENT)

run-gateway: build
	./bin/$(GATEWAY) -addr=:8443 -debug

run-gateway-learning: build
	./bin/$(GATEWAY) -addr=:8443 -debug -learning


secure-build:
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -mod=vendor -o bin/$(APP).exe ./cmd/adinkhepra
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -mod=vendor -o bin/$(AGENT).exe ./cmd/agent
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -mod=vendor -o bin/$(GATEWAY).exe ./cmd/gateway

# ============================================================
# Cross-Platform Release Builds (Track 1 — Sovereign Distribution)
# ============================================================

VERSION?=$(shell git describe --tags --always --dirty 2>/dev/null || echo "v1.0.0")
LD_FLAGS=-trimpath -ldflags="-s -w -X main.Version=$(VERSION) -X main.BuildDate=$(shell date -u +%Y-%m-%dT%H:%M:%SZ)"

# Linux AMD64 (primary for DoD/SCIF/Iron Bank)
build-linux:
	@echo "[ASAF] Building Linux/amd64 static binary ($(VERSION))"
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build $(LD_FLAGS) -o bin/asaf-linux-amd64 ./cmd/adinkhepra
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build $(LD_FLAGS) -o bin/asaf-apiserver-linux-amd64 ./cmd/apiserver
	@echo "[ASAF] Linux build: bin/asaf-linux-amd64"

# Linux ARM64 (Raspberry Pi, AWS Graviton, Apple M1 server)
build-linux-arm64:
	@echo "[ASAF] Building Linux/arm64 static binary ($(VERSION))"
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build $(LD_FLAGS) -o bin/asaf-linux-arm64 ./cmd/adinkhepra
	@echo "[ASAF] Linux ARM64 build: bin/asaf-linux-arm64"

# macOS AMD64
build-darwin-amd64:
	@echo "[ASAF] Building macOS/amd64 binary ($(VERSION))"
	GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go build $(LD_FLAGS) -o bin/asaf-darwin-amd64 ./cmd/adinkhepra

# macOS ARM64 (Apple Silicon — M1/M2/M3)
build-darwin-arm64:
	@echo "[ASAF] Building macOS/arm64 binary ($(VERSION))"
	GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go build $(LD_FLAGS) -o bin/asaf-darwin-arm64 ./cmd/adinkhepra

# Windows AMD64
build-windows:
	@echo "[ASAF] Building Windows/amd64 binary ($(VERSION))"
	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build $(LD_FLAGS) -o bin/asaf-windows-amd64.exe ./cmd/adinkhepra

# Build all platforms for GitHub Release
release-all: build-linux build-linux-arm64 build-darwin-amd64 build-darwin-arm64 build-windows
	@echo "[ASAF] Generating SHA-256 checksums for release verification..."
	@cd bin && sha256sum asaf-linux-amd64 asaf-linux-arm64 \
		asaf-darwin-amd64 asaf-darwin-arm64 asaf-windows-amd64.exe > checksums.txt
	@echo "[ASAF] Release artifacts ready in bin/"
	@echo "[ASAF] Checksums: bin/checksums.txt"
	@ls -lh bin/

# MCP server binary (for asaf mcp command)
build-mcp:
	@echo "[ASAF] Building khepra-mcp binary"
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build $(LD_FLAGS) -o bin/asaf-mcp-linux-amd64 ./cmd/khepra-mcp
	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build $(LD_FLAGS) -o bin/asaf-mcp-windows.exe ./cmd/khepra-mcp

# Stripe webhook receiver (VPS distribution layer)
build-webhook:
	@echo "[ASAF] Building Stripe webhook service"
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build $(LD_FLAGS) -o bin/asaf-webhook-linux-amd64 ./cmd/webhook

# Local NLP server (Track 3) — uses embed.FS, proper process supervision
# Requires: build-linux first to produce asaf-apiserver-linux-amd64
serve-nlp: build-linux
	@echo "[ASAF] Building serve-nlp binary..."
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build $(LD_FLAGS) -o bin/asaf-serve-nlp-linux-amd64 ./cmd/serve-nlp
	@echo "[ASAF] Starting Natural Language Security Platform..."
	@echo "[ASAF]   NLP console → http://localhost:7777"
	@echo "[ASAF]   API server  → http://localhost:45444"
	./bin/asaf-serve-nlp-linux-amd64

# Local NLP (Windows)
serve-nlp-windows: build-windows
	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build $(LD_FLAGS) -o bin/asaf-serve-nlp.exe ./cmd/serve-nlp

# Full release: all binaries including mcp + webhook
release-full: release-all build-mcp build-webhook
	@cd bin && sha256sum * > checksums.txt
	@echo "[ASAF] Full release artifacts ready in bin/"

# ECR-02: FIPS 140-3 Compliance Build (DoD Iron Bank)
# This builds with BoringCrypto (FIPS-validated cryptography module)
# Required for DoD Platform One deployments
#
# Prerequisites:
#   - gcc installed (for CGO)
#   - Go 1.19+ (BoringCrypto experiment)
#
# Note: BoringCrypto requires CGO_ENABLED=1 and Linux/amd64 target
fips-boring-build:
	@echo "[ADINKHEPRA] Building with BoringCrypto (FIPS 140-3 validated)"
	@echo "[ADINKHEPRA] Target: Linux/amd64 (DoD Platform One)"
	GOOS=linux GOARCH=amd64 GOEXPERIMENT=boringcrypto CGO_ENABLED=1 \
		go build -tags=fips -trimpath \
		-ldflags="-s -w -X main.FIPSMode=required" \
		-o bin/$(APP)-fips ./cmd/adinkhepra
	@echo "[ADINKHEPRA] FIPS build complete: bin/$(APP)-fips"
	@echo "[ADINKHEPRA] Verify with: ADINKHEPRA_FIPS_MODE=true ./bin/$(APP)-fips version"

# Go 1.24+ Native FIPS 140-3 Compliance (GODEBUG method)
# This is the newer approach that doesn't require CGO
# Usage: Set GODEBUG=fips140=on at runtime
fips-build: secure-build
	@echo "[ADINKHEPRA] FIPS-Ready Binaries Built (Go 1.24+ GODEBUG method)"
	@echo "[ADINKHEPRA] To run in FIPS mode: GODEBUG=fips140=on ./bin/$(APP)"
	@echo "[ADINKHEPRA] For DoD Iron Bank, use 'make fips-boring-build' instead"

clean:
	rm -rf bin

test:
	# Run Go tests without using the cache to ensure deterministic runs
	go test -count=1 ./...

ci-test:
	# CI-friendly test runner: vendor-aware and no-cache
	CGO_ENABLED=0 go test -count=1 -mod=vendor ./...

# ============================================================
# CVE Database Management
# ============================================================

CVE_DATA_DIR=data/cve-database/cve-data

# Check if CVE data exists
.PHONY: check-cve
check-cve:
	@if [ ! -d "$(CVE_DATA_DIR)/mitre" ] || [ ! -f "$(CVE_DATA_DIR)/cisa-kev/known_exploited_vulnerabilities.json" ]; then \
		echo "[ADINKHEPRA] CVE data not found. Run 'make fetch-cve' to download."; \
		exit 1; \
	else \
		echo "[ADINKHEPRA] CVE data present."; \
	fi

# Fetch CVE data from all sources
.PHONY: fetch-cve
fetch-cve:
	@echo "[ADINKHEPRA] Fetching CVE data from multiple sources..."
	@cd data/cve-database && bash fetch-cve-data.sh
	@echo "[ADINKHEPRA] CVE data fetch complete."

# Quick CVE update (CISA KEV only - fastest, most critical)
.PHONY: fetch-cve-quick
fetch-cve-quick:
	@echo "[ADINKHEPRA] Quick fetch: CISA Known Exploited Vulnerabilities..."
	@mkdir -p $(CVE_DATA_DIR)/cisa-kev
	@curl -s -o $(CVE_DATA_DIR)/cisa-kev/known_exploited_vulnerabilities.json \
		"https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
	@echo "Last updated: $$(date)" > $(CVE_DATA_DIR)/cisa-kev/last-updated.txt
	@echo "[ADINKHEPRA] CISA KEV updated."

# Build with CVE data validation
.PHONY: build-with-cve
build-with-cve: fetch-cve-quick build
	@echo "[ADINKHEPRA] Build complete with fresh CVE data."

# Validate build (includes CVE check)
.PHONY: validate
validate: check-cve test
	@echo "[ADINKHEPRA] Validation complete."

# Full CI pipeline with CVE data
.PHONY: ci
ci: fetch-cve-quick ci-test secure-build
	@echo "[ADINKHEPRA] CI pipeline complete."
# Iron Bank Automation (hardening_manifest.yaml)
# Auto-generates the manifest required for DoD container hardening
.PHONY: ironbank
ironbank: fips-boring-build
	@echo "[ADINKHEPRA] Generating Iron Bank Hardening Manifest..."
	@go run tools/gen_manifest.go "v1.0.0" "bin/$(APP)-fips"
	@echo "[ADINKHEPRA] Manifest generated: hardening_manifest.yaml"

# ============================================================
# VPS FIPS Deployment (POA&M B-1 — CMMC/FedRAMP Compliance)
# Switches the active VPS deployment from standard Dockerfile
# to Dockerfile.fips (GOEXPERIMENT=boringcrypto, CMVP #4407).
#
# This satisfies NIST 800-171 03.13.10 (FIPS-validated crypto modules)
# for the SecRed VPS tier.
#
# Usage: make deploy-vps-fips VPS_HOST=root@srv1494994.hstgr.cloud
# ============================================================
VPS_HOST?=root@srv1494994.hstgr.cloud

.PHONY: deploy-vps-fips
deploy-vps-fips:
	@echo "[ASAF-FIPS] Building FIPS-validated container (GOEXPERIMENT=boringcrypto)"
	@echo "[ASAF-FIPS] Using Dockerfile.fips — BoringCrypto CMVP Certificate #4407"
	docker build -f Dockerfile.fips -t adinkhepra:fips-$(VERSION) .
	@echo "[ASAF-FIPS] Verifying FIPS assertion in built image..."
	docker run --rm -e ADINKHEPRA_FIPS_MODE=true adinkhepra:fips-$(VERSION) version
	@echo "[ASAF-FIPS] Saving and transferring image to VPS..."
	docker save adinkhepra:fips-$(VERSION) | gzip | ssh $(VPS_HOST) "gunzip | docker load"
	@echo "[ASAF-FIPS] Restarting ASAF service on VPS with FIPS image..."
	ssh $(VPS_HOST) "docker stop adinkhepra 2>/dev/null || true && \
		docker rm adinkhepra 2>/dev/null || true && \
		docker run -d --name adinkhepra --restart always \
			-e ADINKHEPRA_FIPS_MODE=true \
			-p 45444:45444 \
			adinkhepra:fips-$(VERSION)"
	@echo "[ASAF-FIPS] Verifying deployed FIPS service..."
	@sleep 5 && ssh $(VPS_HOST) "docker exec adinkhepra /usr/local/bin/adinkhepra version"
	@echo "[ASAF-FIPS] ✓ FIPS deployment complete — NIST 800-171 03.13.10 satisfied"
	@echo "[ASAF-FIPS] Document CMVP evidence: https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/4407"

# ============================================================
# ERT Sandbox (Task 12 — Dockerfile.ert)
# ============================================================

ERT_IMAGE?=khepra-ert
ERT_TAG?=$(VERSION)
SCAN_TARGET?=$(shell pwd)

# Build the ERT scan sandbox image (Syft + Grype + AdinKhepra CLI)
.PHONY: build-ert
build-ert:
	@echo "[ERT] Building ERT scan sandbox (Syft + Grype + AdinKhepra)"
	docker build \
		--file Dockerfile.ert \
		--tag $(ERT_IMAGE):$(ERT_TAG) \
		--tag $(ERT_IMAGE):latest \
		--build-arg SYFT_VERSION=1.4.1 \
		--build-arg GRYPE_VERSION=0.78.0 \
		.
	@echo "[ERT] Image built: $(ERT_IMAGE):$(ERT_TAG)"

# Run ert_godfather against a project path (default: current dir)
# Usage: make ert-scan SCAN_TARGET=/path/to/project
.PHONY: ert-scan
ert-scan:
	@echo "[ERT] Scanning: $(SCAN_TARGET)"
	docker run --rm \
		--network none \
		--read-only \
		--tmpfs /tmp:rw,noexec,nosuid,size=256m \
		--volume "$(SCAN_TARGET):/scan-target:ro" \
		$(ERT_IMAGE):latest \
		ert_godfather /scan-target

# Run ert_architect (supply chain deep scan) against SCAN_TARGET
.PHONY: ert-architect
ert-architect:
	@echo "[ERT] Supply chain scan: $(SCAN_TARGET)"
	docker run --rm \
		--network none \
		--read-only \
		--tmpfs /tmp:rw,noexec,nosuid,size=256m \
		--volume "$(SCAN_TARGET):/scan-target:ro" \
		$(ERT_IMAGE):latest \
		ert_architect /scan-target

# Run ert_crypto (PQC attestation) against SCAN_TARGET
.PHONY: ert-crypto
ert-crypto:
	@echo "[ERT] PQC attestation: $(SCAN_TARGET)"
	docker run --rm \
		--network none \
		--read-only \
		--tmpfs /tmp:rw,noexec,nosuid,size=256m \
		--volume "$(SCAN_TARGET):/scan-target:ro" \
		$(ERT_IMAGE):latest \
		ert_crypto /scan-target

# ============================================================
# Task 11: Crash Dummy Validation
# ============================================================

# Run the crash dummy integration tests (validates ERT pipeline against fixtures)
.PHONY: test-crash-dummy
test-crash-dummy:
	@echo "[ERT] Running Crash Dummy validation suite..."
	go test ./tests/validation/... -v -timeout 5m -run "TestERT|TestDAG" 2>&1 | tee /tmp/crash-dummy-results.txt
	@echo "[ERT] Results saved to /tmp/crash-dummy-results.txt"

# Run ALL validation tests (includes crash dummy + any future suites)
.PHONY: test-validation
test-validation:
	@echo "[ERT] Running full validation suite..."
	go test ./tests/validation/... -v -timeout 10m


# ============================================================
# E2E Tests — Phantom Sandbox (real Linux + Windows targets)
# Build-Test-Release-Feedback-Repeat
# ============================================================
#
# - dummy-linux : Intentionally misconfigured Alpine container (scan target)
# - Phantom Sandbox: adinkhepra CLI runs against real Docker targets
# - Windows: localhost scan via adinkhepra.exe (no Docker needed)
#
# Tests use //go:build e2e tag — excluded from `go test ./...` by default.
# All E2E targets are ADVISORY (non-blocking for release).
#
# make test-e2e              All E2E (Linux containers + Windows)
# make test-e2e-quick        Windows only (no Docker required)
# make test-e2e-linux        Linux container targets (requires Docker)
# make test-e2e-windows      Windows host targets only
# make test-e2e-pipeline     Full pipeline test only
# make test-e2e-version      Fastest sanity: just version check
# make build-dummy-linux     Build dummy Linux target image only
# ============================================================

E2E_TIMEOUT?=20m
E2E_TAGS=-tags e2e

# Build the dummy Linux target Docker image (intentionally misconfigured)
.PHONY: build-dummy-linux
build-dummy-linux:
	@echo "[E2E] Building dummy Linux target image..."
	docker build \
		-t khepra-dummy-linux:e2e \
		-f tests/e2e/fixtures/dummy-linux/Dockerfile \
		.
	@echo "[E2E] Image built: khepra-dummy-linux:e2e"

# All E2E tests (Linux containers + Windows host)
.PHONY: test-e2e
test-e2e: build
	@echo "[E2E] Running ALL E2E tests..."
	go test $(E2E_TAGS) ./tests/e2e/... -v -timeout $(E2E_TIMEOUT) 2>&1 | tee /tmp/e2e-all.txt
	@echo "[E2E] Results: /tmp/e2e-all.txt"

# Windows-only E2E (no Docker required — scans localhost)
.PHONY: test-e2e-quick
test-e2e-quick: build
	@echo "[E2E] Windows E2E tests (no Docker)..."
	go test $(E2E_TAGS) ./tests/e2e/... -v -timeout $(E2E_TIMEOUT) \
		-run "TestE2E_Windows" 2>&1 | tee /tmp/e2e-windows.txt
	@echo "[E2E] Results: /tmp/e2e-windows.txt"

# Windows-only alias
.PHONY: test-e2e-windows
test-e2e-windows: test-e2e-quick

# Linux container targets only
.PHONY: test-e2e-linux
test-e2e-linux: build-dummy-linux build
	@echo "[E2E] Linux container E2E tests..."
	go test $(E2E_TAGS) ./tests/e2e/... -v -timeout $(E2E_TIMEOUT) \
		-run "TestE2E_Linux" 2>&1 | tee /tmp/e2e-linux.txt
	@echo "[E2E] Results: /tmp/e2e-linux.txt"

# Full pipeline only (release gate sanity check)
.PHONY: test-e2e-pipeline
test-e2e-pipeline: build-dummy-linux build
	@echo "[E2E] Full pipeline E2E tests..."
	go test $(E2E_TAGS) ./tests/e2e/... -v -timeout $(E2E_TIMEOUT) \
		-run "FullPipeline" 2>&1 | tee /tmp/e2e-pipeline.txt
	@echo "[E2E] Results: /tmp/e2e-pipeline.txt"

# Version check only (fastest sanity — 30 seconds)
.PHONY: test-e2e-version
test-e2e-version: build
	@echo "[E2E] Version sanity check..."
	go test $(E2E_TAGS) ./tests/e2e/... -v -timeout 30s -run "VersionCheck"

# ============================================================
# Compliance-as-Code (CMMC / ASAF SSP / Trestle)
# ============================================================

.PHONY: cmmc-tracker
cmmc-tracker:
	@echo "[CMMC] Regenerating CMMC_TRACKER.md from SSP control files..."
	@if [ "$$(uname 2>/dev/null)" = "Linux" ] || [ "$$(uname 2>/dev/null)" = "Darwin" ]; then \
		chmod +x scripts/update-cmmc-tracker.sh && bash scripts/update-cmmc-tracker.sh; \
	else \
		powershell -NoProfile -ExecutionPolicy Bypass -File scripts/update-cmmc-tracker.ps1; \
	fi

.PHONY: cmmc-tracker-check
cmmc-tracker-check:
	@echo "[CMMC] Checking CMMC_TRACKER.md is up to date..."
	@if [ "$$(uname 2>/dev/null)" = "Linux" ] || [ "$$(uname 2>/dev/null)" = "Darwin" ]; then \
		chmod +x scripts/update-cmmc-tracker.sh && bash scripts/update-cmmc-tracker.sh --check; \
	else \
		powershell -NoProfile -ExecutionPolicy Bypass -File scripts/update-cmmc-tracker.ps1 -Check; \
	fi

.PHONY: ssp-assemble
ssp-assemble:
	@echo "[TRESTLE] Assembling OSCAL SSP from ASAF-GovCloud-SSP/ workspace..."
	@chmod +x scripts/trestle-assemble.sh
	@bash scripts/trestle-assemble.sh

.PHONY: ssp-validate
ssp-validate:
	@echo "[TRESTLE] Validating assembled SSP OSCAL JSON..."
	@chmod +x scripts/trestle-assemble.sh
	@bash scripts/trestle-assemble.sh --validate-only

.PHONY: compliance
compliance: cmmc-tracker ssp-assemble
	@echo "[COMPLIANCE] CMMC tracker + OSCAL SSP assembly complete"
	@echo "[COMPLIANCE]    Tracker : CMMC_TRACKER.md"
	@echo "[COMPLIANCE]    SSP     : system-security-plans/system-security-plan/system-security-plan.json"

.PHONY: hooks-install
hooks-install:
	@echo "[HOOKS] Installing ASAF compliance pre-commit hook..."
	@git config core.hooksPath .githooks
	@chmod +x .githooks/pre-commit
	@echo "[HOOKS] Hook installed -- git config core.hooksPath = .githooks"

# ============================================================
# Demo Scan Targets — Known-Vulnerable Application Corpus
# Authorized educational targets for ERT pipeline validation.
# Each produces a real Godfather Report with live CVE findings.
# ============================================================

DEMO_TARGETS_DIR?=$(CURDIR)/demo-targets

.PHONY: demo-targets-init
demo-targets-init:
	@mkdir -p "$(DEMO_TARGETS_DIR)"

# Clone DVWA — PHP/MySQL, OWASP Top 10 coverage
.PHONY: clone-dvwa
clone-dvwa: demo-targets-init
	@if [ -d "$(DEMO_TARGETS_DIR)/dvwa/.git" ]; then \
		echo "[DEMO] Updating DVWA..." && git -C "$(DEMO_TARGETS_DIR)/dvwa" pull --quiet; \
	else \
		echo "[DEMO] Cloning DVWA (depth=1)..." && \
		git clone --depth 1 https://github.com/digininja/DVWA "$(DEMO_TARGETS_DIR)/dvwa"; \
	fi
	@echo "[DEMO] DVWA ready: $(DEMO_TARGETS_DIR)/dvwa"

# Clone OWASP Juice Shop — Node.js/Express, large npm dependency tree (most CVE findings)
.PHONY: clone-juiceshop
clone-juiceshop: demo-targets-init
	@if [ -d "$(DEMO_TARGETS_DIR)/juice-shop/.git" ]; then \
		echo "[DEMO] Updating Juice Shop..." && git -C "$(DEMO_TARGETS_DIR)/juice-shop" pull --quiet; \
	else \
		echo "[DEMO] Cloning OWASP Juice Shop (depth=1)..." && \
		git clone --depth 1 https://github.com/juice-shop/juice-shop "$(DEMO_TARGETS_DIR)/juice-shop"; \
	fi
	@echo "[DEMO] Juice Shop ready: $(DEMO_TARGETS_DIR)/juice-shop"

# Clone WebGoat — Java/Maven, enterprise attack surface
.PHONY: clone-webgoat
clone-webgoat: demo-targets-init
	@if [ -d "$(DEMO_TARGETS_DIR)/webgoat/.git" ]; then \
		echo "[DEMO] Updating WebGoat..." && git -C "$(DEMO_TARGETS_DIR)/webgoat" pull --quiet; \
	else \
		echo "[DEMO] Cloning WebGoat (depth=1)..." && \
		git clone --depth 1 https://github.com/WebGoat/WebGoat "$(DEMO_TARGETS_DIR)/webgoat"; \
	fi
	@echo "[DEMO] WebGoat ready: $(DEMO_TARGETS_DIR)/webgoat"

# ERT Godfather scan → DVWA (PHP supply chain analysis)
.PHONY: scan-dvwa
scan-dvwa: clone-dvwa build-ert
	@echo "[DEMO] ═══════════════════════════════════════════════════════════════"
	@echo "[DEMO]  ERT Godfather → DVWA (Damn Vulnerable Web Application)"
	@echo "[DEMO]  PHP attack surface · Composer/apt dependency CVE analysis"
	@echo "[DEMO] ═══════════════════════════════════════════════════════════════"
	$(MAKE) ert-scan SCAN_TARGET="$(DEMO_TARGETS_DIR)/dvwa"

# ERT Godfather scan → Juice Shop (Node.js — highest CVE yield for demos)
.PHONY: scan-juiceshop
scan-juiceshop: clone-juiceshop build-ert
	@echo "[DEMO] ═══════════════════════════════════════════════════════════════"
	@echo "[DEMO]  ERT Godfather → OWASP Juice Shop (Node.js/Angular)"
	@echo "[DEMO]  npm dependency tree · CISA KEV correlation"
	@echo "[DEMO] ═══════════════════════════════════════════════════════════════"
	$(MAKE) ert-scan SCAN_TARGET="$(DEMO_TARGETS_DIR)/juice-shop"

# ERT Godfather scan → WebGoat (Java/Maven — enterprise stack)
.PHONY: scan-webgoat
scan-webgoat: clone-webgoat build-ert
	@echo "[DEMO] ═══════════════════════════════════════════════════════════════"
	@echo "[DEMO]  ERT Godfather → WebGoat (Java/Spring/Maven)"
	@echo "[DEMO]  Maven dependency tree · Spring CVE analysis"
	@echo "[DEMO] ═══════════════════════════════════════════════════════════════"
	$(MAKE) ert-scan SCAN_TARGET="$(DEMO_TARGETS_DIR)/webgoat"

# ERT Crypto attestation → DVWA (legacy crypto in PHP source)
.PHONY: scan-dvwa-crypto
scan-dvwa-crypto: clone-dvwa build-ert
	@echo "[DEMO] ERT Crypto attestation → DVWA (weak cipher/hash detection)"
	$(MAKE) ert-crypto SCAN_TARGET="$(DEMO_TARGETS_DIR)/dvwa"

# ERT Supply chain deep scan → Juice Shop
.PHONY: scan-juiceshop-architect
scan-juiceshop-architect: clone-juiceshop build-ert
	@echo "[DEMO] ERT Architect → Juice Shop (supply chain deep scan)"
	$(MAKE) ert-architect SCAN_TARGET="$(DEMO_TARGETS_DIR)/juice-shop"

# Self-audit: scan Khepra Protocol itself (eat-your-own-dog-food demo)
.PHONY: scan-self
scan-self: build-ert
	@echo "[DEMO] ═══════════════════════════════════════════════════════════════"
	@echo "[DEMO]  ERT Godfather → Khepra Protocol (self-audit)"
	@echo "[DEMO]  Go module dependency tree · Internal CVE posture"
	@echo "[DEMO] ═══════════════════════════════════════════════════════════════"
	$(MAKE) ert-scan SCAN_TARGET="$(CURDIR)"

# Full demo pipeline: all three targets + self-audit in sequence
# Use for demo video recording — run this, pipe output to asciinema or screen capture
.PHONY: demo-scan-all
demo-scan-all: scan-dvwa scan-juiceshop scan-webgoat scan-self
	@echo "[DEMO] ═══════════════════════════════════════════════════════════════"
	@echo "[DEMO]  All ERT Godfather scans complete."
	@echo "[DEMO]  Next: adinkhepra report godfather <scan_results.json>"
	@echo "[DEMO] ═══════════════════════════════════════════════════════════════"

# Remove demo target clones (does not remove ERT image)
.PHONY: clean-demo-targets
clean-demo-targets:
	@echo "[DEMO] Removing demo target clones..."
	@rm -rf "$(DEMO_TARGETS_DIR)"
	@echo "[DEMO] Clean."
