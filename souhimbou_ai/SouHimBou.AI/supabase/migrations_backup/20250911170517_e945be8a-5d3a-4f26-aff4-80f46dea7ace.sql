-- STIG-First Compliance Enhancement Schema

-- Enhanced STIG Rules Management
CREATE TABLE public.stig_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('CAT_I', 'CAT_II', 'CAT_III')),
  vuln_id TEXT,
  group_id TEXT,
  group_title TEXT,
  fix_text TEXT,
  check_text TEXT,
  rule_version TEXT,
  stigid TEXT,
  weight NUMERIC DEFAULT 10.0,
  class TEXT DEFAULT 'UNCLASS',
  stig_uuid UUID,
  legacy_ids TEXT[],
  cci_refs TEXT[],
  nist_controls TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- STIG Benchmark Definitions
CREATE TABLE public.stig_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  benchmark_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL,
  release_info TEXT,
  product TEXT NOT NULL,
  platform TEXT,
  applicable_platforms JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enhanced STIG Compliance Scans
CREATE TABLE public.stig_compliance_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  asset_id UUID,
  benchmark_id UUID REFERENCES public.stig_benchmarks(id),
  scan_type TEXT NOT NULL DEFAULT 'automated',
  scan_status TEXT NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  initiated_by UUID,
  initiated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  total_rules INTEGER DEFAULT 0,
  passed_rules INTEGER DEFAULT 0,
  failed_rules INTEGER DEFAULT 0,
  not_applicable_rules INTEGER DEFAULT 0,
  not_reviewed_rules INTEGER DEFAULT 0,
  cat_i_open INTEGER DEFAULT 0,
  cat_ii_open INTEGER DEFAULT 0,
  cat_iii_open INTEGER DEFAULT 0,
  overall_score NUMERIC DEFAULT 0,
  scan_results JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- STIG Finding Results with Enhanced Tracking
CREATE TABLE public.stig_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID REFERENCES public.stig_compliance_scans(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL,
  rule_id TEXT NOT NULL,
  organization_id UUID NOT NULL,
  finding_status TEXT NOT NULL DEFAULT 'Open' CHECK (finding_status IN ('Open', 'NotAFinding', 'Not_Applicable', 'Not_Reviewed')),
  severity TEXT NOT NULL,
  comments TEXT,
  finding_details JSONB DEFAULT '{}'::jsonb,
  evidence JSONB DEFAULT '[]'::jsonb,
  assigned_to UUID,
  due_date DATE,
  remediation_status TEXT DEFAULT 'pending' CHECK (remediation_status IN ('pending', 'in_progress', 'completed', 'verified', 'exception_granted')),
  remediation_effort_hours NUMERIC,
  remediation_priority INTEGER DEFAULT 50,
  false_positive BOOLEAN DEFAULT false,
  risk_accepted BOOLEAN DEFAULT false,
  accepted_by UUID,
  acceptance_justification TEXT,
  last_verified TIMESTAMP WITH TIME ZONE,
  verified_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Automated Remediation Actions
CREATE TABLE public.stig_remediation_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('script', 'policy', 'configuration', 'manual')),
  action_name TEXT NOT NULL,
  description TEXT,
  remediation_script TEXT,
  prerequisites JSONB DEFAULT '[]'::jsonb,
  supported_platforms TEXT[] DEFAULT '{}',
  risk_level TEXT DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  success_criteria TEXT,
  rollback_procedure TEXT,
  estimated_duration_minutes INTEGER,
  requires_reboot BOOLEAN DEFAULT false,
  automation_enabled BOOLEAN DEFAULT false,
  validation_command TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Remediation Execution Log
