-- Automated Licensing Schema
-- Enables Stripe webhook and pilot signup automation with queue-based signing
--
-- Flow:
-- 1. Stripe webhook or pilot signup creates entry in license_requests
-- 2. Local signer polls /api/licenses/pending via Cloudflare Tunnel
-- 3. Local signer signs with ML-DSA-65 private key
-- 4. Local signer submits to /api/licenses/complete
-- 5. License becomes active

-- License Requests Queue (pending licenses awaiting signing)
CREATE TABLE IF NOT EXISTS license_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT UNIQUE NOT NULL,        -- Format: req-{random8}
    machine_id TEXT NOT NULL,               -- Target machine ID
    organization TEXT NOT NULL,             -- Customer organization
    customer_email TEXT,                    -- Contact email

    -- Payment info (Stripe)
    stripe_session_id TEXT,                 -- checkout.session.completed ID
    stripe_customer_id TEXT,                -- Stripe customer ID

    -- Pilot info
    pilot_id TEXT,                          -- Links to pilot_signups

    -- License configuration
    license_tier TEXT NOT NULL DEFAULT 'pilot',  -- 'pilot', 'pro', 'enterprise', 'government'
    features TEXT NOT NULL,                 -- JSON array of features
    limits TEXT NOT NULL,                   -- JSON: {max_devices, max_concurrent_scans, etc.}

    -- Request metadata
    requested_at INTEGER NOT NULL,
    source TEXT NOT NULL,                   -- 'stripe', 'pilot_signup', 'manual'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'

    -- Signing info (filled by local signer)
    signature TEXT,                         -- ML-DSA-65 signature (hex)
    completed_at INTEGER,
    error_message TEXT,

    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_license_requests_status ON license_requests(status);
CREATE INDEX IF NOT EXISTS idx_license_requests_source ON license_requests(source);
CREATE INDEX IF NOT EXISTS idx_license_requests_machine ON license_requests(machine_id);
CREATE INDEX IF NOT EXISTS idx_license_requests_stripe ON license_requests(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_license_requests_pilot ON license_requests(pilot_id);

-- Pilot Signups (30-day trial program)
CREATE TABLE IF NOT EXISTS pilot_signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pilot_id TEXT UNIQUE NOT NULL,          -- Format: pilot-{random8}
    email TEXT NOT NULL,                    -- Contact email
    organization TEXT NOT NULL,             -- Company name
    contact_name TEXT,                      -- Contact person
    use_case TEXT,                          -- How they plan to use KHEPRA
    referral_source TEXT,                   -- 'direct', 'linkedin', 'conference', etc.

    -- Enrollment
    enrollment_token TEXT,                  -- Generated enrollment token

    -- Status tracking
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,            -- 30 days from creation
    activated_at INTEGER,                   -- When first license was activated
    status TEXT DEFAULT 'pending',          -- 'pending', 'active', 'expired', 'converted'

    -- Conversion tracking
    converted_to_paid INTEGER DEFAULT 0,
    conversion_date INTEGER,
    stripe_customer_id TEXT,

    -- Engagement metrics
    total_scans INTEGER DEFAULT 0,
    last_activity INTEGER,

    created_at_ts INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_pilot_email ON pilot_signups(email);
CREATE INDEX IF NOT EXISTS idx_pilot_status ON pilot_signups(status);
CREATE INDEX IF NOT EXISTS idx_pilot_expires ON pilot_signups(expires_at);
CREATE INDEX IF NOT EXISTS idx_pilot_enrollment ON pilot_signups(enrollment_token);

-- Add columns to licenses table for signing and source tracking
-- (SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so wrap in try/catch in application)
-- ALTER TABLE licenses ADD COLUMN signature TEXT;
-- ALTER TABLE licenses ADD COLUMN license_blob TEXT;
-- ALTER TABLE licenses ADD COLUMN stripe_customer_id TEXT;
-- ALTER TABLE licenses ADD COLUMN pilot_id TEXT;

-- Views for Automation Analytics

-- Pending license requests summary
CREATE VIEW IF NOT EXISTS v_pending_requests AS
SELECT
    lr.request_id,
    lr.machine_id,
    lr.organization,
    lr.customer_email,
    lr.license_tier,
    lr.source,
    lr.status,
    datetime(lr.requested_at, 'unixepoch') as requested_time,
    CAST((strftime('%s', 'now') - lr.requested_at) / 60 AS INTEGER) as minutes_pending
FROM license_requests lr
WHERE lr.status = 'pending'
ORDER BY lr.requested_at ASC;

-- Pilot program dashboard
CREATE VIEW IF NOT EXISTS v_pilot_dashboard AS
SELECT
    ps.pilot_id,
    ps.email,
    ps.organization,
    ps.status,
    datetime(ps.created_at, 'unixepoch') as signup_time,
    datetime(ps.expires_at, 'unixepoch') as expiration_time,
    CAST((ps.expires_at - strftime('%s', 'now')) / 86400 AS INTEGER) as days_remaining,
    ps.total_scans,
    CASE WHEN ps.converted_to_paid = 1 THEN 'Yes' ELSE 'No' END as converted,
    COUNT(l.machine_id) as active_devices
FROM pilot_signups ps
LEFT JOIN licenses l ON l.pilot_id = ps.pilot_id AND l.revoked = 0
GROUP BY ps.pilot_id
ORDER BY ps.created_at DESC;

-- Stripe revenue tracking
CREATE VIEW IF NOT EXISTS v_stripe_licenses AS
SELECT
    lr.stripe_session_id,
    lr.stripe_customer_id,
    lr.organization,
    lr.customer_email,
    lr.license_tier,
    lr.status,
    datetime(lr.requested_at, 'unixepoch') as payment_time,
    datetime(lr.completed_at, 'unixepoch') as activation_time
FROM license_requests lr
WHERE lr.source = 'stripe'
ORDER BY lr.requested_at DESC;

-- License source breakdown
CREATE VIEW IF NOT EXISTS v_license_sources AS
SELECT
    source,
    status,
    COUNT(*) as count,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM license_requests
GROUP BY source, status
ORDER BY source, status;

-- Pilot conversion funnel
CREATE VIEW IF NOT EXISTS v_pilot_funnel AS
SELECT
    'Total Signups' as stage,
    COUNT(*) as count
FROM pilot_signups
UNION ALL
SELECT
    'Activated (Used Token)' as stage,
    COUNT(*) as count
FROM pilot_signups WHERE status IN ('active', 'converted')
UNION ALL
SELECT
    'Converted to Paid' as stage,
    COUNT(*) as count
FROM pilot_signups WHERE converted_to_paid = 1;
