-- TRL 10 Security Foundation: Enhanced Credential Vault and Security Controls

-- Create encryption key management table
CREATE TABLE public.encryption_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_name TEXT NOT NULL UNIQUE,
  key_purpose TEXT NOT NULL, -- 'credential_encryption', 'data_encryption', etc.
  key_version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  rotated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  key_metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id)
);

-- Enhanced discovery credentials with proper encryption
CREATE TABLE public.secure_discovery_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  credential_name TEXT NOT NULL,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('ssh_key', 'username_password', 'api_token', 'certificate', 'cloud_service_account')),
  target_systems JSONB NOT NULL DEFAULT '[]',
  encrypted_credentials BYTEA NOT NULL, -- AES-256-GCM encrypted credentials
  encryption_key_id UUID REFERENCES public.encryption_keys(id),
  credential_fingerprint TEXT, -- SHA-256 hash for integrity verification
  access_pattern JSONB DEFAULT '{}', -- Access control patterns
  mfa_required BOOLEAN DEFAULT true,
  max_concurrent_uses INTEGER DEFAULT 5,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  last_accessed_by UUID,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Asset discovery execution audit trail
CREATE TABLE public.discovery_audit_trail (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discovery_execution_id UUID REFERENCES public.discovery_executions(id),
  organization_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- 'scan_started', 'credential_used', 'asset_discovered', etc.
  event_severity TEXT NOT NULL DEFAULT 'INFO' CHECK (event_severity IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL')),
  event_details JSONB NOT NULL DEFAULT '{}',
  source_ip INET,
  user_id UUID,
  nmap_command TEXT, -- Executed nmap command for audit
  nmap_output TEXT, -- Nmap scan output
  security_context JSONB DEFAULT '{}', -- Security context at execution time
  compliance_flags JSONB DEFAULT '{}', -- Compliance-related metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Nmap scan results table for structured storage
CREATE TABLE public.nmap_scan_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discovery_execution_id UUID REFERENCES public.discovery_executions(id),
  organization_id UUID NOT NULL,
  target_specification JSONB NOT NULL, -- Target IP ranges, hostnames
  scan_type TEXT NOT NULL, -- 'syn_scan', 'tcp_connect', 'udp_scan', etc.
  nmap_version TEXT,
  scan_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scan_completed_at TIMESTAMP WITH TIME ZONE,
  xml_output TEXT, -- Full Nmap XML output
  json_summary JSONB, -- Parsed scan results in JSON format
  discovered_hosts_count INTEGER DEFAULT 0,
  open_ports_count INTEGER DEFAULT 0,
  services_detected JSONB DEFAULT '[]',
  os_fingerprints JSONB DEFAULT '[]',
  vulnerabilities_detected JSONB DEFAULT '[]',
  script_results JSONB DEFAULT '{}', -- NSE script outputs
  performance_metrics JSONB DEFAULT '{}',
  security_violations JSONB DEFAULT '[]', -- Security policy violations detected
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Supply chain security and SBOM tracking
CREATE TABLE public.software_bill_of_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  asset_id UUID REFERENCES public.discovered_assets(id),
  component_name TEXT NOT NULL,
  component_version TEXT,
  component_type TEXT NOT NULL, -- 'library', 'application', 'os', 'firmware'
  vendor TEXT,
  license TEXT,
  cpe_identifier TEXT, -- Common Platform Enumeration identifier
  purl_identifier TEXT, -- Package URL identifier
  hash_sha256 TEXT, -- Component hash for integrity verification
  vulnerability_count INTEGER DEFAULT 0,
  risk_score INTEGER DEFAULT 0,
  compliance_status JSONB DEFAULT '{}',
  detection_method TEXT, -- 'agent', 'network_scan', 'registry_analysis'
  metadata JSONB DEFAULT '{}',
  first_detected TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_verified TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_verified BOOLEAN DEFAULT false
);

-- Advanced threat intelligence correlation
CREATE TABLE public.threat_intelligence_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  asset_id UUID REFERENCES public.discovered_assets(id),
  discovery_execution_id UUID REFERENCES public.discovery_executions(id),
  threat_indicator TEXT NOT NULL, -- IP, domain, hash, etc.
  indicator_type TEXT NOT NULL, -- 'ip', 'domain', 'file_hash', 'url'
  threat_source TEXT NOT NULL, -- 'shodan', 'virustotal', 'otx', 'internal'
  threat_category TEXT, -- 'malware', 'botnet', 'exploit', 'reconnaissance'
  confidence_score NUMERIC(3,2) DEFAULT 0.5,
  severity_level TEXT DEFAULT 'MEDIUM' CHECK (severity_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  threat_details JSONB DEFAULT '{}',
  first_detected TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_confirmed BOOLEAN DEFAULT false,
  false_positive BOOLEAN DEFAULT false,
  remediation_status TEXT DEFAULT 'open' CHECK (remediation_status IN ('open', 'investigating', 'mitigated', 'false_positive'))
);

-- Real-time security monitoring and alerting
CREATE TABLE public.security_monitoring_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (event_severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  source_system TEXT NOT NULL, -- 'nmap', 'credential_vault', 'discovery_engine'
  source_ip INET,
  target_assets UUID[],
  event_details JSONB NOT NULL DEFAULT '{}',
  correlation_id UUID, -- For grouping related events
  auto_remediation_triggered BOOLEAN DEFAULT false,
  remediation_actions JSONB DEFAULT '[]',
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secure_discovery_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nmap_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.software_bill_of_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threat_intelligence_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_monitoring_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for encryption keys - only admins can manage
CREATE POLICY "Admins can manage encryption keys" ON public.encryption_keys
  FOR ALL USING (
    (get_current_user_role() = 'admin' OR is_master_admin())
  );

-- RLS Policies for secure credentials - organization members with admin role
CREATE POLICY "Organization admins can manage secure credentials" ON public.secure_discovery_credentials
  FOR ALL USING (
    organization_id IN (SELECT get_user_organizations()) AND
    (get_current_user_role() = 'admin' OR is_master_admin())
  );

-- RLS Policies for audit trail - organization access
CREATE POLICY "Organization members can view audit trail" ON public.discovery_audit_trail
  FOR SELECT USING (organization_id IN (SELECT get_user_organizations()));

CREATE POLICY "System can insert audit events" ON public.discovery_audit_trail
  FOR INSERT WITH CHECK (true);

-- RLS Policies for Nmap results - organization access
CREATE POLICY "Organization members can access nmap results" ON public.nmap_scan_results
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

-- RLS Policies for SBOM - organization access
CREATE POLICY "Organization members can access SBOM data" ON public.software_bill_of_materials
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

-- RLS Policies for threat intelligence - organization access
CREATE POLICY "Organization members can access threat intelligence" ON public.threat_intelligence_matches
  FOR ALL USING (organization_id IN (SELECT get_user_organizations()));

-- RLS Policies for security monitoring - organization access with role check
CREATE POLICY "Security analysts can access monitoring events" ON public.security_monitoring_events
  FOR ALL USING (
    organization_id IN (SELECT get_user_organizations()) AND
    (get_current_user_role() IN ('admin', 'analyst', 'operator') OR is_master_admin())
  );

-- Create indexes for performance
CREATE INDEX idx_secure_credentials_org_active ON public.secure_discovery_credentials(organization_id, is_active);
CREATE INDEX idx_audit_trail_execution ON public.discovery_audit_trail(discovery_execution_id);
CREATE INDEX idx_audit_trail_org_created ON public.discovery_audit_trail(organization_id, created_at DESC);
CREATE INDEX idx_nmap_results_execution ON public.nmap_scan_results(discovery_execution_id);
CREATE INDEX idx_nmap_results_org_completed ON public.nmap_scan_results(organization_id, scan_completed_at DESC);
CREATE INDEX idx_sbom_asset ON public.software_bill_of_materials(asset_id);
CREATE INDEX idx_sbom_component ON public.software_bill_of_materials(component_name, component_version);
CREATE INDEX idx_threat_intel_asset ON public.threat_intelligence_matches(asset_id);
CREATE INDEX idx_threat_intel_indicator ON public.threat_intelligence_matches(threat_indicator);
CREATE INDEX idx_security_events_org_severity ON public.security_monitoring_events(organization_id, event_severity);
CREATE INDEX idx_security_events_created ON public.security_monitoring_events(created_at DESC);

-- Insert default encryption key for credentials
INSERT INTO public.encryption_keys (key_name, key_purpose, key_metadata) 
VALUES ('default_credential_key', 'credential_encryption', '{"algorithm": "AES-256-GCM", "created_by": "system"}');

-- Create trigger for updating timestamps
CREATE TRIGGER update_secure_credentials_updated_at
  BEFORE UPDATE ON public.secure_discovery_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();