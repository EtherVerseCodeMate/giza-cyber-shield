# Building Iron Bank Container with Telemetry

**Objective**: Build KHEPRA Iron Bank container with anonymous telemetry for traction metrics + dark crypto database
**Time Required**: 15 minutes
**Prerequisites**: Docker installed, adinkhepra binary built

---

## Quick Start (TL;DR)

```bash
# 1. Build adinkhepra binary
go build -o bin/adinkhepra.exe ./cmd/adinkhepra/*.go

# 2. Generate telemetry keypair
bash scripts/generate-telemetry-keypair.sh

# 3. Build Docker image with telemetry
source telemetry-keys/.env
docker build \
  --build-arg TELEMETRY_PRIVATE_KEY=$TELEMETRY_PRIVATE_KEY \
  --build-arg VERSION=1.0.0 \
  --build-arg BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  -f Dockerfile.ironbank \
  -t khepra:ironbank-telemetry .

# 4. Test telemetry
docker run --rm -e KHEPRA_TELEMETRY=true khepra:ironbank-telemetry sonar --dir /etc
```

---

## Step-by-Step Instructions

### Step 1: Build adinkhepra Binary

The telemetry keypair generation requires the `adinkhepra` CLI tool.

```bash
cd "c:\Users\intel\blackbox\khepra protocol"

# Build adinkhepra
go build -o bin/adinkhepra.exe ./cmd/adinkhepra/*.go

# Verify
./bin/adinkhepra.exe --version
```

**Expected output**:
```
adinkhepra version 1.5.0-NUCLEAR
```

---

### Step 2: Generate Telemetry Keypair

This creates a Dilithium3 keypair used to sign telemetry beacons (prevents competitors from spoofing our metrics).

```bash
# Run keypair generator
bash scripts/generate-telemetry-keypair.sh
```

**Expected output**:
```
==========================================
KHEPRA Telemetry Keypair Generator
==========================================

[1/3] Generating Dilithium3 keypair...
[INFO] Keypair generated

[2/3] Converting private key to hex...
[INFO] Private key hex saved to: telemetry-keys/.env

[3/3] Verifying keypair...
[INFO] Public key:  telemetry-keys/khepra-telemetry-v1.pub
[INFO] Private key: telemetry-keys/khepra-telemetry-v1.priv
[INFO] Hex key (for Docker): telemetry-keys/.env

==========================================
✅ Telemetry Keypair Generated!
==========================================
```

**Files Created**:
- `telemetry-keys/khepra-telemetry-v1.pub` - Public key (for telemetry server)
- `telemetry-keys/khepra-telemetry-v1.priv` - Private key (embedded in binary)
- `telemetry-keys/.env` - Hex-encoded private key (for Docker build)

**⚠️ SECURITY**: Keep the private key secure! Add `telemetry-keys/` to `.gitignore`.

---

### Step 3: Build Docker Image with Telemetry

```bash
# Load telemetry private key into environment
source telemetry-keys/.env

# Build Iron Bank container
docker build \
  --build-arg TELEMETRY_PRIVATE_KEY=$TELEMETRY_PRIVATE_KEY \
  --build-arg VERSION=1.0.0 \
  --build-arg BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  --build-arg VCS_REF=$(git rev-parse --short HEAD) \
  -f Dockerfile.ironbank \
  -t khepra:ironbank-telemetry \
  .
```

**Build Process**:
1. Builder stage: Compiles `sonar`, `adinkhepra`, `khepra-daemon` with embedded telemetry key
2. Runtime stage: Copies binaries + public compliance CSVs (Option C)
3. Telemetry key is embedded in `sonar` binary via `-ldflags -X main.telemetryPrivateKey=...`

**Expected output**:
```
[+] Building 145.2s (23/23) FINISHED
 => [builder 1/10] FROM registry1.dso.mil/ironbank/redhat/ubi/ubi9-minimal:9.3
 => [builder 2/10] COPY --chown=1001:0 go.mod go.sum ./
 => [builder 3/10] COPY --chown=1001:0 vendor/ ./vendor/
 => [builder 4/10] COPY --chown=1001:0 . .
 => [builder 5/10] RUN go mod verify
 => [builder 6/10] RUN go build ... -X main.telemetryPrivateKey=... -o sonar
 => [runtime 1/8] COPY --from=builder /build/sonar /usr/local/bin/sonar
 => exporting to image
 => => naming to docker.io/library/khepra:ironbank-telemetry
```

