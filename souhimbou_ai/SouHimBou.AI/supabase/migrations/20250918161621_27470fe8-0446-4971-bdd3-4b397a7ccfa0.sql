-- Priority 1: Fix Critical Data Exposure - Restrict access to security intelligence tables

-- Update RLS policies for security intelligence tables to require authentication and proper roles
DROP POLICY IF EXISTS "CMMC mappings are publicly readable" ON public.cmmc_control_mappings;
CREATE POLICY "Security personnel can view CMMC mappings" 
ON public.cmmc_control_mappings 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND (
    get_current_user_role() IN ('admin', 'analyst', 'compliance_officer') OR 
    is_master_admin()
  )
);

DROP POLICY IF EXISTS "CMMC mappings are publicly readable" ON public.cmmc_stig_mappings;
CREATE POLICY "Security personnel can view CMMC STIG mappings" 
ON public.cmmc_stig_mappings 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND (
    get_current_user_role() IN ('admin', 'analyst', 'compliance_officer') OR 
    is_master_admin()
  )
);

-- Create security function to validate access to security intelligence data
CREATE OR REPLACE FUNCTION public.has_security_clearance(required_level text DEFAULT 'SECRET')
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN is_master_admin() THEN true
    WHEN get_current_user_role() = 'admin' THEN true
    WHEN get_current_user_role() = 'compliance_officer' AND required_level IN ('UNCLASSIFIED', 'CONFIDENTIAL', 'SECRET') THEN true
    WHEN get_current_user_role() = 'analyst' AND required_level IN ('UNCLASSIFIED', 'CONFIDENTIAL') THEN true
    WHEN auth.uid() IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND security_clearance >= required_level
    )
  END;
$$;

-- Priority 2: Authentication Security Hardening

-- Create table for tracking failed login attempts
CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  ip_address inet,
  user_agent text,
  attempted_at timestamp with time zone DEFAULT now(),
  attempt_type text DEFAULT 'password',
  blocked_until timestamp with time zone
);

ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view failed login attempts"
ON public.failed_login_attempts
FOR SELECT
USING (is_master_admin() OR get_current_user_role() = 'admin');

-- Create table for device trust management
CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint text NOT NULL,
  device_name text,
  trusted_at timestamp with time zone DEFAULT now(),
  last_used timestamp with time zone DEFAULT now(),
  ip_address inet,
  user_agent text,
  is_active boolean DEFAULT true,
  expires_at timestamp with time zone,
  UNIQUE(user_id, device_fingerprint)
);

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own trusted devices"
ON public.trusted_devices
FOR ALL
USING (auth.uid() = user_id);

-- Create enhanced session security tracking
CREATE TABLE IF NOT EXISTS public.session_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  event_type text NOT NULL,
  risk_level text DEFAULT 'low',
  device_fingerprint text,
  ip_address inet,
  user_agent text,
  location_data jsonb,
  details jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.session_security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own session events"
ON public.session_security_events
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert session events"
ON public.session_security_events
FOR INSERT
WITH CHECK (true);

