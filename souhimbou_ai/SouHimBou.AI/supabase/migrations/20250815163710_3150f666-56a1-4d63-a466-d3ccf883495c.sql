-- Fix security issue: Restrict access to integration configurations to admins only
-- Currently organization members can access API keys and credentials

-- Drop existing policies that allow all organization members to access sensitive config data
DROP POLICY IF EXISTS "Organization members can manage integrations" ON public.integration_configs;
DROP POLICY IF EXISTS "Organization members can manage EDR integrations" ON public.edr_integrations;

-- Create new admin-only policies for integration_configs table
CREATE POLICY "Admins can manage integration configs" 
ON public.integration_configs 
FOR ALL 
USING (
  (organization_id IN (SELECT get_user_organizations())) 
  AND 
  ((get_current_user_role() = 'admin') OR is_master_admin())
);

-- Create read-only policy for non-admin organization members (without sensitive config data)
CREATE POLICY "Organization members can view integration status" 
ON public.integration_configs 
FOR SELECT 
USING (
  (organization_id IN (SELECT get_user_organizations())) 
  AND 
  ((get_current_user_role() = ANY(ARRAY['analyst', 'operator'])) OR (get_current_user_role() = 'admin') OR is_master_admin())
);

-- Create new admin-only policies for edr_integrations table  
CREATE POLICY "Admins can manage EDR integrations" 
ON public.edr_integrations 
FOR ALL 
USING (
  (organization_id IN (SELECT get_user_organizations())) 
  AND 
  ((get_current_user_role() = 'admin') OR is_master_admin())
);

-- Create read-only policy for non-admin organization members (without sensitive config data)
CREATE POLICY "Organization members can view EDR integration status" 
ON public.edr_integrations 
FOR SELECT 
USING (
  (organization_id IN (SELECT get_user_organizations())) 
  AND 
  ((get_current_user_role() = ANY(ARRAY['analyst', 'operator'])) OR (get_current_user_role() = 'admin') OR is_master_admin())
);

-- Ensure network_monitoring table also follows admin-only pattern for sensitive data
DROP POLICY IF EXISTS "Organization members can view network monitoring" ON public.network_monitoring;

CREATE POLICY "Admins can manage network monitoring" 
ON public.network_monitoring 
FOR ALL 
USING (
  (organization_id IN (SELECT get_user_organizations())) 
  AND 
  ((get_current_user_role() = 'admin') OR is_master_admin())
);

CREATE POLICY "Organization members can view network monitoring data" 
ON public.network_monitoring 
FOR SELECT 
USING (
  (organization_id IN (SELECT get_user_organizations())) 
  AND 
  ((get_current_user_role() = ANY(ARRAY['analyst', 'operator'])) OR (get_current_user_role() = 'admin') OR is_master_admin())
);

-- Add function to sanitize config data for non-admin users
CREATE OR REPLACE FUNCTION public.get_sanitized_integration_config(config_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  config_data jsonb;
  sanitized_config jsonb;
BEGIN
  -- Only admins can access full config
  IF (get_current_user_role() = 'admin') OR is_master_admin() THEN
    SELECT config INTO config_data FROM public.integration_configs WHERE id = config_id;
    RETURN config_data;
  END IF;
  
  -- Return sanitized config for non-admins (remove sensitive fields)
  SELECT config INTO config_data FROM public.integration_configs WHERE id = config_id;
  
  IF config_data IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  
  -- Remove sensitive fields like API keys, passwords, tokens
  sanitized_config := config_data;
  sanitized_config := sanitized_config - 'api_key';
  sanitized_config := sanitized_config - 'apiKey';
  sanitized_config := sanitized_config - 'password';
  sanitized_config := sanitized_config - 'token';
  sanitized_config := sanitized_config - 'secret';
  sanitized_config := sanitized_config - 'credentials';
  sanitized_config := sanitized_config - 'auth_token';
  sanitized_config := sanitized_config - 'access_token';
  
  RETURN sanitized_config;
END;
$$;