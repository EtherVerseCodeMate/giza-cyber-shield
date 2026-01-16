-- Fix Function Search Path Mutable security warning
-- Set secure search path for remaining functions without proper configuration

-- 1. Fix update_updated_at_security_assets function
CREATE OR REPLACE FUNCTION public.update_updated_at_security_assets()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 2. Check and fix any other functions that might be missing search_path
-- Let's also fix the get_sanitized_integration_config function to be more secure
CREATE OR REPLACE FUNCTION public.get_sanitized_integration_config(config_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- 3. Fix get_notification_analytics function  
CREATE OR REPLACE FUNCTION public.get_notification_analytics()
 RETURNS TABLE(total_notifications bigint, pending_count bigint, sent_count bigint, delivered_count bigint, failed_count bigint, channels jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow admins to access this function
  IF NOT ((get_current_user_role() = 'admin') OR is_master_admin()) THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  -- Log the access
  PERFORM log_sensitive_data_access('notifications', 'analytics', 'admin_view');

  RETURN QUERY
  SELECT 
    COUNT(*) as total_notifications,
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
    COUNT(*) FILTER (WHERE status = 'SENT') as sent_count,
    COUNT(*) FILTER (WHERE status = 'DELIVERED') as delivered_count,
    COUNT(*) FILTER (WHERE status = 'FAILED') as failed_count,
    jsonb_object_agg(channel, COUNT(*)) as channels
  FROM public.notifications
  GROUP BY ();
END;
$function$;

-- 4. Fix audit_profile_security_changes function
CREATE OR REPLACE FUNCTION public.audit_profile_security_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Log any changes to security-sensitive fields
  IF OLD.role IS DISTINCT FROM NEW.role OR
     OLD.master_admin IS DISTINCT FROM NEW.master_admin OR
     OLD.security_clearance IS DISTINCT FROM NEW.security_clearance OR
     OLD.mfa_enabled IS DISTINCT FROM NEW.mfa_enabled THEN
    
    PERFORM log_security_monitoring_event(
      'profile_security_field_change',
      'HIGH',
      'profiles',
      NEW.user_id::text,
      jsonb_build_object(
        'changed_fields', jsonb_build_object(
          'role', CASE WHEN OLD.role IS DISTINCT FROM NEW.role THEN jsonb_build_object('from', OLD.role, 'to', NEW.role) END,
          'master_admin', CASE WHEN OLD.master_admin IS DISTINCT FROM NEW.master_admin THEN jsonb_build_object('from', OLD.master_admin, 'to', NEW.master_admin) END,
          'security_clearance', CASE WHEN OLD.security_clearance IS DISTINCT FROM NEW.security_clearance THEN jsonb_build_object('from', OLD.security_clearance, 'to', NEW.security_clearance) END,
          'mfa_enabled', CASE WHEN OLD.mfa_enabled IS DISTINCT FROM NEW.mfa_enabled THEN jsonb_build_object('from', OLD.mfa_enabled, 'to', NEW.mfa_enabled) END
        ),
        'acting_user_role', get_current_user_role(),
        'is_master_admin', is_master_admin()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;