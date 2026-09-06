-- CRITICAL SECURITY FIXES

-- 1. Fix password_reset_otps RLS policies - Remove overly permissive policy and add secure ones
DROP POLICY IF EXISTS "Service role can manage all OTPs" ON public.password_reset_otps;

-- Create proper RLS policies for password_reset_otps
CREATE POLICY "Users can only view their own OTPs"
ON public.password_reset_otps
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND email = password_reset_otps.email
  )
  AND expires_at > now()
  AND used = false
);

CREATE POLICY "Users can insert their own OTPs"
ON public.password_reset_otps  
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND email = password_reset_otps.email
  )
);

CREATE POLICY "Users can update their own OTPs"
ON public.password_reset_otps
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND email = password_reset_otps.email
  )
);

-- System can manage OTPs for legitimate operations
CREATE POLICY "System can manage OTPs"
ON public.password_reset_otps
FOR ALL
USING (
  current_setting('role', true) = 'service_role' OR
  current_setting('jwt.claims.role', true) = 'service_role'
)
WITH CHECK (
  current_setting('role', true) = 'service_role' OR
  current_setting('jwt.claims.role', true) = 'service_role'
);

-- 2. Fix admin_roles infinite recursion by updating the problematic policy
DROP POLICY IF EXISTS "Master admins can manage admin roles" ON public.admin_roles;

-- Create a safer policy that avoids recursion
CREATE POLICY "Master admins can manage admin roles"
ON public.admin_roles
FOR ALL
USING (
  -- Check if current user has master_admin role without causing recursion
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND master_admin = true
  )
);

-- 3. Fix function search paths - Update all functions without proper search_path
CREATE OR REPLACE FUNCTION public.validate_audit_log_insertion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow system actions without user_id
  IF NEW.user_id IS NULL THEN
    -- Only allow system actions or explicitly mark as system
    IF NEW.action NOT LIKE 'system_%' THEN
      NEW.action := 'system_' || NEW.action;
    END IF;
  ELSE
    -- Validate that user_id exists in auth.users if provided
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.user_id) THEN
      -- Log the error but don't fail the insert for system operations
      RAISE WARNING 'Invalid user_id in audit log insertion: %', NEW.user_id;
      NEW.user_id := NULL;
      NEW.action := 'system_' || NEW.action;
    END IF;
  END IF;
  
  -- Auto-populate metadata with insertion context
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.ip_address := COALESCE(NEW.ip_address, inet_client_addr());
  
  RETURN NEW;
END;
$function$;

-- Update other critical functions with proper search paths
CREATE OR REPLACE FUNCTION public.validate_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- 4. Add missing triggers that were detected during the scan
CREATE TRIGGER audit_log_validation_trigger
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_audit_log_insertion();

CREATE TRIGGER profile_security_validation_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_security_fields();

-- 5. Create secure password reset cleanup function
CREATE OR REPLACE FUNCTION public.secure_cleanup_expired_otps()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Only allow cleanup by service role or master admin
  IF NOT (
    current_setting('role', true) = 'service_role' OR
    public.is_master_admin()
  ) THEN
    RAISE EXCEPTION 'Unauthorized cleanup attempt';
  END IF;

  -- Delete expired or used OTPs older than 24 hours
  DELETE FROM public.password_reset_otps 
  WHERE 
    expires_at < now() 
    OR (used = true AND used_at < now() - INTERVAL '24 hours')
    OR created_at < now() - INTERVAL '72 hours';
    
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log cleanup activity
  INSERT INTO public.audit_logs (
    action,
    resource_type,
    details,
    created_at
  ) VALUES (
    'system_password_otp_cleanup',
    'security',
    jsonb_build_object(
      'deleted_count', deleted_count,
      'cleanup_timestamp', now()
    ),
    now()
  );
  
  RETURN deleted_count;
END;
$function$;