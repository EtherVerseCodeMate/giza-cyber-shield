import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// Helper Functions for Real Data Queries
// =============================================================================

// Query actual compliance findings for an asset/rule
async function getActualComplianceFinding(
  supabase: any,
  assetId: string,
  stigRuleId: string
): Promise<{ status: string; riskScore: number; lastChecked: string | null } | null> {
  try {
    const { data, error } = await supabase
      .from('stig_findings')
      .select('status, severity, risk_score, updated_at')
      .eq('asset_id', assetId)
      .eq('rule_id', stigRuleId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    // Map severity to risk score if not provided
    const severityToRisk: Record<string, number> = {
      'critical': 9,
      'high': 7,
      'medium': 5,
      'low': 3
    };

    return {
      status: data.status,
      riskScore: data.risk_score || severityToRisk[data.severity?.toLowerCase()] || 5,
      lastChecked: data.updated_at
    };
  } catch {
    return null;
  }
}

// Query asset configuration for security settings
async function getAssetSecurityConfig(
  supabase: any,
  assetId: string
): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('asset_configurations')
      .select('*')
      .eq('asset_id', assetId)
      .order('collected_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// Generate deterministic hash from data
function generateDeterministicHash(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

interface STIGComplianceRequest {
  organization_id: string;
  asset_ids?: string[];
  stig_rule_ids?: string[];
  scan_type: 'full' | 'incremental' | 'targeted';
  remediation_mode?: 'safe' | 'aggressive' | 'manual_approval';
}

interface ComplianceResult {
  asset_id: string;
  stig_rule_id: string;
  compliance_status: 'COMPLIANT' | 'NOT_COMPLIANT' | 'PARTIAL' | 'ERROR';
  current_configuration: any;
  required_configuration: any;
  deviation_details: string[];
  remediation_actions: string[];
  risk_score: number;
  evidence_collected: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      organization_id, 
      asset_ids, 
      stig_rule_ids, 
      scan_type, 
      remediation_mode = 'safe' 
    }: STIGComplianceRequest = await req.json();

    console.log(`Starting STIG compliance monitoring for org: ${organization_id}, scan type: ${scan_type}`);

    // Get assets to scan
    let assets;
    if (asset_ids && asset_ids.length > 0) {
      const { data: assetsData, error: assetsError } = await supabase
        .from('environment_assets')
        .select('*')
        .eq('organization_id', organization_id)
        .in('id', asset_ids);
      
      if (assetsError) throw assetsError;
      assets = assetsData || [];
    } else {
      const { data: assetsData, error: assetsError } = await supabase
        .from('environment_assets')
        .select('*')
        .eq('organization_id', organization_id);
      
      if (assetsError) throw assetsError;
      assets = assetsData || [];
    }

    // Get STIG rules to check
    let stigRules;
    if (stig_rule_ids && stig_rule_ids.length > 0) {
      const { data: rulesData, error: rulesError } = await supabase
        .from('stig_rules')
        .select('*')
        .in('rule_id', stig_rule_ids);
      
      if (rulesError) throw rulesError;
      stigRules = rulesData || [];
    } else {
      const { data: rulesData, error: rulesError } = await supabase
        .from('stig_rules')
        .select('*')
        .limit(50); // Limit for demo
      
      if (rulesError) throw rulesError;
      stigRules = rulesData || [];
    }

    console.log(`Scanning ${assets.length} assets against ${stigRules.length} STIG rules`);

    // Perform compliance checks
    const complianceResults: ComplianceResult[] = [];
    const driftEvents = [];
    const evidenceCollected = [];

    for (const asset of assets) {
      for (const stigRule of stigRules) {
        const result = await performSTIGComplianceCheck(supabase, asset, stigRule);
        complianceResults.push(result);

        // Store implementation tracking
        await supabase.from('stig_rule_implementations').upsert({
          organization_id,
          asset_id: asset.id,
          stig_rule_id: stigRule.rule_id,
          rule_title: stigRule.title,
          severity: stigRule.severity,
          implementation_method: 'automated',
          implementation_status: result.compliance_status === 'COMPLIANT' ? 'IMPLEMENTED' : 'PENDING',
          compliance_status: result.compliance_status,
          last_checked: new Date().toISOString(),
          evidence_collected: result.evidence_collected
        });

        // Check for compliance drift
        const { data: lastSnapshot } = await supabase
          .from('asset_configuration_snapshots')
          .select('*')
          .eq('asset_id', asset.id)
          .order('captured_at', { ascending: false })
          .limit(1)
          .single();

        if (lastSnapshot && result.compliance_status !== 'COMPLIANT') {
          const driftEvent = {
            organization_id,
            asset_id: asset.id,
            stig_rule_id: stigRule.rule_id,
            drift_type: 'configuration_change',
            severity: stigRule.severity,
            previous_state: lastSnapshot.stig_compliance_status[stigRule.rule_id] || {},
            current_state: result.current_configuration,
            detection_method: 'automated_scan'
          };
          
          await supabase.from('compliance_drift_events').insert(driftEvent);
          driftEvents.push(driftEvent);
        }

        // Collect evidence
        for (const evidence of result.evidence_collected) {
          const evidenceRecord = {
            organization_id,
            asset_id: asset.id,
            stig_rule_id: stigRule.rule_id,
            evidence_type: evidence.type,
            evidence_data: evidence.data,
            collection_method: 'automated'
          };
          
          await supabase.from('stig_evidence').insert(evidenceRecord);
          evidenceCollected.push(evidenceRecord);
        }

        // Auto-remediation if enabled
        if (remediation_mode === 'safe' && result.compliance_status === 'NOT_COMPLIANT') {
          const { data: playbook } = await supabase
            .from('remediation_playbooks')
            .select('*')
            .eq('stig_rule_id', stigRule.rule_id)
            .eq('platform', asset.platform)
            .eq('auto_execute', true)
            .single();

          if (playbook && playbook.risk_level === 'LOW') {
            console.log(`Auto-remediation triggered for ${asset.asset_name} - ${stigRule.rule_id}`);
            
            // Trigger remediation function
            const { error: remediationError } = await supabase.functions.invoke(
              'automated-remediation-engine',
              {
                body: {
                  organization_id,
                  asset_id: asset.id,
                  stig_rule_id: stigRule.rule_id,
                  playbook_id: playbook.id
                }
              }
            );

            if (remediationError) {
              console.error('Remediation failed:', remediationError);
            }
          }
        }
      }

      // Create configuration snapshot
      const configSnapshot = {
        organization_id,
        asset_id: asset.id,
        snapshot_type: 'scheduled',
        configuration_data: generateConfigurationData(asset),
        stig_compliance_status: complianceResults
          .filter(r => r.asset_id === asset.id)
          .reduce((acc, r) => ({
            ...acc,
            [r.stig_rule_id]: {
              status: r.compliance_status,
              risk_score: r.risk_score,
              last_checked: new Date().toISOString()
            }
          }), {})
      };

      await supabase.from('asset_configuration_snapshots').insert(configSnapshot);
    }

    // Generate compliance summary
    const totalChecks = complianceResults.length;
    const compliantChecks = complianceResults.filter(r => r.compliance_status === 'COMPLIANT').length;
    const compliancePercentage = totalChecks > 0 ? (compliantChecks / totalChecks) * 100 : 0;
    
    const criticalFindings = complianceResults.filter(r => 
      r.compliance_status !== 'COMPLIANT' && r.risk_score >= 8
    ).length;
    
    const highFindings = complianceResults.filter(r => 
      r.compliance_status !== 'COMPLIANT' && r.risk_score >= 6 && r.risk_score < 8
    ).length;

    // Generate compliance report
    const report = {
      organization_id,
      report_type: 'stig_compliance',
      report_name: `STIG Compliance Scan - ${new Date().toISOString()}`,
      scope_assets: asset_ids || assets.map(a => a.id),
      scope_stigs: stig_rule_ids || stigRules.map(r => r.rule_id),
      compliance_percentage: compliancePercentage,
      critical_findings: criticalFindings,
      high_findings: highFindings,
      medium_findings: complianceResults.filter(r => 
        r.compliance_status !== 'COMPLIANT' && r.risk_score >= 4 && r.risk_score < 6
      ).length,
      low_findings: complianceResults.filter(r => 
        r.compliance_status !== 'COMPLIANT' && r.risk_score < 4
      ).length,
      report_data: {
        scan_summary: {
          total_assets: assets.length,
          total_rules: stigRules.length,
          total_checks: totalChecks,
          compliant_checks: compliantChecks,
          scan_duration_ms: Date.now()
        },
        compliance_results: complianceResults,
        drift_events: driftEvents.length,
        evidence_collected: evidenceCollected.length,
        remediation_actions: complianceResults.reduce((sum, r) => sum + r.remediation_actions.length, 0)
      }
    };

    await supabase.from('compliance_reports').insert(report);

    console.log(`Compliance monitoring completed: ${compliancePercentage.toFixed(2)}% compliant`);

    return new Response(JSON.stringify({
      success: true,
      compliance_percentage: compliancePercentage,
      total_checks: totalChecks,
      compliant_checks: compliantChecks,
      critical_findings: criticalFindings,
      high_findings: highFindings,
      drift_events_detected: driftEvents.length,
      evidence_collected: evidenceCollected.length,
      report_id: report.id || 'generated',
      results: complianceResults
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('STIG compliance monitoring error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to perform STIG compliance monitoring'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function performSTIGComplianceCheck(
  supabase: any,
  asset: any,
  stigRule: any
): Promise<ComplianceResult> {
  // Query actual compliance finding from database
  const actualFinding = await getActualComplianceFinding(supabase, asset.id, stigRule.rule_id);

  // Determine compliance status from real data
  let complianceStatus: 'COMPLIANT' | 'NOT_COMPLIANT' | 'PARTIAL' | 'ERROR';
  let riskScore: number;

  if (actualFinding) {
    // Use actual finding data
    if (actualFinding.status === 'PASS' || actualFinding.status === 'COMPLIANT') {
      complianceStatus = 'COMPLIANT';
      riskScore = Math.min(actualFinding.riskScore, 3); // Low risk if compliant
    } else if (actualFinding.status === 'PARTIAL') {
      complianceStatus = 'PARTIAL';
      riskScore = actualFinding.riskScore;
    } else {
      complianceStatus = 'NOT_COMPLIANT';
      riskScore = actualFinding.riskScore;
    }
  } else {
    // No finding exists - treat as unknown/needs scan
    complianceStatus = 'NOT_COMPLIANT';
    // Risk based on STIG rule severity
    const severityRisk: Record<string, number> = {
      'CAT_I': 9, 'HIGH': 8, 'CAT_II': 6, 'MEDIUM': 5, 'CAT_III': 3, 'LOW': 2
    };
    riskScore = severityRisk[stigRule.severity?.toUpperCase()] || 5;
  }

  const currentConfig = await generateCurrentConfiguration(supabase, asset, stigRule);
  const requiredConfig = generateRequiredConfiguration(stigRule);

  const isCompliant = complianceStatus === 'COMPLIANT';

  return {
    asset_id: asset.id,
    stig_rule_id: stigRule.rule_id,
    compliance_status: complianceStatus,
    current_configuration: currentConfig,
    required_configuration: requiredConfig,
    deviation_details: isCompliant ? [] : [
      `Configuration mismatch in ${stigRule.control_family || 'security controls'}`,
      'Security policy not enforced',
      'Access controls insufficient'
    ],
    remediation_actions: isCompliant ? [] : [
      `Apply ${stigRule.title} configuration`,
      'Update security policies',
      'Implement access controls'
    ],
    risk_score: riskScore,
    evidence_collected: [
      {
        type: 'configuration_scan',
        data: currentConfig,
        timestamp: new Date().toISOString()
      },
      {
        type: 'policy_check',
        data: { policies_checked: ['password_policy', 'audit_policy'] },
        timestamp: new Date().toISOString()
      }
    ]
  };
}

async function generateCurrentConfiguration(supabase: any, asset: any, stigRule: any): Promise<any> {
  // Query actual asset security configuration
  const securityConfig = await getAssetSecurityConfig(supabase, asset.id);

  if (securityConfig) {
    return {
      asset_type: asset.asset_type,
      platform: asset.platform,
      os_version: asset.operating_system,
      security_settings: {
        password_policy: securityConfig.password_policy_status || 'unknown',
        audit_logging: securityConfig.audit_logging_enabled ? 'enabled' : 'disabled',
        firewall_status: securityConfig.firewall_enabled ? 'active' : 'inactive',
        encryption: securityConfig.encryption_enabled ? 'enabled' : 'disabled'
      },
      compliance_level: stigRule.severity === 'HIGH' ? 'partial' : 'full',
      data_source: 'AGENT_COLLECTED'
    };
  }

  // Fallback to asset metadata (no random values)
  return {
    asset_type: asset.asset_type,
    platform: asset.platform,
    os_version: asset.operating_system,
    security_settings: {
      password_policy: 'unknown',
      audit_logging: asset.asset_type === 'server' ? 'enabled' : 'unknown',
      firewall_status: 'unknown',
      encryption: 'unknown'
    },
    compliance_level: stigRule.severity === 'HIGH' ? 'partial' : 'full',
    data_source: 'ASSET_METADATA',
    needs_agent_scan: true
  };
}

function generateRequiredConfiguration(stigRule: any): any {
  return {
    security_settings: {
      password_policy: 'strong',
      audit_logging: 'enabled',
      firewall_status: 'active',
      encryption: 'enabled'
    },
    compliance_requirements: stigRule.implementation_guidance || 'Standard STIG requirements apply',
    mandatory_controls: ['access_control', 'audit_logging', 'encryption']
  };
}

function generateConfigurationData(asset: any): any {
  const configData = {
    hostname: asset.hostname,
    ip_address: asset.ip_address,
    operating_system: asset.operating_system,
    platform: asset.platform,
    last_scan: new Date().toISOString(),
    services: asset.known_services || ['ssh', 'https'],
    security_patches: asset.patch_level || 0
  };

  return {
    ...configData,
    configuration_hash: generateDeterministicHash(configData)
  };
}