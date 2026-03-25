-- Storage Backup Catalog
--
-- WHY: Supabase database backups (PITR + scheduled) do NOT include Storage objects.
-- Only metadata rows in storage.objects are backed up — not the actual file bytes.
-- This catalog tracks every off-platform backup of Storage objects so we can:
--   1. Verify backup completeness (every object should have a recent entry)
--   2. Plan and execute restore (which backup_path to re-upload from)
--   3. Detect silent data loss (objects with no backup entry)
--   4. Prove DR readiness to auditors (CMMC SC.L2-3.13.2, NIST CP-9)

-- ── Storage Backup Catalog ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS storage_backup_catalog (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_key      TEXT NOT NULL,           -- path within bucket (e.g. "reports/2024/q4.pdf")
    bucket_id       TEXT NOT NULL,           -- Supabase Storage bucket name
    etag            TEXT NOT NULL,           -- ETag at time of backup (for incremental diff)
    size_bytes      BIGINT NOT NULL DEFAULT 0,
    content_type    TEXT NOT NULL DEFAULT 'application/octet-stream',
    backup_path     TEXT NOT NULL,           -- full path in R2/S3: storage-backup/{project}/{bucket}/{date}/{key}
    backup_store    TEXT NOT NULL DEFAULT 'cloudflare-r2', -- r2 | s3 | b2 | local
    backed_up_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dag_node_id     UUID,                    -- AdinKhepra audit node
    restore_tested  BOOLEAN DEFAULT FALSE,   -- DR test flag
    restore_tested_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup of latest backup for an object
CREATE INDEX IF NOT EXISTS idx_storage_backup_catalog_object
    ON storage_backup_catalog (bucket_id, object_key, backed_up_at DESC);

-- Index for compliance dashboards (list all objects backed up after a date)
CREATE INDEX IF NOT EXISTS idx_storage_backup_catalog_time
    ON storage_backup_catalog (backed_up_at DESC);

-- ── Backup Run Log ────────────────────────────────────────────────────────────
-- Records each backup run (triggered by schedule or manual) for audit trails.
CREATE TABLE IF NOT EXISTS storage_backup_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id           TEXT NOT NULL,
    objects_exported    INTEGER NOT NULL DEFAULT 0,
    objects_skipped     INTEGER NOT NULL DEFAULT 0, -- unchanged ETags
    objects_failed      INTEGER NOT NULL DEFAULT 0,
    total_bytes         BIGINT NOT NULL DEFAULT 0,
    errors              JSONB DEFAULT '[]'::jsonb,
    duration_ms         BIGINT,
    trigger_source      TEXT DEFAULT 'schedule',    -- schedule | manual | drbc_test
    dag_node_id         UUID,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at         TIMESTAMPTZ
);

-- ── Object Coverage View ──────────────────────────────────────────────────────
-- Shows the latest backup status for every tracked Storage object.
-- Use for compliance reports: "X% of storage objects have a backup < 24h old"
CREATE OR REPLACE VIEW storage_backup_coverage AS
SELECT DISTINCT ON (bucket_id, object_key)
    bucket_id,
    object_key,
    size_bytes,
    content_type,
    backup_path,
    backup_store,
    backed_up_at,
    restore_tested,
    EXTRACT(EPOCH FROM (NOW() - backed_up_at)) / 3600 AS hours_since_backup,
    CASE
        WHEN backed_up_at > NOW() - INTERVAL '24 hours' THEN 'FRESH'
        WHEN backed_up_at > NOW() - INTERVAL '7 days'   THEN 'AGING'
        WHEN backed_up_at > NOW() - INTERVAL '30 days'  THEN 'STALE'
        ELSE 'CRITICAL'
    END AS backup_status
FROM storage_backup_catalog
ORDER BY bucket_id, object_key, backed_up_at DESC;

-- ── Backup Health Summary (for DR dashboard) ──────────────────────────────────
-- Call via Supabase RPC: SELECT * FROM get_storage_backup_health('my-bucket')
CREATE OR REPLACE FUNCTION get_storage_backup_health(p_bucket_id TEXT DEFAULT NULL)
RETURNS TABLE (
    bucket_id         TEXT,
    total_objects     BIGINT,
    fresh_objects     BIGINT,
    aging_objects     BIGINT,
    stale_objects     BIGINT,
    critical_objects  BIGINT,
    total_bytes       BIGINT,
    oldest_backup_at  TIMESTAMPTZ,
    newest_backup_at  TIMESTAMPTZ,
    coverage_pct      NUMERIC,
    health_score      TEXT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.bucket_id::TEXT,
        COUNT(*)::BIGINT AS total_objects,
        COUNT(*) FILTER (WHERE c.backup_status = 'FRESH')::BIGINT    AS fresh_objects,
        COUNT(*) FILTER (WHERE c.backup_status = 'AGING')::BIGINT    AS aging_objects,
        COUNT(*) FILTER (WHERE c.backup_status = 'STALE')::BIGINT    AS stale_objects,
        COUNT(*) FILTER (WHERE c.backup_status = 'CRITICAL')::BIGINT AS critical_objects,
        SUM(c.size_bytes)::BIGINT,
        MIN(c.backed_up_at),
        MAX(c.backed_up_at),
        ROUND(
            100.0 * COUNT(*) FILTER (WHERE c.backup_status IN ('FRESH', 'AGING'))
            / NULLIF(COUNT(*), 0),
            1
        ) AS coverage_pct,
        CASE
            WHEN COUNT(*) FILTER (WHERE c.backup_status = 'CRITICAL') > 0 THEN 'CRITICAL'
            WHEN COUNT(*) FILTER (WHERE c.backup_status = 'STALE') > 0    THEN 'WARNING'
            WHEN COUNT(*) FILTER (WHERE c.backup_status = 'AGING') > 0    THEN 'DEGRADED'
            ELSE 'HEALTHY'
        END AS health_score
    FROM storage_backup_coverage c
    WHERE (p_bucket_id IS NULL OR c.bucket_id = p_bucket_id)
    GROUP BY c.bucket_id;
END;
$$;

-- ── Missing Objects Alert View ────────────────────────────────────────────────
-- Cross-references storage.objects (metadata) against our backup catalog.
-- Any row here = a Storage object with NO backup on record = DR gap.
-- SECURITY NOTE: requires storage schema access; run as service_role only.
CREATE OR REPLACE VIEW storage_objects_without_backup AS
SELECT
    so.bucket_id,
    so.name AS object_key,
    so.created_at,
    so.updated_at,
    'NO_BACKUP' AS backup_status
FROM storage.objects so
LEFT JOIN storage_backup_catalog sbc
    ON sbc.bucket_id = so.bucket_id AND sbc.object_key = so.name
WHERE sbc.id IS NULL;

-- RLS: only service_role can read backup catalog (contains file paths)
ALTER TABLE storage_backup_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_backup_runs    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_catalog"
    ON storage_backup_catalog FOR ALL
    TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_role_only_runs"
    ON storage_backup_runs FOR ALL
    TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Realtime publication for backup run monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE storage_backup_runs;

COMMENT ON TABLE storage_backup_catalog IS
    'Off-platform backup manifest for Supabase Storage objects. '
    'Supabase database backups do NOT include Storage file bytes — this table '
    'tracks every file backed up to R2/S3 for true DR capability. '
    'Maps to CMMC SC.L2-3.13.2 (protect backup CUI) and NIST CP-9.';

COMMENT ON TABLE storage_backup_runs IS
    'Audit log of each storage backup run. Provides evidence for DR readiness '
    'assessments and C3PAO reviews. Trigger: schedule (daily) or manual.';
