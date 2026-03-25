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