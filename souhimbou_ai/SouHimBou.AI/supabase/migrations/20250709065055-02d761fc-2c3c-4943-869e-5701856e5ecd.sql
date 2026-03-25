
-- Fix RLS policy issues for organizations and user_organizations tables

-- Drop the problematic recursive policy on user_organizations
DROP POLICY IF EXISTS "Users can view organization memberships through function" ON public.user_organizations;

-- Update the get_user_organizations function to bypass RLS entirely
CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Direct query bypassing RLS entirely
  SELECT organization_id FROM user_organizations WHERE user_id = auth.uid();
$$;

-- Add INSERT policy for organizations table so users can create organizations
CREATE POLICY "Users can create organizations" 
ON public.organizations FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Ensure there's a proper INSERT policy for user_organizations
DROP POLICY IF EXISTS "Organization owners and admins can manage memberships" ON public.user_organizations;

CREATE POLICY "Organization admins can manage memberships" 
ON public.user_organizations FOR ALL 
USING (
  organization_id IN (
    SELECT organization_id FROM public.user_organizations 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- Allow users to insert themselves as owners when creating organizations
CREATE POLICY "Users can add themselves to organizations" 
ON public.user_organizations FOR INSERT 
WITH CHECK (user_id = auth.uid());
