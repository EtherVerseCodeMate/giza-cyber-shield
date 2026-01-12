# Air-Gapped Development Guide

## Problem Analysis

Your local development environment is **air-gapped** (no external network access), which causes compilation issues when dependencies aren't vendored.

### Issue 1: Blocked Go Module Proxy ✅ SOLVED

**Error:** `Get "https://proxy.golang.org/...": Forbidden (403)`

**Root Cause:** Network firewall blocking access to:
- proxy.golang.org (Go module proxy)
- github.com (direct module downloads)
- sum.golang.org (checksum verification)

**Solution:** Use Go's vendor mode to commit dependencies to git.

### Issue 2: Proprietary Package Dependencies 🔧 NEEDS FIX

**Error:** `cannot find module providing package github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra`

**Root Cause:** `cmd/sonar/main.go` imports proprietary `pkg/adinkra` which is excluded by `.dockerignore` for IP protection.

**Solution:** Refactor sonar to use open-source alternatives (cloudflare/circl for Dilithium3, crypto/sha256 for hashing).

---

## Complete Solution

### Step 1: Vendor Dependencies (Run on Internet-Connected Machine)

```bash
# Prerequisites: Run on a machine WITH internet access

cd "c:/Users/intel/blackbox/khepra protocol"

# Download all Go module dependencies
go mod download

# Create vendor directory with all dependencies
go mod vendor

# Verify vendor directory was created
ls vendor/

# Commit vendor directory
git add -f vendor/ .gitignore
git commit -m "chore: vendor dependencies for air-gapped builds

- Added vendor/ directory with all Go module dependencies (3,881 files)
- Downgraded tailscale.com to v1.88.1 for Go 1.25.3 compatibility (Iron Bank UBI9)
- Excludes proprietary packages: pkg/adinkra, pkg/license, pkg/kms, pkg/agi, pkg/llm
- Enables air-gapped Iron Bank container builds per DISA requirements

Note: Architectural blocker remains in cmd/sonar/main.go (pkg/adinkra dependency)
See IRON_BANK_BUILD_STATUS.md for refactoring instructions"

# Push to repository (with increased buffer for large upload)
git config --global http.postBuffer 524288000
git config --global http.maxRequestBuffer 524288000
git config --global core.compression 0
git push
```

### Step 2: Fix Sonar Binary Dependencies

See [IRON_BANK_BUILD_STATUS.md](../IRON_BANK_BUILD_STATUS.md) for detailed refactoring instructions.

**Required Changes in cmd/sonar/main.go:**

```go
// OLD (proprietary):
import "github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
pk, sk, err := adinkra.GenerateDilithiumKey()
hash := adinkra.Hash([]byte(timestamp))

// NEW (open-source):
import (
    "crypto/sha256"
    "encoding/hex"
    "github.com/cloudflare/circl/sign/dilithium/mode3"
)
pk, sk, err := mode3.GenerateKey(rand.Reader)
hashBytes := sha256.Sum256([]byte(timestamp))
hash := hex.EncodeToString(hashBytes[:])
```

### Step 3: Build in Air-Gapped Environment

```bash
# Pull latest changes (includes vendor directory)
cd "c:/Users/intel/blackbox/khepra protocol"
git pull

# Verify vendor directory exists
ls vendor/github.com/cloudflare/circl
ls vendor/tailscale.com

# Build using vendored dependencies (no network required)
go build -mod=vendor -o bin/sonar.exe ./cmd/sonar/main.go
go build -mod=vendor -o bin/adinkhepra.exe ./cmd/adinkhepra/*.go
go build -mod=vendor -o bin/khepra-daemon.exe ./cmd/khepra-daemon/main.go
```

### Step 4: Iron Bank Container Build

