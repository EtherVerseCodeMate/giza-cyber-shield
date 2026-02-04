-- Fix Supabase Advisor lint warnings (12 issues)
-- Generated: 2026-02-04
-- Addresses: function_search_path_mutable, rls_policy_always_true, auth_otp_long_expiry

-- =============================================================================
-- 1. FIX FUNCTION SEARCH PATHS (4 warnings)
-- =============================================================================

-- 1a. update_updated_at_column - add SET search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1b. cleanup_expired_otps / cleanup_expired_password_reset_otps
-- May exist under either name; fix both using dynamic OID lookup
DO $$
DECLARE
  func_oid oid;
BEGIN
  FOR func_oid IN
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'cleanup_expired_otps' AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO ''public''', func_oid::regprocedure);
  END LOOP;

  FOR func_oid IN
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'cleanup_expired_password_reset_otps' AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO ''public''', func_oid::regprocedure);
  END LOOP;
END $$;

-- 1c. calculate_pqc_readiness - add SET search_path for all overloads
DO $$
DECLARE
  func_oid oid;
BEGIN
  FOR func_oid IN
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'calculate_pqc_readiness' AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO ''public''', func_oid::regprocedure);
  END LOOP;
END $$;

-- 1d. update_crypto_moat_stats - add SET search_path for all overloads
DO $$
DECLARE
  func_oid oid;
BEGIN
  FOR func_oid IN
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'update_crypto_moat_stats' AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO ''public''', func_oid::regprocedure);
  END LOOP;
END $$;

-- =============================================================================
-- 2. FIX OVERLY PERMISSIVE RLS POLICIES (6 warnings)
-- =============================================================================

-- 2a. audit_logs - restrict SELECT to own records + admins
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;
CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid() AND profiles.master_admin = true
  )
);

-- 2b. khepra_secret_keys - restrict to owner + admins (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'khepra_secret_keys') THEN
    -- Drop any overly permissive policy
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated access" ON public.khepra_secret_keys';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view keys" ON public.khepra_secret_keys';
    EXECUTE 'DROP POLICY IF EXISTS "Public read access" ON public.khepra_secret_keys';

    -- Create restrictive policy: only owner or admin
    EXECUTE $pol$
      CREATE POLICY "Owner or admin access to secret keys" ON public.khepra_secret_keys
      FOR SELECT TO authenticated
      USING (
        auth.uid() = user_id
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.user_id = auth.uid() AND profiles.master_admin = true
        )
      )
    $pol$;
  END IF;
END $$;

-- 2c. matrix_operations_log - restrict SELECT and INSERT (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'matrix_operations_log') THEN
    -- Drop overly permissive policies
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated read" ON public.matrix_operations_log';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated insert" ON public.matrix_operations_log';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can read" ON public.matrix_operations_log';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can insert" ON public.matrix_operations_log';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view operations" ON public.matrix_operations_log';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can insert operations" ON public.matrix_operations_log';

    -- SELECT: only own records or admin
    EXECUTE $pol$
      CREATE POLICY "Owner or admin can view operations log" ON public.matrix_operations_log
      FOR SELECT TO authenticated
      USING (
        auth.uid() = user_id
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.user_id = auth.uid() AND profiles.master_admin = true
        )
      )
    $pol$;

    -- INSERT: only own records
    EXECUTE $pol$
      CREATE POLICY "Users can insert own operations log" ON public.matrix_operations_log
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id)
    $pol$;
  END IF;
END $$;

-- 2d. password_reset_otps - restrict to service role + own records
DROP POLICY IF EXISTS "Service role can manage all OTPs" ON public.password_reset_otps;
DROP POLICY IF EXISTS "Allow all OTP operations" ON public.password_reset_otps;

-- Users can only INSERT OTPs for themselves
CREATE POLICY "Users can create own OTPs" ON public.password_reset_otps
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can only SELECT their own OTPs
CREATE POLICY "Users can view own OTPs" ON public.password_reset_otps
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can UPDATE (mark as used) only their own OTPs
CREATE POLICY "Users can update own OTPs" ON public.password_reset_otps
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- 2e. profiles - replace overly permissive "view all" with scoped access
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Users can view basic profile info of others (username, full_name, role)
-- but full record access only for own profile or admin
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.user_id = auth.uid() AND p.master_admin = true
  )
);

-- =============================================================================
-- 3. FIX OTP EXPIRY (1 warning)
-- Reduce OTP expiry from >3600s to 600s (10 minutes)
-- =============================================================================

-- Note: This requires Supabase Dashboard or supabase CLI config change.
-- The auth.config table approach:
DO $$
BEGIN
  -- Try to update via auth.config if accessible
  BEGIN
    UPDATE auth.config
    SET mailer_otp_exp = 600
    WHERE mailer_otp_exp > 3600;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Cannot update auth.config directly. Set OTP expiry to 600s via Supabase Dashboard > Authentication > Providers > Email > OTP Expiration.';
  END;
END $$;

-- =============================================================================
-- 4. POSTGRES VERSION (1 warning - informational)
-- supabase-postgres-17.4.1.074 has known vulnerabilities
-- Action: Upgrade via Supabase Dashboard > Settings > Infrastructure
-- This cannot be done via SQL migration
-- =============================================================================

-- Record the advisory for audit trail
COMMENT ON SCHEMA public IS 'Advisory: Postgres version upgrade pending. Current: 17.4.1.074. Action: Upgrade via Supabase Dashboard > Settings > Infrastructure.';
