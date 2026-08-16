-- STIG Intelligence Layer Database Schema
-- Phase 2: STIG Trusted Registry, CMMC-to-STIG Bridge, Threat Intelligence

-- STIG Trusted Registry Tables
CREATE TABLE IF NOT EXISTS public.stig_trusted_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  stig_id TEXT NOT NULL,
  stig_version TEXT NOT NULL,
  platform_type TEXT NOT NULL,
  configuration_template JSONB NOT NULL DEFAULT '{}',
  validation_rules JSONB NOT NULL DEFAULT '[]',
  implementation_guidance TEXT,
  vendor_specific_notes TEXT,
  confidence_score DECIMAL(3,2) DEFAULT 0.95,
  ai_verified BOOLEAN DEFAULT false,
  ai_verification_date TIMESTAMPTZ,
  disa_approved BOOLEAN DEFAULT false,
  approval_date DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stig_ai_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  configuration_id UUID NOT NULL REFERENCES public.stig_trusted_configurations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  verification_type TEXT NOT NULL,
  environment_context JSONB NOT NULL DEFAULT '{}',
  verification_status TEXT NOT NULL CHECK (verification_status IN ('verified', 'failed', 'pending', 'warning')),
  confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.0,
  risk_assessment JSONB DEFAULT '{}',
  recommendations JSONB DEFAULT '[]',
  verification_details TEXT,
  ai_model_version TEXT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CMMC-to-STIG Bridge Tables
CREATE TABLE IF NOT EXISTS public.cmmc_control_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cmmc_control_id TEXT NOT NULL,
  cmmc_level INTEGER NOT NULL,
  cmmc_domain TEXT NOT NULL,
  stig_rule_id TEXT NOT NULL,
  stig_title TEXT NOT NULL,
  platform_type TEXT NOT NULL,
  mapping_strength TEXT NOT NULL CHECK (mapping_strength IN ('direct', 'partial', 'indirect', 'supplemental')),
  implementation_priority INTEGER DEFAULT 50,
  automation_possible BOOLEAN DEFAULT false,
  implementation_guidance TEXT,
  validation_criteria JSONB DEFAULT '[]',
  effort_estimate_hours INTEGER,
  cost_estimate DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cmmc_implementation_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  cmmc_level INTEGER NOT NULL,
  target_platforms TEXT[] NOT NULL DEFAULT '{}',
  total_stig_rules INTEGER DEFAULT 0,
  automated_implementations INTEGER DEFAULT 0,
  manual_implementations INTEGER DEFAULT 0,
  estimated_effort_hours INTEGER DEFAULT 0,
  estimated_cost DECIMAL(12,2),
  implementation_status TEXT DEFAULT 'planning' CHECK (implementation_status IN ('planning', 'in_progress', 'completed', 'on_hold')),
  progress_percentage DECIMAL(5,2) DEFAULT 0.0,
  plan_data JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- STIG Threat Intelligence Tables
CREATE TABLE IF NOT EXISTS public.stig_threat_correlations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  threat_source TEXT NOT NULL,
  threat_indicator TEXT NOT NULL,
  threat_type TEXT NOT NULL,
  correlated_stig_rules TEXT[] NOT NULL DEFAULT '{}',
  risk_elevation TEXT NOT NULL CHECK (risk_elevation IN ('none', 'low', 'medium', 'high', 'critical')),
  correlation_confidence DECIMAL(3,2) DEFAULT 0.0,
  threat_intelligence JSONB NOT NULL DEFAULT '{}',
  mitigation_recommendations JSONB DEFAULT '[]',
  automated_response_triggered BOOLEAN DEFAULT false,
  correlation_details TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.stig_intelligence_feeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_name TEXT NOT NULL,
  feed_type TEXT NOT NULL CHECK (feed_type IN ('disa_vulnerability', 'cve_nvd', 'mitre_attack', 'custom')),
  feed_url TEXT,
  authentication_config JSONB DEFAULT '{}',
  sync_frequency_hours INTEGER DEFAULT 24,
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
  records_updated INTEGER DEFAULT 0,
  sync_errors JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stig_ai_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  asset_id UUID,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('optimization', 'gap_analysis', 'risk_assessment', 'predictive')),
  stig_rules_analyzed TEXT[] NOT NULL DEFAULT '{}',
  analysis_scope JSONB NOT NULL DEFAULT '{}',
  ai_findings JSONB NOT NULL DEFAULT '{}',
  recommendations JSONB NOT NULL DEFAULT '[]',
  confidence_score DECIMAL(3,2) DEFAULT 0.0,
  implementation_priority INTEGER DEFAULT 50,
  estimated_impact TEXT,
  analysis_metadata JSONB DEFAULT '{}',
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '30 days'
);

-- Enable RLS on all tables
ALTER TABLE public.stig_trusted_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_ai_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmmc_control_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmmc_implementation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_threat_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_intelligence_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_ai_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Organization members can access STIG configurations" 
ON public.stig_trusted_configurations 
FOR ALL 
USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can access AI verifications" 
ON public.stig_ai_verifications 
FOR ALL 
USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "CMMC mappings are publicly readable" 
ON public.cmmc_control_mappings 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage CMMC mappings" 
ON public.cmmc_control_mappings 
FOR ALL 
USING (get_current_user_role() = 'admin' OR is_master_admin());

CREATE POLICY "Organization members can access implementation plans" 
ON public.cmmc_implementation_plans 
FOR ALL 
USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can access threat correlations" 
ON public.stig_threat_correlations 
FOR ALL 
USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Admins can manage intelligence feeds" 
ON public.stig_intelligence_feeds 
FOR ALL 
USING (get_current_user_role() = 'admin' OR is_master_admin());

CREATE POLICY "Organization members can access AI analyses" 
ON public.stig_ai_analyses 
FOR ALL 
USING (organization_id IN (SELECT get_user_organizations()));

-- Indexes for performance
CREATE INDEX idx_stig_trusted_configurations_org_platform ON public.stig_trusted_configurations(organization_id, platform_type);
CREATE INDEX idx_stig_trusted_configurations_stig_id ON public.stig_trusted_configurations(stig_id, stig_version);
CREATE INDEX idx_cmmc_control_mappings_cmmc_level ON public.cmmc_control_mappings(cmmc_control_id, cmmc_level);
CREATE INDEX idx_stig_threat_correlations_org_detected ON public.stig_threat_correlations(organization_id, detected_at DESC);
CREATE INDEX idx_stig_ai_analyses_org_type ON public.stig_ai_analyses(organization_id, analysis_type);

-- Triggers for updated_at
CREATE TRIGGER update_stig_trusted_configurations_updated_at
  BEFORE UPDATE ON public.stig_trusted_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cmmc_control_mappings_updated_at
  BEFORE UPDATE ON public.cmmc_control_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cmmc_implementation_plans_updated_at
  BEFORE UPDATE ON public.cmmc_implementation_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stig_intelligence_feeds_updated_at
  BEFORE UPDATE ON public.stig_intelligence_feeds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();