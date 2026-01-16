import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DriftDetectionRequest {
  organization_id: string;
  asset_ids?: string[];
  detection_mode: 'continuous' | 'scheduled' | 'triggered';
  sensitivity_level: 'low' | 'medium' | 'high';
  auto_remediation?: boolean;
}

interface DriftEvent {
  asset_id: string;
  stig_rule_id: string;
  drift_type: 'configuration_change' | 'policy_violation' | 'security_event' | 'unauthorized_access';
  severity: string;
  previous_state: any;
  current_state: any;
  detection_method: string;
  confidence_score: number;
  risk_impact: string;
  recommended_actions: string[];
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
      detection_mode = 'scheduled',
      sensitivity_level = 'medium',
      auto_remediation = false
    }: DriftDetectionRequest = await req.json();

    console.log(`Starting compliance drift detection for org: ${organization_id}, mode: ${detection_mode}`);

    // Get assets to monitor
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

    console.log(`Monitoring ${assets.length} assets for compliance drift`);

    const driftEvents: DriftEvent[] = [];
    const alertsTriggered = [];
    const remediationActions = [];

    for (const asset of assets) {
      // Get latest configuration snapshot
      const { data: latestSnapshot, error: snapshotError } = await supabase
        .from('asset_configuration_snapshots')
        .select('*')
        .eq('asset_id', asset.id)
        .order('captured_at', { ascending: false })
        .limit(1);

      if (snapshotError) {
        console.error(`Error fetching snapshot for asset ${asset.id}:`, snapshotError);
        continue;
      }

      // Get baseline configuration
      const { data: baselineSnapshot, error: baselineError } = await supabase
        .from('asset_configuration_snapshots')
        .select('*')
        .eq('asset_id', asset.id)
        .eq('snapshot_type', 'baseline')
        .order('captured_at', { ascending: false })
        .limit(1);

      if (baselineError || !baselineSnapshot || baselineSnapshot.length === 0) {
        console.log(`No baseline found for asset ${asset.id}, creating one`);
        
        // Create baseline snapshot
        const baselineConfig = generateBaselineConfiguration(asset);
        await supabase.from('asset_configuration_snapshots').insert({
          organization_id,
          asset_id: asset.id,
          snapshot_type: 'baseline',
          configuration_data: baselineConfig,
          stig_compliance_status: {}
        });
        
        continue;
      }

      // Detect configuration drift
      const currentConfig = generateCurrentConfiguration(asset);
      const baseline = baselineSnapshot[0];
      
      const configurationDrift = detectConfigurationDrift(
        baseline.configuration_data,
        currentConfig,
        sensitivity_level
      );

      // Detect compliance drift
      const { data: stigImplementations, error: stigError } = await supabase
        .from('stig_rule_implementations')
        .select('*')
        .eq('asset_id', asset.id)
        .eq('organization_id', organization_id);

      if (stigError) {
        console.error(`Error fetching STIG implementations for asset ${asset.id}:`, stigError);
        continue;
      }

      for (const impl of stigImplementations || []) {
        // Simulate compliance drift detection
        const hasDrift = detectComplianceDrift(impl, currentConfig, sensitivity_level);
        
        if (hasDrift.detected) {
          const driftEvent: DriftEvent = {
            asset_id: asset.id,
            stig_rule_id: impl.stig_rule_id,
            drift_type: hasDrift.type,
            severity: calculateDriftSeverity(impl.severity, hasDrift.impact),
            previous_state: baseline.stig_compliance_status[impl.stig_rule_id] || {},
            current_state: {
              compliance_status: hasDrift.current_compliance,
              configuration: currentConfig,
              detected_at: new Date().toISOString()
            },
            detection_method: 'automated_monitoring',
            confidence_score: hasDrift.confidence,
            risk_impact: hasDrift.impact,
            recommended_actions: generateRemediationRecommendations(impl, hasDrift)
          };

          driftEvents.push(driftEvent);

          // Store drift event
          await supabase.from('compliance_drift_events').insert({
            organization_id,
            asset_id: asset.id,
            stig_rule_id: impl.stig_rule_id,
            drift_type: driftEvent.drift_type,
            severity: driftEvent.severity,
            previous_state: driftEvent.previous_state,
            current_state: driftEvent.current_state,
            detection_method: driftEvent.detection_method
          });

          // Check if alerts should be triggered
          const shouldAlert = shouldTriggerAlert(driftEvent, sensitivity_level);
          if (shouldAlert) {
            const alert = await triggerDriftAlert(supabase, organization_id, driftEvent, asset);
            alertsTriggered.push(alert);
          }

          // Auto-remediation if enabled and safe
          if (auto_remediation && driftEvent.severity !== 'CRITICAL' && driftEvent.confidence_score > 0.8) {
            try {
              const { error: remediationError } = await supabase.functions.invoke(
                'automated-remediation-engine',
                {
                  body: {
                    organization_id,
                    asset_id: asset.id,
                    stig_rule_id: impl.stig_rule_id,
                    execution_mode: 'execute',
                    approval_required: false
                  }
                }
              );

              if (!remediationError) {
                remediationActions.push({
                  asset_id: asset.id,
                  stig_rule_id: impl.stig_rule_id,
                  action: 'auto_remediation_triggered'
                });

                // Update drift event with remediation info
                await supabase
                  .from('compliance_drift_events')
                  .update({
                    auto_remediated: true,
                    remediation_action: 'Automated remediation executed'
                  })
                  .eq('asset_id', asset.id)
                  .eq('stig_rule_id', impl.stig_rule_id)
                  .order('detected_at', { ascending: false })
                  .limit(1);
              }
            } catch (error) {
              console.error('Auto-remediation failed:', error);
            }
          }
        }
      }

      // Update asset with current configuration snapshot
      await supabase.from('asset_configuration_snapshots').insert({
        organization_id,
        asset_id: asset.id,
        snapshot_type: 'scheduled',
        configuration_data: currentConfig,
        stig_compliance_status: (stigImplementations || []).reduce((acc, impl) => ({
          ...acc,
          [impl.stig_rule_id]: {
            status: impl.compliance_status,
            last_checked: impl.last_checked
          }
        }), {})
      });
    }

    // Generate drift analysis report
    const driftAnalysis = {
      total_assets_monitored: assets.length,
      drift_events_detected: driftEvents.length,
      critical_drift_events: driftEvents.filter(e => e.severity === 'CRITICAL').length,
      high_drift_events: driftEvents.filter(e => e.severity === 'HIGH').length,
      alerts_triggered: alertsTriggered.length,
      auto_remediations: remediationActions.length,
      average_confidence_score: driftEvents.length > 0 
        ? driftEvents.reduce((sum, e) => sum + e.confidence_score, 0) / driftEvents.length 
        : 0,
      detection_mode,
      sensitivity_level
    };

    console.log(`Drift detection completed: ${driftEvents.length} events detected`);

    return new Response(JSON.stringify({
      success: true,
      drift_analysis: driftAnalysis,
      drift_events: driftEvents,
      alerts_triggered: alertsTriggered,
      remediation_actions: remediationActions,
      monitoring_timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Compliance drift detection error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to perform compliance drift detection'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function generateCurrentConfiguration(asset: any): any {
  // Simulate current system configuration
  return {
    hostname: asset.hostname,
    os_version: asset.operating_system,
    security_patches: Math.floor(Math.random() * 100),
    services: ['ssh', 'http', 'https', 'ftp'],
    firewall_rules: Math.floor(Math.random() * 20),
    user_accounts: Math.floor(Math.random() * 50),
    last_login: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    security_settings: {
      password_policy: Math.random() > 0.8 ? 'weak' : 'strong',
      audit_logging: Math.random() > 0.2 ? 'enabled' : 'disabled',
      encryption: Math.random() > 0.3 ? 'enabled' : 'disabled'
    },
    configuration_hash: Math.random().toString(36).substring(7)
  };
}

function generateBaselineConfiguration(asset: any): any {
  return {
    hostname: asset.hostname,
    os_version: asset.operating_system,
    security_patches: 95,
    services: ['ssh', 'https'],
    firewall_rules: 15,
    user_accounts: 25,
    security_settings: {
      password_policy: 'strong',
      audit_logging: 'enabled',
      encryption: 'enabled'
    },
    baseline_established: new Date().toISOString()
  };
}

function detectConfigurationDrift(baseline: any, current: any, sensitivity: string): any {
  const changes = [];
  
  // Check for significant configuration changes
  if (baseline.security_patches && current.security_patches < baseline.security_patches - 10) {
    changes.push('Security patches reduced');
  }
  
  if (baseline.services?.length && current.services?.length > baseline.services.length + 2) {
    changes.push('New services detected');
  }
  
  if (baseline.security_settings?.password_policy === 'strong' && 
      current.security_settings?.password_policy === 'weak') {
    changes.push('Password policy weakened');
  }

  return {
    detected: changes.length > 0,
    changes,
    severity: changes.length > 2 ? 'HIGH' : 'MEDIUM'
  };
}

function detectComplianceDrift(implementation: any, currentConfig: any, sensitivity: string): any {
  // Simulate compliance drift detection
  const driftProbability = sensitivity === 'high' ? 0.3 : sensitivity === 'medium' ? 0.2 : 0.1;
  const detected = Math.random() < driftProbability;
  
  if (!detected) {
    return { detected: false };
  }

  const driftTypes = ['configuration_change', 'policy_violation', 'security_event', 'unauthorized_access'];
  const impacts = ['LOW', 'MEDIUM', 'HIGH'];
  
  return {
    detected: true,
    type: driftTypes[Math.floor(Math.random() * driftTypes.length)],
    current_compliance: Math.random() > 0.5 ? 'PARTIAL' : 'NOT_COMPLIANT',
    confidence: Math.random() * 0.4 + 0.6, // 0.6 to 1.0
    impact: impacts[Math.floor(Math.random() * impacts.length)]
  };
}

function calculateDriftSeverity(originalSeverity: string, impact: string): string {
  if (originalSeverity === 'CRITICAL' || impact === 'HIGH') {
    return 'CRITICAL';
  }
  if (originalSeverity === 'HIGH' || impact === 'MEDIUM') {
    return 'HIGH';
  }
  return 'MEDIUM';
}

function generateRemediationRecommendations(implementation: any, driftInfo: any): string[] {
  const recommendations = [
    'Review and restore baseline configuration',
    'Verify STIG rule implementation',
    'Update security policies',
    'Conduct security audit',
    'Implement additional monitoring'
  ];
  
  // Return 2-4 recommendations based on drift severity
  const count = driftInfo.impact === 'HIGH' ? 4 : driftInfo.impact === 'MEDIUM' ? 3 : 2;
  return recommendations.slice(0, count);
}

function shouldTriggerAlert(driftEvent: DriftEvent, sensitivity: string): boolean {
  if (driftEvent.severity === 'CRITICAL') return true;
  if (driftEvent.severity === 'HIGH' && sensitivity !== 'low') return true;
  if (driftEvent.confidence_score > 0.9 && sensitivity === 'high') return true;
  
  return false;
}

async function triggerDriftAlert(supabase: any, organizationId: string, driftEvent: DriftEvent, asset: any): Promise<any> {
  // Create security alert
  const alert = {
    organization_id: organizationId,
    alert_type: 'compliance_drift',
    alert_category: 'stig_compliance',
    severity: driftEvent.severity,
    title: `Compliance Drift Detected: ${driftEvent.stig_rule_id}`,
    description: `Asset ${asset.asset_name} has drifted from STIG compliance baseline`,
    metadata: {
      asset_id: driftEvent.asset_id,
      asset_name: asset.asset_name,
      stig_rule_id: driftEvent.stig_rule_id,
      drift_type: driftEvent.drift_type,
      confidence_score: driftEvent.confidence_score,
      risk_impact: driftEvent.risk_impact,
      recommended_actions: driftEvent.recommended_actions
    }
  };

  const { data: alertData, error: alertError } = await supabase
    .from('security_alerts')
    .insert(alert)
    .select()
    .single();

  if (alertError) {
    console.error('Failed to create drift alert:', alertError);
    return null;
  }

  // Check for escalation rules
  const { data: escalationRules } = await supabase
    .from('stig_alert_rules')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('enabled', true);

  for (const rule of escalationRules || []) {
    if (rule.stig_rule_ids.includes(driftEvent.stig_rule_id)) {
      // Trigger notifications based on escalation rules
      console.log(`Triggering escalation for rule: ${rule.rule_name}`);
      
      // Here you would integrate with notification services
      // (email, Slack, Teams, SIEM, etc.) based on rule.notification_channels
    }
  }

  return alertData;
}