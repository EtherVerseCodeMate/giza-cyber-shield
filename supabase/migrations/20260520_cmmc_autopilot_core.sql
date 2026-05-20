-- Migration: 20260520_cmmc_autopilot_core
-- Purpose: Core information model for the Discovery-Driven CMMC Autopilot Workbench.
--
-- Architecture:
--   Seven-phase workflow: 00_seed_intake → 01_discovery → 02_boundary_proposal
--   → 03_scoped_assessment → 04_evidence_collection → 05_findings_poam → 06_audit_export
--
--   The critical inversion: agent PROPOSES boundary from discovery; COMPLIANCE_OFFICER
--   (Dwennimmen role) SIGNS it with ML-DSA-65. boundary_approvals.pqc_signature gates Phase 03.
--   No valid BoundaryApproval → BoundaryGuard blocks all Phase 03+ MCP tool calls.
--
-- FHIR R4 analog mapping (see pkg/cmmc/schema.go):
--   engagements          → ServiceRequest
--   governed_assets      → Device
--   boundary_proposals   → DiagnosticReport (pre-approval state)
--   boundary_approvals   → Consent (with PQC digital signature)
--   assessment_findings  → Observation
--   poam_items           → CarePlan.activity
--   audit_packages       → Bundle (type: document)

-- =============================================================================
-- PREREQUISITE: Add UNIQUE + NOT NULL to organizations.cage_code
-- =============================================================================
-- CAGE code is the permanent identifier for every DIB contractor in SAM.gov.
-- All engagement records are keyed to this; it must be immutable and unique.

ALTER TABLE public.organizations
    ALTER COLUMN cage_code SET NOT NULL,
    ADD CONSTRAINT organizations_cage_code_unique UNIQUE (cage_code);

-- =============================================================================
-- TABLE: engagements
-- =============================================================================
-- One row per CMMC assessment engagement. The root of the workbench DAG.
-- FHIR: ServiceRequest

CREATE TYPE public.cmmc_level AS ENUM ('1', '2', '3');
CREATE TYPE public.org_target_type AS ENUM (
    'prime_contractor',
    'subcontractor',
    'dib_contractor',
    'cloud_service_provider'
);
CREATE TYPE public.workflow_phase AS ENUM (
    '00_seed_intake',
    '01_discovery',
    '02_boundary_proposal',
    '03_scoped_assessment',
    '04_evidence_collection',
    '05_findings_poam',
    '06_audit_export',
    'done'
);

CREATE TABLE IF NOT EXISTS public.engagements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

    -- Contractor identity (denormalized for portability in .khepra export)
    cage_code           TEXT NOT NULL,
    contract_number     TEXT,

    -- Assessment parameters (locked at creation, immutable after Phase 02)
    cmmc_level_target   public.cmmc_level NOT NULL,
    target_type         public.org_target_type NOT NULL,

    -- Workflow state
    phase               public.workflow_phase NOT NULL DEFAULT '00_seed_intake',

    -- C3PAO reviewer tokens (ML-DSA-65 signed access grants, base64)
    c3pao_access_tokens TEXT[] DEFAULT '{}',

    -- Seed data (Phase 00 input)
    seed_networks       TEXT[] DEFAULT '{}',   -- CIDR ranges / hostnames / cloud tags
    seed_cloud_accounts JSONB  DEFAULT '{}',   -- {aws: "acct-id", azure: "sub-id", ...}

    -- Immutable DAG linkage (Phase 01)
    discovery_dag_root  TEXT,                  -- SHA-256 of root discovery DAG node

    -- Boundary governance (Phase 02 output)
    boundary_approval_id UUID,                 -- FK set after Phase 02 completes

    -- Lifecycle
    created_by          UUID NOT NULL REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,

    CONSTRAINT cage_code_matches_org CHECK (
        cage_code = (SELECT cage_code FROM public.organizations WHERE id = organization_id)
    )
);

