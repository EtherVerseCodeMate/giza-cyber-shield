-- Migration: Security Event Tables for MCP Security Operations
-- Date: 2026-02-27
-- Purpose: Persistent storage for ALL security domain operations:
--   Threat hunting, incident response, IDS/IPS alerts, SIEM events,
--   vulnerability findings, DR/BC status, risk scores, and SOAR playbooks.
--
-- These tables power the Natural Language Security Platform:
-- "Is my network compromised?" → queries these tables → plain English answer.

-- =============================================================================
-- TABLE: security_incidents
-- =============================================================================
-- NIST 800-61 compliant incident records.
-- Created by khepra_declare_incident MCP tool.

CREATE TABLE IF NOT EXISTS security_incidents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    severity        TEXT NOT NULL,         -- CRITICAL | HIGH | MEDIUM | LOW
    status          TEXT NOT NULL DEFAULT 'OPEN',
                                           -- OPEN | IN_PROGRESS | CONTAINED | ERADICATED | RECOVERED | CLOSED
    type            TEXT,                  -- RANSOMWARE | PHISHING | DDOS | INSIDER | ZERO_DAY | UNKNOWN
    iocs            JSONB DEFAULT '[]',   -- Array of {type, value, description}
    timeline        JSONB DEFAULT '[]',   -- Array of {timestamp, message, actor}
    playbook_id     TEXT,
    dag_node_id     TEXT,                  -- DAG chain anchor
    pqc_attestation TEXT,                  -- Dilithium-3 signature
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    contained_at    TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    declared_by     TEXT NOT NULL DEFAULT 'mcp_agent'
);

CREATE INDEX IF NOT EXISTS idx_incidents_org      ON security_incidents(org_id);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status   ON security_incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_time     ON security_incidents(detected_at DESC);

ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidents_org_read" ON security_incidents FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: security_alerts
-- =============================================================================
-- IDS/IPS alerts with ML triage scores.
-- Fed by pkg/arsenal, pkg/sonar, and SouHimBou ML service.

