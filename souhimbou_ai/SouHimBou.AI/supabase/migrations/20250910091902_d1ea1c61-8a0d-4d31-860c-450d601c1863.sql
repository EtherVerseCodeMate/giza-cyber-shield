-- Phase 1: Enhanced Data Model for STIG-First Compliance

-- Create enhanced compliance controls table with all NIST 800-53 controls
CREATE TABLE IF NOT EXISTS public.nist_controls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  control_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  family TEXT NOT NULL,
  control_type TEXT NOT NULL DEFAULT 'base',
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  baseline_low BOOLEAN DEFAULT false,
  baseline_moderate BOOLEAN DEFAULT false,
  baseline_high BOOLEAN DEFAULT false,
  baseline_privacy BOOLEAN DEFAULT false,
  implementation_guidance TEXT,
  assessment_procedures TEXT,
  related_controls TEXT[],
  required_evidence TEXT[],
  automation_possible BOOLEAN DEFAULT false,
  automation_query TEXT,
  stig_mappings JSONB DEFAULT '[]'::jsonb,
  cmmc_mappings JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create STIG rules table for implementation mapping
CREATE TABLE IF NOT EXISTS public.stig_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stig_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  platform TEXT NOT NULL,
  check_content TEXT,
  fix_text TEXT,
  nist_control_mappings TEXT[],
  implementation_status TEXT DEFAULT 'not_implemented',
  automation_script TEXT,
  validation_query TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create environment discovery table for asset mapping
CREATE TABLE IF NOT EXISTS public.environment_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  asset_name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  platform TEXT NOT NULL,
  ip_address INET,
  hostname TEXT,
  operating_system TEXT,
  version TEXT,
  discovery_method TEXT,
  last_scanned TIMESTAMP WITH TIME ZONE DEFAULT now(),
  compliance_status JSONB DEFAULT '{}'::jsonb,
  stig_applicability JSONB DEFAULT '[]'::jsonb,
  risk_score INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create compliance implementation tracking
CREATE TABLE IF NOT EXISTS public.compliance_implementations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  asset_id UUID REFERENCES public.environment_assets(id),
  control_id TEXT NOT NULL,
  stig_rule_id TEXT,
  implementation_status TEXT NOT NULL DEFAULT 'planned',
  implementation_date TIMESTAMP WITH TIME ZONE,
  validation_status TEXT DEFAULT 'pending',
  validation_date TIMESTAMP WITH TIME ZONE,
  evidence_collected JSONB DEFAULT '[]'::jsonb,
  remediation_notes TEXT,
  ai_recommendations JSONB DEFAULT '{}'::jsonb,
  next_review_date DATE,
  assigned_to UUID,
  priority_score INTEGER DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI agent activity tracking
CREATE TABLE IF NOT EXISTS public.ai_compliance_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name TEXT NOT NULL,
  control_family TEXT NOT NULL,
  organization_id UUID NOT NULL,
  last_execution TIMESTAMP WITH TIME ZONE DEFAULT now(),
  execution_status TEXT DEFAULT 'idle',
  recommendations_generated INTEGER DEFAULT 0,
  automations_executed INTEGER DEFAULT 0,
  confidence_score DECIMAL(3,2) DEFAULT 0.85,
  learning_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.nist_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stig_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environment_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_implementations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_compliance_agents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Compliance controls public read" ON public.nist_controls FOR SELECT USING (true);
CREATE POLICY "STIG rules public read" ON public.stig_rules FOR SELECT USING (true);

CREATE POLICY "Environment assets organization access" ON public.environment_assets 
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Compliance implementations organization access" ON public.compliance_implementations 
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "AI agents organization access" ON public.ai_compliance_agents 
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

-- Indexes for performance
CREATE INDEX idx_nist_controls_family ON public.nist_controls(family);
CREATE INDEX idx_nist_controls_baseline ON public.nist_controls(baseline_low, baseline_moderate, baseline_high);
CREATE INDEX idx_stig_rules_platform ON public.stig_rules(platform);
CREATE INDEX idx_environment_assets_org ON public.environment_assets(organization_id);
CREATE INDEX idx_compliance_implementations_org_status ON public.compliance_implementations(organization_id, implementation_status);

-- Updated at triggers
CREATE TRIGGER update_nist_controls_updated_at BEFORE UPDATE ON public.nist_controls
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stig_rules_updated_at BEFORE UPDATE ON public.stig_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_environment_assets_updated_at BEFORE UPDATE ON public.environment_assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_implementations_updated_at BEFORE UPDATE ON public.compliance_implementations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_compliance_agents_updated_at BEFORE UPDATE ON public.ai_compliance_agents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();