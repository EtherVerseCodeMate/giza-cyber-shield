-- Migration: AdinKhepra Protocol Pricing Tiers
-- Date: 2026-02-27
-- Source: https://nouchix.com/pricing
--
-- Tiers (from pricing page):
--   KHEPRI  — $50/month   — 10 nodes,    1 user,  500 API calls/day
--   RA      — $500/month  — 100 nodes,   5 users, 1,000 API calls/day
--   ATUM    — $2,000/month— 1,000 nodes, 25 users, unlimited API
--   OSIRIS  — Custom      — unlimited,   unlimited, unlimited (DoD/Gov)
--
-- Changes:
--   1. Add max_users and api_calls_daily_limit columns to licenses
--   2. Add price_cents column for Stripe price amount reference
--   3. Update tier CHECK constraint to include new AdinKhepra tier names
--   4. Update capabilities defaults per tier
--   5. Seed tier_definitions reference table

-- ─── 1. Add new columns to licenses ──────────────────────────────────────────

ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS max_users            INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS api_calls_daily_limit INTEGER,   -- NULL = unlimited
  ADD COLUMN IF NOT EXISTS price_cents          INTEGER,    -- Stripe price amount for reference
  ADD COLUMN IF NOT EXISTS trial_ends_at        TIMESTAMPTZ;

COMMENT ON COLUMN licenses.max_users IS 'Maximum user seats included in this tier';
COMMENT ON COLUMN licenses.api_calls_daily_limit IS 'Max API calls per day; NULL = unlimited (ATUM/OSIRIS)';
COMMENT ON COLUMN licenses.price_cents IS 'Monthly price in cents matching the Stripe price object';
COMMENT ON COLUMN licenses.trial_ends_at IS 'When the free trial period ends (NULL if no trial)';

