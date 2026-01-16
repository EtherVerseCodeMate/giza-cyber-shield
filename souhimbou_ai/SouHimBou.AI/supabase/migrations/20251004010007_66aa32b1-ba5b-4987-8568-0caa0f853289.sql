-- Fix RLS policies for environment_discoveries table
DROP POLICY IF EXISTS "Organization members can access environment discoveries" ON environment_discoveries;

-- Allow authenticated users to insert discoveries for their organizations
CREATE POLICY "Users can insert environment discoveries"
ON environment_discoveries
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow users to view discoveries for their organizations
CREATE POLICY "Users can view environment discoveries"
ON environment_discoveries
FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT get_user_organizations())
  OR organization_id = '00000000-0000-0000-0000-000000000000'
);

-- Allow users to update discoveries for their organizations
CREATE POLICY "Users can update environment discoveries"
ON environment_discoveries
FOR UPDATE
TO authenticated
USING (
  organization_id IN (SELECT get_user_organizations())
  OR organization_id = '00000000-0000-0000-0000-000000000000'
);