-- =============================================================================
-- COMPLETE AUTH FIX - Single migration to fix all authentication issues
-- Generated: 2026-02-04
-- Run this ONCE in the Supabase SQL Editor
-- =============================================================================

-- =============================================
-- STEP 1: Create profiles table if missing
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  security_clearance TEXT CHECK (security_clearance IN ('UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET')),
  department TEXT,
  role TEXT CHECK (role IN ('admin', 'analyst', 'operator', 'viewer')),
  master_admin BOOLEAN DEFAULT false,
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_backup_codes TEXT[],
  emergency_access_codes TEXT[],
  trusted_devices JSONB,
  plan_type TEXT,
  is_trial_active BOOLEAN DEFAULT false,
  trial_starts_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  data_classification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STEP 2: RLS policies for profiles
-- =============================================
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Elevated system access for administrators" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE p.user_id = auth.uid() AND p.master_admin = true
  )
);

CREATE POLICY "Elevated system access for administrators"
ON public.profiles FOR ALL TO authenticated
USING (master_admin = true AND auth.uid() = user_id)
WITH CHECK (master_admin = true AND auth.uid() = user_id);

-- =============================================
-- STEP 3: Updated timestamp trigger
-- =============================================
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

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- STEP 4: Fix handle_new_user trigger
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.email = 'apollo6972@proton.me' THEN
        INSERT INTO public.profiles (user_id, username, full_name, security_clearance, role, department, master_admin)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data ->> 'username', 'admin'),
            COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'System Administrator'),
            'TOP_SECRET',
            'admin',
            'SYSTEM_ADMINISTRATION',
            true
        )
        ON CONFLICT (user_id) DO UPDATE SET
            security_clearance = 'TOP_SECRET',
            role = 'admin',
            department = 'SYSTEM_ADMINISTRATION',
            master_admin = true;
    ELSE
        INSERT INTO public.profiles (user_id, username, full_name, security_clearance, role, department)
        VALUES (
            NEW.id,
            NEW.raw_user_meta_data ->> 'username',
            NEW.raw_user_meta_data ->> 'full_name',
            COALESCE(NEW.raw_user_meta_data ->> 'security_clearance', 'UNCLASSIFIED'),
            COALESCE(NEW.raw_user_meta_data ->> 'role', 'viewer'),
            NEW.raw_user_meta_data ->> 'department'
        )
        ON CONFLICT (user_id) DO UPDATE SET
            username = COALESCE(EXCLUDED.username, public.profiles.username),
            full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
            security_clearance = COALESCE(EXCLUDED.security_clearance, public.profiles.security_clearance),
            role = COALESCE(EXCLUDED.role, public.profiles.role),
            department = COALESCE(EXCLUDED.department, public.profiles.department),
            updated_at = now();
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        INSERT INTO public.profiles (user_id, username, full_name, security_clearance, role, department)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data ->> 'username', '') || '_' || substr(NEW.id::text, 1, 8),
            NEW.raw_user_meta_data ->> 'full_name',
            COALESCE(NEW.raw_user_meta_data ->> 'security_clearance', 'UNCLASSIFIED'),
            COALESCE(NEW.raw_user_meta_data ->> 'role', 'viewer'),
            NEW.raw_user_meta_data ->> 'department'
        )
        ON CONFLICT (user_id) DO NOTHING;
        RETURN NEW;
    WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user trigger error: % %', SQLERRM, SQLSTATE;
        RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- STEP 5: Helper functions with search_path
-- =============================================
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(master_admin, false) FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

-- =============================================
-- STEP 6: Backfill profiles for existing users
-- =============================================
INSERT INTO public.profiles (user_id, username, full_name, security_clearance, role, department, master_admin)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data ->> 'full_name', u.email),
  COALESCE(u.raw_user_meta_data ->> 'security_clearance', 'UNCLASSIFIED'),
  COALESCE(u.raw_user_meta_data ->> 'role', 'viewer'),
  u.raw_user_meta_data ->> 'department',
  CASE WHEN u.email = 'apollo6972@proton.me' THEN true ELSE false END
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- Clean up orphaned profiles
DELETE FROM public.profiles
WHERE user_id NOT IN (SELECT id FROM auth.users)
AND username = 'system_admin';

-- =============================================
-- STEP 7: Fix remaining Advisor warnings
-- =============================================

-- 7a. Fix function search paths (dynamic OID lookup)
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

  FOR func_oid IN
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'calculate_pqc_readiness' AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO ''public''', func_oid::regprocedure);
  END LOOP;

  FOR func_oid IN
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'update_crypto_moat_stats' AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO ''public''', func_oid::regprocedure);
  END LOOP;
END $$;

-- 7b. Fix audit_logs RLS
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

-- 7c. Fix khepra_secret_keys RLS (uses created_by, not user_id)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'khepra_secret_keys') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated access" ON public.khepra_secret_keys';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view keys" ON public.khepra_secret_keys';
    EXECUTE 'DROP POLICY IF EXISTS "Public read access" ON public.khepra_secret_keys';
    EXECUTE 'DROP POLICY IF EXISTS "Owner or admin access to secret keys" ON public.khepra_secret_keys';

    EXECUTE $pol$
      CREATE POLICY "Admin access to secret keys" ON public.khepra_secret_keys
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.user_id = auth.uid() AND profiles.master_admin = true
        )
        OR auth.uid()::text = created_by
      )
    $pol$;
  END IF;
END $$;

-- 7d. Fix matrix_operations_log RLS (no user_id column)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'matrix_operations_log') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated read" ON public.matrix_operations_log';
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated insert" ON public.matrix_operations_log';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can read" ON public.matrix_operations_log';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can insert" ON public.matrix_operations_log';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view operations" ON public.matrix_operations_log';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can insert operations" ON public.matrix_operations_log';
    EXECUTE 'DROP POLICY IF EXISTS "Owner or admin can view operations log" ON public.matrix_operations_log';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own operations log" ON public.matrix_operations_log';

    EXECUTE $pol$
      CREATE POLICY "Admin can view operations log" ON public.matrix_operations_log
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.user_id = auth.uid() AND profiles.master_admin = true
        )
      )
    $pol$;

    EXECUTE $pol$
      CREATE POLICY "Authenticated users can insert operations log" ON public.matrix_operations_log
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL)
    $pol$;
  END IF;
END $$;

-- 7e. Fix password_reset_otps RLS
DROP POLICY IF EXISTS "Service role can manage all OTPs" ON public.password_reset_otps;
DROP POLICY IF EXISTS "Allow all OTP operations" ON public.password_reset_otps;

CREATE POLICY "Users can create own OTPs" ON public.password_reset_otps
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own OTPs" ON public.password_reset_otps
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own OTPs" ON public.password_reset_otps
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

-- 7f. Fix OTP expiry
DO $$
BEGIN
  BEGIN
    UPDATE auth.config
    SET mailer_otp_exp = 600
    WHERE mailer_otp_exp > 3600;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Set OTP expiry to 600s via Dashboard > Authentication > Providers > Email';
  END;
END $$;

-- =============================================================================
-- DONE. Registration should now work. Test by signing up a new user.
-- =============================================================================
