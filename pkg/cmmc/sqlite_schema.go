package cmmc

// SQLiteSchema is the DDL for the embedded SQLite database used in binary-local
// mode (khepra serve). It mirrors the Supabase schema but:
//   - Uses TEXT for UUIDs (generated via uuid.New().String() in Go)
//   - Uses TEXT for timestamps (RFC 3339, parsed with time.Parse)
//   - Uses TEXT for JSONB columns (parsed with json.Unmarshal)
//   - No RLS or triggers (enforced at application layer in Go)
//   - No enums (TEXT with CHECK constraints)
//
// Apply with: db.Exec(SQLiteSchema) on first run.
const SQLiteSchema = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- =============================================================================
-- engagements
-- =============================================================================
CREATE TABLE IF NOT EXISTS engagements (
    id                   TEXT PRIMARY KEY,
    organization_id      TEXT NOT NULL,
    cage_code            TEXT NOT NULL,
    contract_number      TEXT,
    cmmc_level_target    INTEGER NOT NULL CHECK (cmmc_level_target IN (1, 2, 3)),
    target_type          TEXT NOT NULL CHECK (target_type IN (
                             'prime_contractor', 'subcontractor',
                             'dib_contractor', 'cloud_service_provider')),
    phase                TEXT NOT NULL DEFAULT '00_seed_intake'
                             CHECK (phase IN (
                                 '00_seed_intake', '01_discovery',
                                 '02_boundary_proposal', '03_scoped_assessment',
                                 '04_evidence_collection', '05_findings_poam',
                                 '06_audit_export', 'done')),
    seed_networks        TEXT NOT NULL DEFAULT '[]',   -- JSON array
    seed_cloud_accounts  TEXT NOT NULL DEFAULT '{}',   -- JSON object
    c3pao_access_tokens  TEXT NOT NULL DEFAULT '[]',   -- JSON array of signed tokens
    discovery_dag_root   TEXT,
    boundary_approval_id TEXT REFERENCES boundary_approvals(id) DEFERRABLE INITIALLY DEFERRED,
    created_by           TEXT NOT NULL,
    created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    completed_at         TEXT
);

CREATE INDEX IF NOT EXISTS idx_eng_cage  ON engagements(cage_code);
CREATE INDEX IF NOT EXISTS idx_eng_phase ON engagements(phase);

-- =============================================================================
-- boundary_proposals
-- =============================================================================
CREATE TABLE IF NOT EXISTS boundary_proposals (
    id                   TEXT PRIMARY KEY,
    engagement_id        TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    discovery_dag_node   TEXT NOT NULL,
    scan_summary         TEXT NOT NULL DEFAULT '{}',   -- JSON
    proposed_assets      TEXT NOT NULL DEFAULT '[]',   -- JSON array of GovernedAssetDraft
    agent_confidence     REAL NOT NULL
                             CHECK (agent_confidence >= 0 AND agent_confidence <= 1),
    agent_justification  TEXT NOT NULL,
    status               TEXT NOT NULL DEFAULT 'pending_review'
                             CHECK (status IN (
                                 'pending_review', 'approved', 'rejected', 'amended')),
    reviewer_notes       TEXT,
    created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    reviewed_at          TEXT,
    reviewed_by          TEXT   -- user id, must hold Dwennimmen role
);

CREATE INDEX IF NOT EXISTS idx_bp_engagement ON boundary_proposals(engagement_id);
CREATE INDEX IF NOT EXISTS idx_bp_status     ON boundary_proposals(status);

