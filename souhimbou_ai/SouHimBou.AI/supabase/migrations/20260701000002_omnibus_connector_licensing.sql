-- ============================================================
-- KHEPRA Omnibus Connector — License & Metering Tables
-- Migration: 20260701000002_omnibus_connector_licensing.sql
-- Author: SecRed Knowledge Inc. / NouchiX
--
-- This makes the Omnibus Connector a licensable API product.
-- Tier model:
--   free      → 100 calls/day, no LLM, no PQC signing
--   pro       → 10,000 calls/day, all connectors, no LLM
--   enterprise→ unlimited, LLM inference, PQC signing, DAG attestation
--   sovereign → air-gap, on-prem, ML-DSA-65 every call
-- ============================================================

-- ── connector_license_keys ────────────────────────────────────
-- One license key per customer deployment.
-- Not per-user — per API consumer (could be an org's CI/CD pipeline,
-- a SIEM itself, another product, etc.)
-- Validated on every request by the KHEPRA Gateway middleware.

create table if not exists connector_license_keys (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        references organizations(id),
  -- ^ null = standalone API product (sold without SouHimBou subscription)
  license_key         text        not null unique,
  -- ^ cryptographically random 64-char key (32 bytes hex)
  --   Format: khepra_conn_<64hex> (distinguishable from other license types)
  tier                text        not null default 'free',
  -- ^ 'free' | 'pro' | 'enterprise' | 'sovereign'
  product_scope       text[]      not null default '{"siem","soar"}',
  -- ^ which connector categories are permitted:
  --   'siem','soar','edr','cloud','iam','threat_intel','llm','custom'
  rate_limit_per_hour int         not null default 100,
  rate_limit_per_day  int         not null default 1000,
  llm_tokens_per_day  int         not null default 0,
  -- ^ 0 = LLM inference not permitted on this license
  pqc_signing_enabled bool        not null default false,
  -- ^ ML-DSA-65 signing on every connector event (enterprise+)
  dag_attestation     bool        not null default false,
  -- ^ write every event to immutable DAG (enterprise+)
  max_connectors      int         not null default 5,
  -- ^ max registered connector_profiles for this license
  allowed_connector_types text[]  default null,
  -- ^ null = all types permitted by product_scope
  customer_name       text,
  customer_email      text,
  notes               text,
  -- ^ internal notes (e.g. "Pilot for CISO John Smith at Acme Corp")
  pqc_signature       text,
  -- ^ ML-DSA-65 signature over (license_key || tier || product_scope)
  --   signed by SecRed Knowledge Inc. master key at issuance
  is_active           bool        not null default true,
  issued_at           timestamptz not null default now(),
  expires_at          timestamptz,
  -- ^ null = perpetual (lifetime license)
  last_used_at        timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists connector_license_keys_key_idx
  on connector_license_keys (license_key) where is_active = true;
create index if not exists connector_license_keys_org_idx
  on connector_license_keys (org_id) where org_id is not null;

-- ── connector_metering ────────────────────────────────────────
-- Per-key, per-hour metering bucket.
-- Allows real-time rate enforcement without distributed locks.
-- The hour bucket is floor(epoch / 3600) for easy rollup.

create table if not exists connector_metering (
  id                  bigserial   primary key,
  license_key_id      uuid        not null references connector_license_keys(id) on delete cascade,
  hour_bucket         bigint      not null,
  -- ^ Unix timestamp floored to hour: extract(epoch from date_trunc('hour', now()))::bigint
  day_bucket          int         not null,
  -- ^ YYYYMMDD integer for daily rollup
  call_count          int         not null default 0,
  llm_tokens_in       bigint      not null default 0,
  llm_tokens_out      bigint      not null default 0,
  llm_cost_usd_micro  bigint      not null default 0,
  -- ^ cost in micro-dollars (1e-6 USD) to avoid float precision issues
  connector_types_used text[]     not null default '{}',
  -- ^ set of connector_types invoked in this bucket
  error_count         int         not null default 0,
  updated_at          timestamptz not null default now(),

  constraint connector_metering_unique_bucket
    unique (license_key_id, hour_bucket)
);

create index if not exists connector_metering_key_day_idx
  on connector_metering (license_key_id, day_bucket desc);
create index if not exists connector_metering_hour_bucket_idx
  on connector_metering (hour_bucket desc);

-- ── connector_prompt_guard_log ────────────────────────────────
-- WAF: log of blocked/flagged LLM inference requests.
-- Prompt injection, jailbreak attempts, PII leakage → recorded here.

create table if not exists connector_prompt_guard_log (
  id              uuid        primary key default gen_random_uuid(),
  license_key_id  uuid        references connector_license_keys(id),
  org_id          uuid,
  llm_provider    text,
  violation_type  text        not null,
  -- ^ 'prompt_injection' | 'jailbreak' | 'pii_detected' | 'restricted_topic'
  --   | 'token_limit_exceeded' | 'rate_limit'
  severity        text        not null default 'medium',
  prompt_hash     text,       -- SHA-256 of prompt (never store raw prompt)
  action_taken    text        not null default 'blocked',
  -- ^ 'blocked' | 'sanitized' | 'flagged_and_passed'
  detected_at     timestamptz not null default now()
);

create index if not exists prompt_guard_license_idx
  on connector_prompt_guard_log (license_key_id, detected_at desc);

-- ── DB Function: check_and_increment_meter ────────────────────
-- Atomic rate limit check + meter increment in one round trip.
-- Returns: {allowed: bool, calls_this_hour: int, calls_today: int}

create or replace function check_and_increment_meter(
  p_license_key   text,
  p_connector_type text default 'unknown'
) returns jsonb language plpgsql as $$
declare
  v_key       connector_license_keys%rowtype;
  v_hour      bigint := extract(epoch from date_trunc('hour', now()))::bigint;
  v_day       int    := to_char(now(), 'YYYYMMDD')::int;
  v_hour_count int;
  v_day_count  int;
begin
  -- Fetch license
  select * into v_key from connector_license_keys
    where license_key = p_license_key and is_active = true
    limit 1;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_or_inactive_license');
  end if;

  if v_key.expires_at is not null and v_key.expires_at < now() then
    return jsonb_build_object('allowed', false, 'reason', 'license_expired');
  end if;

  -- Upsert metering bucket
  insert into connector_metering (license_key_id, hour_bucket, day_bucket, call_count, connector_types_used)
    values (v_key.id, v_hour, v_day, 1, array[p_connector_type])
  on conflict (license_key_id, hour_bucket) do update
    set call_count             = connector_metering.call_count + 1,
        connector_types_used   = array(
          select distinct unnest(connector_metering.connector_types_used || array[p_connector_type])
        ),
        updated_at             = now()
  returning call_count into v_hour_count;

  -- Daily total
  select coalesce(sum(call_count), 0) into v_day_count
    from connector_metering
    where license_key_id = v_key.id and day_bucket = v_day;

  -- Enforce limits
  if v_hour_count > v_key.rate_limit_per_hour then
    return jsonb_build_object(
      'allowed', false, 'reason', 'hourly_rate_limit_exceeded',
      'calls_this_hour', v_hour_count, 'limit', v_key.rate_limit_per_hour
    );
  end if;

  if v_day_count > v_key.rate_limit_per_day then
    return jsonb_build_object(
      'allowed', false, 'reason', 'daily_rate_limit_exceeded',
      'calls_today', v_day_count, 'limit', v_key.rate_limit_per_day
    );
  end if;

  -- Update last_used_at
  update connector_license_keys set last_used_at = now() where id = v_key.id;

  return jsonb_build_object(
    'allowed', true,
    'tier', v_key.tier,
    'license_key_id', v_key.id,
    'calls_this_hour', v_hour_count,
    'calls_today', v_day_count,
    'llm_tokens_per_day', v_key.llm_tokens_per_day,
    'pqc_signing_enabled', v_key.pqc_signing_enabled,
    'dag_attestation', v_key.dag_attestation,
    'product_scope', v_key.product_scope
  );
end;
$$;

-- ── DB Function: record_llm_tokens ───────────────────────────
-- Increments LLM token metering for a license key's current hour bucket.

create or replace function record_llm_tokens(
  p_license_key_id  uuid,
  p_tokens_in       int,
  p_tokens_out      int,
  p_cost_usd_micro  bigint default 0
) returns void language plpgsql as $$
declare
  v_hour bigint := extract(epoch from date_trunc('hour', now()))::bigint;
  v_day  int    := to_char(now(), 'YYYYMMDD')::int;
begin
  insert into connector_metering (license_key_id, hour_bucket, day_bucket, llm_tokens_in, llm_tokens_out, llm_cost_usd_micro)
    values (p_license_key_id, v_hour, v_day, p_tokens_in, p_tokens_out, p_cost_usd_micro)
  on conflict (license_key_id, hour_bucket) do update
    set llm_tokens_in       = connector_metering.llm_tokens_in + p_tokens_in,
        llm_tokens_out      = connector_metering.llm_tokens_out + p_tokens_out,
        llm_cost_usd_micro  = connector_metering.llm_cost_usd_micro + p_cost_usd_micro,
        updated_at          = now();
end;
$$;

-- ── Seed: free tier license for development ───────────────────
-- Remove this in production. Used for local testing only.
insert into connector_license_keys (
  license_key, tier, product_scope,
  rate_limit_per_hour, rate_limit_per_day,
  llm_tokens_per_day, pqc_signing_enabled, dag_attestation,
  max_connectors, customer_name, notes
) values (
  'khepra_conn_dev_0000000000000000000000000000000000000000000000000000000000000000',
  'enterprise',
  '{"siem","soar","edr","cloud","iam","threat_intel","llm","custom"}',
  10000, 100000, 1000000, true, true, 100,
  'SecRed Knowledge Inc.', 'Development / CI seed key — REMOVE before production'
) on conflict (license_key) do nothing;
