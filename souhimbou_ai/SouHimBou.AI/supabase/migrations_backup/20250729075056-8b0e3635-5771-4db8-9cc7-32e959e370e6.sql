-- Fix search path vulnerability in security definer functions
-- This prevents malicious users from manipulating the search path to bypass security

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(master_admin, false) FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_role_in_organization(org_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.user_organizations 
  WHERE user_id = auth.uid() AND organization_id = org_id;
$$;

CREATE OR REPLACE FUNCTION public.is_organization_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations 
    WHERE user_id = auth.uid() AND organization_id = org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.check_document_permission(doc_id uuid, user_uuid uuid, permission text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.has_accepted_all_agreements(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.is_trial_active(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = user_uuid 
      AND is_trial_active = true 
      AND (trial_ends_at IS NULL OR trial_ends_at > now())
    ), 
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.get_trial_days_remaining(user_uuid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE 
    WHEN trial_ends_at IS NULL THEN 14
    ELSE GREATEST(0, EXTRACT(DAY FROM trial_ends_at - now())::integer)
  END
  FROM public.profiles 
  WHERE user_id = user_uuid;
$$;

-- Enhance profile security validation function
CREATE OR REPLACE FUNCTION public.validate_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Log security field modification attempts
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
    'profile_security_modification_attempt',
    'profile',
    NEW.user_id::text,
    jsonb_build_object(
      'old_role', OLD.role,
      'new_role', NEW.role,
      'old_master_admin', OLD.master_admin,
      'new_master_admin', NEW.master_admin,
      'old_security_clearance', OLD.security_clearance,
      'new_security_clearance', NEW.security_clearance
    ),
    inet_client_addr(),
    now()
  );

  -- Check if non-admin user is trying to modify security fields
  IF NOT ((public.get_current_user_role() = 'admin') OR public.is_master_admin()) THEN
    -- Prevent modification of security-critical fields by non-admins
    IF OLD.role IS DISTINCT FROM NEW.role OR
       OLD.master_admin IS DISTINCT FROM NEW.master_admin OR
       OLD.security_clearance IS DISTINCT FROM NEW.security_clearance THEN
      
      -- Log the security violation
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
        'security_violation',
        'profile',
        NEW.user_id::text,
        jsonb_build_object(
          'violation_type', 'unauthorized_security_field_modification',
          'attempted_changes', jsonb_build_object(
            'role', CASE WHEN OLD.role IS DISTINCT FROM NEW.role THEN jsonb_build_object('from', OLD.role, 'to', NEW.role) END,
            'master_admin', CASE WHEN OLD.master_admin IS DISTINCT FROM NEW.master_admin THEN jsonb_build_object('from', OLD.master_admin, 'to', NEW.master_admin) END,
            'security_clearance', CASE WHEN OLD.security_clearance IS DISTINCT FROM NEW.security_clearance THEN jsonb_build_object('from', OLD.security_clearance, 'to', NEW.security_clearance) END
          )
        ),
        inet_client_addr(),
        now()
      );
      
      RAISE EXCEPTION 'Insufficient privileges to modify security fields';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create function to detect suspicious privilege escalation patterns
CREATE OR REPLACE FUNCTION public.detect_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

-- Add trigger for privilege escalation detection
DROP TRIGGER IF EXISTS detect_privilege_escalation_trigger ON public.audit_logs;
CREATE TRIGGER detect_privilege_escalation_trigger
  AFTER INSERT ON public.audit_logs
  FOR EACH ROW
  WHEN (NEW.action = 'security_violation')
  EXECUTE FUNCTION public.detect_privilege_escalation();

-- Create function to validate organization role changes
CREATE OR REPLACE FUNCTION public.validate_organization_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

-- Add trigger for organization role validation
DROP TRIGGER IF EXISTS validate_organization_role_change_trigger ON public.user_organizations;
CREATE TRIGGER validate_organization_role_change_trigger
  BEFORE INSERT OR UPDATE ON public.user_organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_organization_role_change();