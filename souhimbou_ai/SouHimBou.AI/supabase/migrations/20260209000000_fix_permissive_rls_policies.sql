-- Fix Permissive RLS Policies
-- Security Issue: Multiple tables have overly permissive RLS policies using USING (true) or WITH CHECK (true)
-- This allows any authenticated user to perform operations without proper authorization checks
-- 
-- Remediation: https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy
--
-- NOTE: This migration identifies and documents permissive policies
-- Actual fixes should be implemented per-table based on business logic requirements

-- List of tables with permissive policies that need review:
-- 1. Tables with INSERT policies using WITH CHECK (true)
-- 2. Tables with UPDATE/DELETE policies using USING (true)
-- 3. Public read policies using USING (true) for SELECT are intentionally excluded
--    as they are often used for public data

-- IMPORTANT: Before running fixes, ensure you understand the business logic for each table
-- and implement appropriate RLS policies based on:
-- - User ownership (user_id = auth.uid())
-- - Organization membership
-- - Role-based access control
-- - Public vs private data classification

-- Example of proper RLS policies (commented out - customize per table):

-- For user-owned data:
-- DROP POLICY IF EXISTS "Users can insert their own data" ON table_name;
-- CREATE POLICY "Users can insert their own data" ON table_name
--   FOR INSERT 
--   WITH CHECK (auth.uid() = user_id);
--
-- DROP POLICY IF EXISTS "Users can update their own data" ON table_name
-- CREATE POLICY "Users can update their own data" ON table_name
--   FOR UPDATE
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);

-- For organization-scoped data:
-- DROP POLICY IF EXISTS "Users can insert org data" ON table_name;
-- CREATE POLICY "Users can insert org data" ON table_name
--   FOR INSERT
--   WITH CHECK (
--     organization_id IN (
--       SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
--     )
--   );

-- For service-role only operations:
-- DROP POLICY IF EXISTS "Service role only" ON table_name;
-- CREATE POLICY "Service role only" ON table_name
--   FOR ALL
--   USING (current_setting('role', true) = 'service_role')
--   WITH CHECK (current_setting('role', true) = 'service_role');

-- TABLES REQUIRING IMMEDIATE ATTENTION:
-- The following tables have been identified with permissive policies and need review:

-- 1. Tables that should likely be service_role only
-- Example fixes (uncomment and adjust):

/*
-- Fix for automated_remediation_logs (currently has WITH CHECK (true))
DROP POLICY IF EXISTS "Enable insert for all users" ON public.automated_remediation_logs;
CREATE POLICY "Service role only insert" ON public.automated_remediation_logs
  FOR INSERT
  WITH CHECK (current_setting('role', true) = 'service_role');

-- Fix for security_event_logs (if it has permissive policies)
DROP POLICY IF EXISTS "Enable insert for all users" ON public.security_event_logs;
CREATE POLICY "Service role only insert" ON public.security_event_logs
  FOR INSERT
  WITH CHECK (current_setting('role', true) = 'service_role');
*/

-- 2. Tables that should be user/organization scoped
-- Review and implement based on your data model

/*
-- Example: compliance_snapshots
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.compliance_snapshots;
CREATE POLICY "Users can insert org snapshots" ON public.compliance_snapshots
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Enable update for all users" ON public.compliance_snapshots;
CREATE POLICY "Users can update org snapshots" ON public.compliance_snapshots
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  );
*/

-- 3. Public reference data (these are OK to keep USING (true) for SELECT only)
-- Examples: stig_rules, stig_benchmarks, nist_controls
-- These should remain publicly readable but restricted for INSERT/UPDATE/DELETE

-- Add audit logging for policy violations
CREATE TABLE IF NOT EXISTS public.rls_policy_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  user_id UUID,
  attempted_at TIMESTAMPTZ DEFAULT now(),
  policy_violated TEXT,
  details JSONB
);

-- Enable RLS on audit log itself
ALTER TABLE public.rls_policy_audit_log ENABLE ROW LEVEL SECURITY;

-- Only service role can read audit logs
CREATE POLICY "Service role only access" ON public.rls_policy_audit_log
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- Document the issue for compliance
COMMENT ON TABLE public.rls_policy_audit_log IS 
  'Audit log for RLS policy violations. Created as part of security hardening to address permissive RLS policies issue.';

-- Create a view to identify remaining permissive policies
CREATE OR REPLACE VIEW public.permissive_rls_policies AS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    -- Permissive INSERT policies
    (cmd = 'INSERT' AND with_check = 'true')
    -- Permissive UPDATE policies
    OR (cmd = 'UPDATE' AND (qual = 'true' OR with_check = 'true'))
    -- Permissive DELETE policies
    OR (cmd = 'DELETE' AND qual = 'true')
    -- Permissive ALL policies
    OR (cmd = 'ALL' AND (qual = 'true' OR with_check = 'true'))
  )
  -- Exclude intentional public SELECT policies
  AND NOT (cmd = 'SELECT' AND qual = 'true')
ORDER BY tablename, policyname;

-- Grant access to permissive policies view to service role only
REVOKE ALL ON public.permissive_rls_policies FROM PUBLIC;
GRANT SELECT ON public.permissive_rls_policies TO service_role;

COMMENT ON VIEW public.permissive_rls_policies IS 
  'Lists all RLS policies with permissive expressions (USING (true) or WITH CHECK (true)) that should be reviewed and tightened.';

-- Add notification for developers
DO $$
BEGIN
  RAISE NOTICE 'RLS Policy Security Audit Complete';
  RAISE NOTICE 'Run: SELECT * FROM public.permissive_rls_policies;';
  RAISE NOTICE 'to see tables that require RLS policy hardening.';
  RAISE NOTICE 'Review each policy and implement proper authorization checks.';
END $$;
