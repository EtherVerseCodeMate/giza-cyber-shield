-- Create an RPC function to accept agreements securely bypassing potential RLS issues
CREATE OR REPLACE FUNCTION public.accept_legal_agreements(
  user_uuid UUID,
  user_agent_text TEXT,
  meta_data JSONB,
  agreement_version_text TEXT,
  agreement_types TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert agreements for each type in the array
  INSERT INTO public.user_agreements (user_id, agreement_type, agreement_version, user_agent, metadata)
  SELECT 
    user_uuid, 
    type, 
    agreement_version_text, 
    user_agent_text, 
    meta_data
  FROM unnest(agreement_types) AS type
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_agreements 
    WHERE user_id = user_uuid 
    AND agreement_type = type 
    AND agreement_version = agreement_version_text
    AND revoked_at IS NULL
  );
END;
$$;

-- Ensure RLS policy for insert is correct (fix overly strict casting or mismatch)
DROP POLICY IF EXISTS "Users can create their own agreements" ON public.user_agreements;
CREATE POLICY "Users can create their own agreements" 
ON public.user_agreements 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);
