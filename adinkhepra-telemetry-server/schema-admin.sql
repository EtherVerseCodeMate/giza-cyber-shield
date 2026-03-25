-- Admin Authentication Schema
-- JWT-based authentication for license management with per-admin audit trail

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,  -- bcrypt hash
    role TEXT DEFAULT 'admin',     -- 'admin', 'super_admin'
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    last_login INTEGER,
    active INTEGER DEFAULT 1,      -- 0 = disabled, 1 = active
    created_by TEXT                -- Username of admin who created this account
);

CREATE INDEX IF NOT EXISTS idx_admin_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_active ON admin_users(active);

-- Admin sessions (JWT token tracking for revocation)
CREATE TABLE IF NOT EXISTS admin_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    token_jti TEXT UNIQUE NOT NULL,  -- JWT ID (for revocation)
    issued_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked INTEGER DEFAULT 0,
    revoked_at INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (admin_id) REFERENCES admin_users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_jti ON admin_sessions(token_jti);
CREATE INDEX IF NOT EXISTS idx_sessions_admin ON admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_sessions_revoked ON admin_sessions(revoked);

-- Update license_audit_log to track which admin performed action
-- (Already exists in schema-license.sql, but we'll add admin_user column)
-- ALTER TABLE license_audit_log ADD COLUMN admin_username TEXT;
-- Note: SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS,
-- so we'll handle this in the Worker code by adding the column if missing

-- Insert default super admin (password: Change1234! - MUST CHANGE ON FIRST USE)
-- Password hash for "Change1234!" (bcrypt cost 10)
-- CRITICAL: User MUST change this password immediately after first login
INSERT OR IGNORE INTO admin_users (
    id,
    username,
    password_hash,
    role,
    created_by
) VALUES (
    1,
    'admin',
    '$2a$10$rXvQ8YZK3.cJV5Y.hF5YZOqH3xN8s2nGpJxFqS5ZvQ8YZK3.cJV5Y',  -- Change1234!
    'super_admin',
    'system'
);

-- Views for admin analytics

-- Active admins summary
CREATE VIEW IF NOT EXISTS v_active_admins AS
SELECT
    COUNT(*) as total_admins,
    COUNT(CASE WHEN active = 1 THEN 1 END) as active_admins,
    COUNT(CASE WHEN active = 0 THEN 1 END) as disabled_admins,
    COUNT(CASE WHEN role = 'super_admin' THEN 1 END) as super_admins,
    COUNT(CASE WHEN last_login > strftime('%s', 'now', '-7 days') THEN 1 END) as recently_active
FROM admin_users;

-- Admin activity log (who did what)
CREATE VIEW IF NOT EXISTS v_admin_activity AS
SELECT
    au.username,
    au.role,
    COUNT(CASE WHEN la.action = 'issue' THEN 1 END) as licenses_issued,
    COUNT(CASE WHEN la.action = 'revoke' THEN 1 END) as licenses_revoked,
    COUNT(CASE WHEN la.action = 'modify' THEN 1 END) as licenses_modified,
    MAX(la.timestamp) as last_action_time,
    datetime(MAX(la.timestamp), 'unixepoch') as last_action_datetime
FROM admin_users au
LEFT JOIN license_audit_log la ON au.username = la.admin_user
WHERE au.active = 1
GROUP BY au.id, au.username, au.role
ORDER BY last_action_time DESC;