```bash
# Set telemetry private key (8,000 hex characters)
$env:TELEMETRY_PRIVATE_KEY = Get-Content "telemetry-keys/.env" | Select-String "TELEMETRY_PRIVATE_KEY" | ForEach-Object { $_ -replace "TELEMETRY_PRIVATE_KEY=", "" }

# Build Iron Bank container
docker build -f Dockerfile.ironbank `
  --build-arg TELEMETRY_PRIVATE_KEY=$env:TELEMETRY_PRIVATE_KEY `
  --build-arg VERSION=1.0.0 `
  --build-arg BUILD_DATE=$(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ") `
  --build-arg VCS_REF=$(git rev-parse --short HEAD) `
  -t adinkhepra:ironbank-debug .

# Test container
docker run --rm adinkhepra:ironbank-debug sonar --help
```

---

## Current Status

### ✅ Completed
- Go 1.25.3 compatibility (downgraded Tailscale v1.88.1)
- Vendor directory created (3,881 files, 1,371,343 lines)
- Telemetry server deployed: https://telemetry.souhimbou.org
- Dilithium3 keypair generated (4,000 byte private key)
- Git merge conflicts resolved

### 🔄 In Progress
- **Pushing vendor directory to GitHub** (large upload, ~100MB+)
  - Increased http.postBuffer to 500MB
  - Disabled compression for speed
  - May require multiple attempts due to GitHub timeout limits

### ⚠️ Blocked
- **Iron Bank container build** - waiting on:
  1. Vendor directory push completion
  2. Sonar refactoring (remove pkg/adinkra dependency)

---

## Development Workflow

### Recommended Setup

```
┌─────────────────────────┐
│  Internet-Connected     │
│  Development Machine    │
│  (This Windows box)     │
│                         │
│  • go mod download      │
│  • go mod vendor        │
│  • docker build         │
│  • git commit & push    │
└───────────┬─────────────┘
            │
            │ git push (large upload in progress)
            │
            ▼
┌─────────────────────────┐
│  GitHub Repository      │
│  EtherVerseCodeMate/    │
│  giza-cyber-shield      │
│                         │
│  • vendor/ committed    │
│  • bin/ in .gitignore   │
└───────────┬─────────────┘
            │
            │ Iron Bank pulls
            │
            ▼
┌─────────────────────────┐
│  Iron Bank Registry     │
│  registry1.dso.mil      │
│                         │
│  • Builds from vendor/  │
│  • No network access    │
│  • RHEL-09-STIG-V1R3    │
└─────────────────────────┘
```

---

## Environment Parameters

### Current Repository
- **Public Module:** `github.com/EtherVerseCodeMate/giza-cyber-shield` (community edition)
- **Iron Bank Repository:** `https://github.com/nouchix/adinkhepra-asaf-ironbank`
  - Organization: NouchiX (owned by personal account)
  - SSH URL: `git@github.com:nouchix/adinkhepra-asaf-ironbank.git`
  - DoD credentials: souhimbou.d.kone.mil@army.mil (Secret clearance)
  - GitLab Integration: Configured for Iron Bank Docker import
- **Go Version:** 1.25.3 (matches Iron Bank UBI9)
- **Branch:** main
- **Working Directory:** `c:\Users\intel\blackbox\khepra protocol`

### Key Dependencies
- `github.com/cloudflare/circl v1.6.1` (Dilithium3, Kyber1024)
- `tailscale.com v1.88.1` (downgraded for Go 1.25.3)
- `golang.org/x/crypto v0.46.0`
- `github.com/xuri/excelize/v2 v2.10.0` (STIG/CCI mapping)

### Telemetry Infrastructure
- **Server:** https://telemetry.souhimbou.org (Cloudflare Workers + D1)
- **Database:** Cloudflare D1 (e8ef77ce-5203-4b78-8969-9ee2dc74a7b6)
- **Algorithm:** Dilithium3 (ML-DSA-65)
- **Public Key:** 1,952 bytes (embedded in wrangler.toml)
- **Private Key:** 4,000 bytes (embedded in Docker build via ARG)

### Iron Bank Base Image
- **Registry:** registry1.dso.mil
- **Image:** ironbank/redhat/ubi/ubi9-minimal:9.3
- **Go Version:** 1.25.3 (from UBI9 repos)
- **STIG:** RHEL-09-STIG-V1R3

---

## Verification

### Confirm Vendor Setup

```bash
# Check vendor directory exists
ls vendor/github.com/cloudflare/circl
ls vendor/tailscale.com

# Verify modules.txt
cat vendor/modules.txt | findstr "cloudflare tailscale"

# Check Go version
go version  # Should be 1.25.3 or higher
```

### Test Air-Gapped Build

```bash
# Disable network access to simulate air-gap
$env:GOPROXY = "off"
$env:GOSUMDB = "off"

# Build should succeed with vendor
go build -mod=vendor -o bin/test-sonar.exe ./cmd/sonar/main.go

# Build should fail without vendor
go build -o bin/test-sonar.exe ./cmd/sonar/main.go  # Expected to fail
```

---

## Troubleshooting

### Error: "Connection was reset" during git push

**Cause:** Vendor directory too large (1.3M+ lines) exceeding GitHub HTTP timeout
**Fix:**
```bash
git config --global http.postBuffer 524288000      # 500MB buffer
git config --global http.maxRequestBuffer 524288000
git config --global core.compression 0              # Disable compression
git push  # Retry
```

### Error: "cannot find module providing package .../pkg/adinkra"

**Cause:** Proprietary package excluded by `.dockerignore`
**Fix:** Refactor cmd/sonar/main.go per IRON_BANK_BUILD_STATUS.md

### Error: "module tailscale.com@v1.92.3 requires go >= 1.25.5"

**Cause:** Iron Bank UBI9 has Go 1.25.3
**Fix:** Already applied - Tailscale downgraded to v1.88.1

---

## Git Configuration for Large Uploads

Current settings optimized for vendor directory push:

```bash
# Check current config
git config --global --get http.postBuffer
git config --global --get http.maxRequestBuffer
git config --global --get core.compression

# Expected values:
# http.postBuffer=524288000 (500MB)
# http.maxRequestBuffer=524288000 (500MB)
# core.compression=0 (disabled)
```

---

## Classification

**DISTRIBUTION STATEMENT A:** Approved for public release. Distribution is unlimited.

**SPDX-License-Identifier:** Proprietary

---

## Support

**Vendor:** NouchiX SecRed Knowledge Inc.
**Contact:** support@souhimbou.ai
**Technical Lead:** SGT Souhimbou Kone
**DoD Email:** souhimbou.d.kone.mil@army.mil
**Clearance:** Secret
**Repositories:**
- Community Edition: https://github.com/EtherVerseCodeMate/giza-cyber-shield
- Iron Bank (DoD): https://github.com/nouchix/adinkhepra-asaf-ironbank
  - Organization: NouchiX (personal account ownership)
  - Integrated with GitLab for Iron Bank pipeline
