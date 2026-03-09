-- Migration for Compliance Orchestration Tools (TRL-10 Integration)

-- 1. Create compliance_frameworks table
CREATE TABLE IF NOT EXISTS public.compliance_frameworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    version TEXT,
    description TEXT,
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
    last_sync TIMESTAMP WITH TIME ZONE,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create remediation_playbooks table
CREATE TABLE IF NOT EXISTS public.remediation_playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    effectiveness INTEGER NOT NULL CHECK (effectiveness >= 0 AND effectiveness <= 100),
    estimated_time TEXT NOT NULL,
    complexity TEXT NOT NULL CHECK (complexity IN ('low', 'medium', 'high')),
    steps JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create remediation_executions table
CREATE TABLE IF NOT EXISTS public.remediation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id UUID REFERENCES public.remediation_playbooks(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    log JSONB DEFAULT '[]'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create compliance_control_gaps table
CREATE TABLE IF NOT EXISTS public.compliance_control_gaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    control_id TEXT NOT NULL,
    requirement TEXT NOT NULL,
    impact TEXT NOT NULL CHECK (impact IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'mitigated')),
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    mitigation_plan TEXT,
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

-- Create basic permissive policies for authenticated users (can be tightened later)
CREATE POLICY "Enable read access for authenticated users" ON public.compliance_frameworks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable read access for authenticated users" ON public.compliance_controls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.compliance_connectors FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.remediation_playbooks FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.remediation_executions FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.compliance_control_gaps FOR ALL TO authenticated USING (true);

-- Insert dummy data to enable the front-end to display initial items as requested.
INSERT INTO public.compliance_connectors (name, type, status, last_sync) VALUES 
('AWS Security Hub', 'cloud', 'connected', now()),
('Azure Defender', 'cloud', 'error', now() - interval '2 days'),
('Tenable Nessus', 'vulnerability', 'syncing', now());

INSERT INTO public.remediation_playbooks (name, description, risk_level, effectiveness, estimated_time, complexity) VALUES
('Patch CVE-2024-1234', 'Automated patching for critical vulnerability in Apache.', 'critical', 95, '15m', 'low'),
('Rotate IAM Keys', 'Rotate all AWS IAM keys older than 90 days.', 'high', 80, '30m', 'medium');

INSERT INTO public.compliance_control_gaps (control_id, requirement, impact, status) VALUES
('AC-2', 'Account Management: System must automatically disable inactive accounts.', 'high', 'open'),
('AU-6', 'Audit Review: Audit records lack complete analysis process.', 'medium', 'in_progress');
