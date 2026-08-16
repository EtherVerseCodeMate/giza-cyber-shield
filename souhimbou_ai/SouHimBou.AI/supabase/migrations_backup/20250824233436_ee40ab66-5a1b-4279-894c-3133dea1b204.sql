-- Populate integrations library with industry standards
INSERT INTO public.integrations_library (name, provider, category, description, logo_url, documentation_url, auth_type, required_fields, supported_data_types, is_popular, is_dod_approved, compliance_standards) VALUES

-- SIEM Platforms
('Splunk Enterprise SIEM', 'Splunk Inc.', 'SIEM', 'Enterprise SIEM platform for security monitoring and analytics', '/api/placeholder/64/64', 'https://docs.splunk.com/Documentation/Splunk/latest/RESTAPI', 'api_key', '["endpoint_url", "username", "password"]', '["logs", "alerts", "incidents", "threats", "searches"]', true, true, '["FISMA", "NIST", "SOC2"]'),

('Elastic Stack (ELK)', 'Elastic N.V.', 'SIEM', 'Elasticsearch-based SIEM with API key authentication', '/api/placeholder/64/64', 'https://www.elastic.co/docs/api/doc/elasticsearch/', 'api_key', '["elasticsearch_url", "api_key", "api_key_id"]', '["logs", "alerts", "incidents", "metrics", "threats"]', true, true, '["FISMA", "NIST", "PCI-DSS"]'),

('Microsoft Sentinel', 'Microsoft Corporation', 'SIEM', 'Cloud-native SIEM and SOAR solution', '/api/placeholder/64/64', 'https://docs.microsoft.com/en-us/rest/api/securityinsights/', 'oauth2', '["tenant_id", "client_id", "client_secret", "workspace_id"]', '["incidents", "alerts", "hunting_queries", "workbooks", "analytics_rules"]', true, true, '["FedRAMP", "FISMA", "NIST"]'),

('IBM QRadar', 'IBM Corporation', 'SIEM', 'Enterprise security information and event management', '/api/placeholder/64/64', 'https://www.ibm.com/docs/en/qradar-common', 'api_key', '["console_ip", "api_token", "api_version"]', '["events", "offenses", "assets", "vulnerabilities", "flows"]', true, true, '["FISMA", "NIST", "Common Criteria"]'),

('ArcSight ESM', 'Micro Focus', 'SIEM', 'Enterprise Security Manager for threat detection', '/api/placeholder/64/64', 'https://docs.microfocus.com/ESM', 'basic', '["manager_host", "username", "password", "port"]', '["events", "cases", "active_lists", "resources"]', false, true, '["FISMA", "NIST", "Common Criteria"]'),

-- Endpoint Protection
('CrowdStrike Falcon', 'CrowdStrike', 'ENDPOINT', 'Cloud-native endpoint protection platform', '/api/placeholder/64/64', 'https://falcon.crowdstrike.com/documentation', 'oauth2', '["client_id", "client_secret", "base_url"]', '["endpoint_detections", "incidents", "iocs", "host_info", "real_time_response"]', true, true, '["FedRAMP", "FISMA", "NIST"]'),

('SentinelOne', 'SentinelOne', 'ENDPOINT', 'Autonomous endpoint protection platform', '/api/placeholder/64/64', 'https://usea1-partners.sentinelone.net/docs', 'api_key', '["console_url", "api_token"]', '["threats", "agents", "activities", "exclusions", "policies"]', true, true, '["FedRAMP", "FISMA", "SOC2"]'),

('Microsoft Defender for Endpoint', 'Microsoft Corporation', 'ENDPOINT', 'Enterprise endpoint protection and detection', '/api/placeholder/64/64', 'https://docs.microsoft.com/en-us/microsoft-365/security/defender-endpoint/', 'oauth2', '["tenant_id", "client_id", "client_secret"]', '["alerts", "machines", "files", "investigations", "indicators"]', true, true, '["FedRAMP", "FISMA", "NIST"]'),

('Carbon Black', 'VMware', 'ENDPOINT', 'Next-generation antivirus and endpoint detection', '/api/placeholder/64/64', 'https://developer.carbonblack.com/', 'api_key', '["cb_url", "api_key", "connector_id"]', '["alerts", "devices", "processes", "binaries", "watchlists"]', false, true, '["FISMA", "NIST", "Common Criteria"]'),

-- Firewalls & Network Security  
('Palo Alto Networks', 'Palo Alto Networks', 'FIREWALL', 'Next-generation firewall and security platform', '/api/placeholder/64/64', 'https://docs.paloaltonetworks.com/pan-os/9-1/pan-os-panorama-api', 'api_key', '["endpoint_url", "api_key", "vsys"]', '["firewall_logs", "threat_intel", "policies", "traffic_logs", "url_filtering"]', true, true, '["Common Criteria", "FIPS 140-2", "NIST"]'),

('Fortinet FortiGate', 'Fortinet', 'FIREWALL', 'Unified threat management and firewall', '/api/placeholder/64/64', 'https://docs.fortinet.com/fortigate/apis', 'api_key', '["fortigate_ip", "api_key", "vdom"]', '["logs", "policies", "objects", "system_status", "vpn"]', true, true, '["Common Criteria", "FIPS 140-2", "NIST"]'),

('Cisco ASA', 'Cisco Systems', 'FIREWALL', 'Adaptive Security Appliance firewall', '/api/placeholder/64/64', 'https://developer.cisco.com/docs/asa-rest-api/', 'basic', '["asa_ip", "username", "password"]', '["access_rules", "nat_rules", "vpn", "system_info", "logging"]', false, true, '["Common Criteria", "FIPS 140-2", "NIST"]'),

