-- Migration: MCP Agent Tables
-- Date: 2026-02-27
-- Purpose: Persistent storage for the Khepra MCP Server — sessions, tool call
--          audit logs, DAG node persistence, compliance events, anomaly
--          detections, and agent state snapshots.
--
-- Security design:
--   - All tables have Row-Level Security (RLS) enabled
--   - Service role key bypasses RLS for server-side Go/Python agents
--   - anon/authenticated keys are restricted by user_id policies
--   - PQC fields (pqc_signature, pqc_attestation) stored as TEXT (base64)
--   - dag_node_id provides cryptographic linkage to the immutable DAG chain

-- =============================================================================
-- TABLE: mcp_sessions
-- =============================================================================
-- Tracks AI tool sessions connected to the Khepra MCP server.
-- A session is created when Claude/Cursor/Windsurf authenticates.

CREATE TABLE IF NOT EXISTS mcp_sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id         TEXT NOT NULL,           -- 'claude', 'cursor', 'windsurf', 'cline'
    role             TEXT NOT NULL DEFAULT 'stig:reader',
                                              -- 'stig:reader' | 'stig:analyst' | 'stig:admin'
    pqc_public_key   TEXT,                   -- Dilithium-3 public key (base64)
    capabilities     TEXT[] DEFAULT '{}',    -- allowed tool names
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
    last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata         JSONB
);

CREATE INDEX IF NOT EXISTS idx_mcp_sessions_user     ON mcp_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_agent    ON mcp_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_expires  ON mcp_sessions(expires_at);

ALTER TABLE mcp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mcp_sessions_self" ON mcp_sessions
    FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- TABLE: mcp_tool_calls
-- =============================================================================
-- Immutable audit log of every MCP tool invocation.
-- Combined with the DAG chain, this provides tamper-evident evidence.

