-- Add missing columns to the licenses table (safe — IF NOT EXISTS not supported
-- for columns in SQLite, so each ALTER TABLE is idempotent only if run once;
-- errors from already-existing columns are ignored by D1's tolerant executor)

-- Core new columns required for HMAC auth and registration flow
ALTER TABLE licenses ADD COLUMN max_concurrent_scans INTEGER DEFAULT 5;
ALTER TABLE licenses ADD COLUMN retention_days INTEGER DEFAULT 1;
ALTER TABLE licenses ADD COLUMN ai_credits_monthly INTEGER DEFAULT 50;
ALTER TABLE licenses ADD COLUMN tier_config TEXT;
ALTER TABLE licenses ADD COLUMN enrollment_token_id INTEGER;
ALTER TABLE licenses ADD COLUMN hostname TEXT;
ALTER TABLE licenses ADD COLUMN platform TEXT;
ALTER TABLE licenses ADD COLUMN agent_version TEXT;
ALTER TABLE licenses ADD COLUMN api_key TEXT;
ALTER TABLE licenses ADD COLUMN signature TEXT;
ALTER TABLE licenses ADD COLUMN license_blob TEXT;
ALTER TABLE licenses ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE licenses ADD COLUMN pilot_id TEXT;
