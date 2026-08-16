-- Create environment_discoveries table for auto-detection results
CREATE TABLE public.environment_discoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  discovery_type TEXT NOT NULL CHECK (discovery_type IN ('cloud', 'network', 'platform', 'application', 'ci_cd')),
  provider TEXT NOT NULL CHECK (provider IN ('aws', 'azure', 'gcp', 'on-prem', 'kubernetes', 'docker', 'github', 'gitlab', 'jenkins', 'unknown')),
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  detected_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  auto_configured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_environment_discoveries_org ON public.environment_discoveries(organization_id);
CREATE INDEX idx_environment_discoveries_type ON public.environment_discoveries(discovery_type);
CREATE INDEX idx_environment_discoveries_provider ON public.environment_discoveries(provider);

-- Enable RLS
ALTER TABLE public.environment_discoveries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Organization members can view discoveries"
  ON public.environment_discoveries
  FOR SELECT
  USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can insert discoveries"
  ON public.environment_discoveries
  FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can update discoveries"
  ON public.environment_discoveries
  FOR UPDATE
  USING (organization_id IN (SELECT get_user_organizations()));

-- Create trigger for updated_at
CREATE TRIGGER update_environment_discoveries_updated_at
  BEFORE UPDATE ON public.environment_discoveries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();