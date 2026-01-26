-- KHEPRA Telemetry Aggregation Schema
-- Supabase PostgreSQL migration for Dark Crypto Database Moat
--
-- This schema receives aggregated telemetry from:
-- CloudFlare Workers → DEMARC Gateway → Supabase

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================================
-- ORGANIZATIONS (Multi-tenant isolation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    license_tier TEXT NOT NULL DEFAULT 'pilot' CHECK (license_tier IN ('pilot', 'pro', 'enterprise', 'government')),
    contract_number TEXT, -- DoD contract reference
    cage_code TEXT,       -- Commercial and Government Entity code
    duns_number TEXT,     -- DUNS for government contracting
    primary_contact_email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- License enforcement
    max_devices INTEGER DEFAULT 5,
    current_device_count INTEGER DEFAULT 0,
    license_expires_at TIMESTAMPTZ,

    -- Compliance flags
    fedramp_authorized BOOLEAN DEFAULT FALSE,
    stig_compliant BOOLEAN DEFAULT FALSE,
    pqc_transition_complete BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_org_slug ON organizations(slug);
CREATE INDEX idx_org_license_tier ON organizations(license_tier);

-- ============================================================================
-- CRYPTO INVENTORY (Dark Crypto Database Moat)
-- ============================================================================
CREATE TABLE IF NOT EXISTS crypto_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    device_hash TEXT NOT NULL, -- Anonymized device ID (SHA-256)

    -- Classical cryptography counts
    rsa_2048_count INTEGER DEFAULT 0,
    rsa_3072_count INTEGER DEFAULT 0,
    rsa_4096_count INTEGER DEFAULT 0,
    ecc_p256_count INTEGER DEFAULT 0,
    ecc_p384_count INTEGER DEFAULT 0,
    ecc_p521_count INTEGER DEFAULT 0,

    -- Post-quantum cryptography counts
    dilithium3_count INTEGER DEFAULT 0,  -- ML-DSA-65
    dilithium5_count INTEGER DEFAULT 0,  -- ML-DSA-87
    kyber512_count INTEGER DEFAULT 0,    -- ML-KEM-512
    kyber768_count INTEGER DEFAULT 0,    -- ML-KEM-768
    kyber1024_count INTEGER DEFAULT 0,   -- ML-KEM-1024
    sphincs_count INTEGER DEFAULT 0,     -- SLH-DSA

    -- Vulnerable/deprecated algorithms
    des_count INTEGER DEFAULT 0,
    triple_des_count INTEGER DEFAULT 0,
    md5_count INTEGER DEFAULT 0,
    sha1_count INTEGER DEFAULT 0,
    rsa_1024_count INTEGER DEFAULT 0,

    -- TLS configuration
    tls_config JSONB DEFAULT '{}',
    /*
    {
        "min_version": "1.2",
        "max_version": "1.3",
        "cipher_suites": ["TLS_AES_256_GCM_SHA384", ...],
        "certificate_algorithms": ["RSA", "ECDSA"],
        "has_pqc_support": false
    }
    */

    -- Scoring
    pqc_readiness_score DECIMAL(5,2) DEFAULT 0.0, -- 0-100
    quantum_exposure_score DECIMAL(5,2) DEFAULT 0.0, -- 0-100 (higher = more vulnerable)
    compliance_score DECIMAL(5,2) DEFAULT 0.0, -- 0-100

    -- Metadata
    hostname TEXT,
    platform TEXT, -- windows, linux, darwin
    agent_version TEXT,
    last_scan_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, device_hash)
);

CREATE INDEX idx_crypto_org ON crypto_inventory(organization_id);
CREATE INDEX idx_crypto_pqc_score ON crypto_inventory(pqc_readiness_score);
CREATE INDEX idx_crypto_exposure ON crypto_inventory(quantum_exposure_score DESC);
CREATE INDEX idx_crypto_last_scan ON crypto_inventory(last_scan_at);

