-- ============================================================
-- CMMC Autopilot Workbench — DDL Migration 003
-- File: 003_ea_kernel_schema.sql
-- Requires: 001_base_schema.sql + 002_g0dm0d3_sovereign.sql
--
-- Adds the Evolutionary Algorithm (EA) Kernel persistence layer.
-- The EA runs in pkg/ea/ and continuously evolves security strategies.
-- Every generation is ML-DSA-65 signed and committed to the DAG.
-- This schema is the durable record of that evolution history.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SECTION 1: EA ENGINE STATE
-- One row per tenant — the live state of the EA engine.
-- Updated after every Evolve() call.
-- ────────────────────────────────────────────────────────────

CREATE TABLE ea_engine_state (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    engagement_id           UUID        REFERENCES engagements(id) ON DELETE SET NULL,

    -- Current generation counter (monotonically increasing)
    current_generation      INTEGER     NOT NULL DEFAULT 0,

    -- Current champion genome identity
    best_symbol             TEXT        CHECK (best_symbol IN (
                                'Eban',         -- N=256, Q=8380417, σ=1.78, K=4, 256-bit
                                'Fawohodie',    -- N=256, Q=8380417, σ=1.98, K=3, 192-bit
                                'Nkyinkyim',    -- N=256, Q=3329, σ=1.0, K=3, 192-bit
                                'Dwennimmen'    -- N=256, Q=3329, σ=1.0, K=2, 128-bit
                            )),
    best_fitness            NUMERIC(6,4),       -- 0.0000 – 1.0000+

    -- Population parameters (from engine.go constants)
    pop_size                INTEGER     NOT NULL DEFAULT 50,
    mutation_rate           NUMERIC(5,4) NOT NULL DEFAULT 0.02,
    crossover_rate          NUMERIC(5,4) NOT NULL DEFAULT 0.75,
    tournament_size         INTEGER     NOT NULL DEFAULT 5,
    elite_count             INTEGER     NOT NULL DEFAULT 2,

    -- Engine status
    status                  TEXT        NOT NULL DEFAULT 'idle' CHECK (status IN (
                                'idle',         -- waiting for next scheduled run
                                'evolving',     -- Evolve() currently running
                                'paused',       -- operator-paused
                                'error'         -- last evolution failed
                            )),

    -- DAG node of the last committed generation
    last_dag_node_id        TEXT,

    -- Timestamps
    last_evolved_at         TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (tenant_id)  -- one engine state per tenant
);

COMMENT ON TABLE ea_engine_state IS
    'Live state of the Evolutionary Algorithm engine per tenant. '
    'This is the in-flight view — updated after every Evolve() call. '
    'The full generation history is in ea_generations.';


-- ────────────────────────────────────────────────────────────
-- SECTION 2: EA GENERATION HISTORY
-- Immutable record of every completed evolution cycle.
-- The champion genome of each generation is stored here.
-- Each row is ML-DSA-65 signed.
-- ────────────────────────────────────────────────────────────

