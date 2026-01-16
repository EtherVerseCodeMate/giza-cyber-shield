-- Fix infinite recursion in user_organizations RLS policies

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view their organization memberships" ON public.user_organizations;
DROP POLICY IF EXISTS "Organization admins can manage memberships" ON public.user_organizations;

-- Create new, non-recursive policies
CREATE POLICY "Users can view their own organization memberships" 
ON public.user_organizations FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can view memberships of organizations they belong to" 
ON public.user_organizations FOR SELECT 
USING (
  organization_id IN (
    SELECT uo.organization_id 
    FROM public.user_organizations uo 
    WHERE uo.user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners and admins can manage memberships" 
ON public.user_organizations FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_organizations uo 
    WHERE uo.organization_id = user_organizations.organization_id 
    AND uo.user_id = auth.uid() 
    AND uo.role IN ('owner', 'admin')
  )
);

-- Update the get_user_organizations function to use a direct query without RLS
CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  -- Use a direct query that bypasses RLS to avoid recursion
  SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid();
$$;