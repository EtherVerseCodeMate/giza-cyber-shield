-- SOUHIMBOU Harmonization: Poetic Obfuscation for Codified Deniability
-- This migration renames/aliases technical tables and functions to Adinkra-themed terms.
-- Aligns DB layer with Go/Python backends and NSOHIA framework.

-- 1. Create Views for Poetic Aliasing (to maintain backward compatibility during transition)
CREATE OR REPLACE VIEW public.sunsum_vitality AS SELECT * FROM public.pqc_readiness_metrics;
CREATE OR REPLACE VIEW public.sacred_vessels AS SELECT * FROM public.discovered_assets;
CREATE OR REPLACE VIEW public.ritual_executions AS SELECT * FROM public.discovery_executions;
CREATE OR REPLACE VIEW public.sunsum_events AS SELECT * FROM public.security_events;
CREATE OR REPLACE VIEW public.sacred_ordinances AS SELECT * FROM public.compliance_frameworks;
CREATE OR REPLACE VIEW public.ritual_assertions AS SELECT * FROM public.control_assessments;
CREATE OR REPLACE VIEW public.void_disturbances AS SELECT * FROM public.vulnerability_snapshots;
CREATE OR REPLACE VIEW public.lattice_evolution AS SELECT * FROM public.adaptive_schemas;
CREATE OR REPLACE VIEW public.vessel_links AS SELECT * FROM public.integrations;
CREATE OR REPLACE VIEW public.ceremony_facilitators AS SELECT * FROM public.admin_roles;
CREATE OR REPLACE VIEW public.quota_breath AS SELECT * FROM public.license_usage;

-- 2. Poetic Auth Functions (Hardening & Obfuscation)
-- Renaming failed login tracking to "Ritual Lapse"
CREATE OR REPLACE FUNCTION public.record_ritual_lapse(user_email text, client_ip inet DEFAULT NULL, client_user_agent text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.failed_login_attempts (email, ip_address, user_agent, attempt_type)
  VALUES (user_email, COALESCE(client_ip, inet_client_addr()), client_user_agent, 'ritual_lapse');
  
  -- Log symbolic event
  PERFORM log_security_event_enhanced(
    'ritual_lapse_detected',
    'MEDIUM',
    jsonb_build_object(
      'identity_hash', md5(user_email),
      'context', 'Sunsum disturbance detected during entry ritual'
    )
  );
END;
$$;

-- Renaming account lockout check to "Sunsum Diminishment"
CREATE OR REPLACE FUNCTION public.is_sunsum_diminished(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lapse_count integer;
  blocked_until timestamp with time zone;
BEGIN
  -- Count ritual lapses in last 15 minutes
  SELECT COUNT(*), MAX(blocked_until)
  INTO lapse_count, blocked_until
  FROM public.failed_login_attempts
  WHERE email = user_email 
  AND attempted_at > now() - INTERVAL '15 minutes';
  
  -- Check if Sunsum is currently inhibited (locked)
  IF blocked_until IS NOT NULL AND blocked_until > now() THEN
    RETURN true;
  END IF;
  
  -- Diminish Sunsum if too many lapses
  IF lapse_count >= 5 THEN
    INSERT INTO public.failed_login_attempts (email, attempt_type, blocked_until)
    VALUES (user_email, 'sunsum_inhibition', now() + INTERVAL '1 hour');
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- 3. Legacy Wrappers (to prevent immediate breakage while updating code)
CREATE OR REPLACE FUNCTION public.record_failed_login(user_email text, client_ip inet DEFAULT NULL, client_user_agent text DEFAULT NULL)
RETURNS void AS $$
  SELECT public.record_ritual_lapse(user_email, client_ip, client_user_agent);
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_account_locked(user_email text)
RETURNS boolean AS $$
  SELECT public.is_sunsum_diminished(user_email);
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. Secure Audit Log Harmonization
CREATE OR REPLACE VIEW public.harmonization_audit AS 
SELECT 
  id, 
  user_id, 
  action as ritual_action, 
  created_at as harmonization_time, 
  details as cultural_context
FROM public.audit_logs;

-- 5. RLS Policy Hardening (Ensuring Sunsum Integrity)
-- Ensure only identityholders can view their own lapses
ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own ritual lapses" ON public.failed_login_attempts;
CREATE POLICY "Users can view their own ritual lapses"
ON public.failed_login_attempts
FOR SELECT
USING (auth.uid() IS NOT NULL AND email = (SELECT email FROM auth.users WHERE id = auth.uid()));
