-- Migration: Organization Onboarding Tables
-- Date: 2026-01-28
-- Purpose: Support unified onboarding workflow for STIG compliance setup

-- ============================================
-- TABLE: organization_onboarding
-- ============================================
-- Tracks onboarding progress for each user
CREATE TABLE IF NOT EXISTS organization_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Onboarding progress
    step TEXT NOT NULL DEFAULT 'started',
        -- Values: 'started', 'connected', 'discovery_complete', 'assessment_complete'

    -- Discovery data (stored after successful endpoint discovery)
    discovery_data JSONB,
        -- Contains: discovery_id, endpoints[], summary, cloud_provider, profile

    -- Assessment data (stored after compliance scan)
    assessment_data JSONB,
        -- Contains: scan_id, compliance_score, endpoints_scanned, summary, completed_at

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient user lookups
CREATE INDEX IF NOT EXISTS idx_organization_onboarding_user
    ON organization_onboarding(user_id);

CREATE INDEX IF NOT EXISTS idx_organization_onboarding_step
    ON organization_onboarding(step);

-- ============================================
-- TABLE: user_organizations
-- ============================================
-- Maps users to organizations (supports multi-tenant scenarios)
CREATE TABLE IF NOT EXISTS user_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL,

    -- User's role within the organization
    role TEXT NOT NULL DEFAULT 'member',
        -- Values: 'owner', 'admin', 'member', 'viewer'

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure user can only belong to org once
    UNIQUE(user_id, organization_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_organizations_user
    ON user_organizations(user_id);

CREATE INDEX IF NOT EXISTS idx_user_organizations_org
    ON user_organizations(organization_id);

-- ============================================
-- TABLE: environment_discoveries
-- ============================================
-- Stores discovered endpoints for compliance scanning
CREATE TABLE IF NOT EXISTS environment_discoveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,

    -- Discovery identification
    discovery_id TEXT NOT NULL,

    -- Discovered endpoints (JSONB array)
    endpoints JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Discovery summary
    summary JSONB,
        -- Contains: total_discovered, by_platform{}, by_provider{}

    -- Discovery configuration
    cloud_provider TEXT,
    profile TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for organization lookups
CREATE INDEX IF NOT EXISTS idx_environment_discoveries_org
    ON environment_discoveries(organization_id);

CREATE INDEX IF NOT EXISTS idx_environment_discoveries_discovery_id
    ON environment_discoveries(discovery_id);

-- ============================================
-- TRIGGER: Auto-update timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_organization_onboarding_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organization_onboarding_timestamp
    BEFORE UPDATE ON organization_onboarding
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_onboarding_timestamp();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE organization_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_discoveries ENABLE ROW LEVEL SECURITY;

-- Users can view/update their own onboarding data
CREATE POLICY "Users can manage own onboarding"
    ON organization_onboarding FOR ALL
    USING (auth.uid() = user_id);

-- Users can view their organization memberships
CREATE POLICY "Users can view own org memberships"
    ON user_organizations FOR SELECT
    USING (auth.uid() = user_id);

-- Users can view discoveries for their organizations
CREATE POLICY "Users can view org discoveries"
    ON environment_discoveries FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM user_organizations
            WHERE user_id = auth.uid()
        )
    );

-- Service role can manage all tables
CREATE POLICY "Service role full access to onboarding"
    ON organization_onboarding FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to user_orgs"
    ON user_organizations FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access to discoveries"
    ON environment_discoveries FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