CREATE TABLE IF NOT EXISTS security_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          TEXT NOT NULL,
    rule_id         TEXT,                  -- Detection rule that triggered this
    rule_name       TEXT,
    severity        TEXT NOT NULL,         -- CRITICAL | HIGH | MEDIUM | LOW | INFO
    category        TEXT,                  -- INTRUSION | MALWARE | EXFILTRATION | RECON | C2 | ANOMALY
    status          TEXT NOT NULL DEFAULT 'active',
                                           -- active | investigating | resolved | false_positive
    source_ip       TEXT,
    dest_ip         TEXT,
    source_port     INT,
    dest_port       INT,
    protocol        TEXT,
    event_count     INT DEFAULT 1,         -- Aggregated event count
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- SouHimBou ML fields
    ml_score        NUMERIC(5,4),          -- Anomaly score from SouHimBou
    ml_is_anomaly   BOOLEAN,
    ml_confidence   NUMERIC(5,4),
    archetype       TEXT,                  -- Dominant threat archetype

    -- Evidence chain
    raw_event       JSONB,
    dag_node_id     TEXT,
    incident_id     UUID REFERENCES security_incidents(id) ON DELETE SET NULL,
    resolved_at     TIMESTAMPTZ,
    resolved_by     TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_org       ON security_alerts(org_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity  ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_status    ON security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_time      ON security_alerts(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_ml_score  ON security_alerts(ml_score DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_src_ip    ON security_alerts(source_ip);

ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_org_read" ON security_alerts FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: threat_hunt_sessions
-- =============================================================================
-- Records of active and completed threat hunt sessions.
-- Created by khepra_hunt_threats MCP tool.

CREATE TABLE IF NOT EXISTS threat_hunt_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          TEXT NOT NULL,
    query           TEXT NOT NULL,         -- Natural language hunt query
    scope           TEXT DEFAULT 'all',
    status          TEXT NOT NULL DEFAULT 'running',
                                           -- running | complete | failed
    hypotheses      JSONB DEFAULT '[]',   -- MITRE ATT&CK techniques investigated
    findings        JSONB DEFAULT '[]',   -- {severity, description, iocs, evidence}
    iocs_found      TEXT[] DEFAULT '{}',  -- IOCs discovered during hunt
    ttps_matched    TEXT[] DEFAULT '{}',  -- MITRE ATT&CK IDs matched
    confidence      NUMERIC(5,4) DEFAULT 0.0,
    lookback_hours  INT DEFAULT 24,
    dag_node_id     TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    initiated_by    TEXT DEFAULT 'mcp_agent'
);

CREATE INDEX IF NOT EXISTS idx_hunts_org    ON threat_hunt_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_hunts_time   ON threat_hunt_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_hunts_status ON threat_hunt_sessions(status);

ALTER TABLE threat_hunt_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hunts_org_read" ON threat_hunt_sessions FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: vulnerability_findings
-- =============================================================================
-- CVE/vulnerability findings from enumeration and assessment.
-- Created by khepra_check_vulnerabilities and khepra_enumerate_services.

CREATE TABLE IF NOT EXISTS vulnerability_findings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          TEXT NOT NULL,
    asset_id        TEXT,                  -- Target asset
    asset_ip        INET,
    cve_id          TEXT,                  -- CVE-YYYY-NNNNN
    cwe_id          TEXT,                  -- CWE-NNN
    title           TEXT NOT NULL,
    description     TEXT,
    severity        TEXT NOT NULL,         -- CRITICAL | HIGH | MEDIUM | LOW | INFO (CVSS)
    cvss_score      NUMERIC(3,1),          -- 0.0 - 10.0
    epss_score      NUMERIC(6,4),          -- Exploit Prediction Scoring System (0.0000-1.0000)
    epss_percentile NUMERIC(5,2),          -- EPSS percentile
    exploited_in_wild BOOLEAN DEFAULT false, -- CISA KEV status
    affected_service TEXT,
    affected_version TEXT,
    remediation     TEXT,                  -- How to fix
    status          TEXT NOT NULL DEFAULT 'open',
                                           -- open | in_remediation | mitigated | accepted | fixed
    dag_node_id     TEXT,
    discovered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    remediated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vulns_org      ON vulnerability_findings(org_id);
CREATE INDEX IF NOT EXISTS idx_vulns_cve      ON vulnerability_findings(cve_id);
CREATE INDEX IF NOT EXISTS idx_vulns_severity ON vulnerability_findings(severity);
CREATE INDEX IF NOT EXISTS idx_vulns_epss     ON vulnerability_findings(epss_score DESC);
CREATE INDEX IF NOT EXISTS idx_vulns_kev      ON vulnerability_findings(exploited_in_wild) WHERE exploited_in_wild = true;
CREATE INDEX IF NOT EXISTS idx_vulns_asset    ON vulnerability_findings(asset_id);

ALTER TABLE vulnerability_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vulns_org_read" ON vulnerability_findings FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: firewall_rules
-- =============================================================================
-- Dynamic firewall rules managed by the Polymorphic API Engine.
-- Created by khepra_create_ips_rule and khepra_update_firewall_rule.

CREATE TABLE IF NOT EXISTS firewall_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          TEXT NOT NULL,
    rule_type       TEXT NOT NULL,         -- block_ip | block_cidr | block_country | rate_limit | block_pattern
    action          TEXT NOT NULL DEFAULT 'block',
    value           TEXT NOT NULL,         -- IP, CIDR, country code, regex pattern
    direction       TEXT DEFAULT 'inbound',
    priority        INT DEFAULT 100,
    reason          TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active',
    polymorphic     BOOLEAN DEFAULT true,  -- Signature rotation enabled
    deployed_edge   BOOLEAN DEFAULT false, -- Cloudflare WAF deployed
    hit_count       BIGINT DEFAULT 0,      -- Times this rule has triggered
    dag_node_id     TEXT,
    pqc_signature   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,           -- NULL = permanent
    revoked_at      TIMESTAMPTZ,
    created_by      TEXT DEFAULT 'mcp_agent'
);

CREATE INDEX IF NOT EXISTS idx_rules_org    ON firewall_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_rules_type   ON firewall_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_rules_status ON firewall_rules(status);
CREATE INDEX IF NOT EXISTS idx_rules_value  ON firewall_rules(value);

ALTER TABLE firewall_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rules_org_read" ON firewall_rules FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: dr_snapshots
-- =============================================================================
-- Disaster Recovery snapshots for DRBC (Genesis backups).
-- Created by khepra_create_backup MCP tool.

CREATE TABLE IF NOT EXISTS dr_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          TEXT NOT NULL,
    label           TEXT,
    scope           TEXT NOT NULL DEFAULT 'full',
    backup_size_mb  NUMERIC(10,2),
    storage_path    TEXT,                  -- Supabase Storage path
    integrity_hash  TEXT,                  -- SHA-512 of backup
    pqc_attestation TEXT,                  -- Dilithium-3 signature
    is_verified     BOOLEAN DEFAULT false, -- Recovery test passed
    last_tested_at  TIMESTAMPTZ,
    test_rto_mins   INT,                   -- Actual recovery time in last test
    dag_node_id     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,
    created_by      TEXT DEFAULT 'mcp_agent'
);

