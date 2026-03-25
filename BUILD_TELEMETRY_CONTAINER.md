# Build Iron Bank Container with Telemetry

**Date**: 2026-01-10
**Status**: Ready to build (Docker Desktop must be running)

---

## Prerequisites

1. **Start Docker Desktop** (currently not running)
2. Telemetry keys are ready in `telemetry-keys/.env`

---

## Build Command

Run from the main repository (`c:\Users\intel\blackbox\khepra protocol`):

```bash
# Navigate to repository
cd "c:/Users/intel/blackbox/khepra protocol"

# Load telemetry private key from .env
source telemetry-keys/.env

# Build Iron Bank container with embedded telemetry key
docker build \
  --build-arg TELEMETRY_PRIVATE_KEY="$TELEMETRY_PRIVATE_KEY" \
  --build-arg VERSION=1.0.0 \
  --build-arg BUILD_DATE=2026-01-10T10:08:31Z \
  --build-arg VCS_REF=6278448 \
  -f Dockerfile.ironbank \
  -t adinkhepra:ironbank-debug .
```

**Windows PowerShell Version**:
```powershell
cd "c:\Users\intel\blackbox\khepra protocol"

# Load .env file
$env:TELEMETRY_PRIVATE_KEY = (Get-Content telemetry-keys\.env | Where-Object { $_ -match '^TELEMETRY_PRIVATE_KEY=' }) -replace 'TELEMETRY_PRIVATE_KEY=', ''

# Build container
docker build `
  --build-arg TELEMETRY_PRIVATE_KEY="$env:TELEMETRY_PRIVATE_KEY" `
  --build-arg VERSION=1.0.0 `
  --build-arg BUILD_DATE=2026-01-10T10:08:31Z `
  --build-arg VCS_REF=6278448 `
  -f Dockerfile.ironbank `
  -t adinkhepra:ironbank-debug .
```

---

## Test Commands (After Build)

### 1. Test Telemetry DISABLED (Default Opt-Out)
```bash
docker run --rm adinkhepra:ironbank-debug sonar --dir /etc
```

**Expected Output**:
```
Anonymous telemetry disabled (set KHEPRA_TELEMETRY=true to opt-in)
Scanning directory: /etc
...
```

### 2. Test Telemetry ENABLED (Opt-In)
```bash
docker run --rm -e KHEPRA_TELEMETRY=true adinkhepra:ironbank-debug sonar --dir /etc
```

**Expected Output**:
```
Anonymous telemetry enabled (set KHEPRA_TELEMETRY=false to opt-out)
Scanning directory: /etc
...
Sending telemetry beacon to https://telemetry.souhimbou.org/beacon
Telemetry beacon sent successfully
```

### 3. Verify Beacon Received on Server
```bash
# Check server stats
curl https://telemetry.souhimbou.org/stats

# Check analytics (Dark Crypto Database)
curl https://telemetry.souhimbou.org/analytics
```

**Expected Response** (analytics):
```json
{
  "quantum_exposure": {
    "total_rsa_2048": 42,
    "total_ecc_p256": 15,
    "total_pqc_sign": 0,
    "quantum_risk_ratio": null
  },
  "pqc_adoption_trend": [],
  "generated_at": 1736505600000
}
```

### 4. Query D1 Database Directly
```bash
cd "c:/Users/intel/blackbox/khepra protocol/adinkhepra-telemetry-server"

# View recent beacons
wrangler d1 execute adinkhepra-telemetry --command="SELECT * FROM beacons ORDER BY created_at DESC LIMIT 5"

# View Dark Crypto Database aggregates
wrangler d1 execute adinkhepra-telemetry --command="SELECT * FROM v_quantum_exposure"

# View PQC adoption trend
wrangler d1 execute adinkhepra-telemetry --command="SELECT * FROM v_pqc_adoption LIMIT 10"
```

---

## Telemetry Configuration

**Embedded in Container**:
- **Private Key**: 4,000 bytes (Dilithium3 mode3 signing key)
- **Server URL**: `https://telemetry.souhimbou.org`
- **Default**: Opt-out (KHEPRA_TELEMETRY=false)

**Dark Crypto Database Fields Collected**:
1. `rsa_2048_keys` - RSA-2048 certificates/keys found
2. `rsa_3072_keys` - RSA-3072 certificates/keys found
3. `rsa_4096_keys` - RSA-4096 certificates/keys found
4. `ecc_p256_keys` - NIST P-256 elliptic curve keys found
5. `ecc_p384_keys` - NIST P-384 elliptic curve keys found
6. `dilithium3_keys` - Dilithium3 PQC keys found
7. `kyber1024_keys` - Kyber1024 PQC keys found
8. `tls_weak_configs` - Weak TLS configurations detected
9. `deprecated_ciphers` - Deprecated cipher suites detected

**Privacy Guarantees**:
- No PII collected (no IP address, no hostnames, no file paths)
- Anonymous device ID (SHA-256 hash)
- Country-level geolocation only (no city/coordinates)
- Cryptographic inventory only (no actual certificates/keys sent)
- PQC-signed beacons (anti-spoofing via Dilithium3)

---

## Build Troubleshooting

### Error: "The system cannot find the file specified"
**Cause**: Docker Desktop is not running

**Fix**: Start Docker Desktop, wait for it to fully initialize, then run build command

### Error: "TELEMETRY_PRIVATE_KEY is empty"
**Cause**: .env file not sourced correctly

**Fix**:
```bash
# Verify key is loaded
echo $TELEMETRY_PRIVATE_KEY | wc -c
# Should output: 8001 (8,000 hex chars + newline)

# If empty, manually export
export TELEMETRY_PRIVATE_KEY=$(grep TELEMETRY_PRIVATE_KEY telemetry-keys/.env | cut -d= -f2)
```

### Error: "failed to solve with frontend dockerfile.v0"
**Cause**: Dockerfile.ironbank syntax error or missing base image

**Fix**: Verify Iron Bank base image is accessible:
```bash
docker pull registry1.dso.mil/ironbank/redhat/ubi/ubi9:9.5
```

---

## Next Steps After Build

1. ✅ **Build Container** (run command above after starting Docker)
2. Test telemetry disabled mode
3. Test telemetry enabled mode
4. Verify beacon data in D1 database
5. STIG compliance validation
6. Make repository public

---

**Prepared**: 2026-01-10
**Docker Status**: Not running (start Docker Desktop first)
**Telemetry Server**: ✅ LIVE at https://telemetry.souhimbou.org
