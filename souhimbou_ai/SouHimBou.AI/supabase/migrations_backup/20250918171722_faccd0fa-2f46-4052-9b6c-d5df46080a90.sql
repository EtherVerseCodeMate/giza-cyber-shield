-- STIG-Codex TRL10 Database Schema (Fixed Policy Names)
-- Phase 1: Real-time Configuration Baselining & Drift Detection

-- Configuration baselines table for cryptographic snapshots
CREATE TABLE IF NOT EXISTS public.stig_configuration_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  stig_rule_id TEXT NOT NULL,
  configuration_hash TEXT NOT NULL,
  configuration_data JSONB NOT NULL,
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('baseline', 'current', 'violation', 'remediated')),
  compliance_status TEXT NOT NULL CHECK (compliance_status IN ('compliant', 'non_compliant', 'pending', 'exception')),
  risk_score INTEGER DEFAULT 0,
  validated_by UUID,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_stig_baselines_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Real-time drift events for configuration changes
CREATE TABLE IF NOT EXISTS public.stig_drift_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_id UUID NOT NULL,
  stig_rule_id TEXT NOT NULL,
  drift_type TEXT NOT NULL CHECK (drift_type IN ('configuration_change', 'unauthorized_access', 'policy_violation', 'security_bypass')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  previous_state JSONB NOT NULL,
  current_state JSONB NOT NULL,
  detection_method TEXT NOT NULL CHECK (detection_method IN ('hash_mismatch', 'real_time_monitoring', 'scheduled_scan', 'event_triggered')),
  auto_remediated BOOLEAN DEFAULT false,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  remediation_action TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_stig_drift_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- AI-powered STIG agents for distributed monitoring
CREATE TABLE IF NOT EXISTS public.stig_monitoring_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  agent_name TEXT NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('windows_server', 'linux_server', 'network_device', 'database', 'web_server', 'cloud_service', 'container')),
  deployment_mode TEXT NOT NULL CHECK (deployment_mode IN ('agent_based', 'agentless', 'hybrid')),
  target_platforms TEXT[] NOT NULL DEFAULT '{}',
  supported_stigs TEXT[] NOT NULL DEFAULT '{}',
  operational_mode TEXT NOT NULL CHECK (operational_mode IN ('audit', 'baseline', 'remediate', 'enforce')),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'maintenance', 'error', 'deploying')),
  configuration JSONB NOT NULL DEFAULT '{}',
  performance_metrics JSONB NOT NULL DEFAULT '{
    "configurations_monitored": 0,
    "violations_detected": 0,
    "successful_remediations": 0,
    "failed_remediations": 0,
    "average_response_time_ms": 0
  }',
  deployment_config JSONB DEFAULT '{}',
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_stig_agents_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Trusted STIG configuration registry
CREATE TABLE IF NOT EXISTS public.stig_trusted_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  stig_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  configuration_name TEXT NOT NULL,
  configuration_data JSONB NOT NULL,
  cryptographic_hash TEXT NOT NULL,
  digital_signature TEXT,
  trust_level INTEGER NOT NULL DEFAULT 50 CHECK (trust_level >= 0 AND trust_level <= 100),
  source_type TEXT NOT NULL CHECK (source_type IN ('disa_official', 'vendor_approved', 'community_verified', 'ai_generated', 'custom')),
  validation_status TEXT NOT NULL CHECK (validation_status IN ('verified', 'pending', 'failed', 'deprecated')),
  compliance_frameworks TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  success_rate NUMERIC(5,4) DEFAULT 0.0000,
  risk_assessment JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Threat intelligence correlations
