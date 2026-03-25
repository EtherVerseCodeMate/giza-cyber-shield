-- Phase 1: Critical Data Protection Fixes

-- 1. Fix Notifications Table RLS Policies
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Master admins can manage all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Organization admins can manage notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

-- Create secure, user-scoped policies
CREATE POLICY "Users can view own notifications only" 
ON public.notifications 
FOR SELECT 
USING (recipient_id = auth.uid());

CREATE POLICY "Users can insert own notifications only" 
ON public.notifications 
FOR INSERT 
WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "System can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (current_setting('role', true) = 'service_role');

-- 2. Fix Subscribers Table RLS Policies  
-- Drop existing broad access policies
DROP POLICY IF EXISTS "Subscribers can view their own data" ON public.subscribers;
DROP POLICY IF EXISTS "Admins can manage all subscribers" ON public.subscribers;

-- Create secure, user-scoped policies
CREATE POLICY "Users can view own subscription only" 
ON public.subscribers 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can update own subscription only" 
ON public.subscribers 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert own subscription only" 
ON public.subscribers 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Organization admins can view subscriber count (aggregated only)
CREATE POLICY "Org admins can view subscriber metrics" 
ON public.subscribers 
FOR SELECT 
USING (
  organization_id IN (SELECT get_user_organizations()) 
  AND (get_current_user_role() = 'admin' OR is_master_admin())
);

-- 3. Fix Password Reset OTPs Security
-- Drop overlapping policies
DROP POLICY IF EXISTS "Password reset OTPs are only accessible by service role" ON public.password_reset_otps;
DROP POLICY IF EXISTS "Users can verify their own OTPs" ON public.password_reset_otps;

-- Create single, clear policy
CREATE POLICY "OTP verification access only" 
ON public.password_reset_otps 
FOR SELECT 
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND expires_at > now()
  AND used = false
);

CREATE POLICY "System can manage OTPs" 
ON public.password_reset_otps 
FOR ALL 
USING (current_setting('role', true) = 'service_role')
WITH CHECK (current_setting('role', true) = 'service_role');