-- =============================================================================
-- governed_assets
-- =============================================================================
CREATE TABLE IF NOT EXISTS governed_assets (
    id                   TEXT PRIMARY KEY,
    engagement_id        TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    boundary_proposal_id TEXT NOT NULL REFERENCES boundary_proposals(id),
    hostname             TEXT,
    ip_addresses         TEXT NOT NULL DEFAULT '[]',  -- JSON array
    mac_addresses        TEXT NOT NULL DEFAULT '[]',  -- JSON array
    asset_type           TEXT NOT NULL CHECK (asset_type IN (
                             'workstation', 'server', 'network_device', 'cloud_instance',
                             'ot_device', 'mobile_device', 'virtual_machine',
                             'container', 'saas_application', 'external_service')),
    platform             TEXT,
    operating_system     TEXT,
    fqdn                 TEXT,
    agent_recommendation INTEGER NOT NULL CHECK (agent_recommendation IN (0, 1)),
    agent_reasoning      TEXT NOT NULL,
    human_decision       TEXT NOT NULL CHECK (human_decision IN ('include', 'exclude', 'defer')),
    human_rationale      TEXT,
    decided_by           TEXT NOT NULL,
    decided_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    in_cmmc_scope        INTEGER NOT NULL DEFAULT 0 CHECK (in_cmmc_scope IN (0, 1)),
    dag_node_id          TEXT,
    created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_ga_engagement ON governed_assets(engagement_id);
CREATE INDEX IF NOT EXISTS idx_ga_scope      ON governed_assets(in_cmmc_scope);
CREATE INDEX IF NOT EXISTS idx_ga_decision   ON governed_assets(human_decision);

-- =============================================================================
-- boundary_approvals
-- =============================================================================
CREATE TABLE IF NOT EXISTS boundary_approvals (
    id                   TEXT PRIMARY KEY,
    engagement_id        TEXT NOT NULL REFERENCES engagements(id),
    boundary_proposal_id TEXT NOT NULL REFERENCES boundary_proposals(id),
    approved_by_role     TEXT NOT NULL DEFAULT 'Dwennimmen'
                             CHECK (approved_by_role = 'Dwennimmen'),
    approved_by_user_id  TEXT NOT NULL,
    pqc_signature        TEXT NOT NULL,    -- ML-DSA-65 base64url
    signed_payload_hash  TEXT NOT NULL,    -- SHA-256 hex
    dag_node_id          TEXT NOT NULL,
    khepra_manifest      TEXT NOT NULL,    -- JSON
    effective_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    expires_at           TEXT NOT NULL,    -- effective_at + 90 days, set in Go
    revoked_at           TEXT,
    revoked_by           TEXT,
    revocation_reason    TEXT,

    UNIQUE (engagement_id)  -- only one active approval per engagement
);

CREATE INDEX IF NOT EXISTS idx_ba_engagement ON boundary_approvals(engagement_id);
CREATE INDEX IF NOT EXISTS idx_ba_dag        ON boundary_approvals(dag_node_id);

-- =============================================================================
-- assessment_findings
-- =============================================================================
CREATE TABLE IF NOT EXISTS assessment_findings (
    id               TEXT PRIMARY KEY,
    engagement_id    TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    asset_id         TEXT REFERENCES governed_assets(id),
    control_family   TEXT NOT NULL,
    control_id       TEXT NOT NULL,
    control_title    TEXT,
    cmmc_level       INTEGER NOT NULL CHECK (cmmc_level IN (1, 2, 3)),
    status           TEXT NOT NULL DEFAULT 'not_reviewed'
                         CHECK (status IN (
                             'compliant', 'non_compliant', 'not_applicable', 'not_reviewed')),
    score            REAL CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
    finding_detail   TEXT,
    evidence_refs    TEXT NOT NULL DEFAULT '[]',  -- JSON array of DAG node IDs
    assessed_by      TEXT NOT NULL DEFAULT 'agent',
    assessment_method TEXT DEFAULT 'automated',
    dag_node_id      TEXT,
    assessed_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_af_engagement ON assessment_findings(engagement_id);
CREATE INDEX IF NOT EXISTS idx_af_control    ON assessment_findings(control_id);
CREATE INDEX IF NOT EXISTS idx_af_family     ON assessment_findings(control_family);
CREATE INDEX IF NOT EXISTS idx_af_status     ON assessment_findings(status);

-- =============================================================================
-- poam_items
-- =============================================================================
CREATE TABLE IF NOT EXISTS poam_items (
    id                       TEXT PRIMARY KEY,
    engagement_id            TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    finding_id               TEXT NOT NULL REFERENCES assessment_findings(id),
    weakness_description     TEXT NOT NULL,
    responsible_party        TEXT NOT NULL,
    resources_required       TEXT,
    milestones               TEXT NOT NULL DEFAULT '[]',   -- JSON array
    scheduled_completion     TEXT NOT NULL,                -- YYYY-MM-DD
    status                   TEXT NOT NULL DEFAULT 'open'
                                 CHECK (status IN (
                                     'open', 'in_progress', 'completed',
                                     'delayed', 'risk_accepted')),
    completion_date          TEXT,
    risk_accepted            INTEGER NOT NULL DEFAULT 0 CHECK (risk_accepted IN (0, 1)),
    risk_acceptance_rationale TEXT,
    risk_accepted_by         TEXT,
    dag_node_id              TEXT,
    created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_poam_engagement ON poam_items(engagement_id);
CREATE INDEX IF NOT EXISTS idx_poam_finding    ON poam_items(finding_id);
CREATE INDEX IF NOT EXISTS idx_poam_status     ON poam_items(status);

-- =============================================================================
-- audit_packages
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_packages (
    id               TEXT PRIMARY KEY,
    engagement_id    TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    format           TEXT NOT NULL CHECK (format IN (
                         'oscal_1_1_2', 'emass', 'c3pao_pdf', 'khepra_bundle')),
    version          INTEGER NOT NULL DEFAULT 1,
    title            TEXT,
    khepra_manifest  TEXT NOT NULL,     -- JSON
    pqc_signature    TEXT NOT NULL,     -- ML-DSA-65 base64url
    package_hash     TEXT NOT NULL,     -- SHA-256 hex
    dag_root_node_id TEXT NOT NULL,
    dag_leaf_node_id TEXT NOT NULL,
    storage_path     TEXT,
    download_url     TEXT,
    url_expires_at   TEXT,
    oscal_uuid       TEXT,
    assessment_date  TEXT,              -- YYYY-MM-DD
    created_by       TEXT NOT NULL,
    created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    expires_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_ap_engagement ON audit_packages(engagement_id);
CREATE INDEX IF NOT EXISTS idx_ap_format     ON audit_packages(format);

-- =============================================================================
-- updated_at triggers (SQLite equivalent of Supabase moddatetime)
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS engagements_updated_at
    AFTER UPDATE ON engagements FOR EACH ROW
    BEGIN
        UPDATE engagements SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS findings_updated_at
    AFTER UPDATE ON assessment_findings FOR EACH ROW
    BEGIN
        UPDATE assessment_findings SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS poam_updated_at
    AFTER UPDATE ON poam_items FOR EACH ROW
    BEGIN
        UPDATE poam_items SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = NEW.id;
    END;
`
