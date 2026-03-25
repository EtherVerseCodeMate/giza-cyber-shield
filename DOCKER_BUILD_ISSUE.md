# Docker Build Issue - Go Version Mismatch

**Date**: 2026-01-10
**Status**: ❌ **BLOCKED**

---

## Problem

Iron Bank base image (`registry1.dso.mil/ironbank/redhat/ubi/ubi9-minimal:9.3`) includes **Go 1.25.3**, but your vendored dependency `tailscale.com@v1.92.3` requires **Go >= 1.25.5**.

### Error Message
```
go: tailscale.com in vendor/modules.txt requires go >= 1.25.5 (running go 1.25.3)
```

### Root Cause
The Iron Bank repository lags behind the latest Go releases for stability and security vetting. Your project uses Tailscale v1.92.3 which was released after Iron Bank's Go 1.25.3 approval.

---

## Attempted Fixes (All Failed)

1. ❌ **Downgrade go.mod to 1.25.3** - Still fails because vendor/modules.txt enforces Go 1.25.5
2. ❌ **Set GOTOOLCHAIN=auto** - Doesn't work in `-mod=vendor` mode (can't download newer Go)
3. ❌ **Skip `go mod verify`** - Build still checks vendor/modules.txt
4. ❌ **Remove vendor, use direct dependencies** - Defeats Iron Bank security requirement for vendored dependencies

---

## Solutions (Ranked by Effort)

### Solution 1: Remove Tailscale Dependency (RECOMMENDED for Iron Bank)
**Effort**: Low
**Risk**: Low
**Timeline**: 30 minutes

Tailscale is only used in `pkg/net/tailnet/` which is **EXCLUDED** from Iron Bank build (see `.dockerignore`). You can safely remove it from `go.mod` and re-vendor.

**Steps**:
```bash
cd "c:/Users/intel/blackbox/khepra protocol"

# Remove tailscale from go.mod
go mod edit -droprequire tailscale.com

# Rebuild vendor directory
go mod tidy
go mod vendor

# Rebuild Docker image
docker build -f Dockerfile.ironbank -t adinkhepra:ironbank-debug .
```

**Impact**: None - Tailscale code is already excluded from Iron Bank builds.

---

### Solution 2: Downgrade Tailscale to v1.88.1 (Requires Go 1.25.3)
**Effort**: Medium
**Risk**: Medium
**Timeline**: 1 hour

If you need Tailscale in the main codebase (not Iron Bank), downgrade to an older version.

**Steps**:
```bash
go get tailscale.com@v1.88.1
go mod tidy
go mod vendor
```

**Impact**: May lose recent Tailscale features/bugfixes in main product.

---

### Solution 3: Wait for Iron Bank to Approve Go 1.25.5
**Effort**: None
**Risk**: None
**Timeline**: Unknown (weeks to months)

Iron Bank approvals are slow. Not recommended for immediate testing.

---

### Solution 4: Multi-Stage Build with Local Go 1.25.5
**Effort**: High
**Risk**: Medium (Iron Bank may reject)
**Timeline**: 2 hours

Download and install Go 1.25.5 inside the builder container. Iron Bank may flag this as non-approved toolchain.

---

## Recommendation

**Use Solution 1**: Remove Tailscale dependency since it's already excluded from Iron Bank builds.

```bash
cd "c:/Users/intel/blackbox/khepra protocol"
go mod edit -droprequire tailscale.com
go mod tidy
go mod vendor
```

This is the cleanest solution and aligns with your Iron Bank exclusions.

---

## Temporary Workaround for Testing (Not for Production)

If you need to test telemetry NOW without fixing vendor, build binaries locally and copy them in:

```dockerfile
# Use local build instead of Iron Bank build
FROM golang:1.25.5 AS builder
WORKDIR /build
COPY . .
RUN go build -o sonar ./cmd/sonar/main.go

FROM registry1.dso.mil/ironbank/redhat/ubi/ubi9-minimal:9.3
COPY --from=builder /build/sonar /app/bin/sonar
...
```

**Warning**: This defeats Iron Bank's reproducible build requirement.

---

## Action Required

Choose Solution 1 (remove Tailscale) or Solution 2 (downgrade Tailscale), then rebuild.

**ETA to working build**: 30 minutes after choosing solution.
