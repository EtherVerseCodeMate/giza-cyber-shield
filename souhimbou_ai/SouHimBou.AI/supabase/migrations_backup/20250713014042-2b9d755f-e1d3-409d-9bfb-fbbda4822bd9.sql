-- Create tables to store real enterprise data for compliance automation

-- Infrastructure assets discovered by the discovery engine
CREATE TABLE public.infrastructure_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  asset_type TEXT NOT NULL, -- 'network_scan', 'cloud_discovery', 'container_discovery', 'ad_enumeration'
  target TEXT NOT NULL,
  discovery_results JSONB NOT NULL DEFAULT '{}',
  discovered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  risk_level TEXT CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) DEFAULT 'MEDIUM',
  compliance_status TEXT CHECK (compliance_status IN ('COMPLIANT', 'NON_COMPLIANT', 'UNKNOWN')) DEFAULT 'UNKNOWN'
);

-- Vulnerability scan results from multiple sources
CREATE TABLE public.vulnerability_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  scan_type TEXT NOT NULL, -- 'network_vulnerability', 'web_application', 'file_analysis', 'threat_intelligence', 'compliance_scan'
  targets JSONB NOT NULL DEFAULT '[]',
  results JSONB NOT NULL DEFAULT '{}',
  scan_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_vulnerabilities INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  high_count INTEGER DEFAULT 0,
  medium_count INTEGER DEFAULT 0,
  low_count INTEGER DEFAULT 0,
  scan_status TEXT CHECK (scan_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')) DEFAULT 'PENDING'
);

-- Automated remediation activities and results
CREATE TABLE public.remediation_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  action_type TEXT NOT NULL, -- 'patch_management', 'configuration_hardening', 'security_policy_enforcement', 'incident_response', 'compliance_automation'
  targets JSONB NOT NULL DEFAULT '[]',
  results JSONB NOT NULL DEFAULT '{}',
  dry_run BOOLEAN DEFAULT false,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success_rate INTEGER DEFAULT 0,
  total_actions INTEGER DEFAULT 0,
  successful_actions INTEGER DEFAULT 0,
  execution_status TEXT CHECK (execution_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')) DEFAULT 'PENDING'
);

-- Enable Row Level Security
ALTER TABLE public.infrastructure_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vulnerability_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remediation_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for organization-based access
CREATE POLICY "Organization members can manage infrastructure assets"
ON public.infrastructure_assets
FOR ALL
USING (organization_id IN (SELECT get_user_organizations()))
WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can manage vulnerability scans"
ON public.vulnerability_scans
FOR ALL
USING (organization_id IN (SELECT get_user_organizations()))
WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can manage remediation activities"
ON public.remediation_activities
FOR ALL
USING (organization_id IN (SELECT get_user_organizations()))
WITH CHECK (organization_id IN (SELECT get_user_organizations()));

-- Create indexes for better performance
CREATE INDEX idx_infrastructure_assets_org_type ON public.infrastructure_assets(organization_id, asset_type);
CREATE INDEX idx_infrastructure_assets_discovered_at ON public.infrastructure_assets(discovered_at DESC);
CREATE INDEX idx_vulnerability_scans_org_type ON public.vulnerability_scans(organization_id, scan_type);
CREATE INDEX idx_vulnerability_scans_date ON public.vulnerability_scans(scan_date DESC);
CREATE INDEX idx_remediation_activities_org_type ON public.remediation_activities(organization_id, action_type);
CREATE INDEX idx_remediation_activities_executed_at ON public.remediation_activities(executed_at DESC);

-- Create trigger to update last_updated timestamp
CREATE TRIGGER update_infrastructure_assets_updated_at
BEFORE UPDATE ON public.infrastructure_assets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();