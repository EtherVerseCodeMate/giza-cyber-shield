-- Create tables for polymorphic engine integration configurations
CREATE TABLE IF NOT EXISTS public.integration_adapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  adapter_name TEXT NOT NULL,
  adapter_type TEXT NOT NULL, -- 'ssh', 'api', 'snmp', 'industrial', 'container', 'agentless'
  protocol_config JSONB NOT NULL DEFAULT '{}',
  authentication_config JSONB NOT NULL DEFAULT '{}',
  discovery_capabilities JSONB NOT NULL DEFAULT '[]',
  supported_environments TEXT[] NOT NULL DEFAULT '{}',
  security_level TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'inactive',
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create table for data source connections
CREATE TABLE IF NOT EXISTS public.data_source_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  connection_name TEXT NOT NULL,
  environment_type TEXT NOT NULL,
  adapter_id UUID REFERENCES public.integration_adapters(id),
  connection_config JSONB NOT NULL DEFAULT '{}',
  credentials_config JSONB NOT NULL DEFAULT '{}', -- Will be encrypted
  discovery_results JSONB DEFAULT '{}',
  connection_status TEXT NOT NULL DEFAULT 'configured',
  last_test TIMESTAMP WITH TIME ZONE,
  test_results JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create table for discovered assets through polymorphic engine
CREATE TABLE IF NOT EXISTS public.discovered_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  connection_id UUID REFERENCES public.data_source_connections(id),
  asset_identifier TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  asset_metadata JSONB NOT NULL DEFAULT '{}',
  discovery_method TEXT NOT NULL,
  stig_applicability JSONB DEFAULT '[]',
  compliance_status JSONB DEFAULT '{}',
  discovered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.integration_adapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_source_connections ENABLE ROW LEVEL SECURITY;  
ALTER TABLE public.discovered_assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for integration_adapters
CREATE POLICY "Organization members can manage integration adapters"
ON public.integration_adapters
FOR ALL
USING (organization_id IN (SELECT get_user_organizations()));

-- Create RLS policies for data_source_connections  
CREATE POLICY "Organization members can manage data source connections"
ON public.data_source_connections
FOR ALL
USING (organization_id IN (SELECT get_user_organizations()));

-- Create RLS policies for discovered_assets
CREATE POLICY "Organization members can view discovered assets"
ON public.discovered_assets  
FOR ALL
USING (organization_id IN (SELECT get_user_organizations()));

-- Create updated_at triggers
CREATE TRIGGER update_integration_adapters_updated_at
  BEFORE UPDATE ON public.integration_adapters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_source_connections_updated_at
  BEFORE UPDATE ON public.data_source_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discovered_assets_updated_at
  BEFORE UPDATE ON public.discovered_assets  
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default integration adapters with correct array syntax
INSERT INTO public.integration_adapters (
  organization_id, adapter_name, adapter_type, protocol_config, 
  authentication_config, discovery_capabilities, supported_environments, security_level
) VALUES 
(
  '00000000-0000-0000-0000-000000000000', -- Default for all orgs
  'SSH/WinRM Adapter',
  'ssh',
  '{"protocols": ["SSH", "WinRM"], "ports": [22, 5985, 5986], "encryption": "required"}',
  '{"methods": ["password", "key_pair", "certificate"], "mfa_support": true}',
  '["os_detection", "service_enumeration", "file_system_scan", "registry_scan"]',
  ARRAY['servers-windows', 'servers-linux', 'cloud-aws', 'cloud-azure', 'cloud-gcp'],
  'high'
),
(
  '00000000-0000-0000-0000-000000000000',
  'Cloud API Adapter', 
  'api',
  '{"protocols": ["HTTPS", "REST", "GraphQL"], "rate_limiting": true, "pagination": true}',
  '{"methods": ["api_key", "oauth2", "iam_role"], "token_refresh": true}',
  '["resource_discovery", "configuration_audit", "compliance_check", "cost_analysis"]',
  ARRAY['cloud-aws', 'cloud-azure', 'cloud-gcp', 'containers-k8s', 'web-api-rest'],
  'high'
),
(
  '00000000-0000-0000-0000-000000000000',
  'SNMP Monitoring Adapter',
  'snmp', 
  '{"versions": ["v2c", "v3"], "security": "auth_priv", "bulk_operations": true}',
  '{"methods": ["community_string", "user_credentials"], "encryption": "aes256"}',
  '["device_inventory", "interface_monitoring", "performance_metrics", "trap_collection"]',
  ARRAY['network-routers', 'network-security', 'network-wireless', 'industrial-scada'],
  'medium'
),
(
  '00000000-0000-0000-0000-000000000000',
  'Industrial Protocol Adapter',
  'industrial',
  '{"protocols": ["modbus_tcp", "dnp3", "opc_ua"], "real_time": true, "redundancy": true}',
  '{"methods": ["certificate", "username_password"], "secure_channels": true}',
  '["plc_discovery", "hmi_enumeration", "control_logic_audit", "safety_system_check"]',
  ARRAY['industrial-plc', 'industrial-scada', 'industrial-hmi', 'energy-solar', 'energy-wind', 'energy-battery'],
  'high'
),
(
  '00000000-0000-0000-0000-000000000000',
  'Container Agent Adapter',
  'container',
  '{"runtimes": ["docker", "containerd", "cri-o"], "orchestration": ["kubernetes", "swarm"]}',
  '{"methods": ["service_account", "kubeconfig", "docker_socket"], "rbac": true}',
  '["image_scanning", "runtime_analysis", "network_policy_audit", "secret_detection"]',
  ARRAY['containers-docker', 'containers-k8s'],
  'high'
),
(
  '00000000-0000-0000-0000-000000000000',
  'Agentless Network Scanner',
  'agentless',
  '{"scan_types": ["port_scan", "service_detection", "os_fingerprinting"], "stealth_mode": true}',
  '{"methods": ["none", "network_credentials"], "passive_discovery": true}',
  '["network_discovery", "service_enumeration", "vulnerability_detection", "asset_classification"]',
  ARRAY['servers-windows', 'servers-linux', 'network-infrastructure', 'iot-sensors', 'mobile-devices'],
  'low'
);

-- Set default adapters to active status
UPDATE public.integration_adapters 
SET status = 'active' 
WHERE organization_id = '00000000-0000-0000-0000-000000000000';

-- Function to get available adapters for organization
CREATE OR REPLACE FUNCTION public.get_available_adapters(org_id UUID, env_type TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  adapters JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', adapter_name,
      'type', adapter_type,
      'protocols', protocol_config,
      'capabilities', discovery_capabilities,
      'security_level', security_level,
      'supported_environments', supported_environments
    )
  ) INTO adapters
  FROM public.integration_adapters
  WHERE (organization_id = org_id OR organization_id = '00000000-0000-0000-0000-000000000000')
    AND (env_type IS NULL OR env_type = ANY(supported_environments))
    AND status = 'active';
    
  RETURN COALESCE(adapters, '[]'::JSONB);
END;
$$;