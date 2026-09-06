-- Create user_integrations table for tracking user's connected integrations
CREATE TABLE public.user_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES public.integrations_library(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'pending', 'error', 'secure_ticket_required')),
  config JSONB NOT NULL DEFAULT '{}',
  last_sync TIMESTAMP WITH TIME ZONE,
  sync_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (sync_frequency IN ('realtime', 'hourly', 'daily', 'weekly', 'manual')),
  health_status TEXT NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'warning', 'critical', 'unknown')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id, integration_id)
);

-- Enable RLS
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- Create policies for user integrations
CREATE POLICY "Users can view their organization integrations" 
ON public.user_integrations 
FOR SELECT 
USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Admins can manage organization integrations" 
ON public.user_integrations 
FOR ALL 
USING (
  organization_id IN (SELECT get_user_organizations()) 
  AND (get_current_user_role() = 'admin' OR is_master_admin())
);

-- Create trigger for updated_at
CREATE TRIGGER update_user_integrations_updated_at
BEFORE UPDATE ON public.user_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create organizations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  domain TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  subscription_tier TEXT DEFAULT 'trial',
  max_users INTEGER DEFAULT 5,
  max_storage_gb INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create policies for organizations
CREATE POLICY "Organization members can view their organization" 
ON public.organizations 
FOR SELECT 
USING (id IN (SELECT get_user_organizations()));

CREATE POLICY "Admins can manage their organization" 
ON public.organizations 
FOR ALL 
USING (
  id IN (SELECT get_user_organizations()) 
  AND (get_current_user_role() = 'admin' OR is_master_admin())
);

-- Create user_organizations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'analyst', 'operator', 'viewer', 'compliance_officer')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  invited_by UUID,
  UNIQUE(user_id, organization_id)
);

-- Enable RLS on user_organizations
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

-- Create policies for user_organizations
CREATE POLICY "Users can view their organization memberships" 
ON public.user_organizations 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Organization admins can manage memberships" 
ON public.user_organizations 
FOR ALL 
USING (
  organization_id IN (SELECT get_user_organizations()) 
  AND (get_current_user_role() = 'admin' OR is_master_admin())
);

-- Insert default organization and assign current user if they exist
DO $$
DECLARE
  current_user_id UUID;
  default_org_id UUID;
BEGIN
  -- Get current user ID
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NOT NULL THEN
    -- Create default organization
    INSERT INTO public.organizations (name, slug, subscription_tier)
    VALUES ('Default Organization', 'default-org', 'trial')
    RETURNING id INTO default_org_id;
    
    -- Assign user to organization as admin
    INSERT INTO public.user_organizations (user_id, organization_id, role)
    VALUES (current_user_id, default_org_id, 'admin');
  END IF;
END $$;