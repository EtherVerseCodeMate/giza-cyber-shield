# Cloudflare Worker Files Review

**Review Date**: 2026-01-10
**Files Reviewed**: `wrangler.toml`, `schema.sql`
**Status**: ⚠️ **REQUIRES UPDATES**

---

## File 1: wrangler.toml

### ✅ Correct Elements

```toml
name = "khepra-telemetry"
main = "src/index.js"
compatibility_date = "2024-01-01"
node_compat = true

[[d1_databases]]
binding = "DB"
database_name = "khepra-telemetry"
database_id = "PASTE_YOUR_DATABASE_ID_HERE"  # From step above

[vars]
MAX_BEACON_SIZE = "10240"
RATE_LIMIT_PER_HOUR = "100"
```

**Good**:
- ✅ Correct D1 database binding syntax
- ✅ Environment variables for rate limiting and beacon size
- ✅ Node compatibility enabled (needed for crypto libraries)
- ✅ Commented routes section for future use

### 🔴 CRITICAL: Missing Telemetry Public Key

**Problem**: No `TELEMETRY_PUBLIC_KEY` environment variable!

Your client signs beacons with Dilithium3 private key, but the server needs the **public key** to verify signatures.

**Fix Required**:
```toml
[vars]
MAX_BEACON_SIZE = "10240"
RATE_LIMIT_PER_HOUR = "100"

# CRITICAL: Dilithium3 public key for signature verification
# This is the PUBLIC key corresponding to telemetry-keys/khepra-telemetry-v1_dilithium.pub
TELEMETRY_PUBLIC_KEY = "PASTE_PUBLIC_KEY_HEX_HERE"
```

**How to Get Public Key**:
```bash
cd "c:/Users/intel/blackbox/khepra protocol"

# Extract public key from generated keypair
cat telemetry-keys/khepra-telemetry-v1_dilithium.pub | xxd -p | tr -d '\n'
```

**Note**: Public keys are NOT secret and can be in source code. Only the **private key** (embedded in sonar binary) is secret.

### 🟡 OPTIONAL: Add Secrets for Future

For production, you may want to add secrets (not in `vars`, but via `wrangler secret put`):

```bash
# Optional: API key for authenticated enterprise endpoints (future)
wrangler secret put ENTERPRISE_API_KEY

# Optional: Webhook URL for anomaly alerts (future)
wrangler secret put SLACK_WEBHOOK_URL
```

---

## File 2: schema.sql

### ⚠️ MAJOR ISSUE: Missing Dark Crypto Database Fields

**Current Schema**:
```sql
CREATE TABLE IF NOT EXISTS beacons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    beacon_id TEXT NOT NULL UNIQUE,
    timestamp INTEGER NOT NULL,
    scanner_version TEXT,
    os TEXT,
    arch TEXT,
    scan_duration_ms INTEGER,
    assets_found INTEGER,
    quantum_vulnerable INTEGER,  -- ❌ Too generic!
    quantum_safe INTEGER,         -- ❌ Too generic!
    signature_valid INTEGER DEFAULT 1,
    device_id_hash TEXT,
    ip_country TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    ...
);
```

**Problem**: You're storing aggregates (`quantum_vulnerable`, `quantum_safe`) instead of the **detailed crypto inventory** that makes the Dark Crypto Database valuable!

**Your client sends**:
```go
type CryptoInventory struct {
    RSA2048Keys       int `json:"rsa_2048_keys"`      // ❌ NOT STORED
    RSA3072Keys       int `json:"rsa_3072_keys"`      // ❌ NOT STORED
    RSA4096Keys       int `json:"rsa_4096_keys"`      // ❌ NOT STORED
    ECCP256Keys       int `json:"ecc_p256_keys"`      // ❌ NOT STORED
    ECCP384Keys       int `json:"ecc_p384_keys"`      // ❌ NOT STORED
    Dilithium3Keys    int `json:"dilithium3_keys"`    // ❌ NOT STORED
    Kyber1024Keys     int `json:"kyber1024_keys"`     // ❌ NOT STORED
    TLSWeakConfigs    int `json:"tls_weak_configs"`   // ❌ NOT STORED
    DeprecatedCiphers int `json:"deprecated_ciphers"` // ❌ NOT STORED
}
```

