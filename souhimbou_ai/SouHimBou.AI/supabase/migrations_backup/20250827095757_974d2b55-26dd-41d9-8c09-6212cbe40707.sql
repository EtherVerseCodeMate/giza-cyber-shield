-- Critical Security Fix #1: Fix Password Reset OTP Exposure
-- Remove existing overly permissive policy and replace with secure user-specific access

DROP POLICY IF EXISTS "Users can view their own password reset OTPs" ON public.password_reset_otps;
DROP POLICY IF EXISTS "System can insert password reset OTPs" ON public.password_reset_otps;

-- Create secure RLS policy for password reset OTPs - users can only access their own OTPs
CREATE POLICY "Users can view only their own password reset OTPs" 
ON public.password_reset_otps 
FOR SELECT 
USING (auth.uid() = user_id);

-- System can insert OTPs (for edge functions)
CREATE POLICY "System can insert password reset OTPs" 
ON public.password_reset_otps 
FOR INSERT 
WITH CHECK (true);

-- Critical Security Fix #2: Remove hardcoded master admin and implement proper role system
-- Create admin_roles table for secure role management
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_type TEXT NOT NULL CHECK (role_type IN ('master_admin', 'system_admin', 'security_admin')),
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_type)
);

-- Enable RLS on admin_roles
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- Only master admins can manage admin roles
CREATE POLICY "Master admins can manage admin roles" 
ON public.admin_roles 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.admin_roles ar 
    WHERE ar.user_id = auth.uid() 
    AND ar.role_type = 'master_admin' 
    AND ar.is_active = true 
    AND (ar.expires_at IS NULL OR ar.expires_at > now())
  )
);

-- Users can view their own admin roles
CREATE POLICY "Users can view their own admin roles" 
ON public.admin_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create secure function to check admin roles
CREATE OR REPLACE FUNCTION public.has_admin_role(role_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles 
    WHERE user_id = auth.uid() 
    AND role_type = role_name 
    AND is_active = true 
    AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- Update the is_master_admin function to use the new role system
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- First check new role system
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.admin_roles 
      WHERE user_id = auth.uid() 
      AND role_type = 'master_admin' 
      AND is_active = true 
      AND (expires_at IS NULL OR expires_at > now())
    ) THEN true
    -- Fallback to profiles table for backward compatibility (temporary)
    WHEN EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND master_admin = true
    ) THEN true
    ELSE false
  END;
$$;

-- Medium Priority Fix #3: Secure Integration Library Access
-- Update RLS policy to require authentication for integration library
DROP POLICY IF EXISTS "Integration library is publicly readable" ON public.integrations_library;

CREATE POLICY "Authenticated users can view integration library" 
ON public.integrations_library 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Medium Priority Fix #4: Add comprehensive password reset OTP cleanup
-- Function to cleanup expired OTPs (enhanced version)
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

-- Medium Priority Fix #5: Enhanced audit logging for sensitive operations
-- Create function for enhanced security event logging
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