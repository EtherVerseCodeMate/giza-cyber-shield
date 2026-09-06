-- Insert default organization if it doesn't exist and assign current user
DO $$
DECLARE
  current_user_id UUID;
  default_org_id UUID;
  existing_org_id UUID;
BEGIN
  -- Get current user ID from auth.users table using a different approach
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NOT NULL THEN
    -- Check if user already has an organization
    SELECT organization_id INTO existing_org_id 
    FROM public.user_organizations 
    WHERE user_id = current_user_id 
    LIMIT 1;
    
    IF existing_org_id IS NULL THEN
      -- Check if default organization exists
      SELECT id INTO default_org_id 
      FROM public.organizations 
      WHERE slug = 'default-org' 
      LIMIT 1;
      
      -- Create default organization if it doesn't exist
      IF default_org_id IS NULL THEN
        INSERT INTO public.organizations (name, slug, subscription_tier)
        VALUES ('SouHimBou AI Organization', 'souhimbou-ai-org', 'trial')
        RETURNING id INTO default_org_id;
      END IF;
      
      -- Assign user to organization as admin
      INSERT INTO public.user_organizations (user_id, organization_id, role)
      VALUES (current_user_id, default_org_id, 'admin');
    END IF;
  END IF;
END $$;