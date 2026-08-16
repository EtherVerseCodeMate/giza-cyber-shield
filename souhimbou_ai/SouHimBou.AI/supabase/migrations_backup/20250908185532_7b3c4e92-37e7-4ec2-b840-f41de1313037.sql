-- Phase 1: Critical Data Protection Fixes (Fixed)

-- 1. Fix Notifications Table RLS Policies
-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Master admins can manage all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Organization admins can manage notifications" ON public.notifications;  
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications only" ON public.notifications;

-- Create secure, user-scoped policies
CREATE POLICY "Users can view own notifications only" 
ON public.notifications 
FOR SELECT 
USING (recipient_id = auth.uid());

CREATE POLICY "Users can insert own notifications only" 
ON public.notifications 
FOR INSERT 
WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "System notifications access" 
ON public.notifications 
FOR ALL 
USING (current_setting('role', true) = 'service_role')
WITH CHECK (current_setting('role', true) = 'service_role');

-- 2. Fix Subscribers Table RLS Policies  
-- Drop existing broad access policies
DROP POLICY IF EXISTS "Subscribers can view their own data" ON public.subscribers;
DROP POLICY IF EXISTS "Admins can manage all subscribers" ON public.subscribers;
DROP POLICY IF EXISTS "Users can view own subscription only" ON public.subscribers;

-- Create secure, user-scoped policies
CREATE POLICY "User subscription access only" 
ON public.subscribers 
FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3. Fix Password Reset OTPs Security
-- Drop overlapping policies
DROP POLICY IF EXISTS "Password reset OTPs are only accessible by service role" ON public.password_reset_otps;
DROP POLICY IF EXISTS "Users can verify their own OTPs" ON public.password_reset_otps;
DROP POLICY IF EXISTS "OTP verification access only" ON public.password_reset_otps;
DROP POLICY IF EXISTS "System can manage OTPs" ON public.password_reset_otps;

-- Create single, clear policy for OTP verification
CREATE POLICY "Secure OTP verification only" 
ON public.password_reset_otps 
FOR SELECT 
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND expires_at > now()
  AND used = false
);

-- System role can manage all OTPs
CREATE POLICY "Service role OTP management" 
ON public.password_reset_otps 
FOR ALL 
USING (current_setting('role', true) = 'service_role')
WITH CHECK (current_setting('role', true) = 'service_role');