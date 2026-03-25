-- ============================================================================
-- SUPABASE SECURITY FIXES
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================================

-- 1. FIX FUNCTION SEARCH_PATH - Prevents search_path injection attacks
-- ============================================================================

-- Fix calculate_pqc_readiness function
ALTER FUNCTION public.calculate_pqc_readiness() 
SET search_path = public, pg_temp;

-- Fix update_crypto_moat_stats function  
ALTER FUNCTION public.update_crypto_moat_stats()
SET search_path = public, pg_temp;


-- 2. FIX OVERLY PERMISSIVE RLS POLICIES
-- ============================================================================

-- Drop and recreate khepra_secret_keys INSERT policy with proper restrictions
DROP POLICY IF EXISTS "System can insert secret keys for master setup" ON public.khepra_secret_keys;

CREATE POLICY "System can insert secret keys for master setup"
ON public.khepra_secret_keys
FOR INSERT
TO authenticated
WITH CHECK (
  -- Only allow insert if the user is a superadmin or system service
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('superadmin', 'system')
  )
  OR
  -- Or if this is the first setup (no keys exist yet)
  NOT EXISTS (SELECT 1 FROM public.khepra_secret_keys)
);


-- Fix matrix_operations_log INSERT policies
DROP POLICY IF EXISTS "System can log matrix operations" ON public.matrix_operations_log;
DROP POLICY IF EXISTS "System operations logging" ON public.matrix_operations_log;

-- Create single proper policy for matrix_operations_log
CREATE POLICY "Authenticated users can log their matrix operations"
ON public.matrix_operations_log
FOR INSERT
TO authenticated
WITH CHECK (
  -- Users can only insert logs for their own actions
  user_id = auth.uid()
  OR
  -- Or service role (for system operations)
  auth.role() = 'service_role'
);


-- 3. OPTIONAL: Reduce OTP expiry (currently set via Dashboard)
-- ============================================================================
-- Go to: Dashboard > Authentication > Providers > Email
-- Set "OTP expiry" to 3600 (1 hour) or less
-- Recommended: 900 (15 minutes) for security


-- 4. VERIFY CHANGES
-- ============================================================================
SELECT 
  p.policyname,
  p.tablename,
  p.cmd,
  p.qual,
  p.with_check
FROM pg_policies p
WHERE p.tablename IN ('khepra_secret_keys', 'matrix_operations_log');