### ✅ FIXED SCHEMA (Dark Crypto Database Optimized)

```sql
-- ============================================================================
-- ADINKHEPRA Dark Crypto Database Schema
-- Purpose: Catalog quantum-vulnerable cryptographic assets across DoD/IC
-- Value: $100M-$200M M&A premium (Intel Brief valuation)
-- ============================================================================

-- Main telemetry beacons table
CREATE TABLE IF NOT EXISTS beacons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    beacon_id TEXT NOT NULL UNIQUE,
    timestamp INTEGER NOT NULL,

    -- Scanner metadata
    scanner_version TEXT,
    os TEXT,
    arch TEXT,
    scan_duration_ms INTEGER,
    total_assets_scanned INTEGER DEFAULT 0,

    -- Dark Crypto Database: Quantum-vulnerable cryptography inventory
    rsa_2048_keys INTEGER DEFAULT 0,    -- Critical: Most common quantum target
    rsa_3072_keys INTEGER DEFAULT 0,    -- Moderate risk
    rsa_4096_keys INTEGER DEFAULT 0,    -- Lower risk but still vulnerable
    ecc_p256_keys INTEGER DEFAULT 0,    -- Critical: Weak curve
    ecc_p384_keys INTEGER DEFAULT 0,    -- Moderate: Still quantum-vulnerable

    -- Dark Crypto Database: Post-quantum safe cryptography inventory
    dilithium3_keys INTEGER DEFAULT 0,  -- PQC adoption metric (signing)
    kyber1024_keys INTEGER DEFAULT 0,   -- PQC adoption metric (encryption)

    -- Dark Crypto Database: Legacy/weak configurations
    tls_weak_configs INTEGER DEFAULT 0,      -- TLS 1.0/1.1, weak ciphersuites
    deprecated_ciphers INTEGER DEFAULT 0,    -- 3DES, RC4, MD5, SHA-1

    -- Signature verification status
    signature_valid INTEGER DEFAULT 1,  -- 1 = valid Dilithium3 signature, 0 = invalid/missing

    -- Privacy-preserving identifiers
    device_id_hash TEXT,  -- SHA256 hash, not actual device ID
    ip_country TEXT,      -- Country-level only (from Cloudflare CF-IPCountry header)

    -- Timestamps
    created_at INTEGER DEFAULT (strftime('%s', 'now')),

    -- Constraints
    CHECK (timestamp > 0),
    CHECK (total_assets_scanned >= 0),
    CHECK (rsa_2048_keys >= 0),
    CHECK (rsa_3072_keys >= 0),
    CHECK (rsa_4096_keys >= 0),
    CHECK (ecc_p256_keys >= 0),
    CHECK (ecc_p384_keys >= 0),
    CHECK (dilithium3_keys >= 0),
    CHECK (kyber1024_keys >= 0),
    CHECK (tls_weak_configs >= 0),
    CHECK (deprecated_ciphers >= 0)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_timestamp ON beacons(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_device_hash ON beacons(device_id_hash);
CREATE INDEX IF NOT EXISTS idx_scanner_version ON beacons(scanner_version);
CREATE INDEX IF NOT EXISTS idx_country ON beacons(ip_country);
CREATE INDEX IF NOT EXISTS idx_created_at ON beacons(created_at DESC);

-- Analytics indexes (for Dark Crypto Database queries)
CREATE INDEX IF NOT EXISTS idx_quantum_vuln ON beacons(rsa_2048_keys, ecc_p256_keys);
CREATE INDEX IF NOT EXISTS idx_pqc_adoption ON beacons(dilithium3_keys, kyber1024_keys);
CREATE INDEX IF NOT EXISTS idx_signature_valid ON beacons(signature_valid, timestamp);

-- ============================================================================
-- Daily aggregated statistics (for fast dashboard queries)
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY,  -- Format: YYYY-MM-DD

    -- Basic metrics
    total_scans INTEGER DEFAULT 0,
    unique_devices INTEGER DEFAULT 0,
    total_assets INTEGER DEFAULT 0,

    -- Dark Crypto Database: Daily quantum vulnerability aggregates
    total_rsa_2048_keys INTEGER DEFAULT 0,
    total_rsa_3072_keys INTEGER DEFAULT 0,
    total_rsa_4096_keys INTEGER DEFAULT 0,
    total_ecc_p256_keys INTEGER DEFAULT 0,
    total_ecc_p384_keys INTEGER DEFAULT 0,

    -- Dark Crypto Database: Daily PQC adoption aggregates
    total_dilithium3_keys INTEGER DEFAULT 0,
    total_kyber1024_keys INTEGER DEFAULT 0,

    -- Dark Crypto Database: Daily legacy crypto aggregates
    total_tls_weak_configs INTEGER DEFAULT 0,
    total_deprecated_ciphers INTEGER DEFAULT 0,

    -- Performance metrics
    avg_scan_duration_ms REAL DEFAULT 0,

    -- Timestamps
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- ============================================================================
-- Version distribution tracking (scanner adoption metrics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS version_stats (
    scanner_version TEXT PRIMARY KEY,
    usage_count INTEGER DEFAULT 0,
    first_seen INTEGER DEFAULT (strftime('%s', 'now')),
    last_seen INTEGER DEFAULT (strftime('%s', 'now'))
);

-- ============================================================================
-- Geographic distribution (country-level quantum exposure)
-- ============================================================================
CREATE TABLE IF NOT EXISTS country_stats (
    ip_country TEXT PRIMARY KEY,
    total_scans INTEGER DEFAULT 0,
    unique_devices INTEGER DEFAULT 0,

    -- Dark Crypto Database: Per-country quantum vulnerability
    total_rsa_2048_keys INTEGER DEFAULT 0,
    total_ecc_p256_keys INTEGER DEFAULT 0,
    total_dilithium3_keys INTEGER DEFAULT 0,
    total_kyber1024_keys INTEGER DEFAULT 0,

    last_updated INTEGER DEFAULT (strftime('%s', 'now'))
);

-- ============================================================================
-- Anomaly detection log (for security monitoring)
-- ============================================================================
CREATE TABLE IF NOT EXISTS anomalies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    beacon_id TEXT NOT NULL,
    anomaly_type TEXT NOT NULL,  -- e.g., 'HIGH_KEY_COUNT', 'FAST_SCAN', 'INVALID_SIGNATURE'
    severity TEXT DEFAULT 'medium',  -- 'low', 'medium', 'high', 'critical'
    details TEXT,  -- JSON with anomaly details
    detected_at INTEGER DEFAULT (strftime('%s', 'now')),

    FOREIGN KEY (beacon_id) REFERENCES beacons(beacon_id)
);

CREATE INDEX IF NOT EXISTS idx_anomaly_type ON anomalies(anomaly_type, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_severity ON anomalies(severity, detected_at DESC);

-- ============================================================================
-- ANALYTICS VIEWS (for Dark Crypto Database reporting)
-- ============================================================================

-- View: Global quantum exposure summary
CREATE VIEW IF NOT EXISTS v_quantum_exposure AS
SELECT
    COUNT(DISTINCT device_id_hash) as total_devices,
    SUM(total_assets_scanned) as total_assets,
    SUM(rsa_2048_keys) as total_rsa_2048,
    SUM(rsa_3072_keys) as total_rsa_3072,
    SUM(rsa_4096_keys) as total_rsa_4096,
    SUM(ecc_p256_keys) as total_ecc_p256,
    SUM(ecc_p384_keys) as total_ecc_p384,
    SUM(tls_weak_configs) as total_weak_tls,
    SUM(deprecated_ciphers) as total_deprecated,
    SUM(dilithium3_keys) as total_pqc_sign,
    SUM(kyber1024_keys) as total_pqc_encrypt,
    -- Quantum Risk Ratio (vulnerable keys / PQC keys)
    ROUND(
        (SUM(rsa_2048_keys) + SUM(ecc_p256_keys)) * 1.0 /
        NULLIF(SUM(dilithium3_keys) + SUM(kyber1024_keys), 0),
        2
    ) as quantum_risk_ratio
FROM beacons
WHERE signature_valid = 1  -- Only count verified beacons
  AND timestamp > strftime('%s', 'now', '-90 days');  -- Last 90 days

-- View: PQC adoption rate over time
CREATE VIEW IF NOT EXISTS v_pqc_adoption AS
SELECT
    date,
    total_scans,
    total_dilithium3_keys,
    total_kyber1024_keys,
    total_rsa_2048_keys,
    total_ecc_p256_keys,
    -- PQC Adoption Percentage
    ROUND(
        (total_dilithium3_keys + total_kyber1024_keys) * 100.0 /
        NULLIF(
            total_rsa_2048_keys + total_ecc_p256_keys +
            total_dilithium3_keys + total_kyber1024_keys,
            0
        ),
        2
    ) as pqc_adoption_percent
FROM daily_stats
ORDER BY date DESC;

-- View: High-risk devices (many quantum-vulnerable keys, no PQC)
CREATE VIEW IF NOT EXISTS v_high_risk_devices AS
SELECT
    device_id_hash,
    ip_country,
    SUM(rsa_2048_keys) as total_rsa_2048,
    SUM(ecc_p256_keys) as total_ecc_p256,
    SUM(dilithium3_keys) as total_pqc_keys,
    COUNT(*) as scan_count,
    MAX(timestamp) as last_scan
FROM beacons
WHERE signature_valid = 1
GROUP BY device_id_hash
HAVING (total_rsa_2048 + total_ecc_p256) > 100
   AND total_pqc_keys = 0
ORDER BY (total_rsa_2048 + total_ecc_p256) DESC
LIMIT 100;
```

