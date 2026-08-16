-- Phase 1: Critical Data Protection - Fix exposed sensitive data
-- Fix subscribers table exposure
DROP POLICY IF EXISTS "Public can view active subscribers" ON public.subscribers;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscribers;

-- Create restrictive policies for subscribers table
CREATE POLICY "Users can view only their own subscription data" 
  ON public.subscribers 
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL AND 
    user_id = auth.uid()
  );

CREATE POLICY "Users can insert their own subscription data" 
  ON public.subscribers 
  FOR INSERT 
  WITH CHECK (
    auth.uid() IS NOT NULL AND 
    user_id = auth.uid()
  );

CREATE POLICY "Users can update their own subscription data" 
  ON public.subscribers 
  FOR UPDATE 
  USING (
    auth.uid() IS NOT NULL AND 
    user_id = auth.uid()
  );

-- Fix notifications table - restrict phone/email access
DROP POLICY IF EXISTS "Notifications select access" ON public.notifications;

CREATE POLICY "Users can view their own notifications" 
  ON public.notifications 
  FOR SELECT 
  USING (
    auth.uid() IS NOT NULL AND 
    recipient_id = auth.uid()
  );

CREATE POLICY "Admins can view notification metadata only" 
  ON public.notifications 
  FOR SELECT 
  USING (
    (get_current_user_role() = 'admin' OR is_master_admin()) AND
    -- Exclude sensitive contact fields from admin access
    recipient_email IS NULL AND recipient_phone IS NULL
  );

-- Create sanitized view for admin access to notifications without PII
CREATE OR REPLACE VIEW public.notifications_admin AS 
SELECT 
  id,
  alert_id,
  channel,
  status,
  created_at,
  sent_at,
  delivered_at,
  error_message,
  external_id,
  message_content,
  -- Mask recipient details for admin view
  CASE WHEN recipient_id IS NOT NULL THEN '[MASKED]' ELSE NULL END as recipient_info
FROM public.notifications;

-- Grant access to the sanitized view for admins
GRANT SELECT ON public.notifications_admin TO authenticated;

-- Create RLS policy for the admin view
CREATE POLICY "Admins can view sanitized notifications" 
  ON public.notifications_admin 
  FOR SELECT 
  USING (
    get_current_user_role() = 'admin' OR is_master_admin()
  );

-- Add data classification columns to sensitive tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_classification TEXT DEFAULT 'SENSITIVE';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data_classification TEXT DEFAULT 'PII';
ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS data_classification TEXT DEFAULT 'PII';
ALTER TABLE public.partnership_proposals ADD COLUMN IF NOT EXISTS data_classification TEXT DEFAULT 'CONFIDENTIAL';

-- Create function to log sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  table_name text,
  record_id text,
  access_type text
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
    auth.uid(),
    'sensitive_data_access',
    table_name,
    record_id,
    jsonb_build_object(
      'access_type', access_type,
      'timestamp', now(),
      'user_role', (SELECT role FROM public.profiles WHERE user_id = auth.uid())
    ),
    inet_client_addr(),
    now()
  );
END;
$$;