-- Fix RLS policies for organizations table to allow authenticated users to create organizations

-- Drop existing policies to start clean
DROP POLICY IF EXISTS "Anyone authenticated can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;

-- Create a simple INSERT policy for authenticated users
CREATE POLICY "Authenticated users can create organizations" 
ON public.organizations FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Ensure the existing SELECT and UPDATE policies are working correctly
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON public.organizations;
CREATE POLICY "Users can view organizations they belong to" 
ON public.organizations FOR SELECT 
USING (id IN (SELECT public.get_user_organizations()));

DROP POLICY IF EXISTS "Organization owners can update their organization" ON public.organizations;
CREATE POLICY "Organization owners can update their organization" 
ON public.organizations FOR UPDATE 
USING (id IN (SELECT public.get_user_organizations()));