-- ============================================================================
-- LICENSE TELEMETRY (Aggregated from Cloudflare D1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS license_telemetry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    machine_id TEXT NOT NULL,

    -- License info
    license_tier TEXT NOT NULL,
    features JSONB DEFAULT '[]',
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,

    -- Usage tracking
    validation_count INTEGER DEFAULT 0,
    heartbeat_count INTEGER DEFAULT 0,
    last_heartbeat_at TIMESTAMPTZ,
    last_validation_at TIMESTAMPTZ,

    -- Feature usage analytics
    features_used JSONB DEFAULT '{}',
    /*
    {
        "scan": 1523,
        "cve_check": 892,
        "premium_pqc": 45,
        "white_box_crypto": 12
    }
    */

    -- Compliance
    compliance_status TEXT DEFAULT 'active' CHECK (compliance_status IN ('active', 'warning', 'violation', 'revoked')),
    violation_reason TEXT,

    -- Source tracking
    stripe_customer_id TEXT,
    pilot_id TEXT,
    enrollment_token TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, machine_id)
);

CREATE INDEX idx_license_org ON license_telemetry(organization_id);
CREATE INDEX idx_license_status ON license_telemetry(compliance_status);
CREATE INDEX idx_license_expires ON license_telemetry(expires_at);
CREATE INDEX idx_license_heartbeat ON license_telemetry(last_heartbeat_at);

-- ============================================================================
-- SECURITY EVENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

    event_type TEXT NOT NULL CHECK (event_type IN (
        'license_violation',
        'license_expired',
        'license_revoked',
        'anomaly_detected',
        'rate_limit_exceeded',
        'auth_failure',
        'tampering_detected',
        'crypto_vulnerability',
        'compliance_warning'
    )),

    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),

    source_device_id TEXT,
    source_ip TEXT,
    source_country TEXT,

    title TEXT NOT NULL,
    description TEXT,
    details JSONB DEFAULT '{}',

    -- Resolution tracking
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    resolution_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_org ON security_events(organization_id);
CREATE INDEX idx_events_type ON security_events(event_type);
CREATE INDEX idx_events_severity ON security_events(severity);
CREATE INDEX idx_events_created ON security_events(created_at DESC);
CREATE INDEX idx_events_unresolved ON security_events(resolved_at) WHERE resolved_at IS NULL;