---

### Step 4: Test Telemetry (Community Mode - Opt-In)

By default, telemetry is **DISABLED** in community mode (Iron Bank). Users must opt-in.

#### Test 1: Telemetry Disabled (Default)

```bash
docker run --rm khepra:ironbank-telemetry sonar --dir /etc --out /tmp/scan.json
```

**Expected output**:
```
[SONAR] Collecting Device Fingerprint...
[SONAR] Collecting Host Information...
[SONAR] Collecting Network Intelligence...
[SUCCESS] Scan complete. Snapshot saved to: /tmp/scan.json
[INFO] Anonymous telemetry disabled (set KHEPRA_TELEMETRY=true to help improve KHEPRA)
[INFO] Learn more: https://khepra.io/privacy
```

#### Test 2: Telemetry Enabled (Opt-In)

```bash
docker run --rm \
  -e KHEPRA_TELEMETRY=true \
  -e KHEPRA_TELEMETRY_SERVER=http://localhost:8080/beacon \
  khepra:ironbank-telemetry sonar --dir /etc --out /tmp/scan.json
```

**Expected output**:
```
[SONAR] Collecting Device Fingerprint...
[SONAR] Collecting Host Information...
[SONAR] Collecting Network Intelligence...
[SUCCESS] Scan complete. Snapshot saved to: /tmp/scan.json
[SUCCESS] Anonymous usage data sent (thank you for helping build the Dark Crypto Database!)
```

**⚠️ Note**: Telemetry transmission will fail if server is not running (`http://localhost:8080/beacon`). This is expected for local testing.

---

## Step 5: Verify Telemetry Beacon (Optional)

To verify the telemetry beacon is being created correctly, run with a mock server:

```bash
# Terminal 1: Start mock telemetry server
nc -l 8080
# Or use: python3 -m http.server 8080

# Terminal 2: Run scan with telemetry
docker run --rm \
  -e KHEPRA_TELEMETRY=true \
  -e KHEPRA_TELEMETRY_SERVER=http://host.docker.internal:8080/beacon \
  khepra:ironbank-telemetry sonar --dir /etc
```

**Expected HTTP POST** (in Terminal 1):
```http
POST /beacon HTTP/1.1
Host: host.docker.internal:8080
Content-Type: application/json
X-Khepra-Signature: a1b2c3d4e5f6... (Dilithium3 signature)
X-Khepra-Version: 1.5.0-NUCLEAR

{
  "telemetry_version": "1.0",
  "timestamp": "2026-01-06T12:34:56Z",
  "anonymous_id": "sha256hash...",
  "scan_metadata": {
    "scan_duration_seconds": 5,
    "targets_scanned": 156,
    "findings_count": 23,
    "compliance_frameworks": ["stig", "nist800-53", "nist800-171"],
    "scanner_version": "1.5.0-NUCLEAR",
    "container_runtime": "docker",
    "deployment_environment": "community"
  },
  "cryptographic_inventory": {
    "rsa_2048_keys": 0,
    "rsa_3072_keys": 0,
    ...
  },
  "geographic_hint": "on-prem"
}
```

---

## Telemetry Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KHEPRA_MODE` | `community` | `community` (opt-in) or `enterprise` (opt-out) |
| `KHEPRA_TELEMETRY` | (unset) | `true` to enable, `false` to disable |
| `KHEPRA_TELEMETRY_SERVER` | `https://telemetry.khepra.io/beacon` | Telemetry collection endpoint |

### Option C: Hybrid Telemetry Model

**Community Edition** (Iron Bank):
- **Default**: Telemetry DISABLED
- **Enable**: Set `KHEPRA_TELEMETRY=true`
- **Rationale**: Respects DoD/IC privacy culture, opt-in only

**Enterprise Edition** (Commercial License):
- **Default**: Telemetry ENABLED
- **Disable**: Set `KHEPRA_TELEMETRY=false`
- **Rationale**: Disclosed in EULA, most enterprises expect this

---

## What Data Is Collected?

