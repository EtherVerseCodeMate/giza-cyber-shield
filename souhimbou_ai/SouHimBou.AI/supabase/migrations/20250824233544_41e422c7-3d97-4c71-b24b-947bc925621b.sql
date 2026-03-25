-- Populate integrations library with industry standards
INSERT INTO public.integrations_library (name, provider, category, description, logo_url, documentation_url, auth_type, required_fields, supported_data_types, is_popular, is_dod_approved, compliance_standards) VALUES

-- SIEM Platforms
('Splunk Enterprise SIEM', 'Splunk Inc.', 'SIEM', 'Enterprise SIEM platform for security monitoring and analytics', '/api/placeholder/64/64', 'https://docs.splunk.com/Documentation/Splunk/latest/RESTAPI', 'api_key', '["endpoint_url", "username", "password"]', '["logs", "alerts", "incidents", "threats", "searches"]', true, true, '["FISMA", "NIST", "SOC2"]'),

('Elastic Stack (ELK)', 'Elastic N.V.', 'SIEM', 'Elasticsearch-based SIEM with API key authentication', '/api/placeholder/64/64', 'https://www.elastic.co/docs/api/doc/elasticsearch/', 'api_key', '["elasticsearch_url", "api_key", "api_key_id"]', '["logs", "alerts", "incidents", "metrics", "threats"]', true, true, '["FISMA", "NIST", "PCI-DSS"]'),

('Microsoft Sentinel', 'Microsoft Corporation', 'SIEM', 'Cloud-native SIEM and SOAR solution', '/api/placeholder/64/64', 'https://docs.microsoft.com/en-us/rest/api/securityinsights/', 'oauth2', '["tenant_id", "client_id", "client_secret", "workspace_id"]', '["incidents", "alerts", "hunting_queries", "workbooks", "analytics_rules"]', true, true, '["FedRAMP", "FISMA", "NIST"]'),

-- Endpoint Protection
('CrowdStrike Falcon', 'CrowdStrike', 'ENDPOINT', 'Cloud-native endpoint protection platform', '/api/placeholder/64/64', 'https://falcon.crowdstrike.com/documentation', 'oauth2', '["client_id", "client_secret", "base_url"]', '["endpoint_detections", "incidents", "iocs", "host_info", "real_time_response"]', true, true, '["FedRAMP", "FISMA", "NIST"]'),

('SentinelOne', 'SentinelOne', 'ENDPOINT', 'Autonomous endpoint protection platform', '/api/placeholder/64/64', 'https://usea1-partners.sentinelone.net/docs', 'api_key', '["console_url", "api_token"]', '["threats", "agents", "activities", "exclusions", "policies"]', true, true, '["FedRAMP", "FISMA", "SOC2"]'),

-- Firewalls & Network Security  
('Palo Alto Networks', 'Palo Alto Networks', 'FIREWALL', 'Next-generation firewall and security platform', '/api/placeholder/64/64', 'https://docs.paloaltonetworks.com/pan-os/9-1/pan-os-panorama-api', 'api_key', '["endpoint_url", "api_key", "vsys"]', '["firewall_logs", "threat_intel", "policies", "traffic_logs", "url_filtering"]', true, true, '["Common Criteria", "FIPS 140-2", "NIST"]'),

('Fortinet FortiGate', 'Fortinet', 'FIREWALL', 'Unified threat management and firewall', '/api/placeholder/64/64', 'https://docs.fortinet.com/fortigate/apis', 'api_key', '["fortigate_ip", "api_key", "vdom"]', '["logs", "policies", "objects", "system_status", "vpn"]', true, true, '["Common Criteria", "FIPS 140-2", "NIST"]'),

-- Identity & Access Management
('Okta', 'Okta Inc.', 'IDENTITY', 'Identity and access management platform', '/api/placeholder/64/64', 'https://developer.okta.com/docs/reference/', 'api_key', '["domain", "api_token"]', '["auth_logs", "user_events", "policies", "apps", "groups"]', true, true, '["FedRAMP", "SOC2", "NIST"]'),

('Azure Active Directory', 'Microsoft Corporation', 'IDENTITY', 'Cloud-based identity and access management', '/api/placeholder/64/64', 'https://docs.microsoft.com/en-us/graph/api/overview', 'oauth2', '["tenant_id", "client_id", "client_secret"]', '["sign_in_logs", "audit_logs", "users", "groups", "applications"]', true, true, '["FedRAMP", "FISMA", "NIST"]'),

-- Cloud Security
('AWS Security Hub', 'Amazon Web Services', 'CLOUD', 'Centralized security findings aggregation service', '/api/placeholder/64/64', 'https://docs.aws.amazon.com/securityhub/latest/APIReference/', 'api_key', '["access_key_id", "secret_access_key", "region"]', '["findings", "insights", "compliance", "standards", "custom_actions"]', true, true, '["FedRAMP", "FISMA", "SOC2"]'),

-- Vulnerability Management
('Tenable Nessus', 'Tenable Inc.', 'VULNERABILITY', 'Vulnerability assessment and management', '/api/placeholder/64/64', 'https://developer.tenable.com/reference', 'api_key', '["tenable_url", "access_key", "secret_key"]', '["scans", "vulnerabilities", "assets", "compliance", "policies"]', true, true, '["FISMA", "NIST", "PCI-DSS"]'),

-- Network Monitoring
('SolarWinds NPM', 'SolarWinds', 'NETWORK', 'Network performance monitoring platform', '/api/placeholder/64/64', 'https://documentation.solarwinds.com/en/Success_Center/orionapi/', 'basic', '["orion_server", "username", "password"]', '["network_topology", "performance_metrics", "alerts", "reports"]', false, true, '["FISMA", "NIST"]'),

-- Compliance Tools
('Nessus Compliance', 'Tenable Inc.', 'COMPLIANCE', 'Security compliance and configuration assessment', '/api/placeholder/64/64', 'https://developer.tenable.com/reference', 'api_key', '["tenable_url", "access_key", "secret_key"]', '["compliance_scans", "policy_violations", "benchmarks", "reports"]', false, true, '["FISMA", "NIST", "PCI-DSS", "DISA STIG"]');