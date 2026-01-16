-- Security Enhancement Migration Part 2: Enhanced RLS Policies (Simplified)

-- 1. Enhanced RLS policies for profiles table
DROP POLICY IF EXISTS "Users can update own basic profile data" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profile data" ON public.profiles;

-- Ultra-restrictive policies for profiles
CREATE POLICY "Users can view own basic profile only"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id OR 
  (is_master_admin() AND get_current_user_role() = 'admin')
);

CREATE POLICY "Users can update own basic profile data only"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Enhanced RLS for notifications with stricter PII protection
DROP POLICY IF EXISTS "Users can view own notifications only" ON public.notifications;
DROP POLICY IF EXISTS "Master admins can view notification metadata" ON public.notifications;

CREATE POLICY "Ultra restrictive notification access"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  auth.uid() = recipient_id OR 
  (is_master_admin() AND get_current_user_role() = 'admin')
);

-- 3. Enhanced RLS for partnership proposals - financial data protection
DROP POLICY IF EXISTS "Master admin can manage partnership proposals" ON public.partnership_proposals;

CREATE POLICY "Ultra restrictive partnership proposal access"
ON public.partnership_proposals
FOR ALL
TO authenticated
USING (is_master_admin())
WITH CHECK (is_master_admin());

-- 4. Enhanced RLS for infrastructure tables
DROP POLICY IF EXISTS "Organization members can manage infrastructure assets" ON public.infrastructure_assets;

CREATE POLICY "Infrastructure data admin access only"
ON public.infrastructure_assets
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT get_user_organizations()) AND
  (get_current_user_role() = 'admin' OR is_master_admin())
);

CREATE POLICY "Infrastructure assets admin modifications only"
ON public.infrastructure_assets
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (SELECT get_user_organizations()) AND
  (get_current_user_role() = 'admin' OR is_master_admin())
);

CREATE POLICY "Infrastructure assets admin updates only"
ON public.infrastructure_assets
FOR UPDATE
TO authenticated
USING (
  organization_id IN (SELECT get_user_organizations()) AND
  (get_current_user_role() = 'admin' OR is_master_admin())
)
WITH CHECK (
  organization_id IN (SELECT get_user_organizations()) AND
  (get_current_user_role() = 'admin' OR is_master_admin())
);

CREATE POLICY "Infrastructure assets admin deletes only"
ON public.infrastructure_assets
FOR DELETE
TO authenticated
USING (
  organization_id IN (SELECT get_user_organizations()) AND
  (get_current_user_role() = 'admin' OR is_master_admin())
);

-- 5. Enhanced RLS for network monitoring with restricted access
DROP POLICY IF EXISTS "Organization members can view network monitoring data" ON public.network_monitoring;
DROP POLICY IF EXISTS "Admins can manage network monitoring" ON public.network_monitoring;

CREATE POLICY "Network monitoring admin only access"
ON public.network_monitoring
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT get_user_organizations()) AND
  (get_current_user_role() = 'admin' OR is_master_admin())
);

CREATE POLICY "Network monitoring admin only inserts"
ON public.network_monitoring
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (SELECT get_user_organizations()) AND
  (get_current_user_role() = 'admin' OR is_master_admin())
);

-- 6. Create additional security function for profile validation
CREATE OR REPLACE FUNCTION public.validate_profile_security_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Prevent regular users from modifying sensitive fields
  IF NOT (is_master_admin() OR get_current_user_role() = 'admin') THEN
    -- Keep sensitive fields unchanged for non-admins
    NEW.mfa_backup_codes := OLD.mfa_backup_codes;
    NEW.emergency_access_codes := OLD.emergency_access_codes;
    NEW.security_clearance := OLD.security_clearance;
    NEW.master_admin := OLD.master_admin;
  END IF;
  
  -- Log sensitive field modification attempts
  IF OLD.mfa_backup_codes IS DISTINCT FROM NEW.mfa_backup_codes OR
     OLD.emergency_access_codes IS DISTINCT FROM NEW.emergency_access_codes OR
     OLD.security_clearance IS DISTINCT FROM NEW.security_clearance OR
     OLD.master_admin IS DISTINCT FROM NEW.master_admin THEN
    
    PERFORM log_sensitive_data_access_v2('profiles', 'SENSITIVE_FIELD_UPDATE', 'HIGH');
  END IF;

  RETURN NEW;
END;
$$;

-- Apply security validation trigger to profiles
DROP TRIGGER IF EXISTS validate_profile_security ON public.profiles;
CREATE TRIGGER validate_profile_security
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION validate_profile_security_update();