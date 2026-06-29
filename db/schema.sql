-- ============================================================
-- AdinKhepra ASAF — Supabase Persistence Schema
-- SouHimBou AI SaaS Tier (edge / hybrid modes only)
--
-- IMPORTANT: This schema is for the SouHimBou AI cloud product.
-- AdinKhepra ASAF (sovereign/air-gap) uses SQLite via pkg/dag — NOT Supabase.
-- Never point a sovereign deployment at this schema.
--
-- Apply: Supabase SQL editor → run as project owner
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. ADINKRA SYMBOL REGISTRY ────────────────────────────────────────────────
-- Metadata layer for Adinkra symbol semantics bound to compliance domains.
CREATE TABLE IF NOT EXISTS adinkra_symbols (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             TEXT UNIQUE NOT NULL,      -- 'Eban', 'Nkyinkyim', etc.
    meaning          TEXT,
    compliance_domain TEXT,                      -- 'DoD RMF/STIG', 'CMMC', 'FedRAMP'
    kernel_required  BOOLEAN DEFAULT FALSE,      -- true = Eban-class (kernel ops)
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Canonical symbols (immutable reference data)
INSERT INTO adinkra_symbols (name, meaning, compliance_domain, kernel_required) VALUES
    ('Eban',       'Fortress/Security',     'DoD RMF/STIG',    TRUE),
    ('Fawohodie',  'Freedom/Independence',  'CMMC/Revocation',  FALSE),
    ('Nkyinkyim',  'Adaptability',          'FedRAMP/SIEM',     FALSE),
    ('Dwennimmen', 'Strength',              'Identity/PAM',     FALSE)
ON CONFLICT (name) DO NOTHING;

-- ── 2. TENANT REGISTRY ────────────────────────────────────────────────────────
-- One row per SouHimBou AI customer (Free/Pro/Enterprise tier)
CREATE TABLE IF NOT EXISTS tenants (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_uid     UUID UNIQUE,                    -- Supabase auth.users.id
    tenant_slug  TEXT UNIQUE NOT NULL,
    tier         TEXT NOT NULL DEFAULT 'free'    CHECK (tier IN ('free', 'pro', 'enterprise')),
    stripe_id    TEXT,
    dag_quota    INTEGER DEFAULT 10000,          -- max DAG nodes (free tier cap)
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. DAG NODES (The Trust Constellation) ───────────────────────────────────
-- Core audit trail. Each row = one ML-DSA-65 signed event in the immutable chain.
CREATE TABLE IF NOT EXISTS dag_nodes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_id     TEXT NOT NULL,                  -- ML-DSA-65 identity
    node_type    TEXT NOT NULL                   -- 'tool', 'finding', 'attest', 'drift', 'staging', 'system_change'
                 CHECK (node_type IN ('tool', 'finding', 'attest', 'drift', 'staging',
                                      'system_change', 'security_event', 'baseline', 'export')),
    symbol_id    UUID REFERENCES adinkra_symbols(id),
    action       TEXT NOT NULL,
    attributes   JSONB DEFAULT '{}',             -- raw findings, CVEs, STIG IDs, dollar exposure
    hash         TEXT NOT NULL,                  -- SHA-256 of content (content-addressed)
    signature    TEXT NOT NULL,                  -- ML-DSA-65 / FIPS 204 hex signature
    session_id   TEXT,                           -- agent session correlation
    dag_parent   TEXT,                           -- parent node ID (null = genesis)
    severity     TEXT CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', NULL)),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: same content hash cannot appear twice per tenant
CREATE UNIQUE INDEX IF NOT EXISTS dag_nodes_tenant_hash ON dag_nodes(tenant_id, hash);

-- Query indexes
CREATE INDEX IF NOT EXISTS dag_nodes_tenant_type    ON dag_nodes(tenant_id, node_type);
CREATE INDEX IF NOT EXISTS dag_nodes_tenant_session ON dag_nodes(tenant_id, session_id);
CREATE INDEX IF NOT EXISTS dag_nodes_created_at     ON dag_nodes(created_at DESC);
CREATE INDEX IF NOT EXISTS dag_nodes_agent_id       ON dag_nodes(agent_id);
CREATE INDEX IF NOT EXISTS dag_nodes_severity       ON dag_nodes(severity) WHERE severity IS NOT NULL;

-- ── 4. DAG EDGES (Causal Chain) ───────────────────────────────────────────────
-- Directed edges: "B happened because of A" / "B remediates A"
CREATE TABLE IF NOT EXISTS dag_edges (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_node  UUID NOT NULL REFERENCES dag_nodes(id) ON DELETE CASCADE,
    to_node    UUID NOT NULL REFERENCES dag_nodes(id) ON DELETE CASCADE,
    edge_type  TEXT NOT NULL               -- 'causes', 'remediates', 'attests', 'triggers'
               CHECK (edge_type IN ('causes', 'remediates', 'attests', 'triggers', 'parent')),
    strength   FLOAT DEFAULT 1.0           -- edge weight for blast radius calculation
               CHECK (strength >= 0 AND strength <= 1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_node, to_node, edge_type)  -- no duplicate edges of same type
);

CREATE INDEX IF NOT EXISTS dag_edges_tenant    ON dag_edges(tenant_id);
CREATE INDEX IF NOT EXISTS dag_edges_from_node ON dag_edges(from_node);
CREATE INDEX IF NOT EXISTS dag_edges_to_node   ON dag_edges(to_node);

-- ── 5. FLIGHT RECORDER ────────────────────────────────────────────────────────
-- SouHimBou AI Flight Recorder sessions — agent activity log
CREATE TABLE IF NOT EXISTS flight_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id  TEXT UNIQUE NOT NULL,
    agent_id    TEXT NOT NULL,
    agent_type  TEXT,
    started_at  TIMESTAMPTZ DEFAULT NOW(),
    ended_at    TIMESTAMPTZ,
    tool_count  INTEGER DEFAULT 0,
    anomaly_score FLOAT DEFAULT 0.0         -- KASA behavioral score 0.0–1.0
);

CREATE INDEX IF NOT EXISTS flight_sessions_tenant ON flight_sessions(tenant_id);

-- ── 6. STAGING JOBS ───────────────────────────────────────────────────────────
-- Mirror environment results awaiting human approval
CREATE TABLE IF NOT EXISTS staging_jobs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    control_id  TEXT NOT NULL,             -- STIG/CMMC control being remediated
    command     JSONB NOT NULL,            -- command array (ML-DSA-65 signed payload)
    symbol      TEXT NOT NULL,
    agent_id    TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'running'
                CHECK (status IN ('running', 'success', 'failed', 'approved', 'rejected')),
    diff_output TEXT,                      -- before/after config diff
    stdout      TEXT,
    exit_code   INTEGER,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    approved_at  TIMESTAMPTZ,
    approved_by  TEXT,                     -- agent_id of human approver
    dag_node_id  TEXT                      -- DAG node created on approval
);

