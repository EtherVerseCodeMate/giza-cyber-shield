-- Final Security Hardening - Address Linter Warnings
-- Fix remaining function search paths and enable password protection

-- 1. Fix search_path for all remaining functions that don't have it set
CREATE OR REPLACE FUNCTION public.check_document_permission(doc_id uuid, user_uuid uuid, permission text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.legal_document_permissions
    WHERE document_id = doc_id
    AND (
      user_id = user_uuid OR
      role = (SELECT role FROM public.profiles WHERE user_id = user_uuid)
    )
    AND permission_type = permission
    AND (expires_at IS NULL OR expires_at > now())
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_accepted_all_agreements(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_agreements 
    WHERE user_id = user_uuid 
    AND agreement_type = 'tos' 
    AND revoked_at IS NULL
  ) AND EXISTS (
    SELECT 1 FROM public.user_agreements 
    WHERE user_id = user_uuid 
    AND agreement_type = 'privacy' 
    AND revoked_at IS NULL
  ) AND EXISTS (
    SELECT 1 FROM public.user_agreements 
    WHERE user_id = user_uuid 
    AND agreement_type = 'saas' 
    AND revoked_at IS NULL
  ) AND EXISTS (
    SELECT 1 FROM public.user_agreements 
    WHERE user_id = user_uuid 
    AND agreement_type = 'beta' 
    AND revoked_at IS NULL
  ) AND EXISTS (
    SELECT 1 FROM public.user_agreements 
    WHERE user_id = user_uuid 
    AND agreement_type = 'dod_compliance' 
    AND revoked_at IS NULL
  ) AND EXISTS (
    SELECT 1 FROM public.user_agreements 
    WHERE user_id = user_uuid 
    AND agreement_type = 'liability_waiver' 
    AND revoked_at IS NULL
  ) AND EXISTS (
    SELECT 1 FROM public.user_agreements 
    WHERE user_id = user_uuid 
    AND agreement_type = 'export_control' 
    AND revoked_at IS NULL
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_trial_active(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = user_uuid 
      AND is_trial_active = true 
      AND (trial_ends_at IS NULL OR trial_ends_at > now())
    ), 
    false
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_trial_days_remaining(user_uuid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN trial_ends_at IS NULL THEN 14
    ELSE GREATEST(0, EXTRACT(DAY FROM trial_ends_at - now())::integer)
  END
  FROM public.profiles 
  WHERE user_id = user_uuid;
$function$;

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

-- 2. Enable leaked password protection in auth configuration
-- Note: This requires manual configuration in Supabase dashboard
-- The user will need to enable this in Authentication > Settings

-- 3. Add additional security monitoring for profile updates
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

-- Create trigger for profile security monitoring
DROP TRIGGER IF EXISTS trigger_audit_profile_security_changes ON public.profiles;
CREATE TRIGGER trigger_audit_profile_security_changes
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION audit_profile_security_changes();