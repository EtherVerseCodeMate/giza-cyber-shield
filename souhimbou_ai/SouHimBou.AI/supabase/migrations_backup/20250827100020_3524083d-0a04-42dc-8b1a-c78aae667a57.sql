-- Fix Security Linter Warning #4: Function Search Path Mutable
-- Update existing functions to have proper search_path settings

-- First, let's update functions that don't have proper search_path
DROP FUNCTION IF EXISTS public.cleanup_expired_password_reset_otps();

CREATE OR REPLACE FUNCTION public.cleanup_expired_password_reset_otps()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired or used OTPs older than 24 hours
  DELETE FROM public.password_reset_otps 
  WHERE 
    expires_at < now() 
    OR (used = true AND used_at < now() - INTERVAL '24 hours')
    OR created_at < now() - INTERVAL '72 hours'; -- Safety cleanup for very old records
    
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
$$;

-- Update more functions with proper search_path
CREATE OR REPLACE FUNCTION public.log_security_event_enhanced(
  event_type TEXT,
  severity TEXT DEFAULT 'MEDIUM',
  details JSONB DEFAULT '{}',
  user_context JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  event_id UUID;
BEGIN
  -- Insert enhanced security event
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    details,
    ip_address,
    created_at
  ) VALUES (
    auth.uid(),
    'security_event_' || event_type,
    'security',
    jsonb_build_object(
      'event_type', event_type,
      'severity', severity,
      'details', details,
      'user_context', user_context,
      'timestamp', now(),
      'session_info', jsonb_build_object(
        'user_agent', current_setting('request.headers', true)::json->>'user-agent',
        'ip_address', inet_client_addr()
      )
    ),
    inet_client_addr(),
    now()
  ) RETURNING id INTO event_id;
  
  -- Create high-severity alert if needed
  IF severity IN ('HIGH', 'CRITICAL') THEN
    INSERT INTO public.security_alerts (
      alert_type,
      alert_category,
      severity,
      description,
      metadata
    ) VALUES (
      event_type,
      'security_event',
      severity,
      'High-severity security event: ' || event_type,
      jsonb_build_object(
        'event_id', event_id,
        'user_id', auth.uid(),
        'details', details,
        'auto_generated', true
      )
    );
  END IF;
  
  RETURN event_id;
END;
$$;

-- Update validate_audit_log_insertion_fixed to have proper search_path
CREATE OR REPLACE FUNCTION public.validate_audit_log_insertion_fixed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;