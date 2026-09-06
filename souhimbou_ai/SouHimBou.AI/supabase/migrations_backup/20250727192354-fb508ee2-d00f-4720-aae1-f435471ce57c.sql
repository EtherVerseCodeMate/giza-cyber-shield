-- Create Zero Trust policy management tables
CREATE TABLE public.zero_trust_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  policy_name TEXT NOT NULL,
  policy_type TEXT NOT NULL CHECK (policy_type IN ('device_trust', 'network_access', 'data_protection', 'identity_verification', 'application_security')),
  policy_config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  enforcement_level TEXT DEFAULT 'monitor' CHECK (enforcement_level IN ('monitor', 'warn', 'block')),
  risk_threshold INTEGER DEFAULT 50 CHECK (risk_threshold >= 0 AND risk_threshold <= 100),
  conditions JSONB NOT NULL DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create Zero Trust device assessments table
CREATE TABLE public.zero_trust_device_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  device_fingerprint TEXT NOT NULL,
  assessment_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  trust_score INTEGER NOT NULL CHECK (trust_score >= 0 AND trust_score <= 100),
  risk_factors JSONB DEFAULT '{}',
  compliance_status JSONB DEFAULT '{}',
  security_posture JSONB DEFAULT '{}',
  network_context JSONB DEFAULT '{}',
  behavioral_score INTEGER DEFAULT 50 CHECK (behavioral_score >= 0 AND behavioral_score <= 100),
  last_validation TIMESTAMPTZ,
  validation_result TEXT CHECK (validation_result IN ('passed', 'failed', 'conditional')),
  remediation_required BOOLEAN DEFAULT false,
  remediation_actions JSONB DEFAULT '[]'
);

-- Create Zero Trust access decisions table
CREATE TABLE public.zero_trust_access_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'deny', 'conditional')),
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  factors_evaluated JSONB NOT NULL DEFAULT '{}',
  policy_violations JSONB DEFAULT '[]',
  conditions_applied JSONB DEFAULT '[]',
  context_data JSONB DEFAULT '{}',
  decision_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id TEXT,
  ip_address INET,
  user_agent TEXT
);

-- Create Zero Trust network segments table
CREATE TABLE public.zero_trust_network_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  segment_name TEXT NOT NULL,
  segment_type TEXT NOT NULL CHECK (segment_type IN ('trusted', 'semi_trusted', 'untrusted', 'quarantine')),
  network_ranges JSONB NOT NULL DEFAULT '[]', -- Array of CIDR blocks
  access_policies JSONB NOT NULL DEFAULT '{}',
  monitoring_level TEXT DEFAULT 'standard' CHECK (monitoring_level IN ('minimal', 'standard', 'enhanced', 'maximum')),
  isolation_rules JSONB DEFAULT '{}',
  allowed_protocols JSONB DEFAULT '[]',
  micro_segmentation_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create Zero Trust risk assessments table
CREATE TABLE public.zero_trust_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('user', 'device', 'network', 'application', 'data')),
  subject_id TEXT NOT NULL,
  overall_risk_score INTEGER NOT NULL CHECK (overall_risk_score >= 0 AND overall_risk_score <= 100),
  risk_categories JSONB NOT NULL DEFAULT '{}',
  threat_indicators JSONB DEFAULT '[]',
  vulnerability_score INTEGER DEFAULT 0 CHECK (vulnerability_score >= 0 AND vulnerability_score <= 100),
  compliance_score INTEGER DEFAULT 0 CHECK (compliance_score >= 0 AND compliance_score <= 100),
  behavioral_anomalies JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  assessment_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'superseded'))
);

-- Enable RLS on all tables
ALTER TABLE public.zero_trust_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zero_trust_device_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zero_trust_access_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zero_trust_network_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zero_trust_risk_assessments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Organization members can manage Zero Trust policies" ON public.zero_trust_policies
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can manage device assessments" ON public.zero_trust_device_assessments
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can view access decisions" ON public.zero_trust_access_decisions
FOR SELECT USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "System can insert access decisions" ON public.zero_trust_access_decisions
FOR INSERT WITH CHECK (true);

CREATE POLICY "Organization members can manage network segments" ON public.zero_trust_network_segments
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can manage risk assessments" ON public.zero_trust_risk_assessments
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

-- Create indexes for performance
CREATE INDEX idx_zt_policies_org_type ON public.zero_trust_policies(organization_id, policy_type);
CREATE INDEX idx_zt_device_assessments_user_timestamp ON public.zero_trust_device_assessments(user_id, assessment_timestamp DESC);
CREATE INDEX idx_zt_access_decisions_user_timestamp ON public.zero_trust_access_decisions(user_id, decision_timestamp DESC);
CREATE INDEX idx_zt_network_segments_org ON public.zero_trust_network_segments(organization_id);
CREATE INDEX idx_zt_risk_assessments_subject ON public.zero_trust_risk_assessments(subject_id, assessment_timestamp DESC);

-- Create triggers for timestamp updates
CREATE TRIGGER update_zero_trust_policies_updated_at
  BEFORE UPDATE ON public.zero_trust_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zero_trust_network_segments_updated_at
  BEFORE UPDATE ON public.zero_trust_network_segments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();