CREATE INDEX IF NOT EXISTS idx_snapshots_org  ON dr_snapshots(org_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_time ON dr_snapshots(created_at DESC);

ALTER TABLE dr_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshots_org_read" ON dr_snapshots FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- TABLE: nl_query_log
-- =============================================================================
-- Audit log of all Natural Language security queries.
-- Powers analytics: "What are users asking about most?" → product iteration.

CREATE TABLE IF NOT EXISTS nl_query_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          TEXT,
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id      UUID REFERENCES mcp_sessions(id) ON DELETE SET NULL,
    query_text      TEXT NOT NULL,         -- Natural language query (anonymized if needed)
    tools_called    TEXT[] DEFAULT '{}',   -- Which tools were invoked
    answer_length   INT,                   -- chars in synthesized answer
    confidence      NUMERIC(5,4),
    duration_ms     BIGINT,
    was_helpful     BOOLEAN,               -- User feedback (optional)
    queried_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nl_queries_org  ON nl_query_log(org_id);
CREATE INDEX IF NOT EXISTS idx_nl_queries_time ON nl_query_log(queried_at DESC);
-- Useful for product analytics
CREATE INDEX IF NOT EXISTS idx_nl_queries_tools ON nl_query_log USING GIN(tools_called);

ALTER TABLE nl_query_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nl_queries_self" ON nl_query_log FOR SELECT USING (auth.uid() = user_id);

-- =============================================================================
-- TABLE: risk_scores
-- =============================================================================
-- Quantitative risk scores (FAIR methodology) computed by khepra_calculate_risk_score.

CREATE TABLE IF NOT EXISTS risk_scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          TEXT NOT NULL,
    asset_class     TEXT DEFAULT 'all',
    threat_model    TEXT DEFAULT 'generic_adversary',
    risk_usd_low    NUMERIC(15,2),          -- 10th percentile annual loss exposure
    risk_usd_mean   NUMERIC(15,2),          -- Mean annual loss exposure
    risk_usd_high   NUMERIC(15,2),          -- 90th percentile annual loss exposure
    risk_factors    JSONB,                  -- Breakdown: threat_freq, vuln_severity, asset_value, control_effectiveness
    top_risk_drivers JSONB DEFAULT '[]',   -- Top 5 drivers with individual scores
    dag_node_id     TEXT,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_org  ON risk_scores(org_id);
CREATE INDEX IF NOT EXISTS idx_risk_time ON risk_scores(computed_at DESC);

ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk_scores_org_read" ON risk_scores FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- REALTIME: Add security operations tables to Realtime
-- =============================================================================
-- Enables AI tools and dashboards to receive live security event updates.

ALTER PUBLICATION supabase_realtime ADD TABLE security_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE security_incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE firewall_rules;

-- =============================================================================
-- FUNCTION: get_security_dashboard
-- =============================================================================
-- RPC: SELECT * FROM get_security_dashboard('org-id');
-- Returns the data needed for the executive risk dashboard.

CREATE OR REPLACE FUNCTION get_security_dashboard(p_org_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'active_incidents', (SELECT COUNT(*) FROM security_incidents
                             WHERE org_id = p_org_id AND status NOT IN ('CLOSED', 'RECOVERED')),
        'critical_alerts',  (SELECT COUNT(*) FROM security_alerts
                             WHERE org_id = p_org_id AND severity = 'CRITICAL' AND status = 'active'),
        'open_vulns_critical', (SELECT COUNT(*) FROM vulnerability_findings
                                WHERE org_id = p_org_id AND severity = 'CRITICAL' AND status = 'open'),
        'open_vulns_high',  (SELECT COUNT(*) FROM vulnerability_findings
                             WHERE org_id = p_org_id AND severity = 'HIGH' AND status = 'open'),
        'kev_vulns',        (SELECT COUNT(*) FROM vulnerability_findings
                             WHERE org_id = p_org_id AND exploited_in_wild = true AND status = 'open'),
        'active_hunts',     (SELECT COUNT(*) FROM threat_hunt_sessions
                             WHERE org_id = p_org_id AND status = 'running'),
        'firewall_blocks_24h', (SELECT COALESCE(SUM(hit_count), 0) FROM firewall_rules
                                WHERE org_id = p_org_id AND created_at > now() - INTERVAL '24 hours'),
        'latest_risk_usd',  (SELECT risk_usd_mean FROM risk_scores
                             WHERE org_id = p_org_id ORDER BY computed_at DESC LIMIT 1),
        'generated_at',     now()
    ) INTO result;

    RETURN result;
END;
$$;

-- =============================================================================
-- FUNCTION: get_nl_query_analytics
-- =============================================================================
-- What are users asking about most? Powers product iteration.

CREATE OR REPLACE FUNCTION get_nl_query_analytics(
    p_org_id TEXT DEFAULT NULL,
    p_days INT DEFAULT 30
)
RETURNS TABLE (
    tool_name   TEXT,
    query_count BIGINT,
    avg_duration_ms NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        unnest(tools_called) AS tool_name,
        COUNT(*) AS query_count,
        ROUND(AVG(duration_ms)::NUMERIC, 0) AS avg_duration_ms
    FROM nl_query_log
    WHERE queried_at >= now() - (p_days || ' days')::INTERVAL
      AND (p_org_id IS NULL OR org_id = p_org_id)
    GROUP BY tool_name
    ORDER BY query_count DESC
    LIMIT 20;
$$;
