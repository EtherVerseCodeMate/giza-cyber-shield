-- Fix subscribers table RLS policies to prevent customer data exposure
-- This addresses the security finding: Customer Email Addresses and Payment Data Exposed

-- Drop all existing policies on subscribers table
DROP POLICY IF EXISTS "Users can view only their own subscription data" ON public.subscribers;
DROP POLICY IF EXISTS "Users can update their own subscription data" ON public.subscribers;
DROP POLICY IF EXISTS "Users can insert their own subscription data" ON public.subscribers;
DROP POLICY IF EXISTS "select_own_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;

-- Create secure RLS policies for subscribers table
-- Users can only view their own subscription data (by user_id only, not email)
CREATE POLICY "subscribers_select_own" ON public.subscribers
FOR SELECT 
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Users can only update their own subscription data
CREATE POLICY "subscribers_update_own" ON public.subscribers
FOR UPDATE 
USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Only edge functions with service role can insert subscription data
-- This is for the check-subscription function to work properly
CREATE POLICY "subscribers_service_insert" ON public.subscribers
FOR INSERT 
WITH CHECK (current_setting('role', true) = 'service_role');

-- Admin access for subscription management (with audit logging)
CREATE POLICY "subscribers_admin_access" ON public.subscribers
FOR ALL
USING (
  (get_current_user_role() = 'admin' OR is_master_admin()) 
  AND auth.uid() IS NOT NULL
)
WITH CHECK (
  (get_current_user_role() = 'admin' OR is_master_admin()) 
  AND auth.uid() IS NOT NULL
);

-- Log this security fix
SELECT log_system_audit(
  'security_hardening',
  'subscribers_table',
  'rls_policies',
  jsonb_build_object(
    'action', 'secure_rls_policies_implemented',
    'description', 'Fixed customer email and payment data exposure by implementing strict RLS policies',
    'previous_policies', 'email-based access allowed',
    'new_policies', 'user_id-only access with service role for edge functions'
  )
);