CREATE TABLE public.stig_remediation_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  finding_id UUID REFERENCES public.stig_findings(id) ON DELETE CASCADE,
  action_id UUID REFERENCES public.stig_remediation_actions(id),
  organization_id UUID NOT NULL,
  execution_status TEXT NOT NULL DEFAULT 'pending' CHECK (execution_status IN ('pending', 'running', 'success', 'failed', 'rolled_back')),
  initiated_by UUID,
  initiated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  execution_log TEXT,
  error_message TEXT,
  validation_result JSONB,
  rollback_executed BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- STIG Evidence Collection
CREATE TABLE public.stig_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  finding_id UUID REFERENCES public.stig_findings(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('screenshot', 'log_file', 'configuration', 'document', 'script_output')),
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  file_hash TEXT,
  content TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  collected_by UUID,
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  retention_until DATE
);

-- STIG Compliance Policies
CREATE TABLE public.stig_compliance_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  policy_name TEXT NOT NULL,
  policy_type TEXT NOT NULL CHECK (policy_type IN ('baseline', 'custom', 'exception')),
  applicable_benchmarks UUID[] DEFAULT '{}',
  applicable_assets UUID[] DEFAULT '{}',
  policy_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  enforcement_level TEXT DEFAULT 'advisory' CHECK (enforcement_level IN ('advisory', 'enforced', 'strict')),
  auto_remediation BOOLEAN DEFAULT false,
  notification_settings JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  active BOOLEAN DEFAULT true
);

-- Add RLS policies for all new tables
ALTER TABLE public.stig_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_compliance_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_remediation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_remediation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_compliance_policies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "STIG rules are publicly readable" ON public.stig_rules FOR SELECT USING (true);
CREATE POLICY "Admins can manage STIG rules" ON public.stig_rules FOR ALL USING (is_master_admin() OR get_current_user_role() = 'admin');

CREATE POLICY "STIG benchmarks are publicly readable" ON public.stig_benchmarks FOR SELECT USING (true);
CREATE POLICY "Admins can manage STIG benchmarks" ON public.stig_benchmarks FOR ALL USING (is_master_admin() OR get_current_user_role() = 'admin');

CREATE POLICY "Organization STIG scans access" ON public.stig_compliance_scans 
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization STIG findings access" ON public.stig_findings 
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "STIG remediation actions are publicly readable" ON public.stig_remediation_actions FOR SELECT USING (true);
CREATE POLICY "Admins can manage remediation actions" ON public.stig_remediation_actions FOR ALL USING (is_master_admin() OR get_current_user_role() = 'admin');

CREATE POLICY "Organization remediation executions access" ON public.stig_remediation_executions 
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization STIG evidence access" ON public.stig_evidence 
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization STIG policies access" ON public.stig_compliance_policies 
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

-- Create indexes for performance
CREATE INDEX idx_stig_rules_rule_id ON public.stig_rules(rule_id);
CREATE INDEX idx_stig_rules_severity ON public.stig_rules(severity);
CREATE INDEX idx_stig_compliance_scans_org ON public.stig_compliance_scans(organization_id);
CREATE INDEX idx_stig_compliance_scans_asset ON public.stig_compliance_scans(asset_id);
CREATE INDEX idx_stig_findings_scan ON public.stig_findings(scan_id);
CREATE INDEX idx_stig_findings_asset ON public.stig_findings(asset_id);
CREATE INDEX idx_stig_findings_rule ON public.stig_findings(rule_id);
CREATE INDEX idx_stig_findings_status ON public.stig_findings(finding_status);
CREATE INDEX idx_stig_findings_severity ON public.stig_findings(severity);

-- Create triggers for updated_at
CREATE TRIGGER update_stig_rules_updated_at
    BEFORE UPDATE ON public.stig_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stig_benchmarks_updated_at
    BEFORE UPDATE ON public.stig_benchmarks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stig_findings_updated_at
    BEFORE UPDATE ON public.stig_findings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stig_remediation_actions_updated_at
    BEFORE UPDATE ON public.stig_remediation_actions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stig_compliance_policies_updated_at
    BEFORE UPDATE ON public.stig_compliance_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();