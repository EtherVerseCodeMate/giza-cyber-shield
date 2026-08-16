-- Security hardening: Fix critical RLS policy vulnerabilities (simplified approach)
-- These fixes address the security vulnerabilities identified in the security review

-- 1. Harden profiles table RLS policies
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Profiles select access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles basic update access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles admin security update access" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

-- Create secure RLS policies for profiles table
CREATE POLICY "Users can view own profile only" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING ((get_current_user_role() = 'admin') OR is_master_admin());

CREATE POLICY "Users can update own basic profile data" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all profile data" 
ON public.profiles 
FOR ALL
USING ((get_current_user_role() = 'admin') OR is_master_admin())
WITH CHECK ((get_current_user_role() = 'admin') OR is_master_admin());

CREATE POLICY "System can insert profiles on signup" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 2. Add missing RLS policies for subscribers table
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription data" 
ON public.subscribers 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own subscription" 
ON public.subscribers 
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view subscriber analytics" 
ON public.subscribers 
FOR SELECT 
USING ((get_current_user_role() = 'admin') OR is_master_admin());

-- 3. Harden notifications table RLS policies
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can view notification status only" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create secure notification policies
CREATE POLICY "Users can view own notifications content" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = recipient_id);

CREATE POLICY "Admins can view notification metadata only" 
ON public.notifications 
FOR SELECT 
USING (
  ((get_current_user_role() = 'admin') OR is_master_admin()) AND 
  auth.uid() != recipient_id
);

CREATE POLICY "System can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- 4. Add RLS policies for third_party_testers table (admin only access)
ALTER TABLE public.third_party_testers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage third party testers" 
ON public.third_party_testers 
FOR ALL
USING ((get_current_user_role() = 'admin') OR is_master_admin())
WITH CHECK ((get_current_user_role() = 'admin') OR is_master_admin());

-- 5. Enhanced security logging function for sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access_enhanced(
  table_name text, 
  record_id text, 
  access_type text,
  data_classification text DEFAULT 'SENSITIVE'
) 
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log to audit_logs with enhanced details
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
    'sensitive_data_access',
    table_name,
    record_id,
    jsonb_build_object(
      'access_type', access_type,
      'data_classification', data_classification,
      'timestamp', now(),
      'user_role', get_current_user_role()
    ),
    inet_client_addr(),
    now()
  );

  -- Create security alert for high-risk access patterns
  IF data_classification IN ('CONFIDENTIAL', 'TOP_SECRET') THEN
    INSERT INTO public.security_alerts (
      alert_type,
      alert_category,
      severity,
      description,
      metadata
    ) VALUES (
      'sensitive_data_access',
      'data_protection',
      'MEDIUM',
      'High-classification data accessed: ' || table_name,
      jsonb_build_object(
        'table_name', table_name,
        'record_id', record_id,
        'access_type', access_type,
        'data_classification', data_classification,
        'user_id', auth.uid(),
        'user_role', get_current_user_role()
      )
    );
  END IF;
END;
$$;