-- Update get_evidence_requiring_review function to use most secure search_path setting
-- This follows best practice of search_path = '' with fully qualified names

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
SET search_path = ''
AS $$
  SELECT 
    se.id as evidence_id,
    se.collection_timestamp as collection_date,
    COALESCE(
      EXTRACT(DAY FROM (NOW() - se.last_access_review_date))::INTEGER,
      EXTRACT(DAY FROM (NOW() - se.collection_timestamp))::INTEGER
    ) as days_since_review,
    (se.collection_timestamp + (se.retention_period_days || ' days')::INTERVAL) as retention_expires_at
  FROM public.stig_evidence se
  WHERE 
    (se.last_access_review_date IS NULL AND se.collection_timestamp < NOW() - INTERVAL '365 days')
    OR se.last_access_review_date < NOW() - INTERVAL '365 days'
  ORDER BY days_since_review DESC;
$$;