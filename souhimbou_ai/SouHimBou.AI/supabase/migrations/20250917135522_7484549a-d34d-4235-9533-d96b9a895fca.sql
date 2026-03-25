-- Phase 4: Advanced Analytics & Reporting Tables
CREATE TABLE IF NOT EXISTS public.stig_analytics_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  metric_type TEXT NOT NULL, -- 'compliance_score', 'drift_rate', 'remediation_time', etc.
  metric_value NUMERIC NOT NULL,
  metric_unit TEXT, -- 'percentage', 'count', 'seconds', etc.
  measurement_period_start TIMESTAMPTZ NOT NULL,
  measurement_period_end TIMESTAMPTZ NOT NULL,
  asset_scope JSONB DEFAULT '[]'::JSONB, -- Array of asset IDs this metric covers
  stig_scope JSONB DEFAULT '[]'::JSONB, -- Array of STIG IDs this metric covers
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stig_compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  report_name TEXT NOT NULL,
  report_type TEXT NOT NULL, -- 'executive', 'technical', 'audit', 'trend'
  report_scope JSONB NOT NULL, -- Assets, STIGs, timeframe included
  report_data JSONB NOT NULL, -- Full report content
  compliance_percentage NUMERIC,
  critical_findings INTEGER DEFAULT 0,
  high_findings INTEGER DEFAULT 0,
  medium_findings INTEGER DEFAULT 0,
  low_findings INTEGER DEFAULT 0,
  trend_analysis JSONB DEFAULT '{}'::JSONB,
  recommendations JSONB DEFAULT '[]'::JSONB,
  generated_by UUID,
  generated_at TIMESTAMPTZ DEFAULT now(),
  report_format TEXT DEFAULT 'json', -- 'json', 'pdf', 'csv'
  status TEXT DEFAULT 'generated' -- 'generating', 'generated', 'delivered', 'archived'
);

-- Phase 5: Automation & Orchestration Tables
CREATE TABLE IF NOT EXISTS public.stig_remediation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  workflow_name TEXT NOT NULL,
  workflow_type TEXT NOT NULL, -- 'automated', 'semi_automated', 'manual'
  trigger_conditions JSONB NOT NULL, -- When this workflow should trigger
  remediation_steps JSONB NOT NULL, -- Array of steps to execute
  target_stig_rules JSONB DEFAULT '[]'::JSONB,
  target_platforms JSONB DEFAULT '[]'::JSONB,
  approval_required BOOLEAN DEFAULT false,
  risk_level TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  success_rate NUMERIC DEFAULT 0,
  execution_count INTEGER DEFAULT 0,
  last_execution TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.stig_remediation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.stig_remediation_workflows(id),
  organization_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  stig_rule_id TEXT NOT NULL,
  execution_status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
  execution_log JSONB DEFAULT '[]'::JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  execution_duration_seconds INTEGER,
  remediation_data JSONB DEFAULT '{}'::JSONB,
  approval_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  approved_by UUID,
  approved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.stig_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'compliance_monitor', 'drift_detection', 'policy_enforcement'
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  priority INTEGER DEFAULT 50,
  enabled BOOLEAN DEFAULT true,
  cooldown_minutes INTEGER DEFAULT 60,
  last_triggered TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Phase 6: Enterprise Integration Tables
CREATE TABLE IF NOT EXISTS public.organization_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  integration_type TEXT NOT NULL, -- 'servicenow', 'jira', 'slack', 'teams', 'email'
  integration_name TEXT NOT NULL,
  configuration JSONB NOT NULL,
  authentication_data JSONB NOT NULL, -- Encrypted tokens/credentials
  webhook_endpoints JSONB DEFAULT '[]'::JSONB,
  sync_settings JSONB DEFAULT '{}'::JSONB,
  last_sync TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'disconnected', -- 'connected', 'disconnected', 'error'
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.stig_compliance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  policy_name TEXT NOT NULL,
  policy_type TEXT NOT NULL, -- 'enforcement', 'monitoring', 'reporting'
  policy_definition JSONB NOT NULL,
  target_scope JSONB NOT NULL, -- Assets, STIGs, users affected
  enforcement_level TEXT DEFAULT 'advisory', -- 'advisory', 'warning', 'blocking'
  violation_actions JSONB DEFAULT '[]'::JSONB,
  compliance_threshold NUMERIC DEFAULT 80,
  review_frequency_days INTEGER DEFAULT 30,
  next_review_date DATE,
  policy_owner UUID,
  approvers JSONB DEFAULT '[]'::JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.api_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  integration_name TEXT NOT NULL,
  api_type TEXT NOT NULL, -- 'rest', 'graphql', 'webhook'
  endpoint_url TEXT NOT NULL,
  authentication_type TEXT NOT NULL, -- 'api_key', 'oauth', 'bearer'
  request_headers JSONB DEFAULT '{}'::JSONB,
  rate_limits JSONB DEFAULT '{}'::JSONB,
  data_mapping JSONB DEFAULT '{}'::JSONB,
  sync_frequency_minutes INTEGER DEFAULT 60,
  last_sync TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending',
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_stig_analytics_metrics_org_type ON public.stig_analytics_metrics(organization_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_stig_analytics_metrics_period ON public.stig_analytics_metrics(measurement_period_start, measurement_period_end);
CREATE INDEX IF NOT EXISTS idx_stig_compliance_reports_org_type ON public.stig_compliance_reports(organization_id, report_type);
CREATE INDEX IF NOT EXISTS idx_stig_remediation_workflows_org ON public.stig_remediation_workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_stig_remediation_executions_workflow ON public.stig_remediation_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_stig_remediation_executions_status ON public.stig_remediation_executions(execution_status);
CREATE INDEX IF NOT EXISTS idx_stig_automation_rules_org ON public.stig_automation_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_integrations_org ON public.organization_integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_stig_compliance_policies_org ON public.stig_compliance_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_integrations_org ON public.api_integrations(organization_id);

-- RLS Policies
ALTER TABLE public.stig_analytics_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization members can access analytics metrics" ON public.stig_analytics_metrics
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

ALTER TABLE public.stig_compliance_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization members can access compliance reports" ON public.stig_compliance_reports
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

ALTER TABLE public.stig_remediation_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization members can access remediation workflows" ON public.stig_remediation_workflows
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

ALTER TABLE public.stig_remediation_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization members can access remediation executions" ON public.stig_remediation_executions
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

ALTER TABLE public.stig_automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization members can access automation rules" ON public.stig_automation_rules
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization members can access integrations" ON public.organization_integrations
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

ALTER TABLE public.stig_compliance_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization members can access compliance policies" ON public.stig_compliance_policies
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

ALTER TABLE public.api_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization members can access API integrations" ON public.api_integrations
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stig_analytics_metrics_updated_at BEFORE UPDATE ON public.stig_analytics_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stig_remediation_workflows_updated_at BEFORE UPDATE ON public.stig_remediation_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stig_automation_rules_updated_at BEFORE UPDATE ON public.stig_automation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_organization_integrations_updated_at BEFORE UPDATE ON public.organization_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stig_compliance_policies_updated_at BEFORE UPDATE ON public.stig_compliance_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_api_integrations_updated_at BEFORE UPDATE ON public.api_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();