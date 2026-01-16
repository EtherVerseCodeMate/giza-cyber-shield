-- Set Master Admin account to Enterprise tier
UPDATE public.profiles 
SET plan_type = 'enterprise', 
    is_trial_active = false, 
    trial_ends_at = null,
    master_admin = true
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'apollo6972@proton.me'
);

-- Set Engineer accounts to Enterprise tier (if they exist)
UPDATE public.profiles 
SET plan_type = 'enterprise', 
    is_trial_active = false, 
    trial_ends_at = null,
    role = 'admin'
WHERE full_name ILIKE '%engineer%' OR username ILIKE '%engineer%';

-- Create function to check if user has enterprise access for testing
CREATE OR REPLACE FUNCTION public.has_enterprise_access(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = user_uuid 
    AND (plan_type = 'enterprise' OR master_admin = true)
  );
$$;