-- Fix audit logs security vulnerability
-- Create a secure audit logging system that prevents unauthorized insertions

-- First, create a function that validates audit log insertions
CREATE OR REPLACE FUNCTION public.validate_audit_log_insertion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only allow insertions from authenticated users or system processes
  -- System processes should have a valid user_id or be explicitly marked as system
  IF NEW.user_id IS NULL AND NEW.action NOT LIKE 'system_%' THEN
    RAISE EXCEPTION 'Audit log insertions must have a valid user_id or be system actions';
  END IF;
  
  -- Validate that user_id exists in auth.users if provided
  IF NEW.user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.user_id) THEN
      RAISE EXCEPTION 'Invalid user_id in audit log insertion';
    END IF;
  END IF;
  
  -- Ensure system actions are properly marked
  IF NEW.user_id IS NULL AND NEW.action NOT LIKE 'system_%' THEN
    NEW.action := 'system_' || NEW.action;
  END IF;
  
  -- Auto-populate metadata with insertion context
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.ip_address := COALESCE(NEW.ip_address, inet_client_addr());
  
  RETURN NEW;
END;
$$;

-- Create the trigger to validate audit log insertions
DROP TRIGGER IF EXISTS validate_audit_log_trigger ON public.audit_logs;
CREATE TRIGGER validate_audit_log_trigger
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_audit_log_insertion();

-- Update RLS policies for audit_logs to be more restrictive
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Only authenticated users can insert their own audit logs
CREATE POLICY "Users can insert their own audit logs" 
  ON public.audit_logs 
  FOR INSERT 
  WITH CHECK (
    auth.uid() IS NOT NULL AND 
    (user_id = auth.uid() OR user_id IS NULL)
  );

-- System functions can insert audit logs (for automated processes)
CREATE POLICY "System functions can insert audit logs" 
  ON public.audit_logs 
  FOR INSERT 
  WITH CHECK (
    -- Allow insertions from security definer functions
    current_setting('role', true) = 'postgres' OR
    -- Allow insertions with explicit system actions
    action LIKE 'system_%'
  );

-- Create a secure function for system audit logging
CREATE OR REPLACE FUNCTION public.log_system_audit(
  p_action text,
  p_resource_type text DEFAULT NULL,
  p_resource_id text DEFAULT NULL,
  p_details jsonb DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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
    p_user_id,
    'system_' || p_action,
    p_resource_type,
    p_resource_id,
    COALESCE(p_details, '{}'::jsonb),
    inet_client_addr(),
    now()
  );
END;
$$;