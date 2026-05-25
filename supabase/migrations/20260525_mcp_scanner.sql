-- Migration: MCP Scanner schema corrections and additions
-- Date: 2026-05-25
--
-- Fixes:
--   1. ea_fitness_trend view missing engagement_id correlation (cross-engagement mixing)
--   2. Missing index on ea_evolution_triggers for Mitochondrial Server polling
--   3. composite_resistance range CHECK (values must be normalized to [0, 1])
--   4. g0dm0d3_tool_calls tool_name CHECK extended with 'mcp-scan'

-- ─── 1. Fix ea_fitness_trend view ─────────────────────────────────────────────
-- The original subquery correlated only on tenant_id, causing generation numbers
-- from different engagements to mix in the rolling average.

DROP VIEW IF EXISTS ea_fitness_trend;

CREATE OR REPLACE VIEW ea_fitness_trend AS
SELECT
    g.tenant_id,
    g.engagement_id,
    g.generation_number,
    g.best_fitness,
    g.population_size,
    g.created_at,
    (
        SELECT AVG(g2.best_fitness)
        FROM ea_generations g2
        WHERE g2.tenant_id      = g.tenant_id
          AND g2.engagement_id  = g.engagement_id   -- was missing; caused cross-engagement mixing
          AND g2.generation_number >= g.generation_number - 5
          AND g2.generation_number <= g.generation_number
    ) AS rolling_5gen_avg
FROM ea_generations g
ORDER BY g.engagement_id, g.generation_number;

-- ─── 2. Index on ea_evolution_triggers for Mitochondrial Server polling ────────
-- The Mitochondrial Server polls for unprocessed triggers per tenant.
-- Without this index, the query degrades to a sequential scan under load.

CREATE INDEX IF NOT EXISTS idx_ea_evolution_triggers_pending
    ON ea_evolution_triggers (tenant_id, created_at)
    WHERE processed_at IS NULL;

-- ─── 3. composite_resistance range CHECK ──────────────────────────────────────
-- The raw quantum simulator weights sum to 1.25 (not 1.0).
-- Application code MUST divide by 1.25 before INSERT.
-- This constraint enforces the normalization invariant at the DB layer.

ALTER TABLE quantum_posture_snapshots
    ADD CONSTRAINT IF NOT EXISTS chk_composite_resistance_normalized
    CHECK (composite_resistance >= 0.0 AND composite_resistance <= 1.0);

-- ─── 4. Extend g0dm0d3_tool_calls tool_name CHECK ─────────────────────────────
-- Adds 'mcp-scan' to the G0DM0D3 tool panel so the MCP scanner surface
-- can be invoked from the operator chat interface.

ALTER TABLE g0dm0d3_tool_calls
    DROP CONSTRAINT IF EXISTS g0dm0d3_tool_calls_tool_name_check;

ALTER TABLE g0dm0d3_tool_calls
    ADD CONSTRAINT g0dm0d3_tool_calls_tool_name_check
    CHECK (tool_name IN (
        'dag-summary',
        'stig-summary',
        'pqc-inventory',
        'forensics-summary',
        'license-status',
        'ea-status',
        'mcp-scan'
    ));