CREATE INDEX IF NOT EXISTS staging_jobs_tenant  ON staging_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS staging_jobs_status  ON staging_jobs(status);

-- ── 7. EVIDENCE PACKAGES ─────────────────────────────────────────────────────
-- C3PAO-ready exports (DAG + findings + PoAM + PDF)
CREATE TABLE IF NOT EXISTS evidence_packages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    generated_by  TEXT,
    framework     TEXT DEFAULT 'CMMC_L2',
    alignment_score INTEGER,
    total_risk_usd  FLOAT,
    dag_node_count  INTEGER,
    signature     TEXT,                    -- ML-DSA-65 signature over package manifest
    storage_path  TEXT                     -- S3/Supabase Storage object key
);

-- ── 8. VIEWS ─────────────────────────────────────────────────────────────────

-- Compliance overview (for dashboard KPI cards)
CREATE OR REPLACE VIEW compliance_overview AS
SELECT
    tenant_id,
    node_type,
    severity,
    COUNT(*) AS total,
    SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) AS critical,
    SUM(CASE WHEN severity = 'HIGH'     THEN 1 ELSE 0 END) AS high,
    MAX(created_at) AS latest_event
FROM dag_nodes
GROUP BY tenant_id, node_type, severity;

-- Active staging jobs (for approval gate UI)
CREATE OR REPLACE VIEW pending_approvals AS
SELECT
    s.id,
    s.tenant_id,
    s.control_id,
    s.symbol,
    s.agent_id,
    s.diff_output,
    s.exit_code,
    s.submitted_at,
    t.tier AS tenant_tier
FROM staging_jobs s
JOIN tenants t ON t.id = s.tenant_id
WHERE s.status = 'success';

-- ── 9. ROW LEVEL SECURITY ────────────────────────────────────────────────────
-- Tenants can only see their own data. Service role bypasses RLS.

ALTER TABLE tenants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dag_nodes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE dag_edges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE flight_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging_jobs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_packages ENABLE ROW LEVEL SECURITY;

-- Tenants see only their own row
CREATE POLICY tenants_isolation ON tenants
    FOR ALL USING (auth.uid() = auth_uid);

-- DAG nodes: tenant isolation via tenant_id → auth.uid lookup
CREATE POLICY dag_nodes_isolation ON dag_nodes
    FOR ALL USING (
        tenant_id IN (SELECT id FROM tenants WHERE auth_uid = auth.uid())
    );

CREATE POLICY dag_edges_isolation ON dag_edges
    FOR ALL USING (
        tenant_id IN (SELECT id FROM tenants WHERE auth_uid = auth.uid())
    );

CREATE POLICY flight_sessions_isolation ON flight_sessions
    FOR ALL USING (
        tenant_id IN (SELECT id FROM tenants WHERE auth_uid = auth.uid())
    );

CREATE POLICY staging_jobs_isolation ON staging_jobs
    FOR ALL USING (
        tenant_id IN (SELECT id FROM tenants WHERE auth_uid = auth.uid())
    );

CREATE POLICY evidence_packages_isolation ON evidence_packages
    FOR ALL USING (
        tenant_id IN (SELECT id FROM tenants WHERE auth_uid = auth.uid())
    );

-- ── 10. SEED DATA (demo / dev) ────────────────────────────────────────────────
-- Comment this block out for production deployments.

INSERT INTO tenants (auth_uid, tenant_slug, tier, dag_quota)
VALUES (gen_random_uuid(), 'demo-sovereign', 'enterprise', 100000)
ON CONFLICT (tenant_slug) DO NOTHING;
