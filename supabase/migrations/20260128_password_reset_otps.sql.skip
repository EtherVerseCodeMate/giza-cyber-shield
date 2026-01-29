-- Migration: Create password_reset_otps table for secure OTP-based password reset
-- Required by: send-password-reset-otp and verify-password-reset-otp edge functions

CREATE TABLE IF NOT EXISTS public.password_reset_otps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    CONSTRAINT unique_active_otp UNIQUE (user_id, otp_code)
);

-- Index for efficient lookup by email
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email ON public.password_reset_otps(email);

-- Index for cleanup of expired OTPs
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expires_at ON public.password_reset_otps(expires_at);

-- Enable RLS
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (edge functions use service role)
CREATE POLICY "Service role full access" ON public.password_reset_otps
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Users cannot directly access this table (only through edge functions)
CREATE POLICY "Users cannot access OTPs directly" ON public.password_reset_otps
    FOR SELECT
    USING (false);

-- Function to automatically clean up expired OTPs (can be called by cron)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.password_reset_otps
    WHERE expires_at < NOW() OR used = true;
END;
$$;

-- Comment for documentation
COMMENT ON TABLE public.password_reset_otps IS 'Stores temporary OTP codes for password reset verification. OTPs expire after 10 minutes.';
