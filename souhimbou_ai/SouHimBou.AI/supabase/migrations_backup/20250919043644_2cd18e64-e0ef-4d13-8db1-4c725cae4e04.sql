-- Create database tables for DISA STIGs API & Open Controls Integration

-- DISA STIGs API Cache Table
CREATE TABLE public.disa_stigs_api_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  api_endpoint TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  cached_data JSONB NOT NULL DEFAULT '{}',
  cache_expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Open Controls Performance Metrics Table
CREATE TABLE public.open_controls_performance_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL DEFAULT 0,
  measurement_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metric_metadata JSONB NOT NULL DEFAULT '{}',
  performance_trend TEXT DEFAULT 'stable',
  alert_threshold_exceeded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ML Training Datasets Table
CREATE TABLE public.ml_training_datasets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  dataset_name TEXT NOT NULL,
  dataset_type TEXT NOT NULL,
  data_source TEXT NOT NULL,
  training_data JSONB NOT NULL DEFAULT '{}',
  validation_data JSONB DEFAULT '{}',
  model_metadata JSONB DEFAULT '{}',
  quality_score NUMERIC DEFAULT 0.0,
  data_freshness TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enterprise Performance Analytics Table
CREATE TABLE public.enterprise_performance_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  analytics_type TEXT NOT NULL,
  time_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  time_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  performance_data JSONB NOT NULL DEFAULT '{}',
  compliance_scores JSONB DEFAULT '{}',
  optimization_recommendations JSONB DEFAULT '[]',
  trend_analysis JSONB DEFAULT '{}',
  cost_impact_analysis JSONB DEFAULT '{}',
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enhanced Open Controls Integrations Table
CREATE TABLE public.enhanced_open_controls_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  integration_name TEXT NOT NULL,
  api_endpoint TEXT NOT NULL,
  authentication_method TEXT NOT NULL DEFAULT 'api_key',
  sync_frequency_minutes INTEGER DEFAULT 60,
  last_sync_timestamp TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'pending',
  sync_error_log JSONB DEFAULT '[]',
  performance_metrics JSONB DEFAULT '{}',
  data_mapping_rules JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Live API Gateway Requests Table
CREATE TABLE public.live_api_gateway_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  request_id TEXT NOT NULL,
  api_endpoint TEXT NOT NULL,
  request_method TEXT NOT NULL,
  request_payload JSONB DEFAULT '{}',
  response_data JSONB DEFAULT '{}',
  response_status INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  error_details JSONB DEFAULT '{}',
  request_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip_address INET
);

-- Enterprise Schema Evolutions Table
CREATE TABLE public.enterprise_schema_evolutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  schema_name TEXT NOT NULL,
  evolution_version TEXT NOT NULL,
  evolution_trigger TEXT NOT NULL,
  changes_applied JSONB NOT NULL DEFAULT '[]',
  performance_impact JSONB DEFAULT '{}',
  rollback_plan JSONB DEFAULT '{}',
  confidence_score NUMERIC DEFAULT 0.0,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  rollback_available BOOLEAN DEFAULT TRUE,
  created_by UUID
);

-- Enable Row Level Security
ALTER TABLE public.disa_stigs_api_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_controls_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_training_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_performance_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enhanced_open_controls_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_api_gateway_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_schema_evolutions ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for Organization Access
CREATE POLICY "Organization members can access DISA STIGs cache" 
ON public.disa_stigs_api_cache 
FOR ALL 
USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can access Open Controls metrics" 
ON public.open_controls_performance_metrics 
FOR ALL 
USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can access ML datasets" 
ON public.ml_training_datasets 
FOR ALL 
USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can access performance analytics" 
ON public.enterprise_performance_analytics 
FOR ALL 
USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can access enhanced integrations" 
ON public.enhanced_open_controls_integrations 
FOR ALL 
USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can access API gateway requests" 
ON public.live_api_gateway_requests 
FOR ALL 
USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "Organization members can access schema evolutions" 
ON public.enterprise_schema_evolutions 
FOR ALL 
USING (organization_id IN (SELECT get_user_organizations()));

-- Create indexes for performance
CREATE INDEX idx_disa_stigs_cache_org_endpoint ON public.disa_stigs_api_cache(organization_id, api_endpoint);
CREATE INDEX idx_disa_stigs_cache_expires ON public.disa_stigs_api_cache(cache_expires_at);
CREATE INDEX idx_open_controls_metrics_org_type ON public.open_controls_performance_metrics(organization_id, metric_type);
CREATE INDEX idx_ml_datasets_org_active ON public.ml_training_datasets(organization_id, is_active);
CREATE INDEX idx_performance_analytics_org_period ON public.enterprise_performance_analytics(organization_id, time_period_start);
CREATE INDEX idx_enhanced_integrations_org_active ON public.enhanced_open_controls_integrations(organization_id, is_active);
CREATE INDEX idx_api_gateway_org_timestamp ON public.live_api_gateway_requests(organization_id, request_timestamp);
CREATE INDEX idx_schema_evolutions_org_name ON public.enterprise_schema_evolutions(organization_id, schema_name);

-- Create update triggers
CREATE TRIGGER update_disa_stigs_cache_updated_at
  BEFORE UPDATE ON public.disa_stigs_api_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ml_datasets_updated_at
  BEFORE UPDATE ON public.ml_training_datasets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_enhanced_integrations_updated_at
  BEFORE UPDATE ON public.enhanced_open_controls_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();