CREATE INDEX idx_engagements_org     ON public.engagements(organization_id);
CREATE INDEX idx_engagements_cage    ON public.engagements(cage_code);
CREATE INDEX idx_engagements_phase   ON public.engagements(phase);
CREATE INDEX idx_engagements_created ON public.engagements(created_at DESC);

-- =============================================================================
-- TABLE: boundary_proposals
-- =============================================================================
-- Agent's output from Phase 01 autonomous discovery. Awaits COMPLIANCE_OFFICER
-- review and PQC signature before Phase 03 can begin.
-- FHIR: DiagnosticReport (pre-approval state)

CREATE TYPE public.proposal_status AS ENUM (
    'pending_review',
    'approved',
    'rejected',
    'amended'
);

CREATE TABLE IF NOT EXISTS public.boundary_proposals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id       UUID NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,

    -- Discovery provenance
    discovery_dag_node  TEXT NOT NULL,         -- SHA-256 DAG node that triggered this proposal
    scan_summary        JSONB DEFAULT '{}',    -- {hosts_scanned, ports_open, services_found, ...}

    -- Agent's boundary recommendation
    proposed_assets     JSONB NOT NULL DEFAULT '[]', -- GovernedAssetDraft[]
    agent_confidence    NUMERIC(4,3) NOT NULL   -- 0.000..1.000
        CHECK (agent_confidence >= 0 AND agent_confidence <= 1),
    agent_justification TEXT NOT NULL,

    -- Review state
    status              public.proposal_status NOT NULL DEFAULT 'pending_review',
    reviewer_notes      TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at         TIMESTAMPTZ,
    reviewed_by         UUID REFERENCES auth.users(id)  -- MUST hold Dwennimmen role
);

CREATE INDEX idx_boundary_proposals_engagement ON public.boundary_proposals(engagement_id);
CREATE INDEX idx_boundary_proposals_status     ON public.boundary_proposals(status);

-- =============================================================================
-- TABLE: governed_assets
-- =============================================================================
-- Assets confirmed in the assessment boundary after BoundaryApproval.
-- Per-asset human_decision field captures the governance record.
-- FHIR: Device

CREATE TYPE public.asset_type AS ENUM (
    'workstation',
    'server',
    'network_device',
    'cloud_instance',
    'ot_device',
    'mobile_device',
    'virtual_machine',
    'container',
    'saas_application',
    'external_service'
);

CREATE TYPE public.human_decision AS ENUM ('include', 'exclude', 'defer');

