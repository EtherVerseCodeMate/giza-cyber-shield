-- Enterprise STIG Implementation Framework Database Schema

-- STIG Configuration Baselines
CREATE TABLE public.stig_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  stig_id TEXT NOT NULL,
  stig_version TEXT NOT NULL,
  baseline_name TEXT NOT NULL,
  platform TEXT NOT NULL, -- Windows, Linux, Network, etc.
  configuration JSONB NOT NULL DEFAULT '{}',
  risk_tolerance TEXT NOT NULL DEFAULT 'MEDIUM',
  implementation_status TEXT NOT NULL DEFAULT 'PENDING',
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- STIG Rule Implementation Tracking
CREATE TABLE public.stig_rule_implementations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  stig_rule_id TEXT NOT NULL,
  rule_title TEXT NOT NULL,
  severity TEXT NOT NULL,
  implementation_method TEXT NOT NULL, -- automated, manual, exception
  configuration_script TEXT,
  validation_script TEXT,
  implementation_status TEXT NOT NULL DEFAULT 'PENDING',
  compliance_status TEXT NOT NULL DEFAULT 'NOT_COMPLIANT',
  last_checked TIMESTAMP WITH TIME ZONE,
  last_remediated TIMESTAMP WITH TIME ZONE,
  evidence_collected JSONB DEFAULT '[]',
  remediation_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Compliance Drift Detection
CREATE TABLE public.compliance_drift_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  stig_rule_id TEXT NOT NULL,
  drift_type TEXT NOT NULL, -- configuration_change, policy_violation, security_event
  severity TEXT NOT NULL,
  previous_state JSONB NOT NULL,
  current_state JSONB NOT NULL,
  detection_method TEXT NOT NULL,
  auto_remediated BOOLEAN DEFAULT false,
  remediation_action TEXT,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Automated Remediation Playbooks
CREATE TABLE public.remediation_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  stig_rule_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  playbook_name TEXT NOT NULL,
  description TEXT,
  remediation_script TEXT NOT NULL,
  validation_script TEXT NOT NULL,
  rollback_script TEXT,
  risk_level TEXT NOT NULL DEFAULT 'MEDIUM',
  auto_execute BOOLEAN DEFAULT false,
  success_rate NUMERIC DEFAULT 0,
  execution_count INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- STIG Evidence Collection
CREATE TABLE public.stig_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  stig_rule_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL, -- screenshot, config_file, log_entry, scan_result
  evidence_data JSONB NOT NULL,
  file_path TEXT,
  file_hash TEXT,
  collection_method TEXT NOT NULL, -- automated, manual
  collection_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  retention_period_days INTEGER DEFAULT 2555, -- 7 years for DOD compliance
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CMMC Mapping for DOD Contractors
CREATE TABLE public.cmmc_stig_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stig_rule_id TEXT NOT NULL,
  cmmc_control_id TEXT NOT NULL,
  cmmc_level INTEGER NOT NULL,
  mapping_strength TEXT NOT NULL, -- direct, partial, supporting
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Compliance Reporting and Dashboards
CREATE TABLE public.compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  report_type TEXT NOT NULL, -- stig_compliance, cmmc_assessment, gap_analysis
  report_name TEXT NOT NULL,
  scope_assets UUID[] DEFAULT '{}',
  scope_stigs TEXT[] DEFAULT '{}',
  compliance_percentage NUMERIC,
  critical_findings INTEGER DEFAULT 0,
  high_findings INTEGER DEFAULT 0,
  medium_findings INTEGER DEFAULT 0,
  low_findings INTEGER DEFAULT 0,
  report_data JSONB NOT NULL,
  generated_by UUID,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'GENERATED'
);

-- Asset Configuration Monitoring
CREATE TABLE public.asset_configuration_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  snapshot_type TEXT NOT NULL, -- baseline, scheduled, triggered
  configuration_data JSONB NOT NULL,
  stig_compliance_status JSONB DEFAULT '{}',
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Enterprise Alert Rules for STIG Compliance
CREATE TABLE public.stig_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  rule_name TEXT NOT NULL,
  stig_rule_ids TEXT[] DEFAULT '{}',
  alert_conditions JSONB NOT NULL,
  severity TEXT NOT NULL,
  notification_channels JSONB NOT NULL, -- email, slack, teams, siem
  escalation_rules JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for all tables
ALTER TABLE public.stig_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_rule_implementations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_drift_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remediation_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmmc_stig_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_configuration_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_alert_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Organization members can access STIG baselines" ON public.stig_baselines
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can access STIG implementations" ON public.stig_rule_implementations
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can access drift events" ON public.compliance_drift_events
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can access remediation playbooks" ON public.remediation_playbooks
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can access STIG evidence" ON public.stig_evidence
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "CMMC mappings are publicly readable" ON public.cmmc_stig_mappings
FOR SELECT USING (true);

CREATE POLICY "Admins can manage CMMC mappings" ON public.cmmc_stig_mappings
FOR ALL USING (get_current_user_role() = 'admin' OR is_master_admin());

CREATE POLICY "Organization members can access compliance reports" ON public.compliance_reports
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can access configuration snapshots" ON public.asset_configuration_snapshots
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can access STIG alerts" ON public.stig_alert_rules
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

-- Indexes for performance
CREATE INDEX idx_stig_baselines_org_platform ON public.stig_baselines(organization_id, platform);
CREATE INDEX idx_stig_implementations_asset_rule ON public.stig_rule_implementations(asset_id, stig_rule_id);
CREATE INDEX idx_compliance_drift_asset_detected ON public.compliance_drift_events(asset_id, detected_at);
CREATE INDEX idx_stig_evidence_asset_rule ON public.stig_evidence(asset_id, stig_rule_id, collection_timestamp);
CREATE INDEX idx_configuration_snapshots_asset_time ON public.asset_configuration_snapshots(asset_id, captured_at);

-- Triggers for updated_at fields
CREATE TRIGGER update_stig_baselines_updated_at BEFORE UPDATE ON public.stig_baselines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stig_rule_implementations_updated_at BEFORE UPDATE ON public.stig_rule_implementations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_remediation_playbooks_updated_at BEFORE UPDATE ON public.remediation_playbooks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cmmc_stig_mappings_updated_at BEFORE UPDATE ON public.cmmc_stig_mappings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stig_alert_rules_updated_at BEFORE UPDATE ON public.stig_alert_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();