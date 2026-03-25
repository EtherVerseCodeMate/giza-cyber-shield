-- Migration: 20260308_compliance_orchestration
-- Description: Adds tables for Connectors, Playbooks, and Control Gaps for TRL-10

-- 1. Compliance Connectors
CREATE TABLE IF NOT EXISTS public.compliance_connectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    last_sync TIMESTAMPTZ,
    capabilities JSONB DEFAULT '[]'::jsonb,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Remediation Playbooks
CREATE TABLE IF NOT EXISTS public.remediation_playbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    success_rate NUMERIC DEFAULT 0,
    last_executed TIMESTAMPTZ,
    author TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    steps JSONB DEFAULT '[]'::jsonb,
    requires_approval BOOLEAN DEFAULT true,
    rollback_steps JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Remediation Executions
CREATE TABLE IF NOT EXISTS public.remediation_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    playbook_id UUID NOT NULL REFERENCES public.remediation_playbooks(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    triggered_by TEXT,
    target_count INTEGER DEFAULT 0,
    successful_targets INTEGER DEFAULT 0,
    failed_targets INTEGER DEFAULT 0,
    logs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Compliance Frameworks
CREATE TABLE IF NOT EXISTS public.compliance_frameworks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Compliance Controls
CREATE TABLE IF NOT EXISTS public.compliance_controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    framework_id UUID NOT NULL REFERENCES public.compliance_frameworks(id) ON DELETE CASCADE,
    control_family TEXT NOT NULL,
    control_identifier TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Compliance Control Gaps
CREATE TABLE IF NOT EXISTS public.compliance_control_gaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    control_id UUID NOT NULL REFERENCES public.compliance_controls(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    description TEXT,
    remediation_plan TEXT,
    due_date TIMESTAMPTZ,
    assigned_to TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies

-- compliance_connectors
ALTER TABLE public.compliance_connectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and manage their org connectors" ON public.compliance_connectors
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ));

-- remediation_playbooks
ALTER TABLE public.remediation_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and manage their org playbooks" ON public.remediation_playbooks
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ));

-- remediation_executions
ALTER TABLE public.remediation_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and manage their org executions" ON public.remediation_executions
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ));

-- compliance_frameworks
ALTER TABLE public.compliance_frameworks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and manage their org frameworks" ON public.compliance_frameworks
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ));

-- compliance_controls
ALTER TABLE public.compliance_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view controls for their org frameworks" ON public.compliance_controls
    FOR ALL USING (framework_id IN (
        SELECT id FROM public.compliance_frameworks WHERE organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    ));

-- compliance_control_gaps
ALTER TABLE public.compliance_control_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and manage their org control gaps" ON public.compliance_control_gaps
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ));

-- Triggers for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.compliance_connectors FOR EACH ROW EXECUTE FUNCTION public.moddatetime (updated_at);
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.remediation_playbooks FOR EACH ROW EXECUTE FUNCTION public.moddatetime (updated_at);
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.remediation_executions FOR EACH ROW EXECUTE FUNCTION public.moddatetime (updated_at);
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.compliance_frameworks FOR EACH ROW EXECUTE FUNCTION public.moddatetime (updated_at);
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.compliance_controls FOR EACH ROW EXECUTE FUNCTION public.moddatetime (updated_at);
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.compliance_control_gaps FOR EACH ROW EXECUTE FUNCTION public.moddatetime (updated_at);
