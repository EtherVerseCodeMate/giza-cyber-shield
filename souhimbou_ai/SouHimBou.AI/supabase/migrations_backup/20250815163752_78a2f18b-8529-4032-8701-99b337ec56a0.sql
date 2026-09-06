-- Fix security linter warnings

-- 1. Fix function search path for the sanitize function
CREATE OR REPLACE FUNCTION public.get_sanitized_integration_config(config_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO ''
AS $$
DECLARE
  config_data jsonb;
  sanitized_config jsonb;
BEGIN
  -- Only admins can access full config
  IF (public.get_current_user_role() = 'admin') OR public.is_master_admin() THEN
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