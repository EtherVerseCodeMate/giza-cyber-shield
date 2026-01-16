-- Restrict ai_agent_roles table access (currently publicly readable)
-- This removes the competitive intelligence exposure risk

-- Remove overly permissive policy
DROP POLICY IF EXISTS "Agent roles are viewable by authenticated users" ON public.ai_agent_roles;

-- Create new restricted policy for ai_agent_roles
CREATE POLICY "Agent roles viewable by organization members only"
ON public.ai_agent_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
    AND uo.role IN ('admin', 'analyst', 'compliance_officer')
  ) OR public.is_master_admin()
);

-- Add enhanced security monitoring functions
CREATE OR REPLACE FUNCTION public.log_sensitive_operation(
  operation_type text,
  table_name text,
  record_id text DEFAULT NULL,
  details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
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
    'sensitive_operation_' || operation_type,
    table_name,
    record_id,
    jsonb_build_object(
      'operation', operation_type,
      'details', details,
      'security_level', 'high',
      'timestamp', now()
    ),
    inet_client_addr(),
    now()
  );
END;
$function$;

-- Create trigger for monitoring admin role changes
CREATE OR REPLACE FUNCTION public.audit_admin_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Log admin role modifications
  PERFORM public.log_sensitive_operation(
    'admin_role_change',
    'admin_roles',
    NEW.id::text,
    jsonb_build_object(
      'target_user_id', NEW.user_id,
      'role_type', NEW.role_type,
      'granted_by', NEW.granted_by,
      'is_active', NEW.is_active,
      'expires_at', NEW.expires_at
    )
  );
  
  RETURN NEW;
END;
$function$;

-- Create trigger for admin role table
DROP TRIGGER IF EXISTS audit_admin_roles_trigger ON public.admin_roles;
CREATE TRIGGER audit_admin_roles_trigger
  AFTER INSERT OR UPDATE ON public.admin_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_admin_role_changes();

-- Add MFA requirement enforcement for sensitive operations
CREATE OR REPLACE FUNCTION public.require_mfa_for_sensitive_operations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Check if user has MFA enabled for admin operations
  IF TG_TABLE_NAME IN ('admin_roles', 'encryption_keys', 'secure_discovery_credentials') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND mfa_enabled = true
    ) AND NOT public.is_master_admin() THEN
      RAISE EXCEPTION 'MFA required for sensitive operations. Please enable MFA in your profile settings.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Apply MFA requirement to sensitive tables
DROP TRIGGER IF EXISTS require_mfa_admin_roles ON public.admin_roles;
CREATE TRIGGER require_mfa_admin_roles
  BEFORE INSERT OR UPDATE ON public.admin_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.require_mfa_for_sensitive_operations();

-- Create security monitoring for failed authentication attempts
CREATE OR REPLACE FUNCTION public.monitor_failed_auth_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  recent_failures INTEGER;
BEGIN
  -- Count recent failed attempts from same IP
  SELECT COUNT(*) INTO recent_failures
  FROM public.audit_logs
  WHERE action = 'security_event'
    AND details->>'event_type' = 'failed_login'
    AND ip_address = inet_client_addr()
    AND created_at > now() - INTERVAL '15 minutes';
  
  -- Create alert if too many failures
  IF recent_failures >= 5 THEN
    INSERT INTO public.security_alerts (
      alert_type,
      alert_category,
      severity,
      description,
      metadata
    ) VALUES (
      'authentication_brute_force',
      'security_event',
      'HIGH',
      'Multiple failed authentication attempts detected',
      jsonb_build_object(
        'ip_address', inet_client_addr(),
        'failure_count', recent_failures,
        'time_window', '15 minutes',
        'auto_generated', true
      )
    );
  END IF;
END;
$function$;