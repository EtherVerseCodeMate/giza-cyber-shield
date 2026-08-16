-- Fix RLS policies and add session security table

-- 1. Add session security validation table
CREATE TABLE IF NOT EXISTS public.session_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  risk_level text NOT NULL DEFAULT 'low',
  device_fingerprint text,
  ip_address inet,
  user_agent text,
  details jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on session security events
ALTER TABLE public.session_security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session security events" 
ON public.session_security_events 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert session security events" 
ON public.session_security_events 
FOR INSERT 
WITH CHECK (true);

-- 2. Function to log session security events
CREATE OR REPLACE FUNCTION public.log_session_security_event(
  p_event_type text,
  p_risk_level text DEFAULT 'low',
  p_device_fingerprint text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.session_security_events (
    user_id,
    event_type,
    risk_level,
    device_fingerprint,
    ip_address,
    user_agent,
    details
  ) VALUES (
    auth.uid(),
    p_event_type,
    p_risk_level,
    p_device_fingerprint,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent',
    p_details
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail if logging fails
    NULL;
END;
$function$;

-- 3. Strengthen notifications table RLS
DROP POLICY IF EXISTS "Users can view own notifications content" ON public.notifications;
DROP POLICY IF EXISTS "Master admins only can view notification metadata" ON public.notifications;

CREATE POLICY "Users can view own notifications only" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = recipient_id);

CREATE POLICY "Master admins can view notification metadata" 
ON public.notifications 
FOR SELECT 
USING (public.is_master_admin());

-- 4. Fix audit logs validation trigger
DROP TRIGGER IF EXISTS validate_audit_log_trigger ON public.audit_logs;
CREATE OR REPLACE FUNCTION public.validate_audit_log_insertion_fixed()
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

CREATE TRIGGER validate_audit_log_trigger
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_audit_log_insertion_fixed();