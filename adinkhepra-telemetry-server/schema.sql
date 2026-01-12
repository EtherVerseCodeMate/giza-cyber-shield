-- ============================================================================
-- ADINKHEPRA Dark Crypto Database Schema
-- Cloudflare D1 SQLite Database
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
WHERE signature_valid = 1
  AND timestamp > strftime('%s', 'now', '-90 days');

-- View: PQC adoption rate over time
CREATE VIEW IF NOT EXISTS v_pqc_adoption AS
SELECT
    date,
    total_scans,
    total_dilithium3_keys,
    total_kyber1024_keys,
    total_rsa_2048_keys,
    total_ecc_p256_keys,
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
