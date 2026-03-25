-- First, drop the existing check constraint and add our strategic categories
ALTER TABLE integrations_library DROP CONSTRAINT IF EXISTS integrations_library_category_check;

-- Add the new check constraint with strategic categories aligned to our target niches
ALTER TABLE integrations_library ADD CONSTRAINT integrations_library_category_check 
CHECK (category IN (
  'DOD_TACTICAL',      -- DoD Contractors: Tactical & Strategic Systems
  'INDUSTRIAL_OT',     -- Critical Infrastructure: SCADA/ICS/IoT/OT
  'AI_SECURITY',       -- AI Agents: Enterprise AI/ML Security
  'AIR_GAPPED',        -- Tactical Edge: Air-gapped & SCIF Systems
  'COMPLIANCE',        -- Compliance frameworks (legacy support)
  'CLOUD',            -- Legacy cloud (minimal)
  'NETWORK',          -- Legacy network (minimal)
  'ENDPOINT',         -- Legacy endpoint (minimal) 
  'IDENTITY',         -- Legacy identity (minimal)
  'SIEM',             -- Legacy SIEM (minimal)
  'FIREWALL'          -- Legacy firewall (minimal)
));

-- Clear existing generic integrations
DELETE FROM integrations_library;

-- Insert strategic niche-focused integrations aligned with our value propositions
INSERT INTO integrations_library (
    name, provider, category, description, auth_type, required_fields, 
    supported_data_types, compliance_standards, is_dod_approved, is_popular,
    documentation_url, logo_url
) VALUES 

-- DoD TACTICAL & STRATEGIC SYSTEMS (Target: DoD Contractors)
('DoD Enterprise Email (DISA)', 'DISA', 'DOD_TACTICAL', 
'Defense Information Systems Agency enterprise email security integration',
'certificate', '["cert_file", "cert_password", "disa_domain"]',
'["email_threats", "phishing_intel", "malware_detection", "dod_compliance"]',
'["FISMA", "FedRAMP", "DISA_STIG", "NIST_800_53"]', true, true,
'https://disa.mil/computing/enterprise-infrastructure', '/logos/disa.svg'),

('DCGS-A (Distributed Common Ground System)', 'US Army', 'DOD_TACTICAL',
'Army distributed intelligence processing and dissemination system',
'secret_clearance', '["security_clearance", "unit_designation", "system_id"]',
'["intelligence_reports", "geospatial_data", "threat_assessments", "battlefield_intel"]',
'["TOP_SECRET", "NOFORN", "DCGS_STD"]', true, true,
'https://army.mil/dcgs', '/logos/army-dcgs.svg'),

('SIPR/NIPR Bridge Security Monitor', 'NSA', 'DOD_TACTICAL',
'Cross-domain solution monitoring for classified/unclassified networks',
'tls_mutual', '["cds_certificate", "network_enclave", "clearance_level"]',
'["cross_domain_events", "data_transfers", "security_violations", "audit_trails"]',
'["NSA_IAD", "CNSS", "DCID", "ICD_503"]', true, true,
'https://nsa.gov/cybersecurity', '/logos/nsa-cds.svg'),

('GCCS (Global Command and Control System)', 'DoD CIO', 'DOD_TACTICAL',
'Global military command and control system integration',
'cac_pki', '["cac_certificate", "command_authority", "operational_domain"]',
'["command_orders", "situational_awareness", "force_tracking", "logistics_data"]',
'["GCCS_STD", "JCIDS", "DoDAF", "NIST_800_53"]', true, true,
'https://dod.mil/gccs', '/logos/dod-gccs.svg'),

-- CRITICAL INFRASTRUCTURE OT/ICS/SCADA (Target: Critical Infrastructure Operators)
('Schneider Electric EcoStruxure', 'Schneider Electric', 'INDUSTRIAL_OT',
'Industrial automation and energy management platform security',
'modbus_tcp', '["modbus_gateway", "device_id", "facility_code"]',
'["scada_alarms", "hmi_events", "plc_diagnostics", "energy_data", "industrial_protocols"]',
'["IEC_62443", "NERC_CIP", "NIST_CSF"]', true, true,
'https://ecostruxure.schneider-electric.com/cybersecurity/', '/logos/schneider.svg'),