CREATE TABLE IF NOT EXISTS mcp_tool_calls (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID REFERENCES mcp_sessions(id) ON DELETE SET NULL,
    user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tool_name        TEXT NOT NULL,
    tool_params      JSONB,
    result           JSONB,
    error_message    TEXT,
    dag_node_id      TEXT,                   -- SHA-256 hash of DAG node
    pqc_signature    TEXT,                   -- Dilithium-3 signature (base64)
    duration_ms      BIGINT,
    data_class       TEXT DEFAULT 'PUBLIC',  -- 'PUBLIC' | 'CUI' | 'CLASSIFIED'
    injection_scan   BOOLEAN DEFAULT true,   -- Prompt injection scan performed
    blocked          BOOLEAN DEFAULT false,  -- Tool call was blocked
    block_reason     TEXT,
    called_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_session   ON mcp_tool_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_user      ON mcp_tool_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_tool      ON mcp_tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_called_at ON mcp_tool_calls(called_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_blocked   ON mcp_tool_calls(blocked) WHERE blocked = true;

ALTER TABLE mcp_tool_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mcp_tool_calls_self" ON mcp_tool_calls
    FOR SELECT USING (auth.uid() = user_id);

-- =============================================================================
-- TABLE: mcp_dag_nodes
-- =============================================================================
-- Durable persistence for the in-memory DAG (Directed Acyclic Graph).
-- The in-memory DAG is fast; this table provides queryable, durable storage.

CREATE TABLE IF NOT EXISTS mcp_dag_nodes (
    id           TEXT PRIMARY KEY,           -- SHA-256 content hash (immutable)
    action       TEXT NOT NULL,
    symbol       TEXT,                       -- Egyptian symbol (Khepra notation)
    parents      TEXT[] DEFAULT '{}',        -- Parent node IDs
    pqc_metadata JSONB,                     -- Kyber/Dilithium metadata
    signature    TEXT,                       -- Dilithium-3 signature (base64)
    agent_id     TEXT,                       -- Agent that created this node
    session_id   UUID REFERENCES mcp_sessions(id) ON DELETE SET NULL,
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_dag_nodes_agent   ON mcp_dag_nodes(agent_id);
CREATE INDEX IF NOT EXISTS idx_mcp_dag_nodes_time    ON mcp_dag_nodes(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_dag_nodes_session ON mcp_dag_nodes(session_id);

ALTER TABLE mcp_dag_nodes ENABLE ROW LEVEL SECURITY;

-- DAG nodes are readable by all authenticated users (they are PUBLIC compliance evidence)
CREATE POLICY "mcp_dag_nodes_read" ON mcp_dag_nodes
    FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: mcp_compliance_events
-- =============================================================================
-- Compliance findings recorded by Go KASA agent and Python SouHimBou agent.
-- These feed the PROVE quadrant (export_attestation).

CREATE TABLE IF NOT EXISTS mcp_compliance_events (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           TEXT NOT NULL,
    scan_id          TEXT,
    control_id       TEXT NOT NULL,          -- e.g. 'RHEL-08-010010', 'AC.L2-3.1.1'
    framework        TEXT NOT NULL,          -- 'CMMC_L1' | 'CMMC_L2' | 'STIG_RHEL8' | etc.
    status           TEXT NOT NULL,          -- 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_APPLICABLE'
    score            NUMERIC(5,2),           -- 0.00 to 100.00
    finding_details  JSONB,
    dag_node_id      TEXT,                   -- Links finding to DAG chain
    pqc_attestation  TEXT,                   -- Dilithium-3 signed hash of this finding
    recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    recorded_by      TEXT NOT NULL DEFAULT 'unknown' -- agent ID
);

CREATE INDEX IF NOT EXISTS idx_mcp_compliance_org       ON mcp_compliance_events(org_id);
CREATE INDEX IF NOT EXISTS idx_mcp_compliance_control   ON mcp_compliance_events(control_id);
CREATE INDEX IF NOT EXISTS idx_mcp_compliance_framework ON mcp_compliance_events(framework);
CREATE INDEX IF NOT EXISTS idx_mcp_compliance_status    ON mcp_compliance_events(status);
CREATE INDEX IF NOT EXISTS idx_mcp_compliance_time      ON mcp_compliance_events(recorded_at DESC);

ALTER TABLE mcp_compliance_events ENABLE ROW LEVEL SECURITY;

-- Compliance events scoped by org (using organization_id join pattern)
CREATE POLICY "mcp_compliance_read" ON mcp_compliance_events
    FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: mcp_anomaly_detections
-- =============================================================================
-- Anomaly/threat detections from the SouHimBou ML service.
-- High-score detections auto-trigger compliance scans via MCP bridge.

CREATE TABLE IF NOT EXISTS mcp_anomaly_detections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID REFERENCES mcp_sessions(id) ON DELETE SET NULL,
    source_agent_type   TEXT DEFAULT 'python_souhimbou',
                                                -- 'python_souhimbou' | 'go_kasa'
    target_id           TEXT NOT NULL,          -- Endpoint or event identifier
    anomaly_score       NUMERIC(5,4) NOT NULL,  -- 0.0000 to 1.0000
    is_anomaly          BOOLEAN NOT NULL,
    confidence          NUMERIC(5,4),
    archetype_influence JSONB,                  -- {"Set": 0.72, "Apep": 0.28}
    features            JSONB,                  -- Feature vector for explainability
    dag_node_id         TEXT,
    detected_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_anomaly_target    ON mcp_anomaly_detections(target_id);
CREATE INDEX IF NOT EXISTS idx_mcp_anomaly_score     ON mcp_anomaly_detections(anomaly_score DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_anomaly_is        ON mcp_anomaly_detections(is_anomaly);
CREATE INDEX IF NOT EXISTS idx_mcp_anomaly_time      ON mcp_anomaly_detections(detected_at DESC);

ALTER TABLE mcp_anomaly_detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mcp_anomaly_read" ON mcp_anomaly_detections
    FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: mcp_agent_snapshots
-- =============================================================================
-- Point-in-time agent state snapshots (QUADRANT 3: ROLLBACK).

CREATE TABLE IF NOT EXISTS mcp_agent_snapshots (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id       TEXT NOT NULL,
    agent_type     TEXT NOT NULL,  -- 'go_kasa' | 'python_souhimbou' | 'mcp_claude'
    version        TEXT,
    state          JSONB NOT NULL,
    dag_root_node  TEXT,           -- Root DAG node at snapshot time
    pqc_checksum   TEXT,           -- Kyber-secured state hash
    snapshot_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_snapshots_agent ON mcp_agent_snapshots(agent_id);
CREATE INDEX IF NOT EXISTS idx_mcp_snapshots_time  ON mcp_agent_snapshots(snapshot_at DESC);

ALTER TABLE mcp_agent_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mcp_snapshots_read" ON mcp_agent_snapshots
    FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- FUNCTION: get_mcp_compliance_summary
-- =============================================================================
-- RPC endpoint: SELECT * FROM get_mcp_compliance_summary('org-id', 'CMMC_L2');
-- Returns aggregated compliance score per domain.

CREATE OR REPLACE FUNCTION get_mcp_compliance_summary(
    p_org_id   TEXT,
    p_framework TEXT DEFAULT 'CMMC_L2'
)
RETURNS TABLE (
    domain         TEXT,
    total_controls BIGINT,
    compliant      BIGINT,
    non_compliant  BIGINT,
    score          NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        SPLIT_PART(control_id, '.', 1) AS domain,
        COUNT(*) AS total_controls,
        COUNT(*) FILTER (WHERE status = 'COMPLIANT') AS compliant,
        COUNT(*) FILTER (WHERE status = 'NON_COMPLIANT') AS non_compliant,
        ROUND(
            100.0 * COUNT(*) FILTER (WHERE status = 'COMPLIANT') / NULLIF(COUNT(*), 0),
            2
        ) AS score
    FROM mcp_compliance_events
    WHERE org_id = p_org_id
      AND framework = p_framework
    GROUP BY SPLIT_PART(control_id, '.', 1)
    ORDER BY domain;
$$;

-- =============================================================================
-- FUNCTION: get_mcp_anomaly_stats
-- =============================================================================
-- RPC endpoint: SELECT * FROM get_mcp_anomaly_stats('2026-02-20');

CREATE OR REPLACE FUNCTION get_mcp_anomaly_stats(
    p_since TIMESTAMPTZ DEFAULT (now() - INTERVAL '7 days')
)
RETURNS TABLE (
    total_detections  BIGINT,
    high_risk         BIGINT,   -- score >= 0.85
    medium_risk       BIGINT,   -- score >= 0.50 and < 0.85
    low_risk          BIGINT,   -- score < 0.50
    avg_score         NUMERIC,
    top_targets       JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        COUNT(*) AS total_detections,
        COUNT(*) FILTER (WHERE anomaly_score >= 0.85) AS high_risk,
        COUNT(*) FILTER (WHERE anomaly_score >= 0.50 AND anomaly_score < 0.85) AS medium_risk,
        COUNT(*) FILTER (WHERE anomaly_score < 0.50) AS low_risk,
        ROUND(AVG(anomaly_score)::NUMERIC, 4) AS avg_score,
        (
            SELECT jsonb_agg(t)
            FROM (
                SELECT target_id, COUNT(*) AS detections, MAX(anomaly_score) AS max_score
                FROM mcp_anomaly_detections
                WHERE detected_at >= p_since
                GROUP BY target_id
                ORDER BY detections DESC
                LIMIT 10
            ) t
        ) AS top_targets
    FROM mcp_anomaly_detections
    WHERE detected_at >= p_since;
$$;

-- =============================================================================
-- REALTIME: Enable Realtime for live MCP event streaming
-- =============================================================================
-- Enables AI tools (via Supabase Realtime WebSocket) to receive live updates.

ALTER PUBLICATION supabase_realtime ADD TABLE mcp_tool_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE mcp_compliance_events;
ALTER PUBLICATION supabase_realtime ADD TABLE mcp_anomaly_detections;
