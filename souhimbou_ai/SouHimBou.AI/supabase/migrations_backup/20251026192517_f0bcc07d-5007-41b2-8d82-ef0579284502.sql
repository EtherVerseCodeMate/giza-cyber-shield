-- Add access review tracking to stig_evidence table
-- This addresses security finding: STIG_EVIDENCE_RETENTION

-- Add columns for tracking access reviews
ALTER TABLE public.stig_evidence
ADD COLUMN IF NOT EXISTS last_access_review_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS access_review_notes TEXT,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);

-- Create function to identify evidence requiring access review
-- Evidence older than 365 days without review should be flagged
CREATE OR REPLACE FUNCTION public.get_evidence_requiring_review()
RETURNS TABLE(
  evidence_id UUID,
  collection_date TIMESTAMP WITH TIME ZONE,
  days_since_review INTEGER,
  retention_expires_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id as evidence_id,
    collection_timestamp as collection_date,
    COALESCE(
      EXTRACT(DAY FROM (NOW() - last_access_review_date))::INTEGER,
      EXTRACT(DAY FROM (NOW() - collection_timestamp))::INTEGER
    ) as days_since_review,
    (collection_timestamp + (retention_period_days || ' days')::INTERVAL) as retention_expires_at
  FROM stig_evidence
  WHERE 
    (last_access_review_date IS NULL AND collection_timestamp < NOW() - INTERVAL '365 days')
    OR last_access_review_date < NOW() - INTERVAL '365 days'
  ORDER BY days_since_review DESC;
$$;

-- Grant execute permission to authenticated users with appropriate roles
GRANT EXECUTE ON FUNCTION public.get_evidence_requiring_review() TO authenticated;

-- Add comment explaining the review requirement
COMMENT ON COLUMN public.stig_evidence.last_access_review_date IS 
'Date when access permissions for this evidence were last reviewed. Evidence should be reviewed annually to ensure access restrictions remain appropriate as systems evolve.';

COMMENT ON COLUMN public.stig_evidence.access_review_notes IS 
'Notes from the most recent access review, documenting why current access restrictions are still appropriate.';

COMMENT ON FUNCTION public.get_evidence_requiring_review() IS 
'Returns STIG evidence that requires access review (older than 365 days since last review or collection). Used to maintain security of historical compliance evidence.';