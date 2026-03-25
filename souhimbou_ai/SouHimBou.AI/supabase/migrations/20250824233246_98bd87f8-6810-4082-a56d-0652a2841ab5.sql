-- Enhanced Integration Hub Schema (ISIH)
-- Create integrations library table for built-in industry standards
CREATE TABLE IF NOT EXISTS public.integrations_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('SIEM', 'FIREWALL', 'ENDPOINT', 'IDENTITY', 'CLOUD', 'COMPLIANCE', 'NETWORK', 'VULNERABILITY', 'CUSTOM')),
  description TEXT NOT NULL,
  logo_url TEXT,
  documentation_url TEXT,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('oauth2', 'api_key', 'basic', 'certificate', 'manual')),
  required_fields JSONB NOT NULL DEFAULT '[]',
  supported_data_types JSONB NOT NULL DEFAULT '[]',
  is_popular BOOLEAN DEFAULT false,
  is_dod_approved BOOLEAN DEFAULT false,
  compliance_standards JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user integrations table to track user connections
CREATE TABLE IF NOT EXISTS public.user_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES public.integrations_library(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'pending', 'error', 'secure_ticket_required')),
  config JSONB NOT NULL DEFAULT '{}',
  encrypted_credentials TEXT,
  last_sync TIMESTAMP WITH TIME ZONE,
  sync_frequency TEXT DEFAULT 'hourly' CHECK (sync_frequency IN ('realtime', 'hourly', 'daily', 'weekly', 'manual')),
  health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'warning', 'critical', 'unknown')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Create integration analytics table
CREATE TABLE IF NOT EXISTS public.integration_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_integration_id UUID NOT NULL REFERENCES public.user_integrations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  events_processed INTEGER DEFAULT 0,
  alerts_generated INTEGER DEFAULT 0,
  threats_detected INTEGER DEFAULT 0,
  data_volume_mb INTEGER DEFAULT 0,
  uptime_percentage DECIMAL(5,2) DEFAULT 100.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create integration tickets table for DoD secure workflows
CREATE TABLE IF NOT EXISTS public.integration_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES public.integrations_library(id),
  ticket_type TEXT NOT NULL CHECK (ticket_type IN ('new_integration', 'configuration_change', 'disconnect', 'troubleshooting')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'approved', 'rejected', 'completed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  justification TEXT,
  requested_config JSONB DEFAULT '{}',
  approver_id UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.integrations_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Integration library is publicly readable"
ON public.integrations_library FOR SELECT
USING (true);

CREATE POLICY "Organization members can view user integrations"
ON public.user_integrations FOR SELECT
USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Admins can manage user integrations"
ON public.user_integrations FOR ALL
USING (
  (organization_id IN (SELECT get_user_organizations())) AND 
  ((get_current_user_role() = ANY (ARRAY['admin'::text, 'analyst'::text])) OR is_master_admin())
);

CREATE POLICY "Organization members can view integration analytics"
ON public.integration_analytics FOR SELECT
USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "System can insert integration analytics"
ON public.integration_analytics FOR INSERT
WITH CHECK (true);

CREATE POLICY "Organization members can manage integration tickets"
ON public.integration_tickets FOR ALL
USING (organization_id IN (SELECT get_user_organizations()));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_integrations_org_id ON public.user_integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_status ON public.user_integrations(status);
CREATE INDEX IF NOT EXISTS idx_integration_analytics_date ON public.integration_analytics(date);
CREATE INDEX IF NOT EXISTS idx_integration_tickets_status ON public.integration_tickets(status);

-- Create update triggers
CREATE TRIGGER update_integrations_library_updated_at
  BEFORE UPDATE ON public.integrations_library
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_integrations_updated_at
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integration_tickets_updated_at
  BEFORE UPDATE ON public.integration_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();