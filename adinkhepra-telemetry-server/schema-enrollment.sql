-- Enrollment Token Schema
-- Enables automated license provisioning via pre-shared enrollment tokens
--
-- Flow:
-- 1. Admin creates enrollment token for customer (POST /enrollment/tokens)
-- 2. Customer receives token via SouHimBou.ai dashboard
-- 3. Agent calls POST /license/register with machine_id + enrollment_token
-- 4. Server validates token, creates license, returns activation

-- Enrollment Tokens table
CREATE TABLE IF NOT EXISTS enrollment_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,           -- Format: khepra-enroll-{org}-{random16}
    organization TEXT NOT NULL,            -- Customer organization name
    license_tier TEXT NOT NULL DEFAULT 'trial',  -- 'trial', 'professional', 'enterprise'
    features TEXT NOT NULL,                -- JSON array of enabled features
    max_registrations INTEGER DEFAULT 5,   -- Max machines that can use this token
    current_registrations INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER,                    -- NULL = never expires
    active INTEGER DEFAULT 1,              -- 0 = deactivated
    last_used INTEGER,                     -- Timestamp of last successful registration
    created_by TEXT,                       -- Admin username who created the token
    notes TEXT                             -- Admin notes
);

CREATE INDEX IF NOT EXISTS idx_enrollment_token ON enrollment_tokens(token);
CREATE INDEX IF NOT EXISTS idx_enrollment_org ON enrollment_tokens(organization);
CREATE INDEX IF NOT EXISTS idx_enrollment_active ON enrollment_tokens(active);

-- Add columns to licenses table for tracking enrollment source
-- (Run this if the columns don't exist)
-- ALTER TABLE licenses ADD COLUMN enrollment_token_id INTEGER;
-- ALTER TABLE licenses ADD COLUMN hostname TEXT;
-- ALTER TABLE licenses ADD COLUMN platform TEXT;
-- ALTER TABLE licenses ADD COLUMN agent_version TEXT;

-- View: Enrollment token usage summary
CREATE VIEW IF NOT EXISTS v_enrollment_summary AS
SELECT
    et.id,
    et.token,
    et.organization,
    et.license_tier,
    et.max_registrations,
    et.current_registrations,
    (et.max_registrations - et.current_registrations) as remaining_slots,
    CASE
        WHEN et.active = 0 THEN 'deactivated'
        WHEN et.expires_at IS NOT NULL AND et.expires_at < strftime('%s', 'now') THEN 'expired'
        WHEN et.current_registrations >= et.max_registrations THEN 'exhausted'
        ELSE 'active'
    END as status,
    datetime(et.created_at, 'unixepoch') as created_time,
    datetime(et.expires_at, 'unixepoch') as expires_time,
    datetime(et.last_used, 'unixepoch') as last_used_time,
    et.created_by
FROM enrollment_tokens et
ORDER BY et.created_at DESC;

-- View: Licenses by enrollment token
CREATE VIEW IF NOT EXISTS v_licenses_by_enrollment AS
SELECT
    et.organization,
    et.token,
    l.machine_id,
    l.hostname,
    l.platform,
    l.agent_version,
    l.license_tier,
    datetime(l.issued_at, 'unixepoch') as issued_time,
    datetime(l.expires_at, 'unixepoch') as expires_time,
    CASE WHEN l.revoked = 1 THEN 'revoked' ELSE 'active' END as status
FROM licenses l
JOIN enrollment_tokens et ON l.enrollment_token_id = et.id
ORDER BY l.issued_at DESC;

-- Insert sample enrollment token for testing
INSERT OR IGNORE INTO enrollment_tokens (
    token,
    organization,
    license_tier,
    features,
    max_registrations,
    created_at,
    expires_at,
    created_by,
    notes
) VALUES (
    'khepra-enroll-cuminmall-test1234abcd',
    'Cumin Mall (Paul - Case Study)',
    'trial',
    '["scan", "cve_check", "dashboard_view", "basic_reports"]',
    3,
    strftime('%s', 'now'),
    strftime('%s', 'now', '+90 days'),
    'system:setup',
    'Initial test enrollment token for Paul case study'
);
