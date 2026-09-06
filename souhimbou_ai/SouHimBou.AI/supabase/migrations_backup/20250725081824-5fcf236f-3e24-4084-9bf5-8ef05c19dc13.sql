-- Fix organizations table RLS policy for inserts
-- The current INSERT policy may be conflicting with other policies

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Allow authenticated users to insert organizations" ON organizations;

-- Create a new INSERT policy that properly allows authenticated users to create organizations
CREATE POLICY "Authenticated users can create organizations" 
ON organizations 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Ensure the user_organizations table allows the creator to be added as owner
-- Check if we need to update the user_organizations INSERT policy as well
DROP POLICY IF EXISTS "Users can be added to organizations" ON user_organizations;

CREATE POLICY "Users can be added to organizations" 
ON user_organizations 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id OR get_current_user_role() = 'admin' OR is_master_admin());