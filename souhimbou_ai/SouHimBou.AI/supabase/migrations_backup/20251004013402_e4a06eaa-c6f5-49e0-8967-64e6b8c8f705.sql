-- Fix RLS policies for environment_discoveries to allow anonymous onboarding
-- This allows unauthenticated users to insert discovery data during onboarding

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can insert own organization discoveries" ON public.environment_discoveries;
DROP POLICY IF EXISTS "Users can view own organization discoveries" ON public.environment_discoveries;
DROP POLICY IF EXISTS "Users can update own organization discoveries" ON public.environment_discoveries;

-- Create new policies that allow onboarding flow
CREATE POLICY "Allow anonymous discovery insertions for onboarding"
ON public.environment_discoveries
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert discoveries"
ON public.environment_discoveries
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = auth.uid()
    AND organization_id = environment_discoveries.organization_id
  )
);

CREATE POLICY "Allow authenticated users to view their org discoveries"
ON public.environment_discoveries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = auth.uid()
    AND organization_id = environment_discoveries.organization_id
  )
);

CREATE POLICY "Allow admins to view all discoveries"
ON public.environment_discoveries
FOR SELECT
TO authenticated
USING (
  public.get_current_user_role() = 'admin' OR public.is_master_admin()
);

-- Log the security configuration change
INSERT INTO public.audit_logs (
  action,
  resource_type,
  details,
  created_at
) VALUES (
  'system_rls_policy_update',
  'environment_discoveries',
  jsonb_build_object(
    'change', 'allow_anonymous_onboarding',
    'reason', 'enable_seamless_onboarding_flow',
    'timestamp', now()
  ),
  now()
);