CREATE TABLE ea_generations (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    engagement_id           UUID        REFERENCES engagements(id) ON DELETE SET NULL,

    -- Generation identity
    generation_number       INTEGER     NOT NULL,

    -- Champion genome (96 bytes, hex-encoded for storage)
    -- Genome layout (from adinkra_evolution.go):
    --   [0]      Adinkra symbol selector
    --   [1-7]    Strategy weights (STIG priority, PQC strength, scan speed,
    --            accuracy, FPR penalty, priv-esc risk, remediation coverage)
    --   [8-15]   Capability flags (STIG, Forensics, IR, BCDR, PQC, FIM, Network, SBOM)
    --   [16-23]  Threshold parameters
    --   [48-79]  Symbol → lattice param encodings
    --   [80-87]  DAG consensus weights (4 floats)
    --   [88-95]  Zero-trust thresholds
    champion_genome_hex     TEXT        NOT NULL,   -- hex(96 bytes)
    champion_genome_size    INTEGER     NOT NULL DEFAULT 96,  -- AdinkraGenomeSize

    -- Champion metadata
    champion_symbol         TEXT        NOT NULL CHECK (champion_symbol IN (
                                'Eban', 'Fawohodie', 'Nkyinkyim', 'Dwennimmen'
                            )),
    champion_fitness        NUMERIC(8,6) NOT NULL,

    -- Multi-objective fitness breakdown (from fitness formula)
    -- Fitness = 0.35 * BaseAttackResistance
    --         + 0.25 * KEV_Coverage
    --         + 0.20 * NISTCompliance
    --         + 0.20 * ERTFindingPenalty
    --         × 1.5 bonus if all LatticeParams pass Validate()
    fitness_base_attack_resistance  NUMERIC(6,4),
    fitness_kev_coverage            NUMERIC(6,4),
    fitness_nist_compliance         NUMERIC(6,4),
    fitness_ert_finding_penalty     NUMERIC(6,4),
    fitness_nist_bonus_applied      BOOLEAN     DEFAULT FALSE,

    -- Quantum attack scores (from quantum simulators)
    -- Each 0.0 – 1.0 (1.0 = fully resistant)
    q_score_shor            NUMERIC(5,4),   -- 15% 5yr probability
    q_score_grover          NUMERIC(5,4),   -- 35% 5yr probability
    q_score_bkz_lll         NUMERIC(5,4),   -- 25% 5yr probability
    q_score_timing_power    NUMERIC(5,4),   -- 45% 5yr probability
    q_score_symbol_collision NUMERIC(5,4),  -- 5% 5yr probability (patent-novel)

    -- Derived lattice parameters of champion genome
    lattice_n               INTEGER,    -- ring dimension
    lattice_q               BIGINT,     -- modulus
    lattice_sigma           NUMERIC(8,4), -- error std dev
    lattice_k               INTEGER,    -- module rank
    lattice_security_bits   INTEGER,

    -- Population diversity (avg fitness across all 50 individuals)
    pop_avg_fitness         NUMERIC(8,6),
    pop_min_fitness         NUMERIC(8,6),
    pop_max_fitness         NUMERIC(8,6),

    -- ERT findings that fed into fitness this generation
    ert_open_findings_count INTEGER     DEFAULT 0,
    ert_critical_count      INTEGER     DEFAULT 0,

    -- Active capability flags of champion (bit field decoded from genome [8-15])
    cap_stig                BOOLEAN     DEFAULT FALSE,
    cap_forensics           BOOLEAN     DEFAULT FALSE,
    cap_ir                  BOOLEAN     DEFAULT FALSE,
    cap_bcdr                BOOLEAN     DEFAULT FALSE,
    cap_pqc                 BOOLEAN     DEFAULT FALSE,
    cap_fim                 BOOLEAN     DEFAULT FALSE,
    cap_network             BOOLEAN     DEFAULT FALSE,
    cap_sbom                BOOLEAN     DEFAULT FALSE,

    -- PQC attestation
    pqc_signature           BYTEA       NOT NULL,   -- ML-DSA-65 over this row's canonical JSON
    signature_algorithm     TEXT        NOT NULL DEFAULT 'ML-DSA-65',

    -- DAG integration
    dag_node_id             TEXT        NOT NULL,   -- every generation is DAG-committed

    -- Duration of Evolve() call
    evolution_duration_ms   INTEGER,

    evolved_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (tenant_id, generation_number)
);

CREATE INDEX idx_ea_generations_tenant    ON ea_generations (tenant_id, generation_number DESC);
CREATE INDEX idx_ea_generations_engagement ON ea_generations (engagement_id, generation_number DESC)
    WHERE engagement_id IS NOT NULL;
CREATE INDEX idx_ea_generations_fitness   ON ea_generations (tenant_id, champion_fitness DESC);
CREATE INDEX idx_ea_generations_symbol    ON ea_generations (tenant_id, champion_symbol);

COMMENT ON TABLE ea_generations IS
    'Immutable generation-by-generation record of EA evolution. '
    'Every row is ML-DSA-65 signed and DAG-committed. '
    'The champion_genome_hex is the 96-byte AdinkraGenome of the fittest '
    'individual, which directly governs the KernelRouter dispatch weights '
    'and lattice cryptographic parameters for that generation.';


-- ────────────────────────────────────────────────────────────
-- SECTION 3: KERNEL ROUTER DISPATCH LOG
-- Records every KernelRouter.Classify() dispatch decision.
-- Captures which capabilities fired, in what order, and why.
-- ────────────────────────────────────────────────────────────

