-- Add MFA columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN mfa_enabled boolean DEFAULT false,
ADD COLUMN mfa_backup_codes text[];

-- Update existing profiles to have MFA disabled by default
UPDATE public.profiles 
SET mfa_enabled = false 
WHERE mfa_enabled IS NULL;