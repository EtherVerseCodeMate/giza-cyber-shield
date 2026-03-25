-- STIG-Connector Database Schema
-- Asset discovery and management tables

-- Credentials vault for discovery operations
CREATE TABLE public.discovery_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  credential_name TEXT NOT NULL,
  credential_type TEXT NOT NULL, -- 'ssh_key', 'username_password', 'api_token', 'certificate'
  target_systems JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of IP ranges, hostnames, etc.
  encrypted_credentials JSONB NOT NULL, -- Encrypted credential data
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Discovery jobs and scheduling
CREATE TABLE public.discovery_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  job_name TEXT NOT NULL,
  discovery_type TEXT NOT NULL, -- 'network_scan', 'cloud_discovery', 'agent_based', 'snmp_discovery'
  target_specification JSONB NOT NULL, -- IP ranges, cloud subscriptions, etc.
  credential_ids UUID[] DEFAULT '{}',
  discovery_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  schedule_config JSONB DEFAULT '{}'::jsonb, -- Cron-like scheduling
  status TEXT NOT NULL DEFAULT 'inactive', -- 'active', 'inactive', 'running', 'error'
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Discovered assets (enhanced from existing infrastructure_assets)
CREATE TABLE public.discovered_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  discovery_job_id UUID REFERENCES public.discovery_jobs(id),
  asset_identifier TEXT NOT NULL, -- IP, hostname, resource ID
  asset_type TEXT NOT NULL, -- 'server', 'network_device', 'database', 'application'
  platform TEXT, -- 'windows', 'linux', 'cisco_ios', 'vmware', etc.
  operating_system TEXT,
  version TEXT,
  hostname TEXT,
  ip_addresses INET[],
  mac_addresses TEXT[],
  discovered_services JSONB DEFAULT '[]'::jsonb,
  system_info JSONB DEFAULT '{}'::jsonb,
  applicable_stigs TEXT[] DEFAULT '{}', -- Array of applicable STIG IDs
  stig_version_mapping JSONB DEFAULT '{}'::jsonb,
  discovery_method TEXT NOT NULL,
  last_discovered TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  first_discovered TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  risk_score INTEGER DEFAULT 0,
  compliance_status JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- STIG applicability rules and mapping
CREATE TABLE public.stig_applicability_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stig_id TEXT NOT NULL,
  stig_title TEXT NOT NULL,
  stig_version TEXT NOT NULL,
  platform_patterns JSONB NOT NULL, -- Regex patterns for platform matching
  version_patterns JSONB NOT NULL, -- Version matching rules
  service_requirements JSONB DEFAULT '[]'::jsonb, -- Required services
  exclusion_rules JSONB DEFAULT '[]'::jsonb, -- When NOT to apply
  priority INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Discovery execution logs
CREATE TABLE public.discovery_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discovery_job_id UUID NOT NULL REFERENCES public.discovery_jobs(id),
  organization_id UUID NOT NULL,
  execution_status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed', 'cancelled'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  assets_discovered INTEGER DEFAULT 0,
  assets_updated INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  execution_log JSONB DEFAULT '[]'::jsonb,
  performance_metrics JSONB DEFAULT '{}'::jsonb,
  discovered_asset_ids UUID[] DEFAULT '{}'
);

-- RLS Policies
ALTER TABLE public.discovery_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovered_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_applicability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_executions ENABLE ROW LEVEL SECURITY;

-- Organization-based access for all tables
CREATE POLICY "Organization discovery credentials access" ON public.discovery_credentials
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization discovery jobs access" ON public.discovery_jobs
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization discovered assets access" ON public.discovered_assets
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "STIG rules are viewable by authenticated users" ON public.stig_applicability_rules
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage STIG rules" ON public.stig_applicability_rules
  FOR ALL USING ((get_current_user_role() = 'admin') OR is_master_admin());

CREATE POLICY "Organization discovery executions access" ON public.discovery_executions
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

-- Indexes for performance
CREATE INDEX idx_discovered_assets_org_id ON public.discovered_assets(organization_id);
CREATE INDEX idx_discovered_assets_type ON public.discovered_assets(asset_type);
CREATE INDEX idx_discovered_assets_platform ON public.discovered_assets(platform);
CREATE INDEX idx_discovered_assets_last_discovered ON public.discovered_assets(last_discovered);
CREATE INDEX idx_discovery_jobs_org_status ON public.discovery_jobs(organization_id, status);
CREATE INDEX idx_discovery_executions_job_id ON public.discovery_executions(discovery_job_id);

-- Triggers for updated_at
CREATE TRIGGER update_discovery_credentials_updated_at
  BEFORE UPDATE ON public.discovery_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_discovery_jobs_updated_at
  BEFORE UPDATE ON public.discovery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stig_applicability_rules_updated_at
  BEFORE UPDATE ON public.stig_applicability_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();