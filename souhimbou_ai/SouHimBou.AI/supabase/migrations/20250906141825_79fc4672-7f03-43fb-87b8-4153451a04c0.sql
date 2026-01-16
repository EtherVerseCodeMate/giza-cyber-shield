-- Fix remaining security issues

-- 1. Fix all functions that still don't have proper search_path set
CREATE OR REPLACE FUNCTION public.detect_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recent_attempts INTEGER;
BEGIN
  -- Count recent privilege escalation attempts by this user
  SELECT COUNT(*)
  INTO recent_attempts
  FROM public.audit_logs
  WHERE user_id = auth.uid()
    AND action = 'security_violation'
    AND details->>'violation_type' = 'unauthorized_security_field_modification'
    AND created_at > now() - INTERVAL '1 hour';

  -- If more than 3 attempts in the last hour, raise high-severity alert
  IF recent_attempts >= 3 THEN
    INSERT INTO public.security_events (
      event_type,
      severity,
      source_system,
      details,
      source_ip,
      created_at
    ) VALUES (
      'privilege_escalation_pattern_detected',
      'HIGH',
      'authentication_system',
      jsonb_build_object(
        'user_id', auth.uid(),
        'attempt_count', recent_attempts + 1,
        'time_window', '1 hour',
        'recommended_action', 'immediate_account_review'
      ),
      inet_client_addr(),
      now()
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_organization_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log all role changes
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    created_at
  ) VALUES (
    auth.uid(),
    'organization_role_change',
    'user_organization',
    NEW.id::text,
    jsonb_build_object(
      'target_user_id', NEW.user_id,
      'organization_id', NEW.organization_id,
      'old_role', COALESCE(OLD.role, 'none'),
      'new_role', NEW.role,
      'change_type', CASE WHEN OLD.id IS NULL THEN 'add' ELSE 'modify' END
    ),
    inet_client_addr(),
    now()
  );

  -- Only organization admins or master admins can modify roles
  IF NOT (
    (SELECT role FROM public.user_organizations WHERE user_id = auth.uid() AND organization_id = NEW.organization_id) = 'admin' 
    OR public.is_master_admin()
  ) THEN
    RAISE EXCEPTION 'Insufficient privileges to modify organization roles';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_profile_mfa_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow users to update their own MFA data, or admins
  IF OLD.mfa_backup_codes IS DISTINCT FROM NEW.mfa_backup_codes OR
     OLD.emergency_access_codes IS DISTINCT FROM NEW.emergency_access_codes OR
     OLD.trusted_devices IS DISTINCT FROM NEW.trusted_devices THEN
    
    IF NOT (auth.uid() = NEW.user_id OR is_master_admin()) THEN
      RAISE EXCEPTION 'Unauthorized access to MFA security data';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. Remove or convert SECURITY DEFINER views to SECURITY INVOKER where possible
-- Note: The actual views need to be identified and addressed individually

-- 3. Update any remaining functions without search_path
CREATE OR REPLACE FUNCTION public.update_user_agreements_updated_at()
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

CREATE OR REPLACE FUNCTION public.log_document_action(doc_id uuid, action_name text, old_vals jsonb DEFAULT NULL::jsonb, new_vals jsonb DEFAULT NULL::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.legal_document_audit (
    document_id,
    user_id,
    action,
    old_values,
    new_values,
    ip_address,
    created_at
  ) VALUES (
    doc_id,
    auth.uid(),
    action_name,
    old_vals,
    new_vals,
    inet_client_addr(),
    now()
  );
END;
$function$;

-- 4. Create more secure password reset system
CREATE OR REPLACE FUNCTION public.cleanup_expired_password_reset_otps()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired or used OTPs older than 24 hours
  DELETE FROM public.password_reset_otps 
  WHERE 
    expires_at < now() 
    OR (used = true AND used_at < now() - INTERVAL '24 hours')
    OR created_at < now() - INTERVAL '72 hours'; -- Safety cleanup for very old records
    
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log cleanup activity
  INSERT INTO public.audit_logs (
    action,
    resource_type,
    details,
    created_at
  ) VALUES (
    'system_password_otp_cleanup',
    'security',
    jsonb_build_object(
      'deleted_count', deleted_count,
      'cleanup_timestamp', now()
    ),
    now()
  );
  
  RETURN deleted_count;
END;
$function$;