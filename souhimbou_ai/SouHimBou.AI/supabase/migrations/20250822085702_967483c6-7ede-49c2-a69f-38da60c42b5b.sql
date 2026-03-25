-- Fix security vulnerabilities and strengthen RLS policies (corrected)

-- 1. Enable leaked password protection
UPDATE auth.config 
SET password_dictionary_check_enabled = true 
WHERE id = 'password_dictionary_check_enabled';

-- 2. Strengthen profiles RLS for security fields
CREATE OR REPLACE FUNCTION validate_profile_mfa_access()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Create trigger for MFA data protection
DROP TRIGGER IF EXISTS validate_profile_mfa_access_trigger ON public.profiles;
CREATE TRIGGER validate_profile_mfa_access_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_profile_mfa_access();

-- 3. Strengthen notifications RLS to be more restrictive
DROP POLICY IF EXISTS "Admins can view notification metadata only" ON public.notifications;
CREATE POLICY "Master admins only can view notification metadata" ON public.notifications
FOR SELECT USING (is_master_admin() AND auth.uid() <> recipient_id);

-- 4. Fix function search paths for security functions
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

CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(master_admin, false) FROM public.profiles WHERE user_id = auth.uid();
$function$;

-- 5. Create performance monitoring table
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on performance metrics
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for performance metrics
CREATE POLICY "Organization members can view performance metrics" 
ON public.performance_metrics 
FOR ALL 
USING (organization_id IN (SELECT get_user_organizations()));

-- 6. Create system health monitoring table
CREATE TABLE IF NOT EXISTS public.system_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  response_time_ms INTEGER,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on system health checks
ALTER TABLE public.system_health_checks ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for system health (admin access only)
CREATE POLICY "Admins can manage system health checks" 
ON public.system_health_checks 
FOR ALL 
USING (is_master_admin() OR get_current_user_role() = 'admin');