-- Function to check account lockout status
CREATE OR REPLACE FUNCTION public.is_account_locked(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  failed_count integer;
  last_attempt timestamp with time zone;
  lockout_until timestamp with time zone;
BEGIN
  -- Count failed attempts in last 15 minutes
  SELECT COUNT(*), MAX(attempted_at), MAX(blocked_until)
  INTO failed_count, last_attempt, lockout_until
  FROM public.failed_login_attempts
  WHERE email = user_email 
  AND attempted_at > now() - INTERVAL '15 minutes';
  
  -- Check if account is currently locked
  IF lockout_until IS NOT NULL AND lockout_until > now() THEN
    RETURN true;
  END IF;
  
  -- Lock account if too many failed attempts
  IF failed_count >= 5 THEN
    INSERT INTO public.failed_login_attempts (email, attempt_type, blocked_until)
    VALUES (user_email, 'lockout', now() + INTERVAL '1 hour');
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Function to record failed login attempts
CREATE OR REPLACE FUNCTION public.record_failed_login(user_email text, client_ip inet DEFAULT NULL, client_user_agent text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.failed_login_attempts (email, ip_address, user_agent)
  VALUES (user_email, COALESCE(client_ip, inet_client_addr()), client_user_agent);
  
  -- Log security event
  PERFORM log_security_event_enhanced(
    'failed_login_attempt',
    'MEDIUM',
    jsonb_build_object(
      'email', user_email,
      'ip_address', COALESCE(client_ip, inet_client_addr()),
      'user_agent', client_user_agent
    )
  );
END;
$$;

-- Priority 3: Database Function Security - Add proper search_path to all functions missing it

-- Update existing functions to include proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Enhanced password strength validation
CREATE OR REPLACE FUNCTION public.validate_password_strength(password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  score integer := 0;
  feedback text[] := '{}';
  min_length integer := 12;
  has_upper boolean := false;
  has_lower boolean := false;
  has_digit boolean := false;
  has_special boolean := false;
  common_patterns text[] := ARRAY['password', '123456', 'qwerty', 'admin', 'letmein'];
  pattern text;
BEGIN
  -- Check minimum length
  IF length(password) < min_length THEN
    feedback := array_append(feedback, 'Password must be at least ' || min_length || ' characters');
  ELSE
    score := score + 25;
  END IF;
  
  -- Check character variety
  IF password ~ '[A-Z]' THEN
    has_upper := true;
    score := score + 15;
  ELSE
    feedback := array_append(feedback, 'Add uppercase letters');
  END IF;
  
  IF password ~ '[a-z]' THEN
    has_lower := true;
    score := score + 15;
  ELSE
    feedback := array_append(feedback, 'Add lowercase letters');
  END IF;
  
  IF password ~ '[0-9]' THEN
    has_digit := true;
    score := score + 15;
  ELSE
    feedback := array_append(feedback, 'Add numbers');
  END IF;
  
  IF password ~ '[^A-Za-z0-9]' THEN
    has_special := true;
    score := score + 20;
  ELSE
    feedback := array_append(feedback, 'Add special characters');
  END IF;
  
  -- Check for common patterns
  FOREACH pattern IN ARRAY common_patterns
  LOOP
    IF lower(password) LIKE '%' || pattern || '%' THEN
      score := score - 30;
      feedback := array_append(feedback, 'Avoid common passwords and patterns');
      EXIT;
    END IF;
  END LOOP;
  
  -- Bonus for length
  IF length(password) > 16 THEN
    score := score + 10;
  END IF;
  
  RETURN jsonb_build_object(
    'score', GREATEST(0, LEAST(100, score)),
    'is_strong', score >= 80,
    'feedback', feedback
  );
END;
$$;

-- Priority 4: Enhanced Security Monitoring

-- Create security policy compliance checker
CREATE OR REPLACE FUNCTION public.check_security_policy_compliance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  compliance_results jsonb := '{}';
  mfa_adoption_rate numeric;
  unprotected_admins integer;
  weak_passwords integer;
  inactive_sessions integer;
BEGIN
  -- Only security personnel can run compliance checks
  IF NOT (is_master_admin() OR get_current_user_role() IN ('admin', 'compliance_officer')) THEN
    RAISE EXCEPTION 'Insufficient privileges for security compliance check';
  END IF;
  
  -- Check MFA adoption rate
  SELECT 
    ROUND(
      (COUNT(*) FILTER (WHERE mfa_enabled = true) * 100.0) / NULLIF(COUNT(*), 0), 
      2
    )
  INTO mfa_adoption_rate
  FROM public.profiles;
  
  -- Count unprotected admin accounts
  SELECT COUNT(*)
  INTO unprotected_admins
  FROM public.profiles p
  WHERE p.role IN ('admin') 
  AND (p.mfa_enabled = false OR p.mfa_enabled IS NULL);
  
  -- Count sessions that should be expired
  SELECT COUNT(*)
  INTO inactive_sessions
  FROM public.session_security_events
  WHERE created_at < now() - INTERVAL '24 hours'
  AND event_type = 'session_start';
  
  compliance_results := jsonb_build_object(
    'mfa_adoption_rate', COALESCE(mfa_adoption_rate, 0),
    'unprotected_admin_accounts', unprotected_admins,
    'inactive_sessions_requiring_cleanup', inactive_sessions,
    'compliance_score', 
      CASE 
        WHEN mfa_adoption_rate >= 90 AND unprotected_admins = 0 THEN 'EXCELLENT'
        WHEN mfa_adoption_rate >= 70 AND unprotected_admins <= 1 THEN 'GOOD'
        WHEN mfa_adoption_rate >= 50 THEN 'FAIR'
        ELSE 'POOR'
      END,
    'recommendations', 
      CASE 
        WHEN unprotected_admins > 0 THEN jsonb_build_array('Enable MFA for all admin accounts')
        WHEN mfa_adoption_rate < 70 THEN jsonb_build_array('Increase MFA adoption organization-wide')
        ELSE jsonb_build_array('Maintain current security posture')
      END,
    'checked_at', now()
  );
  
  -- Log the compliance check
  PERFORM log_security_event_enhanced(
    'security_compliance_check',
    'INFO',
    compliance_results
  );
  
  RETURN compliance_results;
END;
$$;

-- Create automated security alert correlation function
CREATE OR REPLACE FUNCTION public.correlate_security_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  suspicious_ips inet[];
  high_risk_users uuid[];
  alert_count integer;
BEGIN
  -- Find IPs with multiple failed login attempts
  SELECT ARRAY_AGG(DISTINCT ip_address)
  INTO suspicious_ips
  FROM public.failed_login_attempts
  WHERE attempted_at > now() - INTERVAL '1 hour'
  GROUP BY ip_address
  HAVING COUNT(*) >= 3;
  
  -- Find users with multiple security events
  SELECT ARRAY_AGG(DISTINCT user_id)
  INTO high_risk_users
  FROM public.session_security_events
  WHERE created_at > now() - INTERVAL '1 hour'
  AND risk_level IN ('HIGH', 'CRITICAL')
  GROUP BY user_id
  HAVING COUNT(*) >= 2;
  
  -- Create correlation alerts for suspicious activity
  IF array_length(suspicious_ips, 1) > 0 THEN
    INSERT INTO public.security_alerts (
      alert_type,
      alert_category,
      severity,
      description,
      metadata
    ) VALUES (
      'coordinated_attack_pattern',
      'network_security',
      'HIGH',
      'Multiple failed login attempts detected from suspicious IP addresses',
      jsonb_build_object(
        'suspicious_ips', suspicious_ips,
        'detection_window', '1 hour',
        'auto_generated', true,
        'recommended_action', 'Block suspicious IP addresses and review access logs'
      )
    );
  END IF;
  
  IF array_length(high_risk_users, 1) > 0 THEN
    INSERT INTO public.security_alerts (
      alert_type,
      alert_category,
      severity,
      description,
      metadata
    ) VALUES (
      'user_compromise_indicators',
      'user_security',
      'CRITICAL',
      'Multiple high-risk security events detected for user accounts',
      jsonb_build_object(
        'affected_users', high_risk_users,
        'detection_window', '1 hour',
        'auto_generated', true,
        'recommended_action', 'Force password reset and MFA verification for affected users'
      )
    );
  END IF;
END;
$$;