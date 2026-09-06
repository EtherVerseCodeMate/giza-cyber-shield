-- Fix database function security by updating existing functions with proper search_path
-- This addresses the "Function Search Path Mutable" security warning

-- Update functions without dropping them to avoid dependency issues

-- Update get_current_user_role function
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$function$;

-- Update is_master_admin function
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
CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid();
$function$;

-- Update has_enterprise_access function
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

-- Update other critical functions with search_path
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access_v2(table_name text, access_type text, classification text DEFAULT 'SENSITIVE'::text)
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
    details,
    ip_address,
    created_at
  ) VALUES (
    auth.uid(),
    'sensitive_data_access_v2',
    table_name,
    jsonb_build_object(
      'access_type', access_type,
      'classification', classification,
      'timestamp', now(),
      'user_role', get_current_user_role(),
      'session_context', jsonb_build_object(
        'user_agent', current_setting('request.headers', true)::json->>'user-agent',
        'ip_address', inet_client_addr()
      )
    ),
    inet_client_addr(),
    now()
  );
END;
$function$;