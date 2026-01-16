-- Fix remaining security issues: Security Definer views and function search path

-- 1. Fix the function search path issue
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- 2. Convert Security Definer views to Security Invoker or regular views
-- Drop existing security definer views and recreate them as regular views

-- Drop the security definer views
DROP VIEW IF EXISTS public.usage_costs_summary;
DROP VIEW IF EXISTS public.profiles_secure;
DROP VIEW IF EXISTS public.notifications_secure;
DROP VIEW IF EXISTS public.partnership_proposals_secure;

-- Recreate as regular views (SECURITY INVOKER by default)
CREATE VIEW public.usage_costs_summary AS
SELECT 
  organization_id,
  date_trunc('month', created_at) as billing_month,
  resource_type,
  sum(quantity * cost_per_unit) as total_cost,
  sum(quantity) as total_quantity,
  count(*) as usage_events
FROM public.resource_usage
GROUP BY organization_id, date_trunc('month', created_at), resource_type;

-- Enable RLS on the view (inherits from underlying tables)
ALTER VIEW public.usage_costs_summary SET (security_invoker = true);

-- Create profiles secure view with proper data masking
CREATE VIEW public.profiles_secure AS
SELECT 
  user_id,
  username,
  full_name,
  CASE 
    WHEN public.can_view_full_pii() THEN email
    ELSE public.mask_email(email)
  END as email,
  CASE 
    WHEN public.can_view_full_pii() THEN phone
    ELSE public.mask_phone(phone)
  END as phone,
  role,
  security_clearance,
  created_at,
  updated_at,
  last_active_at,
  plan_type,
  trial_starts_at,
  trial_ends_at,
  is_trial_active,
  -- Sensitive fields only for authorized users
  CASE 
    WHEN public.can_view_full_pii() THEN mfa_enabled
    ELSE NULL
  END as mfa_enabled,
  master_admin
FROM public.profiles;

ALTER VIEW public.profiles_secure SET (security_invoker = true);

-- Create notifications secure view
CREATE VIEW public.notifications_secure AS
SELECT 
  id,
  alert_id,
  recipient_email,
  CASE 
    WHEN public.can_view_full_pii() THEN recipient_phone
    ELSE public.mask_phone(recipient_phone)
  END as recipient_phone,
  channel,
  status,
  sent_at,
  delivered_at,
  created_at,
  -- Remove sensitive message content for non-privileged users
  CASE 
    WHEN public.can_view_full_pii() THEN message_content
    ELSE jsonb_build_object('type', 'redacted', 'message', 'Content hidden for security')
  END as message_content,
  external_id,
  data_classification
FROM public.notifications;

ALTER VIEW public.notifications_secure SET (security_invoker = true);

-- Create partnership proposals secure view
CREATE VIEW public.partnership_proposals_secure AS
SELECT 
  id,
  organization_id,
  proposal_type,
  title,
  description,
  status,
  priority,
  submitted_by,
  submitted_at,
  reviewed_by,
  reviewed_at,
  approved_at,
  rejected_at,
  rejection_reason,
  created_at,
  updated_at,
  -- Remove sensitive contact details for non-privileged users
  CASE 
    WHEN public.can_view_full_pii() THEN contact_details
    ELSE jsonb_build_object('type', 'redacted', 'message', 'Contact details hidden')
  END as contact_details,
  requirements,
  expected_outcomes
FROM public.partnership_proposals;

ALTER VIEW public.partnership_proposals_secure SET (security_invoker = true);

-- 3. Create RLS policies for the views where needed
-- Note: Views inherit RLS from their underlying tables, but we can add explicit policies

-- Create policy for usage_costs_summary view
CREATE POLICY "Organization members can view usage costs"
ON public.usage_costs_summary
FOR SELECT
USING (
  organization_id IN (SELECT get_user_organizations()) 
  AND (get_current_user_role() IN ('admin', 'analyst') OR is_master_admin())
);

-- Create policy for profiles_secure view  
CREATE POLICY "Users can view secure profiles with appropriate access"
ON public.profiles_secure
FOR SELECT
USING (
  user_id = auth.uid() OR 
  get_current_user_role() = 'admin' OR 
  is_master_admin()
);

-- Create policy for notifications_secure view
CREATE POLICY "Users can view their notifications securely"
ON public.notifications_secure  
FOR SELECT
USING (
  recipient_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid()) OR
  get_current_user_role() = 'admin' OR 
  is_master_admin()
);

-- Create policy for partnership_proposals_secure view
CREATE POLICY "Organization members can view partnership proposals securely"
ON public.partnership_proposals_secure
FOR SELECT  
USING (
  organization_id IN (SELECT get_user_organizations()) 
  AND (get_current_user_role() IN ('admin', 'analyst') OR is_master_admin())
);