CREATE TABLE IF NOT EXISTS public.governed_assets (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id           UUID NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
    boundary_proposal_id    UUID NOT NULL REFERENCES public.boundary_proposals(id),

    -- Asset identity
    hostname                TEXT,
    ip_addresses            TEXT[]  DEFAULT '{}',
    mac_addresses           TEXT[]  DEFAULT '{}',
    asset_type              public.asset_type NOT NULL,
    platform                TEXT,              -- 'aws', 'azure', 'on-prem', 'gcp', 'ot-scada'
    operating_system        TEXT,
    fqdn                    TEXT,

    -- Governance fields (the core inversion)
    agent_recommendation    BOOLEAN NOT NULL,  -- agent says in-scope (true) or out-of-scope
    agent_reasoning         TEXT    NOT NULL,
    human_decision          public.human_decision NOT NULL,
    human_rationale         TEXT,
    decided_by              UUID    NOT NULL REFERENCES auth.users(id),
    decided_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- CMMC scope flag (set after human_decision = 'include')
    in_cmmc_scope           BOOLEAN NOT NULL DEFAULT FALSE,

    -- Evidence DAG linkage
    dag_node_id             TEXT,              -- SHA-256 of asset discovery DAG node

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_governed_assets_engagement ON public.governed_assets(engagement_id);
CREATE INDEX idx_governed_assets_type       ON public.governed_assets(asset_type);
CREATE INDEX idx_governed_assets_scope      ON public.governed_assets(in_cmmc_scope);
CREATE INDEX idx_governed_assets_decision   ON public.governed_assets(human_decision);

-- =============================================================================
-- TABLE: boundary_approvals
-- =============================================================================
-- PQC-signed governance gate. A valid row here is the only thing that allows
-- BoundaryGuard to pass Phase 03+ MCP tool calls.
--
-- The pqc_signature field is ML-DSA-65 (NIST FIPS 204) over the canonical
-- JSON of: {engagement_id, proposal_id, asset_ids[], approved_at, expires_at}.
-- FHIR: Consent (with digital signature extension)

CREATE TABLE IF NOT EXISTS public.boundary_approvals (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id           UUID NOT NULL REFERENCES public.engagements(id),
    boundary_proposal_id    UUID NOT NULL REFERENCES public.boundary_proposals(id),

    -- Signer identity (MUST hold Dwennimmen / COMPLIANCE_OFFICER role)
    approved_by_role        TEXT NOT NULL DEFAULT 'Dwennimmen'
        CHECK (approved_by_role = 'Dwennimmen'),
    approved_by_user_id     UUID NOT NULL REFERENCES auth.users(id),

    -- PQC signature over canonical payload (ML-DSA-65 / NIST FIPS 204)
    pqc_signature           TEXT NOT NULL,     -- base64url ML-DSA-65 signature
    signed_payload_hash     TEXT NOT NULL,     -- SHA-256 hex of the signed canonical JSON

    -- Immutable DAG record of this governance event
    dag_node_id             TEXT NOT NULL,     -- SHA-256 content hash

    -- .khepra manifest (same format as license.khepra)
    khepra_manifest         JSONB NOT NULL,    -- {version, type: "boundary_approval", claims, signature}

    -- Validity window (90-day default; matches CMMC assessment cycle)
    effective_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at              TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),

    -- Revocation
    revoked_at              TIMESTAMPTZ,
    revoked_by              UUID REFERENCES auth.users(id),
    revocation_reason       TEXT,

    CONSTRAINT boundary_approval_unique_engagement
        UNIQUE (engagement_id)               -- only one active approval per engagement
);

CREATE INDEX idx_boundary_approvals_engagement ON public.boundary_approvals(engagement_id);
CREATE INDEX idx_boundary_approvals_expires    ON public.boundary_approvals(expires_at);
CREATE INDEX idx_boundary_approvals_dag        ON public.boundary_approvals(dag_node_id);

-- Back-fill FK from engagements after approval is created
ALTER TABLE public.engagements
    ADD CONSTRAINT fk_engagements_boundary_approval
    FOREIGN KEY (boundary_approval_id) REFERENCES public.boundary_approvals(id)
    DEFERRABLE INITIALLY DEFERRED;

-- =============================================================================
-- TABLE: assessment_findings
-- =============================================================================
-- Per-control assessment results (Phase 03). One row per control per asset
-- (or per engagement for shared controls).
-- FHIR: Observation

CREATE TYPE public.finding_status AS ENUM (
    'compliant',
    'non_compliant',
    'not_applicable',
    'not_reviewed'
);

CREATE TABLE IF NOT EXISTS public.assessment_findings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id       UUID NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
    asset_id            UUID REFERENCES public.governed_assets(id),  -- NULL = engagement-level finding

    -- CMMC control reference
    control_family      TEXT NOT NULL,         -- 'AC', 'AU', 'CM', 'IA', 'IR', 'MA', 'MP', 'PS', 'RA', 'CA', 'SC', 'SI'
    control_id          TEXT NOT NULL,         -- e.g. 'AC.L2-3.1.1'
    control_title       TEXT,
    cmmc_level          public.cmmc_level NOT NULL,

    -- Finding
    status              public.finding_status NOT NULL DEFAULT 'not_reviewed',
    score               NUMERIC(5,2)           -- 0.00..100.00 (NULL if not_reviewed)
        CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
    finding_detail      TEXT,
    evidence_refs       TEXT[] DEFAULT '{}',   -- DAG node IDs of collected evidence

    -- Attribution
    assessed_by         TEXT NOT NULL DEFAULT 'agent', -- 'agent' | user_id
    assessment_method   TEXT DEFAULT 'automated',      -- 'automated' | 'manual' | 'interview' | 'test'

    -- DAG linkage
    dag_node_id         TEXT,

    assessed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_findings_engagement    ON public.assessment_findings(engagement_id);
