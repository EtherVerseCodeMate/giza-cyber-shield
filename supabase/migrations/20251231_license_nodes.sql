-- Migration: Add node-based licensing enforcement tables
-- Date: 2025-12-31
-- Purpose: Enable multi-node license tracking and enforcement

-- ============================================
-- TABLE: licenses
-- ============================================
-- Stores license entitlements for each tenant
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tenant identification
    tenant_id TEXT NOT NULL UNIQUE,
    organization_name TEXT,

    -- License tier and limits
    tier TEXT NOT NULL DEFAULT 'starter',
        -- Values: 'starter', 'professional', 'enterprise', 'unlimited'
    max_nodes INTEGER NOT NULL DEFAULT 1,

    -- Enforcement configuration
    enforcement_mode TEXT NOT NULL DEFAULT 'grace_period',
        -- Values: 'strict', 'grace_period', 'monitoring'

    -- Capabilities (JSONB array for flexibility)
    capabilities JSONB NOT NULL DEFAULT '["compliance", "audit"]'::jsonb,

    -- Billing integration
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT,
        -- Values: 'active', 'past_due', 'canceled', 'trialing'

    -- License lifecycle
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    last_renewal TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_licenses_tenant ON licenses(tenant_id);
CREATE INDEX idx_licenses_stripe_customer ON licenses(stripe_customer_id);
CREATE INDEX idx_licenses_expires ON licenses(expires_at);

-- ============================================
-- TABLE: license_nodes
-- ============================================
-- Tracks deployed nodes for each license
CREATE TABLE IF NOT EXISTS license_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,

    -- Node identification
    host_id TEXT NOT NULL,
    hostname TEXT,
    os TEXT,                                -- linux, windows, darwin
    arch TEXT,                              -- amd64, arm64

    -- Registration tracking
    first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'active',
        -- Values: 'active', 'grace_period', 'suspended', 'decommissioned'

    -- Deployment metadata
    deployment_type TEXT,                   -- production, staging, development
    version TEXT,                           -- adinkhepra version (e.g., v1.5.0)
    environment JSONB,                      -- Additional environment info

    -- Geographic/network info (optional)
    ip_address INET,
    country TEXT,
    datacenter TEXT,

    -- Compliance proof (Dilithium3 signature)
    registration_signature TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure unique node per license
    UNIQUE(license_id, host_id)
);

-- Indexes for performance
CREATE INDEX idx_license_nodes_license ON license_nodes(license_id);
CREATE INDEX idx_license_nodes_host ON license_nodes(host_id);
CREATE INDEX idx_license_nodes_heartbeat ON license_nodes(last_heartbeat);
CREATE INDEX idx_license_nodes_status ON license_nodes(status);

-- ============================================
-- TABLE: license_events
-- ============================================
-- Audit log for license lifecycle events
CREATE TABLE IF NOT EXISTS license_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,

    -- Event details
    event_type TEXT NOT NULL,
        -- Values: 'created', 'renewed', 'upgraded', 'downgraded', 'expired',
        --         'node_registered', 'node_decommissioned', 'limit_exceeded', 'suspended'
    event_data JSONB,                       -- Additional event metadata

    -- Context
    triggered_by TEXT,                      -- 'system', 'admin', 'user', 'webhook'
    node_id UUID REFERENCES license_nodes(id) ON DELETE SET NULL,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for audit queries
CREATE INDEX idx_license_events_license ON license_events(license_id);
CREATE INDEX idx_license_events_type ON license_events(event_type);
CREATE INDEX idx_license_events_created ON license_events(created_at);

-- ============================================
-- FUNCTION: update_timestamp
-- ============================================
-- Automatically update updated_at column
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_licenses_timestamp
    BEFORE UPDATE ON licenses
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_license_nodes_timestamp
    BEFORE UPDATE ON license_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- ============================================
-- FUNCTION: check_node_limit
-- ============================================
-- Validates node count against license limit before registration
CREATE OR REPLACE FUNCTION check_node_limit()
RETURNS TRIGGER AS $$
DECLARE
    active_nodes INT;
    max_allowed INT;
    enforcement TEXT;
