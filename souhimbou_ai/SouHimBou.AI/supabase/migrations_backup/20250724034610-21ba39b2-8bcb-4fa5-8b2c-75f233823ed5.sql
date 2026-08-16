-- Create SIEM integrations table
CREATE TABLE IF NOT EXISTS public.siem_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  siem_type TEXT NOT NULL CHECK (siem_type IN ('splunk', 'elastic', 'qradar', 'sentinel', 'arcsight', 'other')),
  config JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'configuring')),
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.siem_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Organization members can manage SIEM integrations"
ON public.siem_integrations
FOR ALL
USING (organization_id IN (SELECT get_user_organizations()));

-- Create EDR integrations table
CREATE TABLE IF NOT EXISTS public.edr_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  edr_type TEXT NOT NULL CHECK (edr_type IN ('crowdstrike', 'sentinelone', 'carbon_black', 'cylance', 'defender_atp', 'other')),
  config JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'configuring')),
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.edr_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Organization members can manage EDR integrations"
ON public.edr_integrations
FOR ALL
USING (organization_id IN (SELECT get_user_organizations()));

-- Create threat feeds table for external intelligence
CREATE TABLE IF NOT EXISTS public.threat_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  feed_name TEXT NOT NULL,
  feed_type TEXT NOT NULL CHECK (feed_type IN ('commercial', 'government', 'open_source', 'community')),
  provider TEXT NOT NULL,
  feed_url TEXT,
  api_config JSONB DEFAULT '{}',
  status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error', 'syncing')),
  last_update TIMESTAMP WITH TIME ZONE,
  indicators_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.threat_feeds ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Organization members can manage threat feeds"
ON public.threat_feeds
FOR ALL
USING (organization_id IN (SELECT get_user_organizations()));

-- Create network monitoring table for real-time network analysis
CREATE TABLE IF NOT EXISTS public.network_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  source_ip INET NOT NULL,
  destination_ip INET NOT NULL,
  source_port INTEGER,
  destination_port INTEGER,
  protocol TEXT NOT NULL,
  bytes_transferred BIGINT DEFAULT 0,
  packets_count INTEGER DEFAULT 0,
  connection_state TEXT,
  threat_score INTEGER DEFAULT 0,
  geolocation JSONB DEFAULT '{}',
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.network_monitoring ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Organization members can view network monitoring"
ON public.network_monitoring
FOR ALL
USING (organization_id IN (SELECT get_user_organizations()));

-- Create behavioral analytics table
CREATE TABLE IF NOT EXISTS public.behavioral_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('user', 'device', 'application', 'network')),
  entity_identifier TEXT NOT NULL,
  behavior_type TEXT NOT NULL,
  baseline_metrics JSONB DEFAULT '{}',
  current_metrics JSONB DEFAULT '{}',
  anomaly_score NUMERIC DEFAULT 0,
  risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  analysis_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  analysis_period_end TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Enable RLS
ALTER TABLE public.behavioral_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Organization members can view behavioral analytics"
ON public.behavioral_analytics
FOR ALL
USING (organization_id IN (SELECT get_user_organizations()));

-- Add triggers for updated_at
CREATE TRIGGER update_siem_integrations_updated_at
  BEFORE UPDATE ON public.siem_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_edr_integrations_updated_at
  BEFORE UPDATE ON public.edr_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_threat_feeds_updated_at
  BEFORE UPDATE ON public.threat_feeds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();