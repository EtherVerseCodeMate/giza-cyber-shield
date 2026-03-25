-- Fix RLS policies for organizations table to properly handle creation

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can select their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can update their organizations" ON public.organizations;

-- Create improved RLS policies for organizations
CREATE POLICY "Authenticated users can create organizations" 
ON public.organizations 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can select their organizations" 
ON public.organizations 
FOR SELECT 
USING (
  id IN (SELECT get_user_organizations()) OR 
  auth.uid() IN (SELECT user_id FROM public.user_organizations WHERE organization_id = organizations.id)
);

CREATE POLICY "Organization admins can update" 
ON public.organizations 
FOR UPDATE 
USING (
  id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid() AND role IN ('admin', 'owner'))
);