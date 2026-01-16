-- Create organizations table (tenants)
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  subscription_tier TEXT DEFAULT 'trial',
  max_users INTEGER DEFAULT 5,
  max_storage_gb INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'trial', -- trial, basic, professional, enterprise
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, cancelled
  billing_cycle TEXT DEFAULT 'monthly', -- monthly, yearly
  price_per_month DECIMAL(10,2),
  max_users INTEGER DEFAULT 5,
  max_storage_gb INTEGER DEFAULT 10,
  features JSONB DEFAULT '{}',
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  billing_period_start TIMESTAMP WITH TIME ZONE,
  billing_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_organizations junction table
CREATE TABLE public.user_organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member, viewer
  invited_by UUID REFERENCES public.profiles(user_id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  joined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Add organization_id to existing tables to make them tenant-aware
ALTER TABLE public.alerts ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.alert_rules ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.security_events ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.threat_intelligence ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.compliance_frameworks ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.compliance_assessments ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

-- Create functions for tenant access control
CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_organization_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations 
    WHERE user_id = auth.uid() AND organization_id = org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_role_in_organization(org_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  SELECT role FROM public.user_organizations 
  WHERE user_id = auth.uid() AND organization_id = org_id;
$$;

-- RLS Policies for organizations
CREATE POLICY "Users can view organizations they belong to" 
ON public.organizations FOR SELECT 
USING (id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Organization owners can update their organization" 
ON public.organizations FOR UPDATE 
USING (
  id IN (
    SELECT organization_id FROM public.user_organizations 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- RLS Policies for subscriptions
CREATE POLICY "Organization members can view their subscription" 
ON public.subscriptions FOR SELECT 
USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Organization owners can manage subscriptions" 
ON public.subscriptions FOR ALL 
USING (
  organization_id IN (
    SELECT organization_id FROM public.user_organizations 
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

-- RLS Policies for user_organizations
CREATE POLICY "Users can view their organization memberships" 
ON public.user_organizations FOR SELECT 
USING (user_id = auth.uid() OR organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Organization admins can manage memberships" 
ON public.user_organizations FOR ALL 
USING (
  organization_id IN (
    SELECT organization_id FROM public.user_organizations 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- Update existing RLS policies to be tenant-aware
DROP POLICY IF EXISTS "Analysts and above can manage alerts" ON public.alerts;
CREATE POLICY "Organization members can manage alerts in their organization" 
ON public.alerts FOR ALL 
USING (
  organization_id IN (SELECT public.get_user_organizations()) AND
  (get_current_user_role() = ANY (ARRAY['admin'::text, 'analyst'::text, 'operator'::text]) OR is_master_admin())
);

DROP POLICY IF EXISTS "Analysts and above can manage alert rules" ON public.alert_rules;
CREATE POLICY "Organization members can manage alert rules in their organization" 
ON public.alert_rules FOR ALL 
USING (
  organization_id IN (SELECT public.get_user_organizations()) AND
  (get_current_user_role() = ANY (ARRAY['admin'::text, 'analyst'::text, 'operator'::text]) OR is_master_admin())
);

-- Add triggers for updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default organization for existing users
INSERT INTO public.organizations (name, slug, subscription_tier) 
VALUES ('Default Organization', 'default-org', 'trial');

-- Link existing users to default organization
INSERT INTO public.user_organizations (user_id, organization_id, role, joined_at)
SELECT p.user_id, o.id, 'owner', now()
FROM public.profiles p
CROSS JOIN public.organizations o
WHERE o.slug = 'default-org'
ON CONFLICT DO NOTHING;