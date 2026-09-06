-- Add event tagging and source tracking to security_events table
ALTER TABLE public.security_events 
ADD COLUMN IF NOT EXISTS event_tags JSONB DEFAULT '{"environment": "unknown", "type": "unknown", "real_or_test": "unknown"}'::jsonb,
ADD COLUMN IF NOT EXISTS source_ip INET,
ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_by UUID;

-- Create webhook activity tracking table
CREATE TABLE IF NOT EXISTS public.webhook_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_ip INET,
  endpoint TEXT,
  payload_hash TEXT,
  validation_result JSONB,
  rate_limit_applied BOOLEAN DEFAULT false,
  processing_time_ms INTEGER,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on webhook_activity
ALTER TABLE public.webhook_activity ENABLE ROW LEVEL SECURITY;

-- RLS policy for webhook activity
CREATE POLICY "Analysts and above can view webhook activity"
ON public.webhook_activity
FOR SELECT
USING ((get_current_user_role() = ANY(ARRAY['admin', 'analyst', 'operator'])) OR is_master_admin());

-- Create event source management table
CREATE TABLE IF NOT EXISTS public.event_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  trusted BOOLEAN DEFAULT false,
  environment TEXT DEFAULT 'production',
  auto_tag_rules JSONB DEFAULT '{}'::jsonb,
  ip_whitelist INET[],
  api_key_hash TEXT,
  rate_limit_per_minute INTEGER DEFAULT 100,
  enabled BOOLEAN DEFAULT true,
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on event_sources
ALTER TABLE public.event_sources ENABLE ROW LEVEL SECURITY;

-- RLS policy for event sources
CREATE POLICY "Admins can manage event sources"
ON public.event_sources
FOR ALL
USING ((get_current_user_role() = 'admin') OR is_master_admin());

-- Create event processing rules table
CREATE TABLE IF NOT EXISTS public.event_processing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  source_pattern TEXT,
  event_type_pattern TEXT,
  auto_tags JSONB DEFAULT '{}'::jsonb,
  severity_override TEXT,
  auto_resolve BOOLEAN DEFAULT false,
  escalation_required BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 100,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on event_processing_rules
ALTER TABLE public.event_processing_rules ENABLE ROW LEVEL SECURITY;

-- RLS policy for event processing rules
CREATE POLICY "Admins can manage event processing rules"
ON public.event_processing_rules
FOR ALL
USING ((get_current_user_role() = 'admin') OR is_master_admin());

-- Insert default event sources
INSERT INTO public.event_sources (source_name, source_type, trusted, environment, auto_tag_rules) VALUES
('splunk', 'siem', true, 'production', '{"environment": "production", "type": "siem", "real_or_test": "real"}'),
('palo-alto', 'firewall', true, 'production', '{"environment": "production", "type": "network", "real_or_test": "real"}'),
('crowdstrike', 'edr', true, 'production', '{"environment": "production", "type": "endpoint", "real_or_test": "real"}'),
('okta', 'identity', true, 'production', '{"environment": "production", "type": "identity", "real_or_test": "real"}'),
('aws-security', 'cloud', true, 'production', '{"environment": "production", "type": "cloud", "real_or_test": "real"}'),
('imohtep-test', 'test', false, 'test', '{"environment": "test", "type": "simulation", "real_or_test": "test"}')
ON CONFLICT (source_name) DO UPDATE SET 
  auto_tag_rules = EXCLUDED.auto_tag_rules,
  updated_at = now();

-- Insert default processing rules
INSERT INTO public.event_processing_rules (rule_name, source_pattern, event_type_pattern, auto_tags, priority) VALUES
('Production SIEM Events', 'splunk', '.*', '{"environment": "production", "type": "siem", "real_or_test": "real"}', 90),
('Test Environment Events', 'imohtep-test', '.*', '{"environment": "test", "type": "simulation", "real_or_test": "test"}', 10),
('Critical Security Events', '.*', '.*(critical|breach|attack|malware).*', '{"priority": "high", "escalation_required": "true"}', 95),
('Authentication Events', '.*', '.*(login|auth|mfa).*', '{"type": "authentication"}', 80),
('Network Security Events', 'palo-alto', '.*', '{"environment": "production", "type": "network", "real_or_test": "real"}', 85)
ON CONFLICT DO NOTHING;

-- Add trigger for updated_at on event_sources
CREATE TRIGGER update_event_sources_updated_at
  BEFORE UPDATE ON public.event_sources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on event_processing_rules  
CREATE TRIGGER update_event_processing_rules_updated_at
  BEFORE UPDATE ON public.event_processing_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();