CREATE TABLE IF NOT EXISTS public.stig_threat_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  stig_rule_id TEXT NOT NULL,
  threat_source TEXT NOT NULL,
  threat_indicator TEXT NOT NULL,
  indicator_type TEXT NOT NULL CHECK (indicator_type IN ('ip_address', 'domain', 'file_hash', 'url', 'cve', 'mitre_technique')),
  risk_elevation TEXT NOT NULL CHECK (risk_elevation IN ('critical', 'high', 'medium', 'low', 'info')),
  correlation_confidence NUMERIC(3,2) NOT NULL DEFAULT 0.50 CHECK (correlation_confidence >= 0 AND correlation_confidence <= 1),
  threat_context JSONB NOT NULL DEFAULT '{}',
  recommended_actions TEXT[],
  correlated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_stig_threats_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Open Controls API integrations
CREATE TABLE IF NOT EXISTS public.open_controls_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  api_endpoint TEXT NOT NULL,
  authentication_config JSONB NOT NULL DEFAULT '{}',
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('active', 'pending', 'failed', 'disabled')),
  last_sync_at TIMESTAMPTZ,
  sync_frequency_hours INTEGER DEFAULT 24,
  available_stigs TEXT[] DEFAULT '{}',
  sync_errors JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_open_controls_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Automated remediation tracking
CREATE TABLE IF NOT EXISTS public.stig_remediation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  drift_event_id UUID,
  violation_id TEXT,
  remediation_type TEXT NOT NULL CHECK (remediation_type IN ('immediate', 'scheduled', 'approval_required', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending_approval', 'scheduled', 'in_progress')),
  actions_taken TEXT[] DEFAULT '{}',
  rollback_enabled BOOLEAN DEFAULT true,
  rollback_plan JSONB DEFAULT '{}',
  verification_required BOOLEAN DEFAULT true,
  verification_results JSONB DEFAULT '{}',
  impact_assessment JSONB DEFAULT '{}',
  executed_by UUID,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_stig_remediation_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_stig_remediation_drift FOREIGN KEY (drift_event_id) REFERENCES stig_drift_events(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stig_baselines_org_asset ON public.stig_configuration_baselines(organization_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_stig_baselines_stig_rule ON public.stig_configuration_baselines(stig_rule_id);
CREATE INDEX IF NOT EXISTS idx_stig_drift_org_severity ON public.stig_drift_events(organization_id, severity);
CREATE INDEX IF NOT EXISTS idx_stig_drift_detected_at ON public.stig_drift_events(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_stig_agents_org_status ON public.stig_monitoring_agents(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_stig_registry_stig_platform ON public.stig_trusted_registry(stig_id, platform);
CREATE INDEX IF NOT EXISTS idx_stig_threats_org_risk ON public.stig_threat_correlations(organization_id, risk_elevation);
CREATE INDEX IF NOT EXISTS idx_open_controls_org ON public.open_controls_integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_stig_remediation_org_status ON public.stig_remediation_actions(organization_id, status);

-- Enable RLS on all tables
ALTER TABLE public.stig_configuration_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_drift_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_monitoring_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_trusted_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_threat_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_controls_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_remediation_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies with unique names
CREATE POLICY "stig_baselines_org_access" ON public.stig_configuration_baselines
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "stig_drift_org_access" ON public.stig_drift_events
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "stig_agents_org_access" ON public.stig_monitoring_agents
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "stig_registry_public_access" ON public.stig_trusted_registry
  FOR ALL USING (organization_id IS NULL OR organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "stig_threats_org_access" ON public.stig_threat_correlations
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "open_controls_org_access" ON public.open_controls_integrations
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "stig_remediation_org_access" ON public.stig_remediation_actions
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

-- Update triggers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_stig_agents_updated_at') THEN
    CREATE TRIGGER update_stig_agents_updated_at
      BEFORE UPDATE ON public.stig_monitoring_agents
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_stig_registry_updated_at') THEN
    CREATE TRIGGER update_stig_registry_updated_at
      BEFORE UPDATE ON public.stig_trusted_registry
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_open_controls_updated_at') THEN
    CREATE TRIGGER update_open_controls_updated_at
      BEFORE UPDATE ON public.open_controls_integrations
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;