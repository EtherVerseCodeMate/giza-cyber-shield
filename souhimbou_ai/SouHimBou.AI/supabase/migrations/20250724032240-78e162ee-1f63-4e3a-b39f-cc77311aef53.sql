-- Create infrastructure audit table for real asset tracking
CREATE TABLE IF NOT EXISTS public.infrastructure_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('database', 'server', 'network', 'application', 'cloud_service')),
  asset_identifier TEXT NOT NULL,
  location TEXT NOT NULL CHECK (location IN ('supabase', 'github', 'internal', 'cloud', 'external')),
  last_verified TIMESTAMP WITH TIME ZONE DEFAULT now(),
  security_status TEXT DEFAULT 'unknown' CHECK (security_status IN ('secure', 'vulnerable', 'compromised', 'unknown')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.infrastructure_audit ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Organization members can manage infrastructure audit"
ON public.infrastructure_audit
FOR ALL
USING (organization_id IN (SELECT get_user_organizations()));

-- Create real threat investigation table
CREATE TABLE IF NOT EXISTS public.threat_investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  threat_indicator TEXT NOT NULL,
  indicator_type TEXT NOT NULL CHECK (indicator_type IN ('ip', 'domain', 'hash', 'url', 'email')),
  investigation_status TEXT DEFAULT 'pending' CHECK (investigation_status IN ('pending', 'investigating', 'resolved', 'false_positive')),
  threat_level TEXT DEFAULT 'unknown' CHECK (threat_level IN ('low', 'medium', 'high', 'critical', 'unknown')),
  real_or_simulated TEXT DEFAULT 'unknown' CHECK (real_or_simulated IN ('real', 'simulated', 'unknown')),
  investigation_notes TEXT,
  external_references JSONB DEFAULT '[]',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.threat_investigations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Organization members can manage threat investigations"
ON public.threat_investigations
FOR ALL
USING (organization_id IN (SELECT get_user_organizations()));

-- Insert your current infrastructure for audit
INSERT INTO public.infrastructure_audit (organization_id, asset_type, asset_identifier, location, metadata)
SELECT 
  (SELECT id FROM organizations LIMIT 1),
  'database',
  'bqxmmonqibpmnxgypevd.supabase.co',
  'supabase',
  '{"service": "supabase", "project_id": "bqxmmonqibpmnxgypevd", "region": "us-east-1"}'
WHERE NOT EXISTS (SELECT 1 FROM infrastructure_audit WHERE asset_identifier = 'bqxmmonqibpmnxgypevd.supabase.co');

-- Create the threat investigation for the IP mentioned
INSERT INTO public.threat_investigations (
  organization_id,
  threat_indicator,
  indicator_type,
  investigation_status,
  threat_level,
  real_or_simulated,
  investigation_notes,
  created_by
)
SELECT 
  (SELECT id FROM organizations LIMIT 1),
  '185.220.101.42',
  'ip',
  'investigating',
  'high',
  'unknown',
  'IP flagged by ARGUS AI agent - need to verify if real threat or simulated data',
  (SELECT user_id FROM profiles WHERE master_admin = true LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM threat_investigations WHERE threat_indicator = '185.220.101.42');

-- Add triggers for updated_at
CREATE TRIGGER update_infrastructure_audit_updated_at
  BEFORE UPDATE ON public.infrastructure_audit
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_threat_investigations_updated_at
  BEFORE UPDATE ON public.threat_investigations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();