CREATE INDEX idx_findings_control       ON public.assessment_findings(control_id);
CREATE INDEX idx_findings_family        ON public.assessment_findings(control_family);
CREATE INDEX idx_findings_status        ON public.assessment_findings(status);
CREATE INDEX idx_findings_asset         ON public.assessment_findings(asset_id);

-- =============================================================================
-- TABLE: poam_items
-- =============================================================================
-- Plan of Action & Milestones for non-compliant findings (Phase 05).
-- FHIR: CarePlan.activity

CREATE TYPE public.poam_status AS ENUM (
    'open',
    'in_progress',
    'completed',
    'delayed',
    'risk_accepted'
);

CREATE TABLE IF NOT EXISTS public.poam_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id           UUID NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
    finding_id              UUID NOT NULL REFERENCES public.assessment_findings(id),

    -- POAM content (follows NIST SP 800-171A / DoD CMMC POAM template)
    weakness_description    TEXT NOT NULL,
    responsible_party       TEXT NOT NULL,
    resources_required      TEXT,
    milestones              JSONB DEFAULT '[]', -- [{description, due_date, completed_at}]
    scheduled_completion    DATE NOT NULL,
    status                  public.poam_status NOT NULL DEFAULT 'open',
    completion_date         DATE,

    -- Risk acceptance (alternative to remediation)
    risk_accepted           BOOLEAN NOT NULL DEFAULT FALSE,
    risk_acceptance_rationale TEXT,
    risk_accepted_by        UUID REFERENCES auth.users(id),

    -- DAG linkage
    dag_node_id             TEXT,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_poam_engagement ON public.poam_items(engagement_id);
CREATE INDEX idx_poam_finding    ON public.poam_items(finding_id);
CREATE INDEX idx_poam_status     ON public.poam_items(status);
CREATE INDEX idx_poam_due        ON public.poam_items(scheduled_completion);

-- =============================================================================
-- TABLE: audit_packages
-- =============================================================================
-- Phase 06 export records. Each row is a versioned, PQC-signed evidence package.
-- FHIR: Bundle (type: document)

CREATE TYPE public.audit_package_format AS ENUM (
    'oscal_1_1_2',     -- NIST OSCAL Assessment Results (C3PAO standard)
    'emass',           -- DoD eMASS import format
    'c3pao_pdf',       -- Human-readable C3PAO submission PDF
    'khepra_bundle'    -- Native .khepra format (encrypted, PQC-signed)
);

CREATE TABLE IF NOT EXISTS public.audit_packages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id       UUID NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,

    -- Package metadata
    format              public.audit_package_format NOT NULL,
    version             INTEGER NOT NULL DEFAULT 1,  -- increments on re-export
    title               TEXT,

    -- PQC-signed manifest (.khepra format)
    khepra_manifest     JSONB NOT NULL,   -- {version, type: "audit_package", claims, signature}
    pqc_signature       TEXT NOT NULL,   -- ML-DSA-65 base64url over package hash
    package_hash        TEXT NOT NULL,   -- SHA-256 hex of the exported content

    -- DAG provenance (full chain from Phase 01 → Phase 06)
    dag_root_node_id    TEXT NOT NULL,   -- root of the evidence DAG for this engagement
    dag_leaf_node_id    TEXT NOT NULL,   -- leaf node at time of export

    -- Content location
    storage_path        TEXT,            -- local file path or Supabase storage path
    download_url        TEXT,            -- signed URL (expires)
    url_expires_at      TIMESTAMPTZ,

    -- OSCAL-specific metadata
    oscal_uuid          UUID,            -- OSCAL document UUID (stable across re-exports)
    assessment_date     DATE,

    created_by          UUID NOT NULL REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ      -- package validity (90 days default)
);

