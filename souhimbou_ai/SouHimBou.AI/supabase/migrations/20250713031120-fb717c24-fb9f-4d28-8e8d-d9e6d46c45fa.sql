-- Add trial management fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_trial_active BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'trial';

-- Create function to check if user is on active trial
CREATE OR REPLACE FUNCTION public.is_trial_active(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = user_uuid 
      AND is_trial_active = true 
      AND (trial_ends_at IS NULL OR trial_ends_at > now())
    ), 
    false
  );
$$;

-- Create function to get trial days remaining
CREATE OR REPLACE FUNCTION public.get_trial_days_remaining(user_uuid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE 
    WHEN trial_ends_at IS NULL THEN 14
    ELSE GREATEST(0, EXTRACT(DAY FROM trial_ends_at - now())::integer)
  END
  FROM public.profiles 
  WHERE user_id = user_uuid;
$$;

-- Update the trigger to set trial dates for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    username, 
    full_name, 
    security_clearance, 
    role,
    trial_starts_at,
    trial_ends_at,
    is_trial_active,
    plan_type
  )
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE(NEW.raw_user_meta_data ->> 'security_clearance', 'UNCLASSIFIED'),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'viewer'),
    now(),
    now() + INTERVAL '14 days',
    true,
    'trial'
  );
  RETURN NEW;
END;
$function$;