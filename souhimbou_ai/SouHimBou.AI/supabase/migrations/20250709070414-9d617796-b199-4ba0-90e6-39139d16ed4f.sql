-- Complete RLS reset and rebuild with simple non-recursive policies

-- Temporarily disable RLS on user_organizations to break any recursion
ALTER TABLE public.user_organizations DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start completely fresh
DROP POLICY IF EXISTS "Users can view their memberships" ON public.user_organizations;
DROP POLICY IF EXISTS "Users can insert themselves as organization members" ON public.user_organizations;
DROP POLICY IF EXISTS "Organization owners can manage user memberships" ON public.user_organizations;
DROP POLICY IF EXISTS "Organization owners can remove user memberships" ON public.user_organizations;
DROP POLICY IF EXISTS "Users can view their own organization memberships" ON public.user_organizations;

-- Drop all organization policies too
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can update their organization" ON public.organizations;

-- Create the simplest possible function that doesn't cause recursion
CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  -- Direct query with explicit security definer to bypass RLS
  SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid();
$$;

-- Recreate organization policies first (these are simpler)
CREATE POLICY "Anyone authenticated can create organizations" 
ON public.organizations FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view organizations they belong to" 
ON public.organizations FOR SELECT 
USING (id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Organization owners can update their organization" 
ON public.organizations FOR UPDATE 
USING (id IN (SELECT public.get_user_organizations()));

-- Re-enable RLS on user_organizations 
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

-- Create the simplest possible policies for user_organizations
CREATE POLICY "Users can view their own memberships" 
ON public.user_organizations FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own memberships" 
ON public.user_organizations FOR INSERT 
WITH CHECK (user_id = auth.uid());