# Implementation Guide - License Validation System
**AdinKhepra Iron Bank - Premium Tier Deployment**

## ✅ What We've Built

### 1. License Validation Infrastructure

**Server Side** (Cloudflare Workers + D1):
- ✅ [adinkhepra-telemetry-server/src/license.js](../adinkhepra-telemetry-server/src/license.js) - License API endpoints
- ✅ [adinkhepra-telemetry-server/schema-license.sql](../adinkhepra-telemetry-server/schema-license.sql) - Database schema
- ✅ Routes implemented:
  - `POST /license/validate` - Machine ID validation
  - `POST /license/heartbeat` - Hourly liveness check
  - `DELETE /license/revoke/:id` - Remote revocation
  - `POST /license/issue` - Admin license issuance

**Client Side** (Go binary):
- ✅ [cmd/sonar/license.go](../cmd/sonar/license.go) - License validation client
- ✅ Features:
  - Machine ID generation (hostname + MAC + CPU + install path)
  - Dilithium3 signature of machine ID
  - HTTP client for validation API
  - Hourly heartbeat loop
  - Automatic fallback to community edition
  - Premium/HSM feature detection

### 2. Legal Protection

- ✅ [SECURITY.md](../SECURITY.md) - Federal statutes, penalties, prohibited activities
- ✅ [hardening_manifest.yaml](../hardening_manifest.yaml) - IP protection section
- ✅ Legal framework:
  - 18 U.S.C. § 1831-1839 (Economic Espionage Act)
  - 17 U.S.C. § 1201 (DMCA Anti-Circumvention)
  - DFARS 252.227-7013/7015 (Restricted Rights)

### 3. Strategy Documentation

- ✅ [IP_PROTECTION_STRATEGY.md](../IP_PROTECTION_STRATEGY.md) - 5-layer defense architecture
- ✅ [LICENSING_TIERS.md](../LICENSING_TIERS.md) - 3-tier business model
- ✅ [IMPLEMENTATION_GUIDE.md](../IMPLEMENTATION_GUIDE.md) - This file

---

## 🚀 Next Steps: Deployment

### Step 1: Deploy Telemetry Server with License API

```bash
cd "c:/Users/intel/blackbox/khepra protocol/adinkhepra-telemetry-server"

# Initialize D1 database with license schema
wrangler d1 execute adinkhepra-telemetry --file=schema-license.sql

# Deploy updated worker
wrangler deploy

# Test health endpoint
curl https://telemetry.souhimbou.org/health

# Expected output:
# {"status":"ok","timestamp":...,"service":"khepra-telemetry","database":"connected","version":"1.0.0"}
```

**Verify License Endpoints**:
```bash
# Test license validation endpoint (should fail without valid signature)
curl -X POST https://telemetry.souhimbou.org/license/validate \
  -H "Content-Type: application/json" \
  -d '{"machine_id":"test-001","signature":"invalid"}'

# Expected output:
# {"valid":false,"error":"Invalid cryptographic signature",...}
```

---

### Step 2: Issue Test Licenses

Use the `/license/issue` endpoint to create test licenses:

```bash
# Issue a test DoD Premium license
curl -X POST https://telemetry.souhimbou.org/license/issue \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "test-dod-premium-001",
    "organization": "US Army Cyber Command - TEST",
    "features": ["premium_pqc", "white_box_crypto", "compliance_mapping", "custom_lattice"],
    "license_tier": "dod_premium",
    "expires_in_days": 365,
    "max_devices": 1
  }'

# Expected output:
# {"status":"issued","machine_id":"test-dod-premium-001","organization":"US Army Cyber Command - TEST",...}
```

```bash
# Issue a test DoD Premium + HSM license
curl -X POST https://telemetry.souhimbou.org/license/issue \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "test-dod-hsm-001",
    "organization": "NSA - TEST",
    "features": ["premium_pqc", "white_box_crypto", "compliance_mapping", "custom_lattice", "hsm_integration"],
    "license_tier": "dod_premium_hsm",
    "expires_in_days": null,
    "max_devices": 10
  }'
```

