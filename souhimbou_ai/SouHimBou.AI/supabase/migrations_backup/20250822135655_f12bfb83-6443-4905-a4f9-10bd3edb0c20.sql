-- Critical Security Fixes - Core Issues Only
-- Fix exposed PII tables and strengthen function security

-- 1. Enable RLS on subscribers table and add policies
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization admins can manage subscribers"
ON public.subscribers
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
    AND uo.role IN ('admin', 'owner')
  )
);

-- 2. Enable RLS on third_party_testers table and add policies
ALTER TABLE public.third_party_testers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master admins can manage third party testers"
ON public.third_party_testers
FOR ALL
USING (public.is_master_admin());

CREATE POLICY "Organization admins can view their testers"
ON public.third_party_testers
FOR SELECT
USING (
  organization_id IN (SELECT get_user_organizations()) AND
  (get_current_user_role() = 'admin' OR is_master_admin())
);

-- 3. Fix database function search paths to prevent SQL injection
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

CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid();
$function$;

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

CREATE OR REPLACE FUNCTION public.get_user_role_in_organization(org_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_organizations 
  WHERE user_id = auth.uid() AND organization_id = org_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(master_admin, false) FROM public.profiles WHERE user_id = auth.uid();
$function$;

-- 4. Create enhanced security monitoring table
CREATE TABLE IF NOT EXISTS public.security_monitoring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  source_table text,
  source_id text,
  user_id uuid,
  details jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.security_monitoring ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Security monitoring admin access"
ON public.security_monitoring
FOR ALL
USING (is_master_admin());

-- 5. Enhanced audit function for sensitive data access
CREATE OR REPLACE FUNCTION public.log_security_monitoring_event(
  p_event_type text,
  p_severity text DEFAULT 'MEDIUM',
  p_source_table text DEFAULT NULL,
  p_source_id text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.security_monitoring (
    event_type,
    severity,
    source_table,
    source_id,
    user_id,
    details,
    ip_address,
    created_at
  ) VALUES (
    p_event_type,
    p_severity,
    p_source_table,
    p_source_id,
    auth.uid(),
    p_details,
    inet_client_addr(),
    now()
  );
END;
$function$;