-- ─── 2. Tier definitions reference table ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS tier_definitions (
  tier            TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL,
  symbol          TEXT NOT NULL,   -- Egyptian symbol emoji from pricing page
  price_cents     INTEGER,         -- NULL = custom/contact sales
  max_nodes       INTEGER,         -- NULL = unlimited
  max_users       INTEGER,         -- NULL = unlimited
  api_calls_daily INTEGER,         -- NULL = unlimited
  capabilities    JSONB NOT NULL DEFAULT '[]'::jsonb,
  description     TEXT,
  target_segment  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE tier_definitions IS
  'AdinKhepra Protocol pricing tiers as defined on nouchix.com/pricing. '
  'Used by the Stripe webhook to provision licenses on subscription creation.';

INSERT INTO tier_definitions (tier, display_name, symbol, price_cents, max_nodes, max_users, api_calls_daily, capabilities, description, target_segment)
VALUES
  (
    'khepri',
    'KHEPRI',
    '🐣',
    5000,                   -- $50/month
    10,
    1,
    500,
    '["pqc_scanning","adinkra_read_only","pdf_reports","community_support","single_user_license"]'::jsonb,
    'Perfect for security researchers and individual consultants starting their PQC journey.',
    'Research & Individual'
  ),
  (
    'ra',
    'RA',
    '🦅',
    50000,                  -- $500/month
    100,
    5,
    1000,
    '["pqc_scanning","adinkra_read_only","pdf_reports","community_support","single_user_license",'
    '"automated_remediation","cmmc_l2_audit_trails","priority_email_support","api_access","multi_user"]'::jsonb,
    'Comprehensive protection for SMBs requiring CMMC Level 2 compliance attestation.',
    'Small & Mid-Sized Business'
  ),
  (
    'atum',
    'ATUM',
    '⚛️',
    200000,                 -- $2,000/month
    1000,
    25,
    NULL,                   -- unlimited API
    '["pqc_scanning","adinkra_full","pdf_reports","priority_email_support","api_access","multi_user",'
    '"automated_remediation","cmmc_l2_audit_trails","advanced_heuristic_scanning",'
    '"dedicated_account_manager","unlimited_api","custom_lattice_config"]'::jsonb,
    'Enterprise-grade lattice cryptography management for complex infrastructures.',
    'Large Enterprise'
  ),
  (
    'osiris',
    'OSIRIS',
    '👁️',
    NULL,                   -- custom pricing
    NULL,                   -- unlimited nodes
    NULL,                   -- unlimited users
    NULL,                   -- unlimited API
    '["pqc_scanning","adinkra_full","pdf_reports","priority_support","unlimited_api","multi_user",'
    '"automated_remediation","cmmc_l2_audit_trails","advanced_heuristic_scanning",'
    '"dedicated_account_manager","custom_lattice_config",'
    '"air_gapped_deployment","iron_bank_container","hsm_hardware_anchor",'
    '"ts_sci_clearance_support","24_7_critical_response"]'::jsonb,
    'Nation-state grade security for DoD, DIB, and critical infrastructure protection.',
    'Defense & Government'
  )
ON CONFLICT (tier) DO UPDATE SET
  price_cents     = EXCLUDED.price_cents,
  max_nodes       = EXCLUDED.max_nodes,
  max_users       = EXCLUDED.max_users,
  api_calls_daily = EXCLUDED.api_calls_daily,
  capabilities    = EXCLUDED.capabilities,
  description     = EXCLUDED.description,
  target_segment  = EXCLUDED.target_segment;

-- ─── 3. Update tier CHECK constraint ─────────────────────────────────────────
-- Drop old constraint (if any) and add new one that includes all AdinKhepra tiers
-- plus legacy values for backwards compatibility.

ALTER TABLE licenses DROP CONSTRAINT IF EXISTS licenses_tier_check;

ALTER TABLE licenses ADD CONSTRAINT licenses_tier_check
  CHECK (tier IN (
    -- AdinKhepra Protocol tiers (current)
    'khepri', 'ra', 'atum', 'osiris',
    -- Legacy tiers (backwards compatibility — map to khepri/ra/atum on next renewal)
    'starter', 'professional', 'enterprise', 'unlimited',
    -- Free/trial
    'trial', 'free'
  ));

-- ─── 4. Backfill new columns on existing licenses ────────────────────────────
-- Map legacy tier names → new AdinKhepra tiers for max_users and api_calls_daily_limit

UPDATE licenses SET
  max_users = 1,
  api_calls_daily_limit = 500,
  price_cents = 5000
WHERE tier IN ('starter', 'khepri', 'free', 'trial');

UPDATE licenses SET
  max_users = 5,
  api_calls_daily_limit = 1000,
  price_cents = 50000
WHERE tier IN ('professional', 'ra');

UPDATE licenses SET
  max_users = 25,
  api_calls_daily_limit = NULL,
  price_cents = 200000
WHERE tier IN ('enterprise', 'atum');

UPDATE licenses SET
  max_users = NULL,
  api_calls_daily_limit = NULL,
  price_cents = NULL
WHERE tier IN ('unlimited', 'osiris');

-- ─── 5. Helper function: provision_license_from_stripe ───────────────────────
-- Called by the Stripe webhook Edge Function to upsert license entitlements
-- from a Stripe subscription event.

CREATE OR REPLACE FUNCTION provision_license_from_stripe(
  p_tenant_id              TEXT,
  p_stripe_customer_id     TEXT,
  p_stripe_subscription_id TEXT,
  p_tier                   TEXT,
  p_subscription_status    TEXT,
  p_current_period_end     TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier_def    tier_definitions%ROWTYPE;
  v_license_id  UUID;
BEGIN
  -- Load tier definition
  SELECT * INTO v_tier_def FROM tier_definitions WHERE tier = p_tier;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown tier: %', p_tier;
  END IF;

  -- Upsert license record
  INSERT INTO licenses (
    tenant_id,
    stripe_customer_id,
    stripe_subscription_id,
    tier,
    max_nodes,
    max_users,
    api_calls_daily_limit,
    price_cents,
    capabilities,
    subscription_status,
    expires_at,
    last_renewal,
    enforcement_mode,
    updated_at
  )
  VALUES (
    p_tenant_id,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_tier,
    COALESCE(v_tier_def.max_nodes, 2147483647),   -- 2^31-1 for "unlimited" in INT
    COALESCE(v_tier_def.max_users, 2147483647),
    v_tier_def.api_calls_daily,                    -- NULL = unlimited
    v_tier_def.price_cents,
    v_tier_def.capabilities,
    p_subscription_status,
    p_current_period_end,
    CASE WHEN p_subscription_status = 'active' THEN now() ELSE NULL END,
    CASE
      WHEN p_tier IN ('osiris', 'atum') THEN 'monitoring'
      ELSE 'grace_period'
    END,
    now()
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    stripe_customer_id     = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    tier                   = EXCLUDED.tier,
    max_nodes              = EXCLUDED.max_nodes,
    max_users              = EXCLUDED.max_users,
    api_calls_daily_limit  = EXCLUDED.api_calls_daily_limit,
    price_cents            = EXCLUDED.price_cents,
    capabilities           = EXCLUDED.capabilities,
    subscription_status    = EXCLUDED.subscription_status,
    expires_at             = EXCLUDED.expires_at,
    last_renewal           = EXCLUDED.last_renewal,
    enforcement_mode       = EXCLUDED.enforcement_mode,
    updated_at             = now()
  RETURNING id INTO v_license_id;

  RETURN v_license_id;
END;
$$;

-- ─── 6. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE tier_definitions ENABLE ROW LEVEL SECURITY;

-- Tier definitions are public read (show pricing to all authenticated users)
CREATE POLICY "tier_definitions_public_read"
  ON tier_definitions FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can modify tier definitions
CREATE POLICY "tier_definitions_service_write"
  ON tier_definitions FOR ALL
  TO service_role
  USING (true);

-- ─── 7. API calls rate-limit tracking ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_call_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id    UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  usage_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  call_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (license_id, usage_date)
);

CREATE INDEX idx_api_usage_license_date ON api_call_usage(license_id, usage_date);

-- Function: increment API call counter and enforce daily limit
CREATE OR REPLACE FUNCTION increment_api_call(p_license_id UUID)
RETURNS BOOLEAN   -- TRUE = allowed, FALSE = limit exceeded
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limit   INTEGER;
  v_current INTEGER;
BEGIN
  -- Get daily limit
  SELECT api_calls_daily_limit INTO v_limit
  FROM licenses WHERE id = p_license_id;

  IF NOT FOUND THEN
    RETURN FALSE;  -- Unknown license
  END IF;

  -- NULL limit = unlimited (ATUM / OSIRIS)
  IF v_limit IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Get today's usage
  INSERT INTO api_call_usage (license_id, usage_date, call_count)
  VALUES (p_license_id, CURRENT_DATE, 1)
  ON CONFLICT (license_id, usage_date) DO UPDATE
    SET call_count = api_call_usage.call_count + 1,
        updated_at = now()
  RETURNING call_count INTO v_current;

  RETURN v_current <= v_limit;
END;
$$;

COMMENT ON FUNCTION provision_license_from_stripe IS
  'Upserts a license record from a Stripe subscription event. '
  'Called by the stripe-webhook Edge Function.';

COMMENT ON FUNCTION increment_api_call IS
  'Increments the API call counter for a license and returns whether the call is allowed. '
  'Returns TRUE for unlimited tiers (ATUM/OSIRIS).';