---

### Step 3: Integrate License Client into Sonar

Update [cmd/sonar/main.go](../cmd/sonar/main.go) to call `initLicense()` at startup:

```go
// cmd/sonar/main.go
package main

import (
	"log"
	"os"
)

var (
	version = "1.0.0" // Set via ldflags
	logger  = log.New(os.Stdout, "[sonar] ", log.LstdFlags)
)

func main() {
	logger.Println("Starting Sonar security scanner...")

	// Initialize license validation
	if err := initLicense(); err != nil {
		logger.Printf("License initialization completed with fallback: %v", err)
	}

	// Log current license status
	logger.Printf("License tier: %s", getLicenseTier())
	logger.Printf("Features: %v", getLicenseFeatures())
	logger.Printf("Premium crypto: %v", isPremiumLicensed())
	logger.Printf("HSM enabled: %v", isHSMEnabled())

	// Continue with normal sonar execution
	// ...
}
```

---

### Step 4: Build Binary with Embedded Dilithium3 Key

**Option A: Build with Telemetry Private Key** (for testing)

```bash
# Read the Dilithium3 private key from telemetry-keys/.env
cd "c:/Users/intel/blackbox/khepra protocol"

# Extract private key (remove "TELEMETRY_PRIVATE_KEY=" prefix)
$PRIV_KEY = (Get-Content "telemetry-keys/.env" | Select-String "TELEMETRY_PRIVATE_KEY") -replace "TELEMETRY_PRIVATE_KEY=", ""

# Build with embedded key
go build -ldflags="-X main.version=1.0.0 -X main.dilithiumPrivateKey=$PRIV_KEY" -o bin/sonar.exe ./cmd/sonar
```

**Option B: Build without Key** (community edition fallback)

```bash
# Build without embedded key - will use ephemeral key
go build -ldflags="-X main.version=1.0.0" -o bin/sonar-community.exe ./cmd/sonar
```

---

### Step 5: Test License Validation

**Test 1: With Valid License (Premium Tier)**

```bash
# Set environment to enable telemetry
$env:KHEPRA_TELEMETRY = "true"

# Run sonar with valid license
./bin/sonar.exe --help

# Expected output:
# [sonar] Starting Sonar security scanner...
# [sonar] ✅ License validated: US Army Cyber Command - TEST (dod_premium)
# [sonar] Features enabled: [premium_pqc white_box_crypto compliance_mapping custom_lattice]
# [sonar] License expires: 2027-01-10T00:00:00Z
# [sonar] License tier: dod_premium
# [sonar] Premium crypto: true
# [sonar] HSM enabled: false
```

**Test 2: Without License (Community Edition)**

```bash
# Disable telemetry
$env:KHEPRA_TELEMETRY = "false"

# Run sonar
./bin/sonar.exe --help

# Expected output:
# [sonar] License validation disabled via environment variable, using community edition
# [sonar] License tier: community
# [sonar] Features: [basic_pqc]
# [sonar] Premium crypto: false
# [sonar] Using Cloudflare CIRCL for post-quantum cryptography
```

**Test 3: Revoked License**

```bash
# Revoke the license
curl -X DELETE https://telemetry.souhimbou.org/license/revoke/test-dod-premium-001

# Run sonar (should fallback after heartbeat)
./bin/sonar.exe --help

# After 1 hour (or on next heartbeat):
# [sonar] License revoked: disable_premium_features
# [sonar] Premium features disabled, falling back to community edition
```

---

### Step 6: Build Obfuscated Binary

Install garble for Go code obfuscation:

```bash
go install mvdan.cc/garble@latest
```

Build obfuscated binary:

```bash
# Build with maximum obfuscation
garble -tiny -literals -seed=random build \
  -ldflags="-s -w -X main.version=1.0.0 -X main.dilithiumPrivateKey=$PRIV_KEY" \
  -o bin/sonar-premium.exe \
  ./cmd/sonar

# Additional protection: strip debug symbols (already done with -s -w)
# Additional protection: UPX compression (optional)
upx --best --ultra-brute bin/sonar-premium.exe
```