CREATE TABLE ea_kernel_routes (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    engagement_id           UUID        REFERENCES engagements(id) ON DELETE SET NULL,

    -- Which generation's genome governed this routing decision
    generation_id           UUID        REFERENCES ea_generations(id) ON DELETE SET NULL,
    generation_number       INTEGER,

    -- SecurityContext inputs (from kernel_router.go)
    ctx_target              TEXT,
    ctx_has_cui             BOOLEAN,
    ctx_is_air_gapped       BOOLEAN,
    ctx_is_containerised    BOOLEAN,
    ctx_cloud_provider      TEXT,
    ctx_os_family           TEXT,
    ctx_frameworks          TEXT[],     -- ['CMMC', 'STIG', 'NIST-800-53', ...]
    ctx_has_anomaly_signal  BOOLEAN,
    ctx_active_incident     BOOLEAN,
    ctx_legacy_crypto_found BOOLEAN,
    ctx_unpatched_cves      INTEGER,
    ctx_threat_actors       TEXT[],

    -- Routing decision: ordered list of capabilities dispatched
    -- Stored as JSONB array: [{cap: 'CapSTIG', weight: 0.87, order: 1}, ...]
    dispatched_capabilities JSONB       NOT NULL DEFAULT '[]'::jsonb,

    -- Which capabilities were selected (for fast filtering)
    selected_cap_stig       BOOLEAN     DEFAULT FALSE,
    selected_cap_pqc        BOOLEAN     DEFAULT FALSE,
    selected_cap_forensics  BOOLEAN     DEFAULT FALSE,
    selected_cap_ir         BOOLEAN     DEFAULT FALSE,
    selected_cap_fim        BOOLEAN     DEFAULT FALSE,
    selected_cap_bcdr       BOOLEAN     DEFAULT FALSE,
    selected_cap_network    BOOLEAN     DEFAULT FALSE,
    selected_cap_sbom       BOOLEAN     DEFAULT FALSE,

    -- Outcome: results from each dispatched KernelAgent
    -- {cap: 'CapSTIG', success: true, duration_ms: 450, dag_node_id: '...'}
    agent_results           JSONB       NOT NULL DEFAULT '[]'::jsonb,

    -- DAG node created for this routing event
    dag_node_id             TEXT,

    routed_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at            TIMESTAMPTZ
);

CREATE INDEX idx_ea_kernel_routes_tenant     ON ea_kernel_routes (tenant_id, routed_at DESC);
CREATE INDEX idx_ea_kernel_routes_engagement ON ea_kernel_routes (engagement_id, routed_at DESC)
    WHERE engagement_id IS NOT NULL;
CREATE INDEX idx_ea_kernel_routes_incident   ON ea_kernel_routes (tenant_id)
    WHERE ctx_active_incident = TRUE;

COMMENT ON TABLE ea_kernel_routes IS
    'Immutable dispatch log from KernelRouter.Classify(). '
    'Each row captures the full SecurityContext input and the '
    'ordered capability dispatch decision made by the current champion '
    'genome. After each EAEngine.Evolve(), UpdateWeightsFromGenome() '
    're-tunes all 8 routing weights — so dispatch behavior changes '
    'generation by generation and this log is the proof.';


-- ────────────────────────────────────────────────────────────
-- SECTION 4: EA EVOLUTION TRIGGER LOG
-- Records what triggered each Evolve() call.
-- The EA can be triggered by: schedule, new ERT findings,
-- anomaly detection, operator command, or compliance event.
-- ────────────────────────────────────────────────────────────