-- Identity & Access Management
('Okta', 'Okta Inc.', 'IDENTITY', 'Identity and access management platform', '/api/placeholder/64/64', 'https://developer.okta.com/docs/reference/', 'api_key', '["domain", "api_token"]', '["auth_logs", "user_events", "policies", "apps", "groups"]', true, true, '["FedRAMP", "SOC2", "NIST"]'),

('Azure Active Directory', 'Microsoft Corporation', 'IDENTITY', 'Cloud-based identity and access management', '/api/placeholder/64/64', 'https://docs.microsoft.com/en-us/graph/api/overview', 'oauth2', '["tenant_id", "client_id", "client_secret"]', '["sign_in_logs", "audit_logs", "users", "groups", "applications"]', true, true, '["FedRAMP", "FISMA", "NIST"]'),

('CyberArk', 'CyberArk Software', 'IDENTITY', 'Privileged access management solution', '/api/placeholder/64/64', 'https://docs.cyberark.com/Product-Doc/OnlineHelp/PAS/Latest/en/Content/WebServices/Implementing%20Privileged%20Account%20Security%20Web%20Services%20.htm', 'basic', '["pvwa_url", "username", "password"]', '["accounts", "safes", "sessions", "activities", "policies"]', false, true, '["FISMA", "NIST", "Common Criteria"]'),

-- Cloud Security
('AWS Security Hub', 'Amazon Web Services', 'CLOUD', 'Centralized security findings aggregation service', '/api/placeholder/64/64', 'https://docs.aws.amazon.com/securityhub/latest/APIReference/', 'api_key', '["access_key_id", "secret_access_key", "region"]', '["findings", "insights", "compliance", "standards", "custom_actions"]', true, true, '["FedRAMP", "FISMA", "SOC2"]'),

('Azure Security Center', 'Microsoft Corporation', 'CLOUD', 'Unified security management and threat protection', '/api/placeholder/64/64', 'https://docs.microsoft.com/en-us/rest/api/securitycenter/', 'oauth2', '["tenant_id", "client_id", "client_secret", "subscription_id"]', '["alerts", "assessments", "compliance", "recommendations", "secure_scores"]', true, true, '["FedRAMP", "FISMA", "NIST"]'),

('Google Cloud Security Command Center', 'Google Cloud', 'CLOUD', 'Security and risk management platform for Google Cloud', '/api/placeholder/64/64', 'https://cloud.google.com/security-command-center/docs/reference/rest', 'oauth2', '["project_id", "service_account_key"]', '["findings", "assets", "security_marks", "notifications"]', true, true, '["FedRAMP", "FISMA", "SOC2"]'),

-- Vulnerability Management
('Tenable Nessus', 'Tenable Inc.', 'VULNERABILITY', 'Vulnerability assessment and management', '/api/placeholder/64/64', 'https://developer.tenable.com/reference', 'api_key', '["tenable_url", "access_key", "secret_key"]', '["scans", "vulnerabilities", "assets", "compliance", "policies"]', true, true, '["FISMA", "NIST", "PCI-DSS"]'),

('Rapid7 Nexpose', 'Rapid7', 'VULNERABILITY', 'Vulnerability risk management solution', '/api/placeholder/64/64', 'https://help.rapid7.com/insightvm/en-us/api/index.html', 'basic', '["console_url", "username", "password"]', '["scans", "assets", "vulnerabilities", "reports", "sites"]', false, true, '["FISMA", "NIST", "PCI-DSS"]'),

('Qualys VMDR', 'Qualys Inc.', 'VULNERABILITY', 'Vulnerability management detection and response', '/api/placeholder/64/64', 'https://www.qualys.com/docs/', 'basic', '["platform_url", "username", "password"]', '["scans", "assets", "vulnerabilities", "compliance", "policies"]', false, true, '["FISMA", "NIST", "PCI-DSS"]'),

-- Network Monitoring
('Wireshark/tshark', 'Wireshark Foundation', 'NETWORK', 'Network protocol analyzer and monitoring', '/api/placeholder/64/64', 'https://www.wireshark.org/docs/', 'manual', '["capture_interface", "capture_filter"]', '["network_packets", "protocols", "flows", "statistics"]', false, false, '["NIST"]'),

('SolarWinds NPM', 'SolarWinds', 'NETWORK', 'Network performance monitoring platform', '/api/placeholder/64/64', 'https://documentation.solarwinds.com/en/Success_Center/orionapi/', 'basic', '["orion_server", "username", "password"]', '["network_topology", "performance_metrics", "alerts", "reports"]', false, true, '["FISMA", "NIST"]'),

-- Compliance Tools
('Nessus Compliance', 'Tenable Inc.', 'COMPLIANCE', 'Security compliance and configuration assessment', '/api/placeholder/64/64', 'https://developer.tenable.com/reference', 'api_key', '["tenable_url", "access_key", "secret_key"]', '["compliance_scans", "policy_violations", "benchmarks", "reports"]', false, true, '["FISMA", "NIST", "PCI-DSS", "DISA STIG"]'),

('Rapid7 InsightVM', 'Rapid7', 'COMPLIANCE', 'Risk-based vulnerability management with compliance', '/api/placeholder/64/64', 'https://help.rapid7.com/insightvm/', 'basic', '["console_url", "username", "password"]', '["compliance_checks", "policy_results", "remediation", "reports"]', false, true, '["FISMA", "NIST", "PCI-DSS", "DISA STIG"]')

ON CONFLICT (name, provider) DO NOTHING;