-- ============================================================================
-- DARK CRYPTO MOAT (Aggregate vulnerability analysis)
-- ============================================================================
CREATE TABLE IF NOT EXISTS dark_crypto_moat (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    algorithm_name TEXT NOT NULL,
    algorithm_type TEXT NOT NULL CHECK (algorithm_type IN ('symmetric', 'asymmetric', 'hash', 'kex', 'signature', 'pqc')),
    key_size INTEGER,

    -- Risk assessment
    vulnerability_score DECIMAL(5,2) NOT NULL, -- 0-100 (higher = more vulnerable)
    quantum_threat_level TEXT NOT NULL CHECK (quantum_threat_level IN ('none', 'low', 'medium', 'high', 'critical')),
    deprecation_status TEXT CHECK (deprecation_status IN ('active', 'deprecated', 'prohibited')),

    -- Recommendations
    recommended_replacement TEXT,
    migration_priority TEXT CHECK (migration_priority IN ('immediate', 'high', 'medium', 'low', 'optional')),

    -- Aggregate stats (updated by cron job)
    affected_device_count INTEGER DEFAULT 0,
    affected_org_count INTEGER DEFAULT 0,
    total_key_count INTEGER DEFAULT 0,
    aggregate_exposure_value DECIMAL(15,2) DEFAULT 0.0, -- Estimated exposure in $

    -- References
    nist_reference TEXT,
    cve_references TEXT[],

    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_moat_algorithm ON dark_crypto_moat(algorithm_name, key_size);
CREATE INDEX idx_moat_threat ON dark_crypto_moat(quantum_threat_level);
CREATE INDEX idx_moat_vulnerability ON dark_crypto_moat(vulnerability_score DESC);

-- Seed initial algorithm data
INSERT INTO dark_crypto_moat (algorithm_name, algorithm_type, key_size, vulnerability_score, quantum_threat_level, deprecation_status, recommended_replacement, migration_priority) VALUES
-- Prohibited algorithms
('DES', 'symmetric', 56, 100, 'critical', 'prohibited', 'AES-256', 'immediate'),
('3DES', 'symmetric', 168, 85, 'high', 'deprecated', 'AES-256', 'high'),
('MD5', 'hash', 128, 100, 'critical', 'prohibited', 'SHA-256', 'immediate'),
('SHA-1', 'hash', 160, 90, 'high', 'deprecated', 'SHA-256', 'high'),
('RSA-1024', 'asymmetric', 1024, 100, 'critical', 'prohibited', 'RSA-3072 or ML-DSA-65', 'immediate'),
('RSA-2048', 'asymmetric', 2048, 70, 'high', 'deprecated', 'RSA-3072 or ML-DSA-65', 'medium'),
-- Acceptable but quantum-vulnerable
('RSA-3072', 'asymmetric', 3072, 50, 'medium', 'active', 'ML-DSA-65', 'medium'),
('RSA-4096', 'asymmetric', 4096, 40, 'medium', 'active', 'ML-DSA-65', 'low'),
('ECDSA-P256', 'signature', 256, 60, 'high', 'active', 'ML-DSA-65', 'medium'),
('ECDSA-P384', 'signature', 384, 50, 'medium', 'active', 'ML-DSA-65', 'medium'),
('ECDH-P256', 'kex', 256, 60, 'high', 'active', 'ML-KEM-768', 'medium'),
-- Post-Quantum (safe)
('ML-DSA-65', 'pqc', 2048, 5, 'none', 'active', NULL, 'optional'),
('ML-DSA-87', 'pqc', 2592, 3, 'none', 'active', NULL, 'optional'),
('ML-KEM-768', 'pqc', 2400, 5, 'none', 'active', NULL, 'optional'),
('ML-KEM-1024', 'pqc', 3168, 3, 'none', 'active', NULL, 'optional'),
('SLH-DSA-128', 'pqc', 7856, 5, 'none', 'active', NULL, 'optional')
ON CONFLICT (algorithm_name, key_size) DO NOTHING;

-- ============================================================================
-- AUDIT LOG (Immutable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    actor TEXT NOT NULL, -- 'system:cron', 'admin:username', 'service:demarc'
    actor_ip TEXT,

    action TEXT NOT NULL,
    resource_type TEXT NOT NULL, -- 'license', 'organization', 'security_event', etc.
    resource_id TEXT,

    old_value JSONB,
    new_value JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON audit_log(actor);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dark_crypto_moat ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Master admin can see everything
CREATE POLICY "Master admin full access" ON organizations
    FOR ALL USING (auth.jwt() ->> 'role' = 'master_admin');

CREATE POLICY "Master admin full access" ON crypto_inventory
    FOR ALL USING (auth.jwt() ->> 'role' = 'master_admin');

CREATE POLICY "Master admin full access" ON license_telemetry
    FOR ALL USING (auth.jwt() ->> 'role' = 'master_admin');

CREATE POLICY "Master admin full access" ON security_events
    FOR ALL USING (auth.jwt() ->> 'role' = 'master_admin');

CREATE POLICY "Master admin full access" ON dark_crypto_moat
    FOR ALL USING (auth.jwt() ->> 'role' = 'master_admin');

CREATE POLICY "Master admin full access" ON audit_log
    FOR ALL USING (auth.jwt() ->> 'role' = 'master_admin');

-- Service accounts (DEMARC, Cloudflare Worker) can insert
CREATE POLICY "Service account insert" ON crypto_inventory
    FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_account');

CREATE POLICY "Service account insert" ON license_telemetry
    FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_account');

CREATE POLICY "Service account insert" ON security_events
    FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_account');

-- Organization admins can only see their data
CREATE POLICY "Org admin access" ON crypto_inventory
    FOR SELECT USING (
        organization_id = (auth.jwt() ->> 'organization_id')::UUID
    );

CREATE POLICY "Org admin access" ON license_telemetry
    FOR SELECT USING (
        organization_id = (auth.jwt() ->> 'organization_id')::UUID
    );

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Calculate PQC readiness score
CREATE OR REPLACE FUNCTION calculate_pqc_readiness(inv crypto_inventory)
RETURNS DECIMAL AS $$
DECLARE
    total_classical INTEGER;
    total_pqc INTEGER;
    total_keys INTEGER;
BEGIN
    total_classical := COALESCE(inv.rsa_2048_count, 0) + COALESCE(inv.rsa_3072_count, 0) +
                       COALESCE(inv.rsa_4096_count, 0) + COALESCE(inv.ecc_p256_count, 0) +
                       COALESCE(inv.ecc_p384_count, 0) + COALESCE(inv.ecc_p521_count, 0);

    total_pqc := COALESCE(inv.dilithium3_count, 0) + COALESCE(inv.dilithium5_count, 0) +
                 COALESCE(inv.kyber512_count, 0) + COALESCE(inv.kyber768_count, 0) +
                 COALESCE(inv.kyber1024_count, 0) + COALESCE(inv.sphincs_count, 0);

    total_keys := total_classical + total_pqc;

    IF total_keys = 0 THEN
        RETURN 0;
    END IF;

    RETURN ROUND((total_pqc::DECIMAL / total_keys::DECIMAL) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Update aggregate stats in dark_crypto_moat
CREATE OR REPLACE FUNCTION update_crypto_moat_stats()
RETURNS void AS $$
BEGIN
    UPDATE dark_crypto_moat m SET
        affected_device_count = (
            SELECT COUNT(*) FROM crypto_inventory c
            WHERE (m.algorithm_name = 'RSA-2048' AND c.rsa_2048_count > 0)
               OR (m.algorithm_name = 'RSA-3072' AND c.rsa_3072_count > 0)
               OR (m.algorithm_name = 'RSA-4096' AND c.rsa_4096_count > 0)
               OR (m.algorithm_name = 'ECDSA-P256' AND c.ecc_p256_count > 0)
               OR (m.algorithm_name = 'ECDSA-P384' AND c.ecc_p384_count > 0)
               OR (m.algorithm_name = 'ML-DSA-65' AND c.dilithium3_count > 0)
               OR (m.algorithm_name = 'ML-KEM-1024' AND c.kyber1024_count > 0)
        ),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Global PQC transition dashboard
CREATE OR REPLACE VIEW v_pqc_transition_dashboard AS
SELECT
    o.name AS organization_name,
    o.license_tier,
    COUNT(c.id) AS device_count,
    AVG(c.pqc_readiness_score) AS avg_pqc_readiness,
    AVG(c.quantum_exposure_score) AS avg_exposure,
    SUM(c.dilithium3_count + c.dilithium5_count + c.kyber512_count + c.kyber768_count + c.kyber1024_count) AS total_pqc_keys,
    SUM(c.rsa_2048_count + c.rsa_3072_count + c.rsa_4096_count + c.ecc_p256_count + c.ecc_p384_count) AS total_classical_keys
FROM organizations o
LEFT JOIN crypto_inventory c ON o.id = c.organization_id
GROUP BY o.id, o.name, o.license_tier
ORDER BY avg_pqc_readiness ASC;

-- License health dashboard
CREATE OR REPLACE VIEW v_license_health AS
SELECT
    o.name AS organization_name,
    o.license_tier,
    l.compliance_status,
    COUNT(l.id) AS license_count,
    MAX(l.last_heartbeat_at) AS last_activity,
    SUM(l.validation_count) AS total_validations,
    CASE
        WHEN MAX(l.expires_at) < NOW() THEN 'expired'
        WHEN MAX(l.expires_at) < NOW() + INTERVAL '7 days' THEN 'expiring_soon'
        ELSE 'active'
    END AS health_status
FROM organizations o
LEFT JOIN license_telemetry l ON o.id = l.organization_id
GROUP BY o.id, o.name, o.license_tier, l.compliance_status;

-- Security event summary
CREATE OR REPLACE VIEW v_security_summary AS
SELECT
    DATE(created_at) AS event_date,
    event_type,
    severity,
    COUNT(*) AS event_count,
    COUNT(*) FILTER (WHERE resolved_at IS NOT NULL) AS resolved_count
FROM security_events
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), event_type, severity
ORDER BY event_date DESC, severity;