---

## 🔍 Schema Comparison

| Field | Your Schema | Fixed Schema | Impact |
|-------|-------------|--------------|--------|
| `quantum_vulnerable` | ✅ Generic aggregate | ❌ REMOVED | Lost detail |
| `quantum_safe` | ✅ Generic aggregate | ❌ REMOVED | Lost detail |
| `rsa_2048_keys` | ❌ Missing | ✅ **ADDED** | 🎯 **Dark Crypto DB** |
| `rsa_3072_keys` | ❌ Missing | ✅ **ADDED** | 🎯 **Dark Crypto DB** |
| `rsa_4096_keys` | ❌ Missing | ✅ **ADDED** | 🎯 **Dark Crypto DB** |
| `ecc_p256_keys` | ❌ Missing | ✅ **ADDED** | 🎯 **Dark Crypto DB** |
| `ecc_p384_keys` | ❌ Missing | ✅ **ADDED** | 🎯 **Dark Crypto DB** |
| `dilithium3_keys` | ❌ Missing | ✅ **ADDED** | 🎯 **PQC Adoption** |
| `kyber1024_keys` | ❌ Missing | ✅ **ADDED** | 🎯 **PQC Adoption** |
| `tls_weak_configs` | ❌ Missing | ✅ **ADDED** | 🎯 **Legacy Risk** |
| `deprecated_ciphers` | ❌ Missing | ✅ **ADDED** | 🎯 **Legacy Risk** |

