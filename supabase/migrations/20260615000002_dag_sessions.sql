-- Migration: DAG Sessions
-- Date: 2026-06-15
-- Purpose: Top-level assessment session tracking for the Flight Recorder DAG.
--          One row per compliance scan run (CLI `adinkhepra demo`, web scan,
--          or MCP ert_scan invocation). Anchors DAG chain, EA state, PQC
--          attestation, scoring, and report artifacts in a single auditable row.
--
-- Depends on:
--   20260227_mcp_agent_tables.sql   (mcp_sessions, mcp_dag_nodes)
--   20260615000001_user_profiles_onboarding.sql  (set_updated_at())
--
-- Design:
--   - org_id is TEXT (not FK) so sovereign/air-gap mode works without Supabase
--   - mcp_compliance_events.scan_id (TEXT) naturally maps to dag_sessions.id::text
--   - mcp_dag_nodes gets a dag_session_id column via ALTER to link DAG nodes
--   - ML-DSA-65 attestation (NIST FIPS 204) covers session summary hash
--   - Realtime enabled for live dashboard scoring updates

-- =============================================================================
-- TABLE: dag_sessions
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.dag_sessions (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ── Identity ──────────────────────────────────────────────────────────────
    user_id                 UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    org_id                  TEXT        NOT NULL,
    mcp_session_id          UUID        REFERENCES public.mcp_sessions(id) ON DELETE SET NULL,

    -- ── Scan scope ────────────────────────────────────────────────────────────
    framework               TEXT        NOT NULL
                                        CHECK (framework IN (
                                            'CMMC_L1','CMMC_L2',
                                            'STIG_RHEL8','STIG_WIN2019','STIG_UBUNTU',
                                            'NIST_800_53','NIST_800_171',
                                            'FULL_SUITE'
                                        )),
    scan_target             TEXT,                           -- hostname, IP range, or org scope label
    scan_profile            TEXT        NOT NULL DEFAULT 'standard'
                                        CHECK (scan_profile IN ('rapid','standard','deep','air-gap')),

    -- ── Lifecycle ─────────────────────────────────────────────────────────────
    status                  TEXT        NOT NULL DEFAULT 'pending'
                                        CHECK (status IN (
                                            'pending','scanning','signing',
                                            'complete','failed','aborted'
                                        )),
    error_message           TEXT,                           -- populated on 'failed'

    -- ── DAG chain anchors ─────────────────────────────────────────────────────
    -- Both reference mcp_dag_nodes.id (TEXT content-hash — no FK to allow
    -- nodes to be written after session row is created)
    dag_root_node           TEXT,
    dag_tip_node            TEXT,
    node_count              INTEGER     NOT NULL DEFAULT 0,

    -- ── Compliance scoring ────────────────────────────────────────────────────
    controls_total          INTEGER     NOT NULL DEFAULT 0,
    controls_compliant      INTEGER     NOT NULL DEFAULT 0,
    controls_non_compliant  INTEGER     NOT NULL DEFAULT 0,
    controls_not_applicable INTEGER     NOT NULL DEFAULT 0,
    overall_score           NUMERIC(5,2)
                                        CHECK (overall_score IS NULL OR
                                               (overall_score >= 0 AND overall_score <= 100)),

    -- ── Evolutionary Algorithm state at session close ─────────────────────────
    ea_generation           INTEGER,
    ea_best_fitness         NUMERIC(10,6),
    ea_champion_symbol      TEXT        CHECK (ea_champion_symbol IN (
                                            'Eban','Fawohodie','Nkyinkyim','Dwennimmen'
                                        )),

    -- ── PQC attestation (ML-DSA-65 / NIST FIPS 204) ──────────────────────────
    pqc_attestation         TEXT,                           -- base64 ML-DSA-65 signature of session summary
    pqc_public_key          TEXT,                           -- base64 verifying public key
    pqc_algorithm           TEXT        NOT NULL DEFAULT 'ML-DSA-65'
                                        CHECK (pqc_algorithm IN ('ML-DSA-44','ML-DSA-65','ML-DSA-87')),

    -- ── Report artifacts ──────────────────────────────────────────────────────
    report_url              TEXT,                           -- Supabase Storage URL → Godfather Report PDF
    poam_url                TEXT,                           -- POAM export URL
    ssp_url                 TEXT,                           -- SSP export URL
    emass_url               TEXT,                           -- eMASS XML export URL (DoDI 8510.01)

    -- ── Timestamps ────────────────────────────────────────────────────────────
    started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- ── Metadata ──────────────────────────────────────────────────────────────
    -- Tool versions, CLI flags, environment profile, sovereign vs cloud mode
    metadata                JSONB
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_dag_sessions_user
    ON public.dag_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_dag_sessions_org
    ON public.dag_sessions(org_id);

CREATE INDEX IF NOT EXISTS idx_dag_sessions_status
    ON public.dag_sessions(status);

CREATE INDEX IF NOT EXISTS idx_dag_sessions_framework
    ON public.dag_sessions(framework);

CREATE INDEX IF NOT EXISTS idx_dag_sessions_started
    ON public.dag_sessions(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_dag_sessions_score
    ON public.dag_sessions(overall_score DESC)
    WHERE overall_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dag_sessions_mcp
    ON public.dag_sessions(mcp_session_id)
    WHERE mcp_session_id IS NOT NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.dag_sessions ENABLE ROW LEVEL SECURITY;

-- Users see their own sessions
CREATE POLICY "dag_sessions_owner_all" ON public.dag_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Service role reads all (billing, admin, agent-side finalization)
CREATE POLICY "dag_sessions_service_read" ON public.dag_sessions
    FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "dag_sessions_service_write" ON public.dag_sessions
    FOR ALL USING (auth.role() = 'service_role');

-- ── updated_at trigger ───────────────────────────────────────────────────────
-- Reuses set_updated_at() defined in 20260615000001_user_profiles_onboarding.sql

DROP TRIGGER IF EXISTS set_dag_sessions_updated_at ON public.dag_sessions;
CREATE TRIGGER set_dag_sessions_updated_at
    BEFORE UPDATE ON public.dag_sessions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- ALTER TABLE: mcp_dag_nodes — backlink to dag_sessions
-- =============================================================================
-- Allows querying "all DAG nodes for this assessment session" directly.
-- Nullable so existing rows and MCP-only sessions (no dag_session) are unaffected.

ALTER TABLE public.mcp_dag_nodes
    ADD COLUMN IF NOT EXISTS dag_session_id UUID
        REFERENCES public.dag_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mcp_dag_nodes_dag_session
    ON public.mcp_dag_nodes(dag_session_id)
    WHERE dag_session_id IS NOT NULL;

-- =============================================================================
-- FUNCTION: finalize_dag_session
-- =============================================================================
-- Called by the Go KASA agent (via service-role key) after a scan completes.
-- Reads control findings from mcp_compliance_events where scan_id matches,
-- computes the overall score, sets pqc_attestation, and marks status = 'complete'.
--
-- Usage (from Go agent):
--   SELECT finalize_dag_session(
--       '00000000-0000-0000-0000-000000000000'::uuid,
--       'dag-tip-node-hash',
--       142,
--       '<base64-ml-dsa-65-signature>',
--       '<base64-public-key>'
--   );

CREATE OR REPLACE FUNCTION public.finalize_dag_session(
    p_session_id        UUID,
    p_dag_tip_node      TEXT,
    p_node_count        INTEGER,
    p_pqc_attestation   TEXT        DEFAULT NULL,
    p_pqc_public_key    TEXT        DEFAULT NULL
)
RETURNS public.dag_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total         INTEGER;
    v_compliant     INTEGER;
    v_non_compliant INTEGER;
    v_not_applicable INTEGER;
    v_score         NUMERIC(5,2);
    v_result        public.dag_sessions;
BEGIN
    -- Aggregate from mcp_compliance_events (scan_id stored as TEXT = session UUID)
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'COMPLIANT'),
        COUNT(*) FILTER (WHERE status = 'NON_COMPLIANT'),
        COUNT(*) FILTER (WHERE status = 'NOT_APPLICABLE')
    INTO v_total, v_compliant, v_non_compliant, v_not_applicable
    FROM public.mcp_compliance_events
    WHERE scan_id = p_session_id::text;

    -- Compute score against total assessable controls (exclude NOT_APPLICABLE)
    v_score := CASE
        WHEN (v_total - v_not_applicable) = 0 THEN NULL
        ELSE ROUND(
            100.0 * v_compliant::NUMERIC / NULLIF((v_total - v_not_applicable), 0),
            2
        )
    END;

    UPDATE public.dag_sessions SET
        status                  = 'complete',
        dag_tip_node            = p_dag_tip_node,
        node_count              = p_node_count,
        controls_total          = v_total,
        controls_compliant      = v_compliant,
        controls_non_compliant  = v_non_compliant,
        controls_not_applicable = v_not_applicable,
        overall_score           = v_score,
        pqc_attestation         = p_pqc_attestation,
        pqc_public_key          = p_pqc_public_key,
        completed_at            = now(),
        updated_at              = now()
    WHERE id = p_session_id
    RETURNING * INTO v_result;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'dag_session % not found', p_session_id;
    END IF;

    RETURN v_result;
END;
$$;

-- =============================================================================
-- FUNCTION: abort_dag_session
-- =============================================================================
-- Marks a session aborted with a reason. Called on scan timeout or user cancel.

CREATE OR REPLACE FUNCTION public.abort_dag_session(
    p_session_id    UUID,
    p_reason        TEXT DEFAULT 'user_cancelled'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.dag_sessions SET
        status        = 'aborted',
        error_message = p_reason,
        completed_at  = now(),
        updated_at    = now()
    WHERE id = p_session_id
      AND status NOT IN ('complete','aborted');

    IF NOT FOUND THEN
        RAISE WARNING 'dag_session % not found or already terminal', p_session_id;
    END IF;
END;
$$;

-- =============================================================================
-- FUNCTION: get_dag_session_summary
-- =============================================================================
-- RPC endpoint returning session + per-domain breakdown.
-- Usage: SELECT * FROM get_dag_session_summary('session-uuid');

CREATE OR REPLACE FUNCTION public.get_dag_session_summary(
    p_session_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'session',  row_to_json(s),
        'domains',  COALESCE((
            SELECT jsonb_agg(d ORDER BY d->>'domain')
            FROM (
                SELECT jsonb_build_object(
                    'domain',       SPLIT_PART(control_id, '.', 1),
                    'total',        COUNT(*),
                    'compliant',    COUNT(*) FILTER (WHERE status = 'COMPLIANT'),
                    'non_compliant',COUNT(*) FILTER (WHERE status = 'NON_COMPLIANT'),
                    'score',        ROUND(
                                        100.0 * COUNT(*) FILTER (WHERE status = 'COMPLIANT')::NUMERIC
                                        / NULLIF(COUNT(*) FILTER (WHERE status != 'NOT_APPLICABLE'), 0),
                                        2
                                    )
                ) AS d
                FROM public.mcp_compliance_events
                WHERE scan_id = p_session_id::text
                GROUP BY SPLIT_PART(control_id, '.', 1)
            ) sub
        ), '[]'::jsonb)
    )
    FROM public.dag_sessions s
    WHERE s.id = p_session_id;
$$;

-- =============================================================================
-- FUNCTION: get_org_dag_history
-- =============================================================================
-- Returns the last N sessions for an org, ordered newest first.
-- Useful for trend charts in the dashboard.
--
-- Usage: SELECT * FROM get_org_dag_history('org-id', 'CMMC_L2', 10);

CREATE OR REPLACE FUNCTION public.get_org_dag_history(
    p_org_id    TEXT,
    p_framework TEXT    DEFAULT NULL,
    p_limit     INTEGER DEFAULT 10
)
RETURNS TABLE (
    id              UUID,
    framework       TEXT,
    scan_target     TEXT,
    status          TEXT,
    overall_score   NUMERIC,
    controls_total  INTEGER,
    controls_compliant INTEGER,
    ea_champion_symbol TEXT,
    pqc_algorithm   TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        id, framework, scan_target, status,
        overall_score, controls_total, controls_compliant,
        ea_champion_symbol, pqc_algorithm,
        started_at, completed_at
    FROM public.dag_sessions
    WHERE org_id = p_org_id
      AND (p_framework IS NULL OR framework = p_framework)
      AND status = 'complete'
    ORDER BY started_at DESC
    LIMIT LEAST(p_limit, 100);
$$;

-- =============================================================================
-- REALTIME: Live scoring updates to dashboard
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.dag_sessions;
