-- Create security clearance utility functions
CREATE OR REPLACE FUNCTION public.get_user_security_clearance(user_uuid uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(security_clearance, 'UNCLASSIFIED') 
  FROM public.profiles 
  WHERE user_id = user_uuid;
$$;

-- Create function to check if user meets minimum security clearance
CREATE OR REPLACE FUNCTION public.meets_security_clearance(required_level text, user_uuid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN is_master_admin() THEN true
    WHEN required_level = 'UNCLASSIFIED' THEN true
    WHEN required_level = 'CONFIDENTIAL' THEN 
      get_user_security_clearance(user_uuid) IN ('CONFIDENTIAL', 'SECRET', 'TOP_SECRET')
    WHEN required_level = 'SECRET' THEN 
      get_user_security_clearance(user_uuid) IN ('SECRET', 'TOP_SECRET')
    WHEN required_level = 'TOP_SECRET' THEN 
      get_user_security_clearance(user_uuid) = 'TOP_SECRET'
    ELSE false
  END;
$$;

-- Create function to log security clearance access attempts
CREATE OR REPLACE FUNCTION public.log_clearance_access(resource_type text, resource_id text, required_clearance text, access_granted boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
    'security_clearance_access',
    resource_type,
    resource_id,
    jsonb_build_object(
      'required_clearance', required_clearance,
      'user_clearance', get_user_security_clearance(auth.uid()),
      'access_granted', access_granted,
      'timestamp', now()
    ),
    inet_client_addr(),
    now()
  );
END;
$$;

-- Update has_security_clearance function to use the new logic
CREATE OR REPLACE FUNCTION public.has_security_clearance(required_level text DEFAULT 'SECRET'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT meets_security_clearance(required_level, auth.uid());
$$;

-- Create security clearance audit trigger
CREATE OR REPLACE FUNCTION public.audit_security_clearance_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Log security clearance changes
  IF OLD.security_clearance IS DISTINCT FROM NEW.security_clearance THEN
    PERFORM log_security_event_enhanced(
      'security_clearance_change',
      'HIGH',
      jsonb_build_object(
        'old_clearance', OLD.security_clearance,
        'new_clearance', NEW.security_clearance,
        'target_user', NEW.user_id,
        'changed_by', auth.uid()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger for security clearance changes
DROP TRIGGER IF EXISTS audit_security_clearance_changes_trigger ON public.profiles;
CREATE TRIGGER audit_security_clearance_changes_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_security_clearance_changes();