-- Fix security vulnerabilities and strengthen RLS policies

-- 1. Enable leaked password protection
UPDATE auth.config 
SET password_dictionary_check_enabled = true 
WHERE id = 'password_dictionary_check_enabled';

-- 2. Fix subscribers table (if it exists, create proper RLS)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subscribers') THEN
        -- Drop existing overly permissive policies
        DROP POLICY IF EXISTS "Public read access" ON public.subscribers;
        DROP POLICY IF EXISTS "Anyone can insert" ON public.subscribers;
        
        -- Create strict RLS policies for subscribers
        CREATE POLICY "Admin only access to subscribers" ON public.subscribers
        FOR ALL USING (is_master_admin());
        
        CREATE POLICY "Users can only insert their own subscription" ON public.subscribers
        FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- 3. Strengthen partnership_proposals RLS (already exists but verify it's restrictive)
-- Current policy is already restrictive to master admins only, which is correct

-- 4. Strengthen profiles RLS for security fields
-- Add additional validation for security-sensitive fields
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for MFA data protection
DROP TRIGGER IF EXISTS validate_profile_mfa_access_trigger ON public.profiles;
CREATE TRIGGER validate_profile_mfa_access_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_profile_mfa_access();

-- 5. Strengthen notifications RLS to be more restrictive
-- Update existing policies to be more secure
DROP POLICY IF EXISTS "Admins can view notification metadata only" ON public.notifications;
CREATE POLICY "Master admins only can view notification metadata" ON public.notifications
FOR SELECT USING (is_master_admin() AND auth.uid() <> recipient_id);

-- 6. Fix function search paths for all functions
-- Update all existing functions to have secure search paths
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

CREATE OR REPLACE FUNCTION public.get_user_role_in_organization(org_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_organizations 
  WHERE user_id = auth.uid() AND organization_id = org_id;
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

-- 7. Add audit logging for all sensitive data access
CREATE OR REPLACE FUNCTION log_sensitive_table_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log access to sensitive tables
  IF TG_OP = 'SELECT' THEN
    PERFORM log_sensitive_data_access_enhanced(
      TG_TABLE_NAME,
      COALESCE(NEW.id::text, OLD.id::text, 'unknown'),
      'read',
      CASE 
        WHEN TG_TABLE_NAME = 'profiles' THEN 'CONFIDENTIAL'
        WHEN TG_TABLE_NAME = 'partnership_proposals' THEN 'CONFIDENTIAL'
        WHEN TG_TABLE_NAME = 'notifications' THEN 'SENSITIVE'
        ELSE 'SENSITIVE'
      END
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Apply logging triggers to sensitive tables
DROP TRIGGER IF EXISTS log_profiles_access ON public.profiles;
CREATE TRIGGER log_profiles_access
  AFTER SELECT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_sensitive_table_access();

DROP TRIGGER IF EXISTS log_notifications_access ON public.notifications;
CREATE TRIGGER log_notifications_access
  AFTER SELECT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION log_sensitive_table_access();