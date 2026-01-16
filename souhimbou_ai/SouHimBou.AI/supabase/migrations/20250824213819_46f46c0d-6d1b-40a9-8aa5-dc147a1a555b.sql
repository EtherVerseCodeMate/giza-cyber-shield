-- Phase 1: Fix Critical Database Function Security Vulnerabilities
-- Set secure search paths for all existing functions to prevent schema injection

-- 1. Fix has_enterprise_access function
CREATE OR REPLACE FUNCTION public.has_enterprise_access(user_uuid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = user_uuid 
    AND (plan_type = 'enterprise' OR master_admin = true)
  );
$function$;

-- 2. Fix get_user_role_in_organization function
CREATE OR REPLACE FUNCTION public.get_user_role_in_organization(org_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_organizations 
  WHERE user_id = auth.uid() AND organization_id = org_id;
$function$;

-- 3. Fix get_user_organizations function
CREATE OR REPLACE FUNCTION public.get_user_organizations()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid();
$function$;

-- 4. Fix get_current_user_role function
CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$function$;

-- 5. Fix is_master_admin function
CREATE OR REPLACE FUNCTION public.is_master_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(master_admin, false) FROM public.profiles WHERE user_id = auth.uid();
$function$;

-- 6. Fix is_organization_member function
CREATE OR REPLACE FUNCTION public.is_organization_member(org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations 
    WHERE user_id = auth.uid() AND organization_id = org_id
  );
$function$;

-- 7. Fix has_accepted_all_agreements function
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

-- 8. Fix is_trial_active function
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

-- 9. Fix get_trial_days_remaining function
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

-- Phase 2: Strengthen RLS Policies for Sensitive Data Protection

-- 1. Strengthen profiles table RLS - restrict MFA and sensitive fields
DROP POLICY IF EXISTS "Users can update own basic profile data" ON public.profiles;
CREATE POLICY "Users can update own basic profile data" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND 
  -- Prevent non-admins from modifying security-critical fields
  (
    -- Allow admins to modify anything
    (public.get_current_user_role() = 'admin' OR public.is_master_admin()) 
    OR 
    -- Non-admins can only modify basic fields, not security fields
    (
      OLD.role IS NOT DISTINCT FROM NEW.role AND
      OLD.master_admin IS NOT DISTINCT FROM NEW.master_admin AND
      OLD.security_clearance IS NOT DISTINCT FROM NEW.security_clearance AND
      OLD.mfa_backup_codes IS NOT DISTINCT FROM NEW.mfa_backup_codes AND
      OLD.emergency_access_codes IS NOT DISTINCT FROM NEW.emergency_access_codes AND
      OLD.trusted_devices IS NOT DISTINCT FROM NEW.trusted_devices
    )
  )
);

-- 2. Add additional protection for MFA-related fields in profiles
CREATE POLICY "MFA fields restricted to owner and admins" 
ON public.profiles 
FOR UPDATE 
USING (
  auth.uid() = user_id AND 
  (
    -- Allow if no MFA fields are being changed
    (
      OLD.mfa_backup_codes IS NOT DISTINCT FROM NEW.mfa_backup_codes AND
      OLD.emergency_access_codes IS NOT DISTINCT FROM NEW.emergency_access_codes AND
      OLD.trusted_devices IS NOT DISTINCT FROM NEW.trusted_devices AND
      OLD.mfa_enabled IS NOT DISTINCT FROM NEW.mfa_enabled
    )
    OR 
    -- Allow if user is admin/master admin
    (public.get_current_user_role() = 'admin' OR public.is_master_admin())
  )
);

-- 3. Strengthen notifications table RLS
DROP POLICY IF EXISTS "Users can view own notifications content" ON public.notifications;
DROP POLICY IF EXISTS "Master admins only can view notification metadata" ON public.notifications;

CREATE POLICY "Users can view own notifications only" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = recipient_id);

CREATE POLICY "Master admins can view notification metadata" 
ON public.notifications 
FOR SELECT 
USING (
  public.is_master_admin() AND 
  -- Log access to sensitive notification data
  (PERFORM public.log_sensitive_data_access_enhanced('notifications', id::text, 'admin_view', 'CONFIDENTIAL')) IS NOT NULL
);

-- 4. Audit logs - fix validation trigger to prevent user_id errors
DROP TRIGGER IF EXISTS validate_audit_log_trigger ON public.audit_logs;
CREATE OR REPLACE FUNCTION public.validate_audit_log_insertion_fixed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow system actions without user_id
  IF NEW.user_id IS NULL THEN
    -- Only allow system actions or explicitly mark as system
    IF NEW.action NOT LIKE 'system_%' THEN
      NEW.action := 'system_' || NEW.action;
    END IF;
  ELSE
    -- Validate that user_id exists in auth.users if provided
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.user_id) THEN
      -- Log the error but don't fail the insert for system operations
      RAISE WARNING 'Invalid user_id in audit log insertion: %', NEW.user_id;
      NEW.user_id := NULL;
      NEW.action := 'system_' || NEW.action;
    END IF;
  END IF;
  
  -- Auto-populate metadata with insertion context
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.ip_address := COALESCE(NEW.ip_address, inet_client_addr());
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_audit_log_trigger
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_audit_log_insertion_fixed();

-- Phase 3: Enhanced Security Monitoring

-- Create security alerts for privilege escalation attempts
CREATE OR REPLACE FUNCTION public.detect_privilege_escalation_enhanced()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  recent_attempts INTEGER;
  user_role TEXT;
BEGIN
  -- Get current user role for context
  SELECT public.get_current_user_role() INTO user_role;
  
  -- Count recent privilege escalation attempts by this user
  SELECT COUNT(*)
  INTO recent_attempts
  FROM public.audit_logs
  WHERE user_id = auth.uid()
    AND action = 'security_violation'
    AND details->>'violation_type' = 'unauthorized_security_field_modification'
    AND created_at > now() - INTERVAL '1 hour';

  -- If more than 2 attempts in the last hour, raise high-severity alert
  IF recent_attempts >= 2 THEN
    INSERT INTO public.security_events (
      event_type,
      severity,
      source_system,
      details,
      source_ip,
      created_at
    ) VALUES (
      'privilege_escalation_pattern_detected',
      'CRITICAL',
      'authentication_system',
      jsonb_build_object(
        'user_id', auth.uid(),
        'user_role', user_role,
        'attempt_count', recent_attempts + 1,
        'time_window', '1 hour',
        'recommended_action', 'immediate_account_suspension_review'
      ),
      inet_client_addr(),
      now()
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Add session security validation table
CREATE TABLE IF NOT EXISTS public.session_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  risk_level text NOT NULL DEFAULT 'low',
  device_fingerprint text,
  ip_address inet,
  user_agent text,
  details jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on session security events
ALTER TABLE public.session_security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session security events" 
ON public.session_security_events 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert session security events" 
ON public.session_security_events 
FOR INSERT 
WITH CHECK (true);

-- Function to log session security events
CREATE OR REPLACE FUNCTION public.log_session_security_event(
  p_event_type text,
  p_risk_level text DEFAULT 'low',
  p_device_fingerprint text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.session_security_events (
    user_id,
    event_type,
    risk_level,
    device_fingerprint,
    ip_address,
    user_agent,
    details
  ) VALUES (
    auth.uid(),
    p_event_type,
    p_risk_level,
    p_device_fingerprint,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent',
    p_details
  );
END;
$function$;