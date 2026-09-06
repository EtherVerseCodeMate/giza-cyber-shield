-- Fix database function security by adding proper search_path to all functions
-- This addresses the "Function Search Path Mutable" security warning

-- Update get_current_user_role function
DROP FUNCTION IF EXISTS public.get_current_user_role();
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$function$;

-- Update is_master_admin function
DROP FUNCTION IF EXISTS public.is_master_admin();
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.admin_roles 
      WHERE user_id = auth.uid() 
      AND role_type = 'master_admin' 
      AND is_active = true 
      AND (expires_at IS NULL OR expires_at > now())
    ) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND master_admin = true
    ) THEN true
    ELSE false
  END;
$function$;

-- Update get_user_organizations function
DROP FUNCTION IF EXISTS public.get_user_organizations();
CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid();
$function$;

-- Update has_enterprise_access function
DROP FUNCTION IF EXISTS public.has_enterprise_access(uuid);
CREATE OR REPLACE FUNCTION public.has_enterprise_access(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = user_uuid 
    AND (plan_type = 'enterprise' OR master_admin = true)
  );
$function$;

-- Update is_organization_member function
DROP FUNCTION IF EXISTS public.is_organization_member(uuid);
CREATE OR REPLACE FUNCTION public.is_organization_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations 
    WHERE user_id = auth.uid() AND organization_id = org_id
  );
$function$;

-- Update is_trial_active function
DROP FUNCTION IF EXISTS public.is_trial_active(uuid);
CREATE OR REPLACE FUNCTION public.is_trial_active(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
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

-- Update get_trial_days_remaining function
DROP FUNCTION IF EXISTS public.get_trial_days_remaining(uuid);
CREATE OR REPLACE FUNCTION public.get_trial_days_remaining(user_uuid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT CASE 
    WHEN trial_ends_at IS NULL THEN 14
    ELSE GREATEST(0, EXTRACT(DAY FROM trial_ends_at - now())::integer)
  END
  FROM public.profiles 
  WHERE user_id = user_uuid;
$function$;

-- Restrict ai_agent_roles table access (currently publicly readable)
-- Remove overly permissive policy and add proper organization-based access
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

-- Add audit logging for sensitive operations
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