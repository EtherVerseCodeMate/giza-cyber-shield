-- Monday.com Integration Configuration Table
CREATE TABLE IF NOT EXISTS public.monday_integration_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  api_token_hash TEXT NOT NULL, -- Store hashed token for validation
  board_mappings JSONB NOT NULL DEFAULT '{
    "security_findings": null,
    "remediation_pipeline": null,
    "compliance_tracking": null,
    "asset_inventory": null,
    "mvp_development": null,
    "product_roadmap": null,
    "onboarding_journey": null
  }'::jsonb,
  sync_preferences JSONB NOT NULL DEFAULT '{
    "sync_frequency": "real-time",
    "auto_create_items": true,
    "bidirectional_sync": true,
    "sync_comments": true
  }'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id)
);

-- Monday.com Sync History Table
CREATE TABLE IF NOT EXISTS public.monday_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'push', 'pull', 'bidirectional'
  entity_type TEXT NOT NULL, -- 'finding', 'task', 'asset', 'feature', etc.
  entity_id UUID,
  monday_item_id TEXT,
  monday_board_id TEXT,
  operation TEXT NOT NULL, -- 'create', 'update', 'delete'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  error_message TEXT,
  sync_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Monday.com Item Mappings Table
CREATE TABLE IF NOT EXISTS public.monday_item_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  local_entity_type TEXT NOT NULL,
  local_entity_id UUID NOT NULL,
  monday_item_id TEXT NOT NULL,
  monday_board_id TEXT NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sync_status TEXT DEFAULT 'synced',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, local_entity_type, local_entity_id)
);

-- Enable RLS
ALTER TABLE public.monday_integration_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monday_sync_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monday_item_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Organization members can manage Monday config"
  ON public.monday_integration_config
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can view sync history"
  ON public.monday_sync_history
  FOR SELECT
  USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "System can insert sync history"
  ON public.monday_sync_history
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Organization members can view item mappings"
  ON public.monday_item_mappings
  FOR ALL
  USING (organization_id IN (SELECT get_user_organizations()));

-- Indexes for performance
CREATE INDEX idx_monday_sync_history_org ON public.monday_sync_history(organization_id, created_at DESC);
CREATE INDEX idx_monday_item_mappings_entity ON public.monday_item_mappings(organization_id, local_entity_type, local_entity_id);
CREATE INDEX idx_monday_item_mappings_item ON public.monday_item_mappings(monday_item_id);