-- Complete fix for RLS policy recursion issues

-- First, completely drop ALL policies on user_organizations to start clean
DROP POLICY IF EXISTS "Users can view their own organization memberships" ON public.user_organizations;
DROP POLICY IF EXISTS "Organization owners and admins can manage memberships" ON public.user_organizations; 
DROP POLICY IF EXISTS "Organization admins can manage memberships" ON public.user_organizations;
DROP POLICY IF EXISTS "Users can add themselves to organizations" ON public.user_organizations;

-- Recreate the get_user_organizations function with a completely different approach
-- Use a direct query with no function calls to avoid any recursion
CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT organization_id 
  FROM user_organizations 
  WHERE user_id = auth.uid();
END;
$$;

-- Create simple, non-recursive policies for user_organizations
CREATE POLICY "Users can view their memberships" 
ON public.user_organizations FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert themselves as organization members" 
ON public.user_organizations FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Create UPDATE/DELETE policies that don't use the recursive function
CREATE POLICY "Organization owners can manage user memberships" 
ON public.user_organizations FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_organizations uo 
    WHERE uo.organization_id = user_organizations.organization_id 
    AND uo.user_id = auth.uid() 
    AND uo.role = 'owner'
  )
);

CREATE POLICY "Organization owners can remove user memberships" 
ON public.user_organizations FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM user_organizations uo 
    WHERE uo.organization_id = user_organizations.organization_id 
    AND uo.user_id = auth.uid() 
    AND uo.role = 'owner'
  )
);

-- Ensure organizations INSERT policy exists and is correct
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
CREATE POLICY "Users can create organizations" 
ON public.organizations FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);