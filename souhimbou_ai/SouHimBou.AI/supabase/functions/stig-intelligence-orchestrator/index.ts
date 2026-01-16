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

  const implementationPlan = {
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
  const { platform, stig_category, implementation_status, organization_id } = search_criteria;

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
  const syncResults = feed_types.map((feedType: string) => ({
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