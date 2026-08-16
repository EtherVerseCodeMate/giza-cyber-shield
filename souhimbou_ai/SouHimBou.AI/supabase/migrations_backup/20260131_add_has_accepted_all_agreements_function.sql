-- Create function to check if user has accepted all required agreements
CREATE OR REPLACE FUNCTION has_accepted_all_agreements(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  required_agreements TEXT[] := ARRAY[
    'tos',
    'privacy',
    'saas',
    'beta',
    'dod_compliance',
    'liability_waiver',
    'export_control'
  ];
  accepted_count INTEGER;
BEGIN
  -- Count how many required agreements the user has accepted
  SELECT COUNT(DISTINCT agreement_type)
  INTO accepted_count
  FROM user_agreements
  WHERE user_id = user_uuid
    AND agreement_type = ANY(required_agreements)
    AND revoked_at IS NULL;
  
  -- Return true if all required agreements are accepted
  RETURN accepted_count = array_length(required_agreements, 1);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION has_accepted_all_agreements(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION has_accepted_all_agreements IS 'Checks if a user has accepted all required legal agreements';
