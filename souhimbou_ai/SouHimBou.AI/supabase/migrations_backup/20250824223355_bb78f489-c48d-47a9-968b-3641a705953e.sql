-- Security Enhancement Migration Part 2: Enhanced RLS Policies and Audit Functions

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

CREATE POLICY "Users can update own non-sensitive profile data"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND
  -- Prevent updates to sensitive fields by regular users
  (OLD.mfa_backup_codes IS NOT DISTINCT FROM NEW.mfa_backup_codes) AND
  (OLD.emergency_access_codes IS NOT DISTINCT FROM NEW.emergency_access_codes) AND
  (OLD.security_clearance IS NOT DISTINCT FROM NEW.security_clearance) AND
  (OLD.master_admin IS NOT DISTINCT FROM NEW.master_admin)
);

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

-- 4. Create function to sanitize infrastructure data for non-admins
CREATE OR REPLACE FUNCTION public.sanitize_infrastructure_metadata(metadata jsonb, user_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only admins see full infrastructure details
  IF user_role = 'admin' OR is_master_admin() THEN
    RETURN metadata;
  END IF;
  
  -- Return sanitized metadata for non-admins
  RETURN jsonb_build_object(
    'summary', 'Infrastructure details available to authorized personnel only',
    'asset_count', COALESCE(metadata->>'asset_count', 'CLASSIFIED'),
    'last_scan', COALESCE(metadata->>'last_scan', 'CLASSIFIED')
  );
END;
$$;

-- 5. Enhanced RLS for infrastructure tables with data masking
DROP POLICY IF EXISTS "Organization members can manage infrastructure assets" ON public.infrastructure_assets;

CREATE POLICY "Infrastructure data with strict access control"
ON public.infrastructure_assets
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT get_user_organizations()) AND
  (get_current_user_role() = ANY(ARRAY['admin', 'analyst']) OR is_master_admin())
);

CREATE POLICY "Infrastructure assets admin only modifications"
ON public.infrastructure_assets
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (SELECT get_user_organizations()) AND
  (get_current_user_role() = 'admin' OR is_master_admin())
);

CREATE POLICY "Infrastructure assets admin only updates"
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

CREATE POLICY "Infrastructure assets admin only deletes"
ON public.infrastructure_assets
FOR DELETE
TO authenticated
USING (
  organization_id IN (SELECT get_user_organizations()) AND
  (get_current_user_role() = 'admin' OR is_master_admin())
);

-- 6. Enhanced RLS for network monitoring with restricted access
DROP POLICY IF EXISTS "Organization members can view network monitoring data" ON public.network_monitoring;
DROP POLICY IF EXISTS "Admins can manage network monitoring" ON public.network_monitoring;

CREATE POLICY "Network monitoring ultra restricted access"
ON public.network_monitoring
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT get_user_organizations()) AND
  (get_current_user_role() = 'admin' OR is_master_admin())
);

CREATE POLICY "Network monitoring admin only modifications"
ON public.network_monitoring
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (SELECT get_user_organizations()) AND
  (get_current_user_role() = 'admin' OR is_master_admin())
);

-- 7. Create audit function for sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access_v2(
  table_name text, 
  operation text, 
  classification text DEFAULT 'SENSITIVE'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    action,
    resource_type,
    details,
    ip_address,
    created_at
  ) VALUES (
    'sensitive_data_access_v2',
    table_name,
    jsonb_build_object(
      'operation', operation,
      'classification', classification,
      'user_id', auth.uid(),
      'user_role', get_current_user_role(),
      'is_master_admin', is_master_admin(),
      'access_time', now(),
      'security_level', 'HIGH_SENSITIVITY'
    ),
    inet_client_addr(),
    now()
  );
END;
$$;

-- 8. Add trigger function to log modifications to sensitive tables (INSERT/UPDATE/DELETE only)
CREATE OR REPLACE FUNCTION public.audit_sensitive_modifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log modifications to sensitive tables
  PERFORM log_sensitive_data_access_v2(TG_TABLE_NAME, TG_OP, 'HIGH');
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Apply audit triggers to sensitive tables (modifications only)
DROP TRIGGER IF EXISTS audit_profiles_modifications ON public.profiles;
CREATE TRIGGER audit_profiles_modifications
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_modifications();

DROP TRIGGER IF EXISTS audit_notifications_modifications ON public.notifications;
CREATE TRIGGER audit_notifications_modifications
  AFTER INSERT OR UPDATE OR DELETE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_modifications();

-- 9. Create emergency data wipe function (for GDPR compliance)
CREATE OR REPLACE FUNCTION public.emergency_wipe_user_pii(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only master admins can perform emergency wipes
  IF NOT is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only master admins can perform emergency data wipes';
  END IF;
  
  -- Log the emergency action
  PERFORM log_sensitive_data_access_v2('emergency_wipe', 'DELETE', 'CRITICAL');
  
  -- Wipe PII from profiles
  UPDATE public.profiles 
  SET 
    full_name = 'WIPED_' || extract(epoch from now())::text,
    mfa_backup_codes = NULL,
    emergency_access_codes = NULL,
    trusted_devices = '[]'::jsonb
  WHERE user_id = target_user_id;
  
  -- Wipe notification PII
  UPDATE public.notifications 
  SET 
    recipient_email = 'wiped@privacy.local',
    recipient_phone = NULL,
    message_content = jsonb_build_object('status', 'DATA_WIPED_FOR_PRIVACY')
  WHERE recipient_id = target_user_id;
  
  RETURN true;
END;
$$;

-- 10. Create function to get secured financial data
CREATE OR REPLACE FUNCTION public.get_secured_financial_data(proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only master admins can see financial data
  IF NOT is_master_admin() THEN
    RETURN jsonb_build_object('error', 'Access denied: Financial data requires master admin privileges');
  END IF;
  
  -- Log financial data access
  PERFORM log_sensitive_data_access_v2('partnership_proposals', 'FINANCIAL_DATA_ACCESS', 'CRITICAL');
  
  SELECT jsonb_build_object(
    'value_estimate', value_estimate,
    'proposal_id', id,
    'accessed_at', now()
  ) INTO result
  FROM public.partnership_proposals
  WHERE id = proposal_id;
  
  RETURN result;
END;
$$;