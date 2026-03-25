-- Fix security vulnerabilities and add monitoring (corrected version)

-- 1. Strengthen profiles RLS for security fields
CREATE OR REPLACE FUNCTION validate_profile_mfa_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow users to update their own MFA data, or admins
  IF OLD.mfa_backup_codes IS DISTINCT FROM NEW.mfa_backup_codes OR
     OLD.emergency_access_codes IS DISTINCT FROM NEW.emergency_access_codes OR
     OLD.trusted_devices IS DISTINCT FROM NEW.trusted_devices THEN
    
    IF NOT (auth.uid() = NEW.user_id OR is_master_admin()) THEN
      RAISE EXCEPTION 'Unauthorized access to MFA security data';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Create trigger for MFA data protection
DROP TRIGGER IF EXISTS validate_profile_mfa_access_trigger ON public.profiles;
CREATE TRIGGER validate_profile_mfa_access_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_profile_mfa_access();

-- 2. Strengthen notifications RLS to be more restrictive
DROP POLICY IF EXISTS "Admins can view notification metadata only" ON public.notifications;
CREATE POLICY "Master admins only can view notification metadata" ON public.notifications
FOR SELECT USING (is_master_admin() AND auth.uid() <> recipient_id);

-- 3. Create performance monitoring table
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on performance metrics
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for performance metrics
CREATE POLICY "Organization members can view performance metrics" 
ON public.performance_metrics 
FOR ALL 
USING (organization_id IN (SELECT get_user_organizations()));

-- 4. Create system health monitoring table
CREATE TABLE IF NOT EXISTS public.system_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  response_time_ms INTEGER,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on system health checks
ALTER TABLE public.system_health_checks ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for system health (admin access only)
CREATE POLICY "Admins can manage system health checks" 
ON public.system_health_checks 
FOR ALL 
USING (is_master_admin() OR get_current_user_role() = 'admin');

-- 5. Create security audit table for enhanced monitoring
CREATE TABLE IF NOT EXISTS public.security_audit_enhanced (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  audit_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  user_id UUID,
  action TEXT NOT NULL,
  risk_level TEXT DEFAULT 'LOW',
  findings JSONB DEFAULT '{}',
  remediation_status TEXT DEFAULT 'PENDING',
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on security audit
ALTER TABLE public.security_audit_enhanced ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for security audit
CREATE POLICY "Organization security audit access" 
ON public.security_audit_enhanced 
FOR ALL 
USING (organization_id IN (SELECT get_user_organizations()) AND (get_current_user_role() = ANY(ARRAY['admin', 'analyst']) OR is_master_admin()));

-- 6. Create compliance validation tracking table
CREATE TABLE IF NOT EXISTS public.compliance_validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  framework_type TEXT NOT NULL,
  control_id TEXT NOT NULL,
  validation_type TEXT NOT NULL,
  status TEXT NOT NULL,
  score NUMERIC,
  findings TEXT,
  evidence_links JSONB DEFAULT '[]',
  validated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  next_validation_due TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on compliance validation
ALTER TABLE public.compliance_validation_results ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for compliance validation
CREATE POLICY "Organization compliance validation access" 
ON public.compliance_validation_results 
FOR ALL 
USING (organization_id IN (SELECT get_user_organizations()) AND (get_current_user_role() = ANY(ARRAY['admin', 'analyst', 'compliance_officer']) OR is_master_admin()));