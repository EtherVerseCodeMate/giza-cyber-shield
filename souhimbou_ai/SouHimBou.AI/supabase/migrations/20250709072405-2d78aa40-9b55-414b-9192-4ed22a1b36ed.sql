-- Completely reset and fix RLS policies for organizations table

-- First, disable RLS temporarily to clear any conflicts
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start completely fresh
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Anyone authenticated can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON public.organizations;
DROP POLICY IF EXISTS "Organization owners can update their organization" ON public.organizations;

-- Re-enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create the simplest possible INSERT policy that should work
CREATE POLICY "Allow authenticated users to insert organizations" 
ON public.organizations FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Create SELECT policy
CREATE POLICY "Users can select their organizations" 
ON public.organizations FOR SELECT 
TO authenticated
USING (id IN (SELECT public.get_user_organizations()));

-- Create UPDATE policy  
CREATE POLICY "Users can update their organizations" 
ON public.organizations FOR UPDATE 
TO authenticated
USING (id IN (SELECT public.get_user_organizations()));