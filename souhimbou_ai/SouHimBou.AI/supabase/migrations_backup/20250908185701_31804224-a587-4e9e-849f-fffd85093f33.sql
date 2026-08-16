-- Phase 2: Database Security Hardening

-- 1. Ensure all views use SECURITY INVOKER (not DEFINER)
-- Let's recreate the secure views to ensure they don't have any security definer properties

-- Drop and recreate notifications_secure view with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public.notifications_secure;
CREATE VIEW public.notifications_secure 
WITH (security_invoker = true) AS
SELECT 
  notifications.id,
  notifications.alert_id,
  notifications.recipient_id,
  CASE
    WHEN can_view_full_pii() THEN notifications.recipient_email
    ELSE mask_email(notifications.recipient_email)
  END AS recipient_email,
  CASE
    WHEN can_view_full_pii() THEN notifications.recipient_phone
    ELSE mask_phone(notifications.recipient_phone)
  END AS recipient_phone,
  notifications.channel,
  notifications.status,
  CASE
    WHEN (auth.uid() = notifications.recipient_id OR can_view_full_pii()) THEN notifications.message_content
    ELSE jsonb_build_object('status', 'MESSAGE_REDACTED_FOR_PRIVACY')
  END AS message_content,
  notifications.sent_at,
  notifications.delivered_at,
  notifications.created_at,
  notifications.error_message,
  notifications.external_id
FROM notifications;

-- Drop and recreate profiles_secure view with explicit SECURITY INVOKER  
DROP VIEW IF EXISTS public.profiles_secure;
CREATE VIEW public.profiles_secure 
WITH (security_invoker = true) AS
SELECT 
  profiles.id,
  profiles.user_id,
  profiles.username,
  CASE
    WHEN (auth.uid() = profiles.user_id OR can_view_full_pii()) THEN profiles.full_name
    ELSE 'REDACTED'::text
  END AS full_name,
  CASE
    WHEN (auth.uid() = profiles.user_id OR can_view_full_pii()) THEN profiles.department
    ELSE 'REDACTED'::text
  END AS department,
  CASE
    WHEN can_view_full_pii() THEN profiles.security_clearance
    ELSE 'CLASSIFIED'::text
  END AS security_clearance,
  profiles.role,
  profiles.created_at,
  profiles.updated_at,
  profiles.master_admin,
  profiles.mfa_enabled,
  CASE
    WHEN (auth.uid() = profiles.user_id) THEN 'MFA_CONFIGURED'::text
    ELSE 'HIDDEN'::text
  END AS mfa_status,
  profiles.plan_type,
  profiles.trial_starts_at,
  profiles.trial_ends_at,
  profiles.is_trial_active
FROM profiles;

-- Drop and recreate usage_costs_summary view with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public.usage_costs_summary;
CREATE VIEW public.usage_costs_summary 
WITH (security_invoker = true) AS
SELECT 
  r.organization_id,
  r.billing_period,
  r.resource_type,
  sum(r.quantity) AS total_quantity,
  r.unit,
  avg(r.cost_per_unit) AS avg_cost_per_unit,
  sum(r.total_cost) AS total_cost,
  count(*) AS usage_events
FROM resource_usage r
GROUP BY r.organization_id, r.billing_period, r.resource_type, r.unit;

-- 2. Add additional audit logging for sensitive operations
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access_v2(
  table_name text, 
  access_type text,
  classification text DEFAULT 'SENSITIVE'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    details,
    ip_address,
    created_at
  ) VALUES (
    auth.uid(),
    'sensitive_data_access_v2',
    table_name,
    jsonb_build_object(
      'access_type', access_type,
      'classification', classification,
      'timestamp', now(),
      'user_role', get_current_user_role(),
      'session_context', jsonb_build_object(
        'user_agent', current_setting('request.headers', true)::json->>'user-agent',
        'ip_address', inet_client_addr()
      )
    ),
    inet_client_addr(),
    now()
  );
END;
$$;

-- 3. Create function for secure data encryption key rotation
CREATE OR REPLACE FUNCTION public.rotate_encryption_keys()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rotation_count INTEGER := 0;
BEGIN
  -- Only master admins can rotate keys
  IF NOT is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only master admins can rotate encryption keys';
  END IF;
  
  -- Log the key rotation attempt
  PERFORM log_sensitive_data_access_v2('encryption_keys', 'KEY_ROTATION', 'TOP_SECRET');
  
  -- In a real implementation, this would rotate actual encryption keys
  -- For now, we'll just log the operation
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    details,
    created_at
  ) VALUES (
    auth.uid(),
    'system_encryption_key_rotation',
    'security',
    jsonb_build_object(
      'rotation_timestamp', now(),
      'rotation_type', 'manual',
      'security_level', 'maximum'
    ),
    now()
  );
  
  RETURN true;
END;
$$;