CREATE INDEX idx_audit_packages_engagement ON public.audit_packages(engagement_id);
CREATE INDEX idx_audit_packages_format     ON public.audit_packages(format);
CREATE INDEX idx_audit_packages_created    ON public.audit_packages(created_at DESC);

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE public.engagements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boundary_proposals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governed_assets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boundary_approvals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poam_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_packages      ENABLE ROW LEVEL SECURITY;

-- Members of the owning organization can access engagements
CREATE POLICY "engagements_org_members" ON public.engagements
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ));

-- Proposals, assets, approvals, findings, POAMs, and packages are scoped through engagement
CREATE POLICY "boundary_proposals_via_engagement" ON public.boundary_proposals
    FOR ALL USING (engagement_id IN (
        SELECT id FROM public.engagements WHERE organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "governed_assets_via_engagement" ON public.governed_assets
    FOR ALL USING (engagement_id IN (
        SELECT id FROM public.engagements WHERE organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "boundary_approvals_via_engagement" ON public.boundary_approvals
    FOR ALL USING (engagement_id IN (
        SELECT id FROM public.engagements WHERE organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "findings_via_engagement" ON public.assessment_findings
    FOR ALL USING (engagement_id IN (
        SELECT id FROM public.engagements WHERE organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "poam_via_engagement" ON public.poam_items
    FOR ALL USING (engagement_id IN (
        SELECT id FROM public.engagements WHERE organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    ));

CREATE POLICY "audit_packages_via_engagement" ON public.audit_packages
    FOR ALL USING (engagement_id IN (
        SELECT id FROM public.engagements WHERE organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    ));

-- =============================================================================
-- updated_at TRIGGERS
-- =============================================================================

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.engagements
    FOR EACH ROW EXECUTE FUNCTION public.moddatetime(updated_at);

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.assessment_findings
    FOR EACH ROW EXECUTE FUNCTION public.moddatetime(updated_at);

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.poam_items
    FOR EACH ROW EXECUTE FUNCTION public.moddatetime(updated_at);

-- =============================================================================
-- FUNCTION: cmmc_compliance_score
-- =============================================================================
-- Returns per-domain and overall SPRS score for an engagement.
-- SPRS score range: -203 to 110 (DFARS 252.204-7019)

CREATE OR REPLACE FUNCTION public.cmmc_compliance_score(p_engagement_id UUID)
RETURNS TABLE (
    control_family  TEXT,
    total           BIGINT,
    compliant       BIGINT,
    non_compliant   BIGINT,
    not_reviewed    BIGINT,
    domain_score    NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT
        control_family,
        COUNT(*)                                                    AS total,
        COUNT(*) FILTER (WHERE status = 'compliant')                AS compliant,
        COUNT(*) FILTER (WHERE status = 'non_compliant')            AS non_compliant,
        COUNT(*) FILTER (WHERE status = 'not_reviewed')             AS not_reviewed,
        ROUND(
            100.0 * COUNT(*) FILTER (WHERE status = 'compliant')
            / NULLIF(COUNT(*) FILTER (WHERE status <> 'not_applicable'), 0),
            2
        )                                                           AS domain_score
    FROM public.assessment_findings
    WHERE engagement_id = p_engagement_id
    GROUP BY control_family
    ORDER BY control_family;
$$;

-- =============================================================================
-- REALTIME: Enable live updates for governance workflow
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.engagements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.boundary_proposals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.boundary_approvals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assessment_findings;
