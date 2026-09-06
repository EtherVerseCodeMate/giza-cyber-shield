-- Create onboarding workflow tracking table
CREATE TABLE public.organization_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  current_phase TEXT NOT NULL DEFAULT 'pre_onboarding',
  phase_status JSONB NOT NULL DEFAULT '{
    "pre_onboarding": {"status": "pending", "completed_at": null},
    "discovery": {"status": "pending", "completed_at": null},
    "integration": {"status": "pending", "completed_at": null},
    "training": {"status": "pending", "completed_at": null},
    "go_live": {"status": "pending", "completed_at": null}
  }'::jsonb,
  intake_data JSONB,
  discovery_results JSONB,
  integration_config JSONB,
  training_progress JSONB,
  assigned_lead UUID REFERENCES auth.users(id),
  technical_lead UUID REFERENCES auth.users(id),
  milestones JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organization_onboarding ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Organization members can view their onboarding"
  ON public.organization_onboarding
  FOR SELECT
  USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization admins can manage onboarding"
  ON public.organization_onboarding
  FOR ALL
  USING (
    organization_id IN (SELECT get_user_organizations()) 
    AND (get_current_user_role() = 'admin' OR is_master_admin())
  );

-- Create onboarding checklist items table
CREATE TABLE public.onboarding_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id UUID NOT NULL REFERENCES public.organization_onboarding(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_description TEXT,
  required BOOLEAN DEFAULT true,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES auth.users(id),
  evidence_links JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Organization members can access checklist items"
  ON public.onboarding_checklist_items
  FOR ALL
  USING (
    onboarding_id IN (
      SELECT id FROM public.organization_onboarding 
      WHERE organization_id IN (SELECT get_user_organizations())
    )
  );

-- Create indexes
CREATE INDEX idx_org_onboarding_org_id ON public.organization_onboarding(organization_id);
CREATE INDEX idx_org_onboarding_phase ON public.organization_onboarding(current_phase);
CREATE INDEX idx_checklist_items_onboarding ON public.onboarding_checklist_items(onboarding_id);
CREATE INDEX idx_checklist_items_phase ON public.onboarding_checklist_items(phase);

-- Create updated_at trigger
CREATE TRIGGER update_org_onboarding_updated_at
  BEFORE UPDATE ON public.organization_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();