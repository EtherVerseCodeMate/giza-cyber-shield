-- Create third_party_testers table
CREATE TABLE public.third_party_testers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  testing_scope TEXT NOT NULL,
  access_level TEXT NOT NULL CHECK (access_level IN ('sandbox', 'limited_production', 'full_production')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'completed')),
  risk_assessment TEXT NOT NULL DEFAULT 'medium' CHECK (risk_assessment IN ('low', 'medium', 'high', 'critical')),
  monitoring_enabled BOOLEAN NOT NULL DEFAULT true,
  containment_rules JSONB NOT NULL DEFAULT '{}',
  suspension_reason TEXT,
  suspended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  organization_id UUID
);

-- Create tester_activities table
CREATE TABLE public.tester_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tester_id UUID NOT NULL REFERENCES public.third_party_testers(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  resource_accessed TEXT NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  details JSONB NOT NULL DEFAULT '{}',
  flagged BOOLEAN NOT NULL DEFAULT false,
  source_ip INET,
  user_agent TEXT,
  session_id TEXT,
  organization_id UUID
);

-- Create security_alerts table (enhanced)
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tester_id UUID REFERENCES public.third_party_testers(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  alert_category TEXT NOT NULL DEFAULT 'general',
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  auto_contained BOOLEAN NOT NULL DEFAULT false,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  organization_id UUID
);

-- Enable Row Level Security
ALTER TABLE public.third_party_testers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tester_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for third_party_testers
CREATE POLICY "Admins can manage third party testers" 
ON public.third_party_testers 
FOR ALL 
USING ((get_current_user_role() = 'admin') OR is_master_admin());

-- RLS Policies for tester_activities
CREATE POLICY "Admins can view tester activities" 
ON public.tester_activities 
FOR SELECT 
USING ((get_current_user_role() = ANY(ARRAY['admin', 'analyst', 'operator'])) OR is_master_admin());

CREATE POLICY "System can insert tester activities" 
ON public.tester_activities 
FOR INSERT 
WITH CHECK (true);

-- RLS Policies for security_alerts (enhanced)
CREATE POLICY "Admins can manage security alerts" 
ON public.security_alerts 
FOR ALL 
USING ((get_current_user_role() = ANY(ARRAY['admin', 'analyst', 'operator'])) OR is_master_admin());

-- Create indexes for performance
CREATE INDEX idx_tester_activities_tester_id ON public.tester_activities(tester_id);
CREATE INDEX idx_tester_activities_timestamp ON public.tester_activities(timestamp DESC);
CREATE INDEX idx_tester_activities_risk_score ON public.tester_activities(risk_score DESC);
CREATE INDEX idx_security_alerts_tester_id ON public.security_alerts(tester_id);
CREATE INDEX idx_security_alerts_category ON public.security_alerts(alert_category);
CREATE INDEX idx_security_alerts_created_at ON public.security_alerts(created_at DESC);

-- Trigger for updating timestamps
CREATE TRIGGER update_third_party_testers_updated_at
  BEFORE UPDATE ON public.third_party_testers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to log third-party security events
CREATE OR REPLACE FUNCTION public.log_third_party_security_event(
  p_tester_id UUID,
  p_event_type TEXT,
  p_severity TEXT DEFAULT 'medium',
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  alert_id UUID;
BEGIN
  INSERT INTO public.security_alerts (
    tester_id,
    alert_type,
    alert_category,
    severity,
    description,
    metadata
  ) VALUES (
    p_tester_id,
    p_event_type,
    'third_party',
    p_severity,
    'Third-party security event: ' || p_event_type,
    p_details
  ) RETURNING id INTO alert_id;

  -- Also log to audit_logs
  INSERT INTO public.audit_logs (
    action,
    resource_type,
    resource_id,
    details,
    ip_address,
    created_at
  ) VALUES (
    'third_party_security_event',
    'third_party_tester',
    p_tester_id::text,
    jsonb_build_object(
      'event_type', p_event_type,
      'severity', p_severity,
      'alert_id', alert_id,
      'details', p_details
    ),
    inet_client_addr(),
    now()
  );

  RETURN alert_id;
END;
$$;