### ✅ Collected (Anonymous):
- Scan duration (seconds)
- Number of targets scanned
- Number of findings
- Compliance frameworks used (STIG, NIST 800-53, etc.)
- Scanner version
- Container runtime (Docker, Kubernetes, native)
- Deployment environment (community, enterprise)
- Cryptographic asset **counts** (e.g., "12 RSA-2048 keys")
- Geographic hint (AWS region, Azure location, or "on-prem")

### ❌ NOT Collected (Privacy Protected):
- IP addresses
- Hostnames
- Usernames
- Specific findings (e.g., "CVE-2024-1234 on port 443")
- Actual cryptographic keys (only counts)
- File paths
- Process names
- Any personally identifiable information (PII)

### 🔒 Anti-Spoofing:
- Every beacon is signed with Dilithium3 (PQC signature)
- Telemetry server verifies signature before accepting
- Prevents competitors from injecting fake metrics

---

## Building Without Telemetry (Development)

If you want to build a container WITHOUT telemetry (e.g., for testing):

```bash
docker build \
  --build-arg VERSION=1.0.0 \
  --build-arg BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  -f Dockerfile.ironbank \
  -t khepra:ironbank-no-telemetry \
  .
```

**Result**: `sonar` binary will have empty `telemetryPrivateKey=""`, so telemetry beacons won't be signed (server will reject them).

---

## Troubleshooting

### Issue 1: "adinkhepra: command not found"

**Problem**: `generate-telemetry-keypair.sh` can't find `adinkhepra` binary.

**Fix**:
```bash
go build -o bin/adinkhepra.exe ./cmd/adinkhepra/*.go
```

### Issue 2: Docker build fails with "invalid TELEMETRY_PRIVATE_KEY"

**Problem**: Private key hex is malformed or not loaded.

**Fix**:
```bash
# Regenerate keypair
bash scripts/generate-telemetry-keypair.sh

# Verify .env file exists
cat telemetry-keys/.env
# Should show: TELEMETRY_PRIVATE_KEY=a1b2c3d4...

# Re-source
source telemetry-keys/.env
echo $TELEMETRY_PRIVATE_KEY  # Should print hex string
```

### Issue 3: Telemetry says "transmission failed"

**Problem**: Telemetry server is not reachable.

**Expected Behavior**: This is **non-fatal**. Scanner completes successfully, just logs a warning:
```
[WARN] Telemetry transmission failed: dial tcp: connection refused
```

**Fix** (for production):
- Deploy telemetry server (see [COMMUNITY_TELEMETRY_STRATEGY.md](COMMUNITY_TELEMETRY_STRATEGY.md))
- Or set `KHEPRA_TELEMETRY_SERVER=https://your-server.com/beacon`

---

## Next Steps

1. **Deploy Telemetry Server** (see [COMMUNITY_TELEMETRY_STRATEGY.md](COMMUNITY_TELEMETRY_STRATEGY.md))
   - PostgreSQL database for dark crypto fingerprints
   - Go HTTP server with Dilithium3 signature verification
   - AWS GovCloud deployment (FedRAMP compliance)

2. **Submit to Iron Bank**
   - Upload `Dockerfile.ironbank` + `hardening_manifest.yaml`
   - Telemetry is opt-in (privacy compliant)
   - Reviewers can test community scanner without enabling telemetry

3. **Monitor Traction Metrics**
   - Active installations (unique anonymous IDs)
   - Scan volume (targets scanned per month)
   - PQC readiness gap (% quantum-vulnerable)
   - Geographic distribution

4. **Monetize Dark Crypto Database**
   - Quantum Exposure Report ($25K/report)
   - PQC Readiness Index ($100K/year to analysts)
   - Cryptographic Threat Feed API ($10K/year)

---

## Security Checklist

- [x] Anonymous telemetry (no PII collected)
- [x] Opt-in for community tier (privacy-first)
- [x] Dilithium3 signature prevents spoofing
- [x] Private key embedded at build time (not in source code)
- [x] TLS 1.3 for telemetry transmission
- [x] Non-fatal failures (telemetry never breaks scans)
- [x] Privacy policy disclosed (https://khepra.io/privacy)
- [ ] Deploy telemetry server with public key verification
- [ ] Add telemetry-keys/ to .gitignore

---

**Document Status**: ✅ Complete - Ready for Implementation
**Priority**: 🟢 **STRATEGIC** - Enables $150M+ value (traction + dark crypto database)
**Owner**: SGT Souhimbou Kone
**Created**: 2026-01-06