**Obfuscation Effects**:
- `-tiny`: Minimize binary size
- `-literals`: Encrypt string literals
- `-seed=random`: Randomize obfuscation (different output each build)
- `-ldflags="-s -w"`: Strip symbol table and debug info

---

### Step 7: Create GitHub Release with Protected Binary

```bash
# Create release tarball
cd "c:/Users/intel/blackbox/khepra protocol"

# Create bin directory structure
mkdir -p release/bin
cp bin/sonar-premium.exe release/bin/sonar.exe

# Add other binaries
go build -o release/bin/adinkhepra.exe ./cmd/adinkhepra
go build -o release/bin/khepra-daemon.exe ./cmd/khepra-daemon

# Create tarball
tar -czf adinkhepra-ironbank-v1.0.0-windows-amd64.tar.gz -C release .

# Calculate SHA256
certutil -hashfile adinkhepra-ironbank-v1.0.0-windows-amd64.tar.gz SHA256

# Create GitHub release
gh release create v1.0.0 \
  adinkhepra-ironbank-v1.0.0-windows-amd64.tar.gz \
  --title "AdinKhepra Iron Bank v1.0.0" \
  --notes "DoD Premium Edition with proprietary PQC algorithms

**License Required**: This release requires a valid DoD license.
**License Validation**: telemetry.souhimbou.org
**Features**: Premium PQC, White-box Crypto, Compliance Mapping

**Legal Notice**: Protected under 18 U.S.C. § 1831-1839 (Economic Espionage Act).
Reverse engineering prohibited. Unauthorized use may result in Federal prosecution.

**Checksum**: SHA256 <paste hash here>
"
```

---

### Step 8: Update Dockerfile.ironbank for Binary Ingestion

Update [Dockerfile.ironbank](../Dockerfile.ironbank) to download pre-built binary:

```dockerfile
# Stage 1: Download pre-built binaries from GitHub releases
FROM registry1.dso.mil/ironbank/redhat/ubi/ubi9-minimal:9.3 AS downloader

ARG VERSION=1.0.0
ARG GITHUB_TOKEN=""

# Install curl for downloading
RUN microdnf install -y curl tar && microdnf clean all

# Download release tarball
RUN curl -L \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    -o /tmp/adinkhepra.tar.gz \
    "https://github.com/nouchix/adinkhepra-asaf-ironbank/releases/download/v${VERSION}/adinkhepra-ironbank-v${VERSION}-windows-amd64.tar.gz"

# Extract binaries
RUN tar -xzf /tmp/adinkhepra.tar.gz -C /tmp/

# Verify checksums (add SHA256 verification here)
# RUN echo "<SHA256> /tmp/bin/sonar.exe" | sha256sum -c -

# Stage 2: Runtime container
FROM registry1.dso.mil/ironbank/redhat/ubi/ubi9-minimal:9.3

# Labels
LABEL name="adinkhepra-ironbank"
LABEL vendor="NouchiX SecRed Knowledge Inc."
LABEL version="1.0.0"
LABEL description="Post-quantum cryptographic security scanner for DoD (Premium Edition)"
LABEL maintainer="souhimbou.d.kone.mil@army.mil"

# Copy pre-built binaries from downloader stage
COPY --from=downloader /tmp/bin/sonar.exe /app/sonar
COPY --from=downloader /tmp/bin/adinkhepra.exe /app/adinkhepra
COPY --from=downloader /tmp/bin/khepra-daemon.exe /app/khepra-daemon

# Set permissions
RUN chmod +x /app/sonar /app/adinkhepra /app/khepra-daemon

# Create non-root user (Iron Bank requirement)
RUN useradd -u 1001 -r -g 0 -s /sbin/nologin \
    -c "Sonar user" sonar

# Switch to non-root
USER 1001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD ["/app/sonar", "--version"]

# Default entrypoint
ENTRYPOINT ["/app/sonar"]
CMD ["--help"]
```