**Verdict**: ⚠️ **Your schema will NOT build the Dark Crypto Database moat**

---

## 📊 What You're Missing

### Revenue Impact Analysis

**With Your Current Schema**:
- Basic telemetry (scan counts, version tracking)
- Generic "quantum vulnerable" aggregate
- **No actionable quantum vulnerability data**
- **Cannot generate Quantum Exposure Reports**
- **Cannot build M&A premium ($100M-$200M lost)**

**With Fixed Schema**:
- ✅ Detailed RSA key distribution (2048, 3072, 4096)
- ✅ ECC curve vulnerability tracking (P-256, P-384)
- ✅ PQC adoption metrics (Dilithium3, Kyber1024)
- ✅ Legacy crypto detection (TLS 1.0/1.1, weak ciphers)
- ✅ Geographic quantum exposure heatmaps
- ✅ Revenue products enabled:
  - **Quantum Exposure Report**: $25K per report
  - **PQC Readiness Index**: $100K/year subscription
  - **Threat Feed API**: $10K/year per customer
  - **Dark Crypto Database**: $100M-$200M M&A premium

---

## 🚀 Deployment Instructions

### Step 1: Create D1 Database
```bash
# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create khepra-telemetry

# Output will show:
# [[d1_databases]]
# binding = "DB"
# database_name = "khepra-telemetry"
# database_id = "PASTE_THIS_INTO_WRANGLER_TOML"
```

