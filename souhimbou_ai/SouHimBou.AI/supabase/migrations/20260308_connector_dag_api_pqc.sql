-- ═══════════════════════════════════════════════════════════════════
-- Khepra Connector SDK — DAG Audit, Failure Learning, Licensing,
-- PQC-OAuth Session tables
-- Iron Bank dag.Node pattern ported to Postgres (content-addressed)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Connector DAG Nodes (Iron Bank dag.Node → Postgres)
--    Every ConnectorSDK action writes an immutable, content-addressed
--    row. SHA-256(action||symbol||time||pqc_metadata) stored in
--    node_hash enforces content-addressing identical to Go ComputeHash().
CREATE TABLE IF NOT EXISTS connector_dag_nodes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  node_hash       text        UNIQUE NOT NULL,           -- SHA-256 content address
  parent_hashes   text[]      NOT NULL DEFAULT '{}',     -- parent node_hashes (The Weave)
  action          text        NOT NULL,                  -- 'connector.add|test|delete|learn|fail'
  symbol          text        NOT NULL,                  -- Adinkra symbol / source agent
  actor_id        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id uuid        NOT NULL,
  connector_id    uuid        REFERENCES compliance_connectors(id) ON DELETE SET NULL,
  pqc_metadata    jsonb       NOT NULL DEFAULT '{}',     -- tier, threat_level, certainty, scopes
  hmac_signature  text,                                  -- HMAC-SHA256(node_hash, session_secret)
  ml_dsa_signature text,                                 -- ML-DSA-65 from Go backend if available
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT node_hash_format CHECK (node_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_dag_org        ON connector_dag_nodes(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dag_connector  ON connector_dag_nodes(connector_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dag_action     ON connector_dag_nodes(action);
CREATE INDEX IF NOT EXISTS idx_dag_parent     ON connector_dag_nodes USING gin(parent_hashes);

-- 2. Connector Failure Log (raw payloads for AI Learning Mode)
CREATE TABLE IF NOT EXISTS connector_failure_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL,
  connector_id     uuid        REFERENCES compliance_connectors(id) ON DELETE CASCADE,
  provider         text        NOT NULL,
  error_code       text,
  error_body       jsonb       NOT NULL DEFAULT '{}',
  http_status      int,
  attempted_at     timestamptz NOT NULL DEFAULT now(),
  dag_node_hash    text        REFERENCES connector_dag_nodes(node_hash) ON DELETE SET NULL,
  pattern_generated bool       NOT NULL DEFAULT false,
  pattern_id       uuid        -- references polymorphic_apis.id (soft ref, table may not exist yet)
);

CREATE INDEX IF NOT EXISTS idx_failure_org      ON connector_failure_log(organization_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_failure_provider ON connector_failure_log(provider, pattern_generated);
CREATE INDEX IF NOT EXISTS idx_failure_unlearned ON connector_failure_log(organization_id)
  WHERE NOT pattern_generated;

-- 3. Connector API Licenses (third-party monetization)
CREATE TABLE IF NOT EXISTS connector_api_licenses (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL,
  api_key_hash     text        UNIQUE NOT NULL,  -- SHA-256 of raw key (never store raw)
  tier             text        NOT NULL DEFAULT 'community'
                               CHECK (tier IN ('community','professional','enterprise','partner')),
  rate_limit_rpm   int         NOT NULL DEFAULT 60,
  rate_limit_daily int         NOT NULL DEFAULT 1000,
  allowed_actions  text[]      NOT NULL DEFAULT '{test,discover}',
  pqc_public_key   text,       -- ML-DSA-65 public key for PQC-OAuth token validation
  issued_at        timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz,
  revoked          bool        NOT NULL DEFAULT false,
  revoked_at       timestamptz,
  metadata         jsonb       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_license_org  ON connector_api_licenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_license_key  ON connector_api_licenses(api_key_hash) WHERE NOT revoked;

-- 4. PQC-OAuth Sessions (context-aware, signed sessions)
CREATE TABLE IF NOT EXISTS pqc_oauth_sessions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id  uuid        NOT NULL,
  license_id       uuid        REFERENCES connector_api_licenses(id) ON DELETE SET NULL,
  tier             text        NOT NULL DEFAULT 'community',
  threat_level     text        NOT NULL DEFAULT 'green'
                               CHECK (threat_level IN ('green','yellow','orange','red')),
  allowed_scopes   text[]      NOT NULL DEFAULT '{connector:read}',
  token_hash       text        UNIQUE NOT NULL,
  ml_dsa_signature text,
  issued_at        timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  last_used_at     timestamptz,
  revoked          bool        NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_pqcsess_user   ON pqc_oauth_sessions(user_id) WHERE NOT revoked;
CREATE INDEX IF NOT EXISTS idx_pqcsess_token  ON pqc_oauth_sessions(token_hash) WHERE NOT revoked;
CREATE INDEX IF NOT EXISTS idx_pqcsess_expiry ON pqc_oauth_sessions(expires_at) WHERE NOT revoked;

-- 5. Connector Usage Events (billing metering)
CREATE TABLE IF NOT EXISTS connector_usage_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL,
  license_id       uuid        REFERENCES connector_api_licenses(id) ON DELETE SET NULL,
  session_id       uuid        REFERENCES pqc_oauth_sessions(id) ON DELETE SET NULL,
  dag_node_hash    text        REFERENCES connector_dag_nodes(node_hash) ON DELETE SET NULL,
  action           text        NOT NULL,
  provider         text,
  billable         bool        NOT NULL DEFAULT false,
  cost_units       numeric(10,4) NOT NULL DEFAULT 0,
  occurred_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_org     ON connector_usage_events(organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_license ON connector_usage_events(license_id, occurred_at DESC);

-- 6. RLS
ALTER TABLE connector_dag_nodes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_failure_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_api_licenses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pqc_oauth_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_usage_events   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dag_org_read"   ON connector_dag_nodes FOR SELECT
  USING (organization_id = auth.uid() OR actor_id = auth.uid());
CREATE POLICY "dag_own_insert" ON connector_dag_nodes FOR INSERT
  WITH CHECK (actor_id = auth.uid());

CREATE POLICY "failure_org_read" ON connector_failure_log FOR SELECT
  USING (organization_id = auth.uid());

CREATE POLICY "license_org_read" ON connector_api_licenses FOR SELECT
  USING (organization_id = auth.uid());

CREATE POLICY "session_own_read" ON pqc_oauth_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "usage_org_read"  ON connector_usage_events FOR SELECT
  USING (organization_id = auth.uid());