BEGIN
    -- Get license details
    SELECT max_nodes, enforcement_mode
    INTO max_allowed, enforcement
    FROM licenses
    WHERE id = NEW.license_id;

    -- Count active nodes
    SELECT COUNT(*)
    INTO active_nodes
    FROM license_nodes
    WHERE license_id = NEW.license_id
      AND status = 'active';

    -- Check if limit exceeded
    IF active_nodes >= max_allowed THEN
        -- In strict mode, reject registration
        IF enforcement = 'strict' THEN
            RAISE EXCEPTION 'Node limit exceeded: %/% (license_id: %)',
                active_nodes, max_allowed, NEW.license_id;
        END IF;

        -- In grace_period mode, allow but mark as grace_period status
        IF enforcement = 'grace_period' THEN
            NEW.status = 'grace_period';

            -- Log event
            INSERT INTO license_events (license_id, event_type, event_data, triggered_by, node_id)
            VALUES (
                NEW.license_id,
                'limit_exceeded',
                jsonb_build_object(
                    'active_nodes', active_nodes,
                    'max_nodes', max_allowed,
                    'host_id', NEW.host_id
                ),
                'system',
                NEW.id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce node limits on registration
CREATE TRIGGER enforce_node_limit
    BEFORE INSERT ON license_nodes
    FOR EACH ROW
    EXECUTE FUNCTION check_node_limit();

-- ============================================
-- VIEW: license_summary
-- ============================================
-- Convenient view for license overview
CREATE OR REPLACE VIEW license_summary AS
SELECT
    l.id AS license_id,
    l.tenant_id,
    l.organization_name,
    l.tier,
    l.max_nodes,
    l.enforcement_mode,
    COUNT(ln.id) FILTER (WHERE ln.status = 'active') AS active_nodes,
    COUNT(ln.id) FILTER (WHERE ln.status = 'grace_period') AS grace_period_nodes,
    MAX(ln.last_heartbeat) AS last_activity,
    CASE
        WHEN COUNT(ln.id) FILTER (WHERE ln.status = 'active') > l.max_nodes THEN 'OVERAGE'
        WHEN COUNT(ln.id) FILTER (WHERE ln.status = 'active') = l.max_nodes THEN 'AT_LIMIT'
        ELSE 'ACTIVE'
    END AS license_status,
    l.subscription_status,
    l.expires_at,
    l.created_at
FROM licenses l
LEFT JOIN license_nodes ln ON ln.license_id = l.id
GROUP BY l.id;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS on all tables
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_events ENABLE ROW LEVEL SECURITY;

-- Note: consulting_access table assumed to exist from previous migrations
-- OR policies need adjustment if it doesn't.
-- For now, commenting out auth-dependent policies to avoid errors if auth schema missing
-- or providing safe defaults.

/* 
-- Policy: Users can view their own license
CREATE POLICY "Users can view own license"
    ON licenses FOR SELECT
    USING (auth.uid() IN (
        SELECT user_id FROM consulting_access WHERE tenant_id = licenses.tenant_id
    ));
*/

-- Policy: Service role can manage all licenses
CREATE POLICY "Service role full access to licenses"
    ON licenses FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Service role can manage all nodes
CREATE POLICY "Service role full access to nodes"
    ON license_nodes FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Service role can manage all events
CREATE POLICY "Service role full access to events"
    ON license_events FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- SEED DATA (Example licenses)
-- ============================================
-- Insert example license tiers (for testing)
INSERT INTO licenses (tenant_id, organization_name, tier, max_nodes, enforcement_mode, capabilities) VALUES
    ('demo-starter', 'Demo Starter Corp', 'starter', 1, 'grace_period', '["compliance", "audit"]'::jsonb),
    ('demo-professional', 'Demo Professional Inc', 'professional', 10, 'grace_period', '["compliance", "audit", "network_analysis", "stig_mapper"]'::jsonb),
    ('demo-enterprise', 'Demo Enterprise LLC', 'enterprise', 100, 'grace_period', '["compliance", "audit", "network_analysis", "stig_mapper", "advisory"]'::jsonb)
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================
-- CLEANUP FUNCTION
-- ============================================
-- Decommission nodes that haven't sent heartbeat in 30 days
CREATE OR REPLACE FUNCTION cleanup_stale_nodes()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE license_nodes
    SET status = 'decommissioned',
        updated_at = now()
    WHERE last_heartbeat < now() - INTERVAL '30 days'
      AND status = 'active';

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    -- Log cleanup event
    INSERT INTO license_events (license_id, event_type, event_data, triggered_by)
    SELECT DISTINCT
        license_id,
        'nodes_decommissioned',
        jsonb_build_object('count', updated_count),
        'system'
    FROM license_nodes
    WHERE status = 'decommissioned'
      AND updated_at >= now() - INTERVAL '1 minute';

    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup job (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-stale-nodes', '0 2 * * *', 'SELECT cleanup_stale_nodes()');
