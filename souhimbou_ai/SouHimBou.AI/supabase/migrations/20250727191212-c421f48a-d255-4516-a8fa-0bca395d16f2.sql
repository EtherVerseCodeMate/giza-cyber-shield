-- Create integration configurations table
CREATE TABLE public.integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  integration_type TEXT NOT NULL, -- 'siem', 'edr', 'threat_intel', 'cloud_security', 'webhook'
  provider TEXT NOT NULL, -- 'splunk', 'crowdstrike', 'virustotal', etc.
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  credentials_stored BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'pending')),
  last_sync TIMESTAMPTZ,
  last_health_check TIMESTAMPTZ,
  health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'warning', 'critical', 'unknown')),
  sync_frequency_minutes INTEGER DEFAULT 60,
  enabled BOOLEAN DEFAULT true,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create integration activity logs table
CREATE TABLE public.integration_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES public.integration_configs(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'sync', 'health_check', 'data_received', 'error'
  status TEXT NOT NULL CHECK (status IN ('success', 'warning', 'error')),
  message TEXT,
  details JSONB DEFAULT '{}',
  records_processed INTEGER DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create integration data flows table (for visualization)
CREATE TABLE public.integration_data_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES public.integration_configs(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  destination_system TEXT NOT NULL,
  data_type TEXT NOT NULL, -- 'alerts', 'events', 'indicators', 'logs'
  flow_rate_per_hour INTEGER DEFAULT 0,
  last_data_received TIMESTAMPTZ,
  total_records BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_data_flows ENABLE ROW LEVEL SECURITY;

-- RLS policies for integration_configs
CREATE POLICY "Organization members can manage integrations" ON public.integration_configs
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

-- RLS policies for integration_activity  
CREATE POLICY "Organization members can view integration activity" ON public.integration_activity
FOR SELECT USING (integration_id IN (
  SELECT id FROM public.integration_configs 
  WHERE organization_id IN (SELECT get_user_organizations())
));

CREATE POLICY "System can insert integration activity" ON public.integration_activity
FOR INSERT WITH CHECK (true);

-- RLS policies for integration_data_flows
CREATE POLICY "Organization members can manage data flows" ON public.integration_data_flows
FOR ALL USING (integration_id IN (
  SELECT id FROM public.integration_configs 
  WHERE organization_id IN (SELECT get_user_organizations())
));

-- Create indexes for performance
CREATE INDEX idx_integration_configs_org_type ON public.integration_configs(organization_id, integration_type);
CREATE INDEX idx_integration_activity_integration_created ON public.integration_activity(integration_id, created_at DESC);
CREATE INDEX idx_integration_data_flows_integration ON public.integration_data_flows(integration_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_integration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_integration_configs_updated_at
  BEFORE UPDATE ON public.integration_configs
  FOR EACH ROW EXECUTE FUNCTION update_integration_updated_at();

CREATE TRIGGER update_integration_data_flows_updated_at
  BEFORE UPDATE ON public.integration_data_flows
  FOR EACH ROW EXECUTE FUNCTION update_integration_updated_at();