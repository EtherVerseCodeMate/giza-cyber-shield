-- License Management Schema
-- Extends adinkhepra-telemetry-server with IP protection features

-- Licenses table
CREATE TABLE IF NOT EXISTS licenses (
    machine_id TEXT PRIMARY KEY,
    organization TEXT NOT NULL,  -- DoD unit (e.g., "US Army 25th ID", "DISA", "NSA")
    features TEXT NOT NULL,      -- JSON array: ["premium_pqc", "white_box_crypto", "hsm_integration"]
    license_tier TEXT NOT NULL DEFAULT 'dod_premium',  -- 'dod_premium', 'contractor', 'trial'
    issued_at INTEGER NOT NULL,
    expires_at INTEGER,          -- NULL = perpetual license
    max_devices INTEGER DEFAULT 1,
    max_concurrent_scans INTEGER DEFAULT 5,  -- 5 for Starter, 20 for Pro, 50 for Business
    retention_days INTEGER DEFAULT 1,        -- 1 for Starter, 7 for Pro, 30 for Business
    ai_credits_monthly INTEGER DEFAULT 50,   -- TBot queries
    tier_config TEXT,                        -- JSON: extra overrides
    -- Registration metadata (populated by handleLicenseRegister)
    enrollment_token_id INTEGER,             -- FK → enrollment_tokens.id
    hostname TEXT,
    platform TEXT,
    agent_version TEXT,
    -- HMAC authentication: raw api_key stored so the server can verify
    -- client heartbeat signatures. 256-bit CSPRNG key; not a user password.
    api_key TEXT,
    -- ML-DSA-65 signed license fields (populated by handleLicenseComplete)
    signature TEXT,
    license_blob TEXT,
    -- Payment and pilot tracking
    stripe_customer_id TEXT,
    pilot_id TEXT,
    revoked INTEGER DEFAULT 0,
    revoked_at INTEGER,
    revoked_reason TEXT,
    last_validated INTEGER,
    last_heartbeat INTEGER,
    validation_count INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_licenses_org ON licenses(organization);
CREATE INDEX IF NOT EXISTS idx_licenses_revoked ON licenses(revoked);
CREATE INDEX IF NOT EXISTS idx_licenses_expires ON licenses(expires_at);

-- License Validations (audit log)
CREATE TABLE IF NOT EXISTS license_validations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    version TEXT,
    installation_id TEXT,
    validation_result TEXT NOT NULL,  -- 'success', 'error', 'denied'
    error_message TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_validations_machine ON license_validations(machine_id);
CREATE INDEX IF NOT EXISTS idx_validations_timestamp ON license_validations(timestamp);
CREATE INDEX IF NOT EXISTS idx_validations_result ON license_validations(validation_result);

-- License Heartbeats (liveness monitoring)
CREATE TABLE IF NOT EXISTS license_heartbeats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    status_data TEXT,  -- JSON: uptime, memory, cpu, etc.
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_heartbeats_machine ON license_heartbeats(machine_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_timestamp ON license_heartbeats(timestamp);

-- License Audit Log (admin actions)
CREATE TABLE IF NOT EXISTS license_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id TEXT NOT NULL,
    action TEXT NOT NULL,  -- 'issue', 'revoke', 'renew', 'modify'
    timestamp INTEGER NOT NULL,
    details TEXT,  -- JSON
    admin_user TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_machine ON license_audit_log(machine_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON license_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON license_audit_log(timestamp);

-- Views for Analytics

-- Active licenses summary
CREATE VIEW IF NOT EXISTS v_active_licenses AS
SELECT
    COUNT(*) as total_licenses,
    COUNT(CASE WHEN revoked = 0 THEN 1 END) as active_licenses,
    COUNT(CASE WHEN revoked = 1 THEN 1 END) as revoked_licenses,
    COUNT(CASE WHEN expires_at IS NULL THEN 1 END) as perpetual_licenses,
    COUNT(CASE WHEN expires_at < strftime('%s', 'now') THEN 1 END) as expired_licenses,
    COUNT(DISTINCT organization) as unique_organizations
FROM licenses;

-- License usage by organization
CREATE VIEW IF NOT EXISTS v_org_licenses AS
SELECT
    organization,
    COUNT(*) as total_licenses,
    COUNT(CASE WHEN revoked = 0 THEN 1 END) as active,
    SUM(validation_count) as total_validations,
    MAX(last_validated) as most_recent_validation
FROM licenses
GROUP BY organization
ORDER BY total_validations DESC;

-- Recent validations (last 24 hours)
CREATE VIEW IF NOT EXISTS v_recent_validations AS
SELECT
    lv.machine_id,
    l.organization,
    lv.timestamp,
    lv.version,
    lv.validation_result,
    datetime(lv.timestamp, 'unixepoch') as validation_time
FROM license_validations lv
JOIN licenses l ON lv.machine_id = l.machine_id
WHERE lv.timestamp > (strftime('%s', 'now') - 86400)
ORDER BY lv.timestamp DESC
LIMIT 100;

-- Licenses requiring attention (expired or no recent heartbeat)
CREATE VIEW IF NOT EXISTS v_licenses_attention AS
SELECT
    machine_id,
    organization,
    CASE
        WHEN revoked = 1 THEN 'revoked'
        WHEN expires_at < strftime('%s', 'now') THEN 'expired'
        WHEN last_heartbeat < (strftime('%s', 'now') - 7200) THEN 'no_heartbeat'
        ELSE 'ok'
    END as status,
    datetime(last_heartbeat, 'unixepoch') as last_heartbeat_time,
    datetime(expires_at, 'unixepoch') as expiration_time
FROM licenses
WHERE status != 'ok'
ORDER BY last_heartbeat DESC;

-- Insert sample DoD licenses for testing
INSERT OR IGNORE INTO licenses (
    machine_id,
    organization,
    features,
    license_tier,
    issued_at,
    expires_at,
    max_devices
) VALUES
(
    'dod-test-001',
    'US Army Cyber Command',
    '["premium_pqc", "white_box_crypto", "hsm_integration"]',
    'dod_premium',
    strftime('%s', 'now'),
    strftime('%s', 'now', '+365 days'),
    10
),
(
    'dod-test-002',
    'DISA - Defense Information Systems Agency',
    '["premium_pqc", "white_box_crypto"]',
    'dod_premium',
    strftime('%s', 'now'),
    NULL,  -- Perpetual license
    100
),
(
    'dod-test-003',
    'NSA - National Security Agency',
    '["premium_pqc", "white_box_crypto", "hsm_integration", "custom_lattice"]',
    'dod_premium',
    strftime('%s', 'now'),
    NULL,  -- Perpetual license
    1000
);
