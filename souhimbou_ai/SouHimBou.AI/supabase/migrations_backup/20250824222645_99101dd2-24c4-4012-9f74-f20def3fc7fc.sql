-- Create password_reset_otps table for secure OTP-based password resets
CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_password_reset_otps_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_user_id ON public.password_reset_otps(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email_otp ON public.password_reset_otps(email, otp_code) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expires_at ON public.password_reset_otps(expires_at) WHERE used = false;

-- Create RLS policies
CREATE POLICY "Service role can manage all OTPs" 
ON public.password_reset_otps 
FOR ALL 
USING (true);

-- No user-level access policies since this is managed by edge functions only

-- Clean up expired OTPs function
CREATE OR REPLACE FUNCTION public.cleanup_expired_password_reset_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.password_reset_otps 
  WHERE expires_at < now() OR (used = true AND used_at < now() - INTERVAL '24 hours');
END;
$$;

-- Schedule cleanup (this would typically be done via pg_cron or similar)
COMMENT ON FUNCTION public.cleanup_expired_password_reset_otps() IS 'Function to clean up expired or used password reset OTPs';