---

### Step 9: Build and Test Iron Bank Container

```bash
# Build Iron Bank container
docker build -f Dockerfile.ironbank \
  --build-arg VERSION=1.0.0 \
  --build-arg GITHUB_TOKEN=$env:GITHUB_TOKEN \
  -t adinkhepra:ironbank-v1.0.0 .

# Test container
docker run --rm adinkhepra:ironbank-v1.0.0 --version

# Expected output:
# Sonar v1.0.0

# Test with license validation enabled
docker run --rm \
  -e KHEPRA_TELEMETRY=true \
  adinkhepra:ironbank-v1.0.0

# Expected output:
# [sonar] Starting Sonar security scanner...
# [sonar] ✅ License validated: ...
```

---

## 🧪 Testing Checklist

### License Validation Tests

- [ ] **Valid License**: Premium features enabled
- [ ] **Invalid License**: Falls back to community edition
- [ ] **Expired License**: Falls back after grace period
- [ ] **Revoked License**: Immediate shutdown on heartbeat
- [ ] **Network Failure**: Graceful fallback with warning
- [ ] **Disabled Telemetry**: Community edition mode

### Binary Protection Tests

- [ ] **String Extraction**: `strings sonar-premium.exe | grep adinkra` (should show minimal info)
- [ ] **Symbol Table**: `objdump -t sonar-premium.exe` (should be empty with `-s -w`)
- [ ] **Decompilation**: Test with Go decompiler (should show obfuscated code)
- [ ] **Size Comparison**: Obfuscated binary smaller than regular build

### Integration Tests

- [ ] **Air-Gapped Mode**: License disabled via env var
- [ ] **Networked Mode**: License validated at startup
- [ ] **Heartbeat Loop**: Hourly checks for 24 hours
- [ ] **Feature Detection**: Premium crypto enabled when licensed
- [ ] **HSM Detection**: HSM enabled when feature present

---

## 📊 Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| License Validation Success Rate | >99% | Monitor validation logs |
| False Positives (valid licenses rejected) | <0.1% | Customer support tickets |
| Revocation Latency | <5 seconds | Test revocation API |
| Binary Reverse Engineering Time | >6 months | External security audit |
| Legal Violations Detected | 0 | Audit logs + customer reports |

---

## 🔒 Security Considerations

### Secret Management

**Dilithium3 Private Key**:
- ✅ Embedded in binary via build args (not in source code)
- ✅ Hex-encoded (8,000 characters)
- ⚠️ **NEVER commit to Git**
- ⚠️ **NEVER log or print**
- ⚠️ Stored in `telemetry-keys/.env` (gitignored)

### Build Process

**Secure Build Pipeline**:
1. Build on trusted CI/CD server (GitHub Actions with secrets)
2. Embed private key via `-ldflags` at build time
3. Obfuscate with garble (symbol renaming, string encryption)
4. Strip symbols with `-s -w`
5. Optionally compress with UPX
6. Calculate SHA256 checksum
7. Sign binary with code signing certificate (optional)
8. Upload to GitHub releases (private repository)

### Network Security

**Telemetry Server**:
- ✅ HTTPS only (TLS 1.3)
- ✅ Cloudflare DDoS protection
- ✅ Rate limiting (100 requests/hour per machine)
- ✅ CORS headers (allow all for telemetry, restrict for admin endpoints)
- ⚠️ Add authentication for `/license/issue` and `/license/revoke` endpoints

---

## 📞 Support Contacts

**License Issues**: support@souhimbou.ai
**Security Issues**: security@souhimbou.ai
**DoD Contracting**: souhimbou.d.kone.mil@army.mil

**Telemetry Server**: https://telemetry.souhimbou.org
**Iron Bank Repository**: https://github.com/nouchix/adinkhepra-asaf-ironbank

---

*Last Updated: 2026-01-10*
*Version: 1.0*
*Author: SGT Souhimbou Kone, NouchiX SecRed Knowledge Inc.*
