-- Migration for Compliance Orchestration Tools (TRL-10 Integration)

-- 1. Create compliance_frameworks table
CREATE TABLE IF NOT EXISTS public.compliance_frameworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    version TEXT,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create compliance_controls table
CREATE TABLE IF NOT EXISTS public.compliance_controls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    framework_id UUID REFERENCES public.compliance_frameworks(id) ON DELETE CASCADE,
    control_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create compliance_connectors table
CREATE TABLE IF NOT EXISTS public.compliance_connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'disconnected',
    organization_id UUID,
    last_sync TIMESTAMP WITH TIME ZONE,
    discovered_assets INTEGER DEFAULT 0,
    config JSONB DEFAULT '{}'::jsonb,
    capabilities JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create remediation_playbooks table
CREATE TABLE IF NOT EXISTS public.remediation_playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    type TEXT DEFAULT 'manual',
    requires_approval BOOLEAN DEFAULT true,
    steps JSONB DEFAULT '[]'::jsonb,
    rollback_steps JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create remediation_executions table
CREATE TABLE IF NOT EXISTS public.remediation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID REFERENCES public.remediation_playbooks(id) ON DELETE CASCADE,
    organization_id UUID,
    status TEXT NOT NULL DEFAULT 'running',
    triggered_by TEXT,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    end_time TIMESTAMP WITH TIME ZONE,
    logs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create compliance_control_gaps table
CREATE TABLE IF NOT EXISTS public.compliance_control_gaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    control_id TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'detected',
    description TEXT,
    affected_assets INTEGER DEFAULT 0,
    blast_radius INTEGER DEFAULT 5,
    remediation_plan JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.compliance_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remediation_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remediation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_control_gaps ENABLE ROW LEVEL SECURITY;

-- Create basic permissive policies for authenticated users
CREATE POLICY "Enable read access for authenticated users" ON public.compliance_frameworks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable read access for authenticated users" ON public.compliance_controls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.compliance_connectors FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.remediation_playbooks FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.remediation_executions FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.compliance_control_gaps FOR ALL TO authenticated USING (true);

-- Insert Dummy Data for Frontend Development
INSERT INTO public.compliance_connectors (name, type, status, last_sync, discovered_assets, config, capabilities) VALUES 
('AWS Security Hub', 'Microsoft Azure', 'connected', now(), 1247, '{"category": "cloud", "authType": "service_principal", "frameworks": ["SOC2", "PCI-DSS"]}'::jsonb, '[{"name": "Discovery", "type": "discover", "enabled": true, "lastTested": "2023-10-25T12:00:00Z", "successRate": 100}]'::jsonb),
('CrowdStrike Falcon', 'CrowdStrike', 'error', now() - interval '2 days', 450, '{"category": "security", "authType": "api_key", "frameworks": ["SOC2", "NIST-800-171"]}'::jsonb, '[{"name": "Discovery", "type": "discover", "enabled": true, "lastTested": "2023-10-25T12:00:00Z", "successRate": 85}]'::jsonb);

INSERT INTO public.remediation_playbooks (id, name, description, tags, type, requires_approval, steps, rollback_steps) VALUES
('b01cf214-7e8c-4f90-a544-772922ef6531', 'Automated S3 Bucket Encryption', 'Enables default AES-256 encryption on unencrypted S3 buckets.', '{"SC.13.175"}', 'terraform', true, '[{"id": "step1", "name": "Identify unencrypted buckets", "action": "aws_s3_inventory", "tool": "api", "critical": true}, {"id": "step2", "name": "Apply AES-256 encryption", "action": "aws_s3_encrypt", "tool": "terraform", "critical": true}]'::jsonb, '["Remove default encryption from bucket"]'::jsonb),
('d29a008c-9824-4f05-8b43-261ce38fbc97', 'Enforce MFA across AD', 'Enforces Multi-Factor Authentication for all Active Directory users.', '{"AC.7.020"}', 'api', false, '[{"id": "step1", "name": "Query AD users without MFA", "action": "ad_query", "tool": "script", "critical": true}, {"id": "step2", "name": "Enable MFA policy", "action": "ad_policy_update", "tool": "api", "critical": true}]'::jsonb, '["Revert conditional access policy changes"]'::jsonb);

INSERT INTO public.remediation_executions (playbook_id, status, triggered_by, start_time, logs) VALUES
('b01cf214-7e8c-4f90-a544-772922ef6531', 'completed', 'system', now() - interval '1 hour', '[{"timestamp": "2026-03-08T10:00:00Z", "step": "initialization", "level": "info", "message": "Starting remediation execution"}, {"timestamp": "2026-03-08T10:05:00Z", "step": "completion", "level": "info", "message": "Remediation completed successfully"}]'::jsonb),
('d29a008c-9824-4f05-8b43-261ce38fbc97', 'waiting-approval', 'admin', now(), '[{"timestamp": "2026-03-08T11:00:00Z", "step": "initialization", "level": "info", "message": "Waiting for approval to execute remediation"}]'::jsonb);

INSERT INTO public.compliance_control_gaps (control_id, severity, status, description, affected_assets, blast_radius, remediation_plan) VALUES
('SC.13.175', 'critical', 'detected', '12 S3 buckets and 3 databases lack encryption, violating CMMC SC.13.175', 15, 8, '{"tool": "terraform", "steps": ["Identify unencrypted buckets", "Apply AES-256 encryption"], "approvalRequired": true, "rollbackPlan": ["Remove default encryption"]}'::jsonb),
('AC.7.020', 'high', 'remediation-planned', '45 user accounts without enforced multi-factor authentication', 45, 5, '{"tool": "api", "steps": ["Query AD users without MFA", "Enable MFA policy"], "approvalRequired": false, "rollbackPlan": ["Revert conditionally applied policies"]}'::jsonb);
