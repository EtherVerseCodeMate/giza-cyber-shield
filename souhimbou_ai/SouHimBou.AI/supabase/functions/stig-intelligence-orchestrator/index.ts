/**
 * STIG Intelligence Orchestrator
 * Handles STIG trusted registry, CMMC-to-STIG bridge, and threat intelligence
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// Helper Functions for Real Data Queries
// =============================================================================

// Query historical verification data to determine baseline confidence
async function getHistoricalVerificationStats(
  supabase: any,
  configurationId: string
): Promise<{ avgConfidence: number; successRate: number; totalVerifications: number }> {
  try {
    const { data, error } = await supabase
      .from('stig_ai_verifications')
      .select('confidence_score, verification_status')
      .eq('configuration_id', configurationId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      return { avgConfidence: 0.85, successRate: 0.9, totalVerifications: 0 };
    }

    const totalVerifications = data.length;
    const avgConfidence = data.reduce((sum: number, v: any) => sum + (v.confidence_score || 0.8), 0) / totalVerifications;
    const successCount = data.filter((v: any) => v.verification_status === 'verified').length;
    const successRate = successCount / totalVerifications;

    return { avgConfidence, successRate, totalVerifications };
  } catch {
    return { avgConfidence: 0.85, successRate: 0.9, totalVerifications: 0 };
  }
}

// Query CMMC-to-STIG mapping table for real mappings
async function getCMMCToSTIGMappings(
  supabase: any,
  cmmcControl: string,
  platforms: string[]
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('cmmc_stig_mappings')
      .select('stig_id, platform, implementation_guidance, automation_possible, priority_score')
      .eq('cmmc_control', cmmcControl)
      .in('platform', platforms);

    if (error || !data || data.length === 0) {
      return [];
    }

    return data;
  } catch {
    return [];
  }
}

// Query optimization analysis history
async function getOptimizationHistory(
  supabase: any,
  assetId: string,
  stigRule: string
): Promise<{ currentCompliance: string; lastAnalysis: any | null }> {
  try {
    // Check current compliance status
    const { data: findings } = await supabase
      .from('stig_findings')
      .select('status, severity, updated_at')
      .eq('asset_id', assetId)
      .eq('rule_id', stigRule)
      .order('updated_at', { ascending: false })
      .limit(1);

    // Check past analyses
    const { data: analyses } = await supabase
      .from('stig_ai_analyses')
      .select('ai_findings, confidence_score, implementation_priority')
      .contains('stig_rules_analyzed', [stigRule])
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false })
      .limit(1);

    const currentStatus = findings?.[0]?.status || 'unknown';
    const compliance = currentStatus === 'PASS' ? 'compliant' : 'non_compliant';

    return {
      currentCompliance: compliance,
      lastAnalysis: analyses?.[0] || null
    };
  } catch {
    return { currentCompliance: 'unknown', lastAnalysis: null };
  }
}

// Query intelligence feed sync status
async function getIntelligenceFeedStatus(
  supabase: any,
  feedType: string
): Promise<{ lastSyncRecords: number; lastSyncAt: string | null }> {
  try {
    const { data, error } = await supabase
      .from('intelligence_feed_syncs')
      .select('records_synced, completed_at')
      .eq('feed_type', feedType)
      .eq('sync_status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return { lastSyncRecords: 0, lastSyncAt: null };
    }

    return {
      lastSyncRecords: data[0].records_synced || 0,
      lastSyncAt: data[0].completed_at
    };
  } catch {
    return { lastSyncRecords: 0, lastSyncAt: null };
  }
}

// Query workflow execution history for success rate
async function getWorkflowSuccessRate(
  supabase: any,
  workflowId: string
): Promise<{ successRate: number; avgDuration: number; totalExecutions: number }> {
  try {
    const { data, error } = await supabase
      .from('stig_remediation_executions')
      .select('execution_status, execution_duration_seconds')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      return { successRate: 0.9, avgDuration: 30, totalExecutions: 0 };
    }

    const totalExecutions = data.length;
    const successCount = data.filter((e: any) => e.execution_status === 'completed').length;
    const successRate = successCount / totalExecutions;
    const durations = data.filter((e: any) => e.execution_duration_seconds).map((e: any) => e.execution_duration_seconds);
    const avgDuration = durations.length > 0 ? durations.reduce((a: number, b: number) => a + b, 0) / durations.length : 30;

    return { successRate, avgDuration, totalExecutions };
  } catch {
    return { successRate: 0.9, avgDuration: 30, totalExecutions: 0 };
  }
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

    const { action, ...payload } = await req.json();

    console.log(`STIG Intelligence Orchestrator: ${action}`, payload);

    switch (action) {
      case 'get_trusted_configurations':
        return await handleGetTrustedConfigurations(supabase, payload);

      case 'verify_configuration_ai':
        return await handleAIVerification(supabase, payload);

      case 'generate_cmmc_mapping':
        return await handleCMMCMapping(supabase, payload);

      case 'correlate_threat_intelligence':
        return await handleThreatCorrelation(supabase, payload);

      case 'analyze_stig_optimization':
        return await handleSTIGOptimization(supabase, payload);

      case 'search_configurations':
        return await handleConfigurationSearch(supabase, payload);

      case 'sync_intelligence_feeds':
        return await handleIntelligenceSync(supabase, payload);

      case 'execute_remediation_workflow':
        return await handleExecuteWorkflow(supabase, payload);

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
    }
  } catch (error) {
    console.error('STIG Intelligence Orchestrator error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function handleGetTrustedConfigurations(supabase: any, payload: any) {
  const { stig_id, platform_type, organization_id } = payload;

  const { data: configurations, error } = await supabase
    .from('stig_trusted_configurations')
    .select(`
      *,
      stig_ai_verifications(*)
    `)
    .eq('organization_id', organization_id)
    .eq('stig_id', stig_id)
    .eq('platform_type', platform_type)
    .eq('disa_approved', true)
    .order('confidence_score', { ascending: false });

  if (error) throw error;

  return new Response(
    JSON.stringify({ configurations }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleAIVerification(supabase: any, payload: any) {
  const { configuration_id, environment_context, organization_id } = payload;

  // Simulate AI verification process
  const aiVerificationResult = {
    verification_status: Math.random() > 0.2 ? 'verified' : 'warning',
    confidence_score: Math.random() * 0.3 + 0.7, // 0.7-1.0
    risk_assessment: {
      security_impact: Math.random() > 0.8 ? 'high' : 'medium',
      implementation_complexity: Math.random() > 0.6 ? 'complex' : 'standard',
      compatibility_score: Math.random() * 0.2 + 0.8
    },
    recommendations: [
      'Validate configuration in test environment before production deployment',
      'Monitor for performance impact during initial 24 hours',
      'Verify backup procedures are in place before implementation'
    ],
    verification_details: 'AI analysis completed successfully with environment-specific validation',
    ai_model_version: 'stig-intelligence-v2.1'
  };

  const { data: verification, error } = await supabase
    .from('stig_ai_verifications')
    .insert({
      configuration_id,
      organization_id,
      verification_type: 'environment_validation',
      environment_context,
      ...aiVerificationResult
    })
    .select()
    .single();

  if (error) throw error;

  return new Response(
    JSON.stringify(verification),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleCMMCMapping(supabase: any, payload: any) {
  const { cmmc_controls, target_platforms } = payload;

  // Generate CMMC-to-STIG mappings
  const mappings = cmmc_controls.map((control: string) => {
    const stigImplementations = generateSTIGImplementations(control, target_platforms);
    return {
      cmmc_control: control,
      stig_implementations: stigImplementations
    };
  });

  // Calculate implementation plan
  const totalSTIGRules = mappings.reduce((total: number, mapping: any) =>
    total + mapping.stig_implementations.length, 0);

  const automatedImplementations = mappings.reduce((total: number, mapping: any) =>
    total + mapping.stig_implementations.filter((impl: any) => impl.automation_possible).length, 0);

  const implementation_plan = {
    total_stig_rules: totalSTIGRules,
    automated_implementations: automatedImplementations,
    manual_implementations: totalSTIGRules - automatedImplementations,
    estimated_effort_hours: totalSTIGRules * 4 + (totalSTIGRules - automatedImplementations) * 8
  };

  return new Response(
    JSON.stringify({ mappings, implementation_plan }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleThreatCorrelation(supabase: any, payload: any) {
  const { organization_id, threat_sources = ['disa_vulnerability', 'cve_nvd'] } = payload;

  // Simulate threat intelligence correlation
  const correlations = [
    {
      threat_source: 'disa_vulnerability',
      threat_indicator: 'CVE-2024-12345',
      threat_type: 'remote_code_execution',
      correlated_stig_rules: ['V-220857', 'V-220858', 'V-220859'],
      risk_elevation: 'critical',
      correlation_confidence: 0.95,
      threat_intelligence: {
        cvss_score: 9.8,
        attack_vector: 'network',
        impact: 'complete_system_compromise'
      },
      mitigation_recommendations: [
        'Apply emergency patches immediately',
        'Implement network segmentation',
        'Enable enhanced monitoring'
      ],
      correlation_details: 'High-severity vulnerability with active exploitation detected'
    },
    {
      threat_source: 'mitre_attack',
      threat_indicator: 'T1078.004',
      threat_type: 'cloud_account_compromise',
      correlated_stig_rules: ['V-220123', 'V-220124'],
      risk_elevation: 'high',
      correlation_confidence: 0.87,
      threat_intelligence: {
        technique: 'Valid Accounts: Cloud Accounts',
        tactic: 'initial_access'
      },
      mitigation_recommendations: [
        'Enforce MFA for all cloud accounts',
        'Implement conditional access policies',
        'Review and audit cloud permissions'
      ],
      correlation_details: 'MITRE ATT&CK technique correlation with STIG requirements'
    }
  ];

  // Insert correlations into database
  const { data: insertedCorrelations, error } = await supabase
    .from('stig_threat_correlations')
    .insert(
      correlations.map(corr => ({
        organization_id,
        ...corr,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      }))
    )
    .select();

  if (error) throw error;

  return new Response(
    JSON.stringify(insertedCorrelations),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleSTIGOptimization(supabase: any, payload: any) {
  const { asset_id, stig_rules, analysis_options, organization_id } = payload;

  // Simulate AI STIG optimization analysis
  const analyses = stig_rules.map((stigRule: string) => ({
    stig_rule_id: stigRule,
    analysis_type: 'optimization',
    ai_findings: {
      current_implementation: Math.random() > 0.7 ? 'compliant' : 'non_compliant',
      optimization_potential: Math.random() * 40 + 10, // 10-50% improvement
      security_impact: Math.random() > 0.6 ? 'positive' : 'neutral',
      performance_impact: Math.random() > 0.8 ? 'negative' : 'minimal'
    },
    recommendations: [
      'Consider automated implementation for improved consistency',
      'Validate configuration against latest DISA guidance',
      'Implement monitoring for configuration drift'
    ],
    confidence_score: Math.random() * 0.2 + 0.8,
    implementation_priority: Math.floor(Math.random() * 50) + 50
  }));

  const { data: insertedAnalyses, error } = await supabase
    .from('stig_ai_analyses')
    .insert(
      analyses.map(analysis => ({
        organization_id,
        asset_id,
        analysis_type: 'optimization',
        stig_rules_analyzed: [analysis.stig_rule_id],
        analysis_scope: analysis_options,
        ai_findings: analysis.ai_findings,
        recommendations: analysis.recommendations,
        confidence_score: analysis.confidence_score,
        implementation_priority: analysis.implementation_priority
      }))
    )
    .select();

  if (error) throw error;

  return new Response(
    JSON.stringify(insertedAnalyses),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleConfigurationSearch(supabase: any, payload: any) {
  const { search_criteria } = payload;
  const { platform, implementation_status, organization_id } = search_criteria;

  let query = supabase
    .from('stig_trusted_configurations')
    .select('*')
    .eq('organization_id', organization_id);

  if (platform) {
    query = query.eq('platform_type', platform);
  }

  if (implementation_status) {
    query = query.eq('disa_approved', implementation_status === 'approved');
  }

  const { data: configurations, error } = await query
    .order('confidence_score', { ascending: false })
    .limit(50);

  if (error) throw error;

  return new Response(
    JSON.stringify({
      configurations,
      total_results: configurations.length,
      search_criteria
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleIntelligenceSync(supabase: any, payload: any) {
  const { feed_types = ['disa_vulnerability', 'cve_nvd'] } = payload;

  // Simulate intelligence feed synchronization
  const sync_results = feed_types.map((feedType: string) => ({
    feed_type: feedType,
    sync_status: 'completed',
    records_updated: Math.floor(Math.random() * 500) + 100,
    last_sync_at: new Date().toISOString(),
    next_sync_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }));

  return new Response(
    JSON.stringify({ sync_results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function generateSTIGImplementations(cmmcControl: string, platforms: string[]) {
  // Simulate STIG implementations for CMMC control
  const stigImplementations = platforms.flatMap(platform => [
    {
      stig_id: `V-${Math.floor(Math.random() * 900000) + 100000}`,
      platform: platform,
      implementation_guidance: `Implement ${cmmcControl} requirements for ${platform} systems`,
      automation_possible: Math.random() > 0.4,
      priority_score: Math.floor(Math.random() * 40) + 60
    }
  ]);

  return stigImplementations;
}

async function handleExecuteWorkflow(supabase: any, payload: any) {
  const { workflow_id, organization_id } = payload;

  console.log(`Executing remediation workflow ${workflow_id} for org ${organization_id}`);

  // Fetch workflow details
  const { data: workflow, error: workflowError } = await supabase
    .from('stig_remediation_workflows')
    .select('*')
    .eq('id', workflow_id)
    .single();

  if (workflowError) throw workflowError;

  // Create execution record
  const { data: execution, error: execError } = await supabase
    .from('stig_remediation_executions')
    .insert({
      organization_id,
      workflow_id,
      execution_status: 'running',
      started_at: new Date().toISOString(),
      metadata: { workflow_name: workflow.workflow_name }
    })
    .select()
    .single();

  if (execError) throw execError;

  // Simulate workflow steps execution
  try {
    // In production, this would coordinate multiple remediation actions
    const success = Math.random() > 0.1; // 90% success rate

    await supabase
      .from('stig_remediation_executions')
      .update({
        execution_status: success ? 'completed' : 'failed',
        completed_at: new Date().toISOString(),
        execution_duration_seconds: Math.floor(Math.random() * 60) + 10,
        error_message: success ? null : 'Simulated workflow step failure'
      })
      .eq('id', execution.id);

    // Update workflow stats
    await supabase
      .from('stig_remediation_workflows')
      .update({
        execution_count: (workflow.execution_count || 0) + 1,
        last_execution: new Date().toISOString()
      })
      .eq('id', workflow_id);

    return new Response(
      JSON.stringify({ success, execution_id: execution.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Workflow execution error:', error);
    await supabase
      .from('stig_remediation_executions')
      .update({
        execution_status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message
      })
      .eq('id', execution.id);

    throw error;
  }
}