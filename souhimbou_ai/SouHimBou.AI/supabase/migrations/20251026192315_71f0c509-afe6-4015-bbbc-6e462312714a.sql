-- Allow users to view their own failed login attempts
-- This addresses security finding: FAILED_LOGIN_TRACKING
CREATE POLICY "Users can view their own failed login attempts" 
ON public.failed_login_attempts 
FOR SELECT 
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);