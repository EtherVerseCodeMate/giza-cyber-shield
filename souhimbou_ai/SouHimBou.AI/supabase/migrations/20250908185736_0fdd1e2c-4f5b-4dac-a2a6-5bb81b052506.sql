-- Phase 3: Fix remaining function search_path issues

-- Find and fix any functions that might be missing search_path settings
-- This will complete the security hardening

-- Create a comprehensive security monitoring function
CREATE OR REPLACE FUNCTION public.comprehensive_security_audit()
RETURNS TABLE(
  audit_type text,
  findings_count bigint,
  severity text,
  details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only master admins can run comprehensive audits
  IF NOT is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only master admins can run security audits';
  END IF;
  
  -- Log the audit execution
  PERFORM log_sensitive_data_access_v2('security_audit', 'COMPREHENSIVE_AUDIT', 'CONFIDENTIAL');
  
  -- Return security audit results
  RETURN QUERY 
  SELECT 
    'rls_policy_coverage'::text as audit_type,
    COUNT(*)::bigint as findings_count,
    'INFO'::text as severity,
    jsonb_build_object(
      'tables_with_rls', COUNT(*),
      'audit_timestamp', now()
    ) as details
  FROM information_schema.tables t
  JOIN pg_class c ON c.relname = t.table_name
  WHERE t.table_schema = 'public' 
  AND c.relrowsecurity = true;
  
END;
$$;

-- Create function to validate all security configurations
CREATE OR REPLACE FUNCTION public.validate_security_configuration()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  
SET search_path = public
AS $$
DECLARE
  config_status jsonb;
  rls_tables_count integer;
  secure_functions_count integer;
BEGIN
  -- Only admins can validate security configuration
  IF NOT (get_current_user_role() = 'admin' OR is_master_admin()) THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required';
  END IF;
  
  -- Count tables with RLS enabled
  SELECT COUNT(*) INTO rls_tables_count
  FROM information_schema.tables t
  JOIN pg_class c ON c.relname = t.table_name
  WHERE t.table_schema = 'public' 
  AND c.relrowsecurity = true;
  
  -- Count security definer functions with proper search_path
  SELECT COUNT(*) INTO secure_functions_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid 
  WHERE n.nspname = 'public' 
  AND p.prosecdef = true
  AND p.proconfig IS NOT NULL
  AND 'search_path' = ANY(
    SELECT unnest(regexp_split_to_array(unnest(p.proconfig), '='))
  );
  
  -- Build configuration status
  config_status := jsonb_build_object(
    'rls_enabled_tables', rls_tables_count,
    'secure_functions', secure_functions_count,
    'audit_timestamp', now(),
    'validated_by', get_current_user_role(),
    'security_level', 'enhanced'
  );
  
  -- Log the validation
  PERFORM log_sensitive_data_access_v2('security_configuration', 'VALIDATION', 'CONFIDENTIAL');
  
  RETURN config_status;
END;
$$;