('Siemens SICAM GridEdge', 'Siemens', 'INDUSTRIAL_OT',
'Power grid automation and protection system monitoring',
'iec61850', '["substation_id", "ied_address", "protection_zone"]',
'["protection_events", "grid_measurements", "fault_analysis", "load_dispatch"]',
'["IEC_61850", "IEEE_1815", "NERC_CIP", "IEC_62443"]', true, true,
'https://siemens.com/sicam/cybersecurity', '/logos/siemens-grid.svg'),

('Honeywell Experion PKS', 'Honeywell', 'INDUSTRIAL_OT',
'Process control system for critical infrastructure',
'honeywell_secure', '["control_network", "safety_system_id", "plant_code"]',
'["process_alarms", "safety_shutdowns", "control_loop_data", "historian_data"]',
'["IEC_62443", "ISA_99", "NIST_CSF", "API_1164"]', true, true,
'https://honeywell.com/experion/security', '/logos/honeywell-pks.svg'),

('Rockwell FactoryTalk Security', 'Rockwell Automation', 'INDUSTRIAL_OT',
'Industrial automation security and access control',
'ethernet_ip', '["controller_path", "safety_network", "zone_classification"]',
'["ladder_logic_changes", "hmi_access", "safety_events", "production_data"]',
'["IEC_62443", "cULus", "ATEX", "SIL_3"]', true, true,
'https://rockwellautomation.com/factorytalk/security', '/logos/rockwell-ft.svg'),

-- AI ENTERPRISE & CONTAINER SECURITY (Target: AI Agents in Enterprise)
('NVIDIA Morpheus AI Security', 'NVIDIA', 'AI_SECURITY',
'AI-powered cybersecurity framework for enterprise AI workloads',
'api_key', '["triton_endpoint", "model_repository", "gpu_cluster"]',
'["ai_model_threats", "inference_anomalies", "data_poisoning", "adversarial_attacks"]',
'["MLOps_Security", "NIST_AI_RMF", "ISO_23053"]', true, true,
'https://nvidia.com/morpheus', '/logos/nvidia-morpheus.svg'),

('Kubernetes Security Operator (KSO)', 'CNCF', 'AI_SECURITY',
'Container orchestration security for AI workloads',
'service_account', '["cluster_endpoint", "namespace", "rbac_config"]',
'["pod_security", "network_policies", "admission_control", "runtime_threats"]',
'["CIS_Kubernetes", "NIST_SP_800_190", "PCI_DSS", "SOC2"]', true, true,
'https://kubernetes.io/docs/concepts/security/', '/logos/k8s-security.svg'),

('MLflow Security Extension', 'Databricks', 'AI_SECURITY',
'Machine learning lifecycle security and governance',
'bearer_token', '["mlflow_server", "model_registry", "experiment_tracking"]',
'["model_lineage", "data_drift", "model_performance", "access_patterns"]',
'["MLOps_Governance", "GDPR", "CCPA", "SOX"]', true, true,
'https://mlflow.org/docs/latest/auth/', '/logos/mlflow-secure.svg'),

('Palantir Foundry for Defense', 'Palantir', 'AI_SECURITY',
'Data integration and AI platform for defense and critical infrastructure',
'oauth2_pkce', '["foundry_domain", "client_credentials", "security_realm"]',
'["operational_data", "predictive_analytics", "decision_support", "multi_source_fusion"]',
'["FedRAMP_High", "IL5", "FISMA", "ITAR"]', true, true,
'https://palantir.com/foundry-defense', '/logos/palantir-foundry.svg'),

-- AIR-GAPPED & TACTICAL EDGE (Target: Air-gapped & SCIF Systems)
('Disconnected Operations Security Monitor', 'Raytheon', 'AIR_GAPPED',
'Security monitoring for air-gapped and tactical edge systems',
'local_certificate', '["isolated_network", "edge_device_id", "tactical_unit"]',
'["offline_threats", "usb_events", "local_anomalies", "device_integrity"]',
'["TEMPEST", "Cross_Domain", "COMSEC", "TRANSEC"]', true, true,
'https://raytheon.com/tactical-security', '/logos/raytheon-tactical.svg'),

('SCIF Network Monitor', 'General Dynamics', 'AIR_GAPPED',
'Sensitive Compartmented Information Facility network security',
'two_person_integrity', '["scif_designation", "compartment_level", "facility_code"]',
'["emission_security", "acoustic_monitoring", "physical_intrusion", "tempest_compliance"]',
'["ICD_705", "DCID_6_9", "NISPOM", "CNSS_1253"]', true, true,
'https://gdmissionsystems.com/scif-security', '/logos/gd-scif.svg');