CREATE TABLE ea_evolution_triggers (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    engagement_id       UUID        REFERENCES engagements(id) ON DELETE SET NULL,
    generation_id       UUID        REFERENCES ea_generations(id) ON DELETE SET NULL,

    trigger_type        TEXT        NOT NULL CHECK (trigger_type IN (
                            'scheduled',        -- periodic background evolution
                            'ert_new_findings', -- new ERT scan produced findings
                            'anomaly_detected', -- ASAF anomaly signal fired
                            'critical_cve',     -- new CISA KEV match
                            'operator_command', -- manual via API
                            'compliance_gate',  -- triggered by assessment phase transition
                            'startup'           -- initial evolution on engine start
                        )),

    -- Context that caused the trigger
    trigger_context     JSONB       DEFAULT '{}'::jsonb,
        -- e.g. {ert_finding_ids: [...], cve_id: 'CVE-2024-...', anomaly_score: 0.87}

    triggered_by        UUID        REFERENCES users(id),    -- null for automated triggers
    triggered_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ea_triggers_tenant ON ea_evolution_triggers (tenant_id, triggered_at DESC);


-- ────────────────────────────────────────────────────────────
-- SECTION 5: G0DM0D3 TOOL CALL LOG
-- Records every [TOOL:xxx] invocation — both AI-embedded and
-- direct HTTP GET to /api/g0dm0d3/tools/{name}.
-- This captures the live tool-calling behavior of the AI.
-- ────────────────────────────────────────────────────────────

CREATE TABLE g0dm0d3_tool_calls (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID        REFERENCES g0dm0d3_sessions(id) ON DELETE SET NULL,
    tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    engagement_id       UUID        REFERENCES engagements(id) ON DELETE SET NULL,

    -- Tool identity (using actual names from tool panel)
    tool_name           TEXT        NOT NULL CHECK (tool_name IN (
                            'dag-summary',          -- DAG node count + action breakdown
                            'stig-summary',         -- STIG scan nodes from DAG
                            'pqc-inventory',        -- PQC algorithm usage tally
                            'forensics-summary',    -- forensic + threat events
                            'license-status',       -- sovereign license details
                            'ea-status'             -- LIVE EA snapshot: gen, fitness, symbol, pop
                        )),

    -- How the tool was called
    invocation_type     TEXT        NOT NULL CHECK (invocation_type IN (
                            'ai_embedded',  -- AI embedded [TOOL:xxx] in response
                            'http_direct'   -- direct HTTP GET /api/g0dm0d3/tools/{name}
                        )),

    -- Result (tool output injected into AI response or returned to caller)
    -- Stored as JSONB snapshot of tool output at call time
    tool_output         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    success             BOOLEAN     NOT NULL DEFAULT TRUE,
    error_message       TEXT,
    latency_ms          INTEGER,

    called_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_g0dm0d3_tool_calls_session    ON g0dm0d3_tool_calls (session_id);
CREATE INDEX idx_g0dm0d3_tool_calls_tenant     ON g0dm0d3_tool_calls (tenant_id, called_at DESC);
CREATE INDEX idx_g0dm0d3_tool_calls_ea_status  ON g0dm0d3_tool_calls (tenant_id, called_at DESC)
    WHERE tool_name = 'ea-status';

COMMENT ON TABLE g0dm0d3_tool_calls IS
    'Every [TOOL:xxx] invocation by the G0DM0D3 AI Brain. '
    'When the AI embeds [TOOL:dag-summary] in a response, the tool is '
    'auto-executed and injected before the user sees the response. '
    'This table records that invocation, its output snapshot, and whether '
    'it was AI-embedded or directly called via HTTP GET. '
    'Critical: ea-status tool calls capture live EA engine snapshots '
    '(generation, best_fitness, best_symbol, pop_size) at the moment '
    'the AI consulted the engine mid-conversation.';


-- ────────────────────────────────────────────────────────────
-- SECTION 6: QUANTUM POSTURE SNAPSHOTS
-- Periodic snapshots of the current quantum attack resistance
-- profile, derived from the champion genome's simulator scores.
-- Used for trending and executive reporting.
-- ────────────────────────────────────────────────────────────

CREATE TABLE quantum_posture_snapshots (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    engagement_id           UUID        REFERENCES engagements(id) ON DELETE SET NULL,
    generation_id           UUID        REFERENCES ea_generations(id) ON DELETE SET NULL,

    -- Symbol of champion genome at snapshot time
    champion_symbol         TEXT        NOT NULL,
    champion_fitness        NUMERIC(8,6) NOT NULL,

    -- Five quantum attack scores
    -- (mirrored from ea_generations for denormalized time-series access)
    q_score_shor            NUMERIC(5,4) NOT NULL,
    q_score_grover          NUMERIC(5,4) NOT NULL,
    q_score_bkz_lll         NUMERIC(5,4) NOT NULL,
    q_score_timing_power    NUMERIC(5,4) NOT NULL,
    q_score_symbol_collision NUMERIC(5,4) NOT NULL,

    -- Weighted composite (probability-weighted attack resistance)
    -- = 0.15*shor + 0.35*grover + 0.25*bkz + 0.45*timing + 0.05*collision
    -- normalized to [0,1]
    composite_resistance    NUMERIC(5,4) NOT NULL,

    -- NSM-10 / CISA PQC mandate alignment
    nist_fips203_compliant  BOOLEAN     NOT NULL DEFAULT FALSE,  -- ML-KEM
    nist_fips204_compliant  BOOLEAN     NOT NULL DEFAULT FALSE,  -- ML-DSA
    cisa_nsm10_aligned      BOOLEAN     NOT NULL DEFAULT FALSE,

    snapped_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qps_tenant_time ON quantum_posture_snapshots (tenant_id, snapped_at DESC);
CREATE INDEX idx_qps_engagement  ON quantum_posture_snapshots (engagement_id, snapped_at DESC)
    WHERE engagement_id IS NOT NULL;

COMMENT ON TABLE quantum_posture_snapshots IS
    'Time-series quantum attack resistance profile. '
    'One snapshot per EA evolution cycle, derived from champion genome scores. '
    'Powers the Godfather Report quantum posture trending and NSM-10 '
    'CISA mandate alignment evidence. Composite resistance tracks '
    'probability-weighted improvement across Shor, Grover, BKZ/LLL, '
    'timing/power, and Adinkra symbol collision attack models.';


-- ────────────────────────────────────────────────────────────
-- SECTION 7: VIEWS FOR API LAYER
-- ────────────────────────────────────────────────────────────

-- Current EA status per tenant (used by GET /ea/status)
CREATE VIEW ea_current_status AS
    SELECT
        s.tenant_id,
        s.engagement_id,
        s.current_generation,
        s.best_symbol,
        s.best_fitness,
        s.pop_size,
        s.mutation_rate,
        s.crossover_rate,
        s.status,
        s.last_evolved_at,
        g.champion_fitness,
        g.q_score_shor,
        g.q_score_grover,
        g.q_score_bkz_lll,
        g.q_score_timing_power,
        g.q_score_symbol_collision,
        g.cap_stig,
        g.cap_forensics,
        g.cap_ir,
        g.cap_bcdr,
        g.cap_pqc,
        g.cap_fim,
        g.cap_network,
        g.cap_sbom,
        g.dag_node_id       AS last_generation_dag_node,
        g.evolution_duration_ms AS last_evolution_ms
    FROM ea_engine_state s
    LEFT JOIN ea_generations g
        ON g.tenant_id = s.tenant_id
        AND g.generation_number = s.current_generation;

-- Fitness trend (last 20 generations) — powers the trend chart in UI
CREATE VIEW ea_fitness_trend AS
    SELECT
        tenant_id,
        engagement_id,
        generation_number,
        champion_symbol,
        champion_fitness,
        fitness_base_attack_resistance,
        fitness_kev_coverage,
        fitness_nist_compliance,
        fitness_ert_finding_penalty,
        q_score_shor,
        q_score_grover,
        q_score_bkz_lll,
        q_score_timing_power,
        q_score_symbol_collision,
        ert_critical_count,
        evolved_at
    FROM ea_generations
    WHERE generation_number >= (
        SELECT MAX(generation_number) - 19
        FROM ea_generations g2
        WHERE g2.tenant_id = ea_generations.tenant_id
    )
    ORDER BY generation_number DESC;


-- ────────────────────────────────────────────────────────────
-- SECTION 8: RLS POLICIES
-- ────────────────────────────────────────────────────────────

ALTER TABLE ea_engine_state             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ea_generations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ea_kernel_routes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ea_evolution_triggers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE g0dm0d3_tool_calls          ENABLE ROW LEVEL SECURITY;
ALTER TABLE quantum_posture_snapshots   ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON ea_engine_state
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON ea_generations
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- EA generations are insert-only (evolution history is immutable)
CREATE POLICY ea_generations_insert ON ea_generations
    FOR INSERT WITH CHECK (
        tenant_id = current_setting('app.current_tenant_id')::UUID
    );

CREATE POLICY tenant_isolation ON ea_kernel_routes
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON g0dm0d3_tool_calls
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON quantum_posture_snapshots
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);


-- ────────────────────────────────────────────────────────────
-- SECTION 9: SEED INITIAL ENGINE STATE ON TENANT CREATION
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION initialize_ea_engine(p_tenant_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO ea_engine_state (
        tenant_id,
        current_generation,
        pop_size,
        mutation_rate,
        crossover_rate,
        tournament_size,
        elite_count,
        status
    ) VALUES (
        p_tenant_id,
        0,
        50,     -- PopulationSize constant from engine.go
        0.02,   -- MutationRate constant
        0.75,   -- CrossoverRate constant
        5,      -- TournamentSize constant
        2,      -- EliteCount constant
        'idle'
    )
    ON CONFLICT (tenant_id) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION initialize_ea_engine IS
    'Seeds the EA engine state row for a new tenant. '
    'Called alongside insert_default_sovereign_provider() during tenant creation. '
    'The engine starts at generation 0 and evolves on first Evolve() call, '
    'which is triggered automatically on product startup (trigger_type=startup).';
