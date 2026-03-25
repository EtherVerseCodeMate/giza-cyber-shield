-- Add enhanced MFA columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN trusted_devices JSONB DEFAULT '[]'::jsonb,
ADD COLUMN emergency_access_codes TEXT[] DEFAULT '{}';

-- Create organization_settings table for MFA policies
CREATE TABLE public.organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  mfa_policy JSONB DEFAULT '{
    "enforce_for_all": false,
    "require_for_admin": true,
    "max_trusted_devices": 3,
    "device_trust_duration_days": 30,
    "require_periodic_reverification": true,
    "emergency_bypass_enabled": false
  }'::jsonb,
  security_policies JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS on organization_settings
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for organization_settings
CREATE POLICY "Organization members can view settings" 
ON public.organization_settings 
FOR SELECT 
USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization admins can manage settings" 
ON public.organization_settings 
FOR ALL 
USING (
  organization_id IN (SELECT get_user_organizations()) AND 
  (get_current_user_role() = 'admin' OR is_master_admin())
);

-- Create trigger for updating updated_at column
CREATE TRIGGER update_organization_settings_updated_at
BEFORE UPDATE ON public.organization_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create security device tracking table
CREATE TABLE public.security_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_name TEXT NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_type TEXT DEFAULT 'unknown',
  last_used TIMESTAMP WITH TIME ZONE DEFAULT now(),
  trusted_until TIMESTAMP WITH TIME ZONE,
  location_info TEXT,
  is_trusted BOOLEAN DEFAULT false,
  risk_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on security_devices
ALTER TABLE public.security_devices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for security_devices
CREATE POLICY "Users can manage their own devices" 
ON public.security_devices 
FOR ALL 
USING (auth.uid()::text = user_id::text);

-- Create trigger for updating updated_at column
CREATE TRIGGER update_security_devices_updated_at
BEFORE UPDATE ON public.security_devices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_security_devices_user_id ON public.security_devices(user_id);
CREATE INDEX idx_security_devices_fingerprint ON public.security_devices(device_fingerprint);
CREATE INDEX idx_organization_settings_org_id ON public.organization_settings(organization_id);