### Step 2: Update wrangler.toml
```toml
[[d1_databases]]
binding = "DB"
database_name = "khepra-telemetry"
database_id = "abc123-your-actual-database-id"  # From step 1

[vars]
MAX_BEACON_SIZE = "10240"
RATE_LIMIT_PER_HOUR = "100"
TELEMETRY_PUBLIC_KEY = "YOUR_DILITHIUM3_PUBLIC_KEY_HEX"  # From telemetry-keys/*.pub
```

### Step 3: Apply Fixed Schema
```bash
# Apply schema to D1 database (use FIXED schema.sql, not your current one)
wrangler d1 execute khepra-telemetry --file=schema.sql

# Verify tables created
wrangler d1 execute khepra-telemetry --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### Step 4: Update Worker Code
Your `src/index.js` needs to be updated to:
1. Verify Dilithium3 signatures (critical!)
2. Parse client beacon structure correctly
3. Store all 9 crypto inventory fields
4. Update daily_stats with detailed aggregates

### Step 5: Deploy
```bash
# Deploy to Cloudflare Workers
wrangler deploy

# Test health endpoint
curl https://khepra-telemetry.YOUR-SUBDOMAIN.workers.dev/health

# Expected:
# {"status":"ok","timestamp":1736524800000,"service":"khepra-telemetry","database":"connected"}
```

---

## ✅ Final Recommendations

### Immediate Actions (Before Docker Testing)

1. **Update schema.sql** with the FIXED version above (adds all Dark Crypto DB fields)
2. **Extract public key**:
   ```bash
   cd "c:/Users/intel/blackbox/khepra protocol"
   cat telemetry-keys/khepra-telemetry-v1_dilithium.pub | xxd -p | tr -d '\n'
   ```
3. **Add `TELEMETRY_PUBLIC_KEY` to wrangler.toml**
4. **Update `src/index.js`** to store crypto inventory fields (I can generate this for you)
5. **Deploy to Cloudflare Workers**

### After Deployment

- Test with real beacons from Docker container
- Verify crypto inventory fields are populated
- Generate analytics queries for fundraising deck
- Create dashboard at `dashboard.khepra.io` (React + Cloudflare Pages)

---

## 🎯 Strategic Priority

**CRITICAL**: The schema is the foundation of your $100M-$200M Dark Crypto Database moat.

Without detailed crypto inventory fields:
- ❌ No quantum vulnerability intelligence
- ❌ No competitive moat
- ❌ No revenue products
- ❌ No M&A premium

With fixed schema:
- ✅ World's only PQC-authenticated quantum vulnerability database
- ✅ DoD/IC-wide cryptographic asset inventory
- ✅ Revenue products: Reports, API, consulting
- ✅ $100M-$200M M&A valuation justification

---

## 📋 Updated Files Needed

I can generate for you:
1. **✅ Fixed schema.sql** (completed above)
2. **Updated wrangler.toml** (with public key)
3. **Updated src/index.js** (with signature verification + crypto inventory storage)
4. **Example analytics queries** (for fundraising metrics)

Would you like me to generate these files now?

---

**Review Status**: ⚠️ **REQUIRES SCHEMA UPDATE**
**Priority**: 🔴 **CRITICAL** - Dark Crypto Database depends on this
**Next Step**: Apply fixed schema, deploy worker, test with real beacons
