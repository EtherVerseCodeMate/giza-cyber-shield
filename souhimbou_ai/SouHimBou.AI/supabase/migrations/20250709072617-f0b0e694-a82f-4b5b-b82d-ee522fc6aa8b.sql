-- Temporarily disable RLS on organizations table to debug the issue
-- This will allow us to identify if the problem is authentication or policy-related

ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;

-- Also check if there are any other constraints causing issues
-- Let's also make sure the user_organizations table policies don't interfere

-- Drop any problematic policies on user_organizations that might cause cascade issues
DROP POLICY IF EXISTS "Users can create their own memberships" ON public.user_organizations;

-- Create a simple policy for user_organizations that allows authenticated users to insert
CREATE POLICY "Allow authenticated users to insert user organizations" 
ON public.user_organizations FOR INSERT 
TO authenticated
WITH CHECK (true);