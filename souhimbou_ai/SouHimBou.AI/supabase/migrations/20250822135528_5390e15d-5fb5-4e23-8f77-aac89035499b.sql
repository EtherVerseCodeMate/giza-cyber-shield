-- Critical Security Fixes Migration
-- Fix exposed PII and strengthen database security

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

-- 3. Strengthen profiles table RLS policies for MFA data
DROP POLICY IF EXISTS "Users can update own basic profile data" ON public.profiles;

CREATE POLICY "Users can update own non-security profile data"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND
  -- Prevent non-admins from modifying security fields
  (OLD.role IS NOT DISTINCT FROM NEW.role OR 
   get_current_user_role() = 'admin' OR 
   is_master_admin()) AND
  (OLD.master_admin IS NOT DISTINCT FROM NEW.master_admin OR 
   is_master_admin()) AND
  (OLD.security_clearance IS NOT DISTINCT FROM NEW.security_clearance OR 
   get_current_user_role() = 'admin' OR 
   is_master_admin())
);

-- 4. Fix database function search paths to prevent SQL injection
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

-- 5. Strengthen notifications table RLS for PII protection
DROP POLICY IF EXISTS "Master admins only can view notification metadata" ON public.notifications;

CREATE POLICY "Master admins can view notification metadata only"
ON public.notifications
FOR SELECT
USING (
  is_master_admin() AND 
  auth.uid() <> recipient_id
);

-- Add audit logging for notification access
CREATE OR REPLACE FUNCTION public.log_notification_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log access to notifications containing PII
  IF NEW.data_classification IN ('PII', 'CONFIDENTIAL') THEN
    PERFORM log_sensitive_data_access_enhanced(
      'notifications',
      NEW.id::text,
      'view',
      NEW.data_classification
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for notification access logging
DROP TRIGGER IF EXISTS trigger_log_notification_access ON public.notifications;
CREATE TRIGGER trigger_log_notification_access
  BEFORE SELECT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION log_notification_access();

-- 6. Create enhanced security monitoring table
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

-- 7. Enhanced audit function for sensitive data access
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