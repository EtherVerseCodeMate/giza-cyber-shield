-- Fix remaining infinite recursion in user_organizations RLS policies

-- Drop the problematic policy that still causes recursion
DROP POLICY IF EXISTS "Users can view memberships of organizations they belong to" ON public.user_organizations;

-- Create a simpler, non-recursive policy that uses the security definer function
CREATE POLICY "Users can view organization memberships through function" 
ON public.user_organizations FOR SELECT 
USING (
  organization_id IN (SELECT get_user_organizations())
);

-- Also ensure the get_user_organizations function bypasses RLS completely
CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Direct query bypassing RLS entirely
  SELECT organization_id FROM user_organizations WHERE user_id = auth.uid();
$$;