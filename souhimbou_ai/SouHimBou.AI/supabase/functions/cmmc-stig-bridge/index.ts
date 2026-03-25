import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CMMCBridgeRequest {
  action: 'generate_mapping' | 'collect_evidence' | 'create_poam' | 'validate_compliance';
  organization_id: string;
  cmmc_level?: number;
  control_families?: string[];
  asset_ids?: string[];
  assessment_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: CMMCBridgeRequest = await req.json();
    console.log('CMMC-STIG Bridge request:', request);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (request.action) {
      case 'generate_mapping':
        return await handleGenerateMapping(supabase, request);
      case 'collect_evidence':
        return await handleCollectEvidence(supabase, request);
      case 'create_poam':
        return await handleCreatePOAM(supabase, request);
      case 'validate_compliance':
        return await handleValidateCompliance(supabase, request);
      default:
        throw new Error(`Unknown action: ${request.action}`);
    }

  } catch (error) {
    console.error('Error in CMMC-STIG bridge:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleGenerateMapping(supabase: any, request: CMMCBridgeRequest) {
  const { organization_id, cmmc_level = 3, control_families = [] } = request;
  
  // Get CMMC controls for the specified level
  const cmmcControls = await getCMMCControls(cmmc_level, control_families);
  
  // Map to STIG rules
  const stigMappings = await mapCMMCToSTIG(supabase, cmmcControls);
  
  // Generate implementation plan
  const implementationPlan = await generateImplementationPlan(supabase, organization_id, stigMappings);
  
  return new Response(JSON.stringify({
    success: true,
    cmmc_level,
    mapped_controls: stigMappings.length,
    implementation_plan: implementationPlan,
    mappings: stigMappings
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleCollectEvidence(supabase: any, request: CMMCBridgeRequest) {
  const { organization_id, asset_ids = [] } = request;
  
  // Collect evidence from discovered assets
  const evidenceCollection = await collectAutomatedEvidence(supabase, organization_id, asset_ids);
  
  // Generate compliance evidence artifacts
  const evidenceArtifacts = await generateEvidenceArtifacts(supabase, evidenceCollection);
  
  return new Response(JSON.stringify({
    success: true,
    evidence_collected: evidenceCollection.length,
    artifacts_generated: evidenceArtifacts.length,
    evidence: evidenceCollection,
    artifacts: evidenceArtifacts
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleCreatePOAM(supabase: any, request: CMMCBridgeRequest) {
  const { organization_id, assessment_id } = request;
  
  // Identify non-compliant items
  const findings = await identifyFindings(supabase, organization_id, assessment_id);
  
  // Generate POAM entries
  const poamEntries = await generatePOAMEntries(supabase, findings);
  
  return new Response(JSON.stringify({
    success: true,
    findings_count: findings.length,
    poam_entries: poamEntries.length,
    findings,
    poam_entries: poamEntries
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleValidateCompliance(supabase: any, request: CMMCBridgeRequest) {
  const { organization_id, cmmc_level = 3 } = request;
  
  // Validate current compliance posture
  const complianceStatus = await validateCompliancePosture(supabase, organization_id, cmmc_level);
  
  return new Response(JSON.stringify({
    success: true,
    compliance_status: complianceStatus
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getCMMCControls(level: number, families: string[]) {
  // CMMC Level 3 controls mapped to families
  const cmmcControlsL3 = [
    { id: 'AC.L3-3.1.1', family: 'Access Control', title: 'Authorized Access Control' },
    { id: 'AC.L3-3.1.2', family: 'Access Control', title: 'Transaction & Function Control' },
    { id: 'AU.L3-3.3.1', family: 'Audit and Accountability', title: 'Audit Event Creation' },
    { id: 'AU.L3-3.3.2', family: 'Audit and Accountability', title: 'Audit Review Analysis' },
    { id: 'CA.L3-3.12.1', family: 'Security Assessment', title: 'Periodic Assessments' },
    { id: 'CM.L3-3.4.1', family: 'Configuration Management', title: 'Baseline Configuration' },
    { id: 'CM.L3-3.4.2', family: 'Configuration Management', title: 'Security Configuration' },
    { id: 'IA.L3-3.5.1', family: 'Identification and Authentication', title: 'User Identification' },
    { id: 'IA.L3-3.5.2', family: 'Identification and Authentication', title: 'MFA for Privileged Accounts' },
    { id: 'IR.L3-3.6.1', family: 'Incident Response', title: 'Incident Handling' },
    { id: 'MA.L3-3.7.1', family: 'Maintenance', title: 'System Maintenance' },
    { id: 'MP.L3-3.8.1', family: 'Media Protection', title: 'Media Handling' },
    { id: 'PE.L3-3.10.1', family: 'Physical Protection', title: 'Physical Access Control' },
    { id: 'PS.L3-3.9.1', family: 'Personnel Security', title: 'Personnel Screening' },
    { id: 'RA.L3-3.11.1', family: 'Risk Assessment', title: 'Risk Assessment' },
    { id: 'SA.L3-3.13.1', family: 'System and Services Acquisition', title: 'Supply Chain Protection' },
    { id: 'SC.L3-3.13.1', family: 'System and Communications Protection', title: 'Boundary Protection' },
    { id: 'SC.L3-3.13.2', family: 'System and Communications Protection', title: 'Security Functions' },
    { id: 'SI.L3-3.14.1', family: 'System and Information Integrity', title: 'Flaw Remediation' }
  ];

  return families.length > 0 
    ? cmmcControlsL3.filter(control => families.includes(control.family))
    : cmmcControlsL3;
}

async function mapCMMCToSTIG(supabase: any, cmmcControls: any[]) {
  const mappings = [];

  for (const control of cmmcControls) {
    // Query existing mappings
    const { data: existingMappings } = await supabase
      .from('cmmc_stig_mappings')
      .select('*')
      .eq('cmmc_control_id', control.id);

    if (existingMappings && existingMappings.length > 0) {
      mappings.push(...existingMappings.map((mapping: any) => ({
        ...control,
        stig_rule_id: mapping.stig_rule_id,
        mapping_strength: mapping.mapping_strength,
        notes: mapping.notes
      })));
    } else {
      // Create intelligent mapping based on control family
      const stigRules = await findRelatedSTIGRules(control);
      mappings.push({
        ...control,
        stig_rules: stigRules,
        mapping_strength: 'automated',
        notes: 'Auto-generated mapping based on control analysis'
      });
    }
  }

  return mappings;
}

async function findRelatedSTIGRules(control: any) {
  // Map CMMC controls to common STIG rule categories
  const mappingRules = {
    'Access Control': ['APSC-DV-000160', 'APSC-DV-000170', 'APSC-DV-001460'],
    'Audit and Accountability': ['APSC-DV-000400', 'APSC-DV-000410', 'APSC-DV-000420'],
    'Configuration Management': ['APSC-DV-000480', 'APSC-DV-000490', 'APSC-DV-000500'],
    'Identification and Authentication': ['APSC-DV-001750', 'APSC-DV-001760', 'APSC-DV-001770'],
    'Incident Response': ['APSC-DV-000950', 'APSC-DV-000960'],
    'System and Communications Protection': ['APSC-DV-002400', 'APSC-DV-002410', 'APSC-DV-002420']
  };

  return mappingRules[control.family] || [];
}

async function generateImplementationPlan(supabase: any, organizationId: string, mappings: any[]) {
  const plan = {
    phases: [
      {
        phase: 1,
        name: 'Assessment & Discovery',
        duration_weeks: 2,
        tasks: [
          'Asset discovery and inventory',
          'Current state assessment',
          'Gap analysis against CMMC requirements'
        ]
      },
      {
        phase: 2,
        name: 'STIG Implementation',
        duration_weeks: 8,
        tasks: [
          'Deploy STIG configurations',
          'Implement security controls',
          'Configure monitoring and logging'
        ]
      },
      {
        phase: 3,
        name: 'Evidence Collection',
        duration_weeks: 3,
        tasks: [
          'Automated evidence gathering',
          'Manual evidence collection',
          'Evidence validation and review'
        ]
      },
      {
        phase: 4,
        name: 'Validation & Certification',
        duration_weeks: 2,
        tasks: [
          'Compliance validation',
          'Final assessment',
          'CMMC certification preparation'
        ]
      }
    ],
    estimated_completion: '15 weeks',
    priority_controls: mappings.slice(0, 5).map(m => m.id)
  };

  return plan;
}

async function collectAutomatedEvidence(supabase: any, organizationId: string, assetIds: string[]) {
  const evidence = [];

  // Collect from discovered assets
  const { data: assets } = await supabase
    .from('discovered_assets')
    .select('*')
    .eq('organization_id', organizationId)
    .in('id', assetIds.length > 0 ? assetIds : []);

  for (const asset of assets || []) {
    // System configuration evidence
    evidence.push({
      type: 'system_configuration',
      asset_id: asset.id,
      title: `${asset.hostname || asset.asset_identifier} Configuration`,
      data: asset.system_info,
      compliance_controls: ['CM.L3-3.4.1', 'CM.L3-3.4.2'],
      collected_at: new Date().toISOString()
    });

    // Service inventory evidence
    if (asset.discovered_services) {
      evidence.push({
        type: 'service_inventory',
        asset_id: asset.id,
        title: `${asset.hostname || asset.asset_identifier} Services`,
        data: asset.discovered_services,
        compliance_controls: ['CM.L3-3.4.1'],
        collected_at: new Date().toISOString()
      });
    }

    // Vulnerability assessment evidence
    if (asset.risk_score > 0) {
      evidence.push({
        type: 'vulnerability_assessment', 
        asset_id: asset.id,
        title: `${asset.hostname || asset.asset_identifier} Risk Assessment`,
        data: {
          risk_score: asset.risk_score,
          compliance_status: asset.compliance_status
        },
        compliance_controls: ['RA.L3-3.11.1', 'SI.L3-3.14.1'],
        collected_at: new Date().toISOString()
      });
    }
  }

  return evidence;
}

async function generateEvidenceArtifacts(supabase: any, evidenceCollection: any[]) {
  const artifacts = [];

  // Group evidence by type
  const groupedEvidence = evidenceCollection.reduce((groups, evidence) => {
    const type = evidence.type;
    if (!groups[type]) groups[type] = [];
    groups[type].push(evidence);
    return groups;
  }, {});

  // Generate artifacts for each evidence type
  for (const [type, evidenceList] of Object.entries(groupedEvidence)) {
    artifacts.push({
      artifact_type: `${type}_report`,
      title: `${type.replace('_', ' ').toUpperCase()} Evidence Report`,
      evidence_count: (evidenceList as any[]).length,
      generated_at: new Date().toISOString(),
      format: 'json',
      data: evidenceList
    });
  }

  return artifacts;
}

async function identifyFindings(supabase: any, organizationId: string, assessmentId?: string) {
  const findings = [];

  // Check for non-compliant assets
  const { data: assets } = await supabase
    .from('discovered_assets')
    .select('*')
    .eq('organization_id', organizationId)
    .gt('risk_score', 50);

  for (const asset of assets || []) {
    findings.push({
      finding_type: 'high_risk_asset',
      severity: 'HIGH',
      asset_id: asset.id,
      description: `Asset ${asset.hostname || asset.asset_identifier} has high risk score: ${asset.risk_score}`,
      cmmc_controls_affected: ['RA.L3-3.11.1', 'SI.L3-3.14.1'],
      remediation_required: true
    });
  }

  return findings;
}

async function generatePOAMEntries(supabase: any, findings: any[]) {
  const poamEntries = [];

  for (const finding of findings) {
    poamEntries.push({
      weakness_description: finding.description,
      severity: finding.severity,
      controls_affected: finding.cmmc_controls_affected?.join(', '),
      remediation_plan: generateRemediationPlan(finding),
      estimated_completion: getEstimatedCompletion(finding.severity),
      responsible_party: 'System Administrator',
      status: 'Open',
      created_date: new Date().toISOString()
    });
  }

  return poamEntries;
}

function generateRemediationPlan(finding: any): string {
  switch (finding.finding_type) {
    case 'high_risk_asset':
      return 'Implement additional security controls, update configurations, and apply security patches to reduce risk score below threshold.';
    default:
      return 'Review and implement appropriate security controls to address the identified weakness.';
  }
}

function getEstimatedCompletion(severity: string): string {
  const completionDays = {
    'CRITICAL': 7,
    'HIGH': 30,
    'MEDIUM': 60,
    'LOW': 90
  };

  const days = completionDays[severity] || 30;
  const completionDate = new Date();
  completionDate.setDate(completionDate.getDate() + days);
  return completionDate.toISOString().split('T')[0];
}

async function validateCompliancePosture(supabase: any, organizationId: string, cmmcLevel: number) {
  const { data: assets } = await supabase
    .from('discovered_assets') 
    .select('*')
    .eq('organization_id', organizationId);

  const totalAssets = assets?.length || 0;
  const compliantAssets = assets?.filter(asset => asset.risk_score < 50).length || 0;
  const compliancePercentage = totalAssets > 0 ? (compliantAssets / totalAssets) * 100 : 0;

  return {
    cmmc_level: cmmcLevel,
    total_assets: totalAssets,
    compliant_assets: compliantAssets,
    compliance_percentage: Math.round(compliancePercentage * 100) / 100,
    overall_status: compliancePercentage >= 90 ? 'COMPLIANT' : 'NON_COMPLIANT',
    next_assessment_due: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    recommendations: generateComplianceRecommendations(compliancePercentage, totalAssets)
  };
}

function generateComplianceRecommendations(compliancePercentage: number, totalAssets: number): string[] {
  const recommendations = [];

  if (compliancePercentage < 70) {
    recommendations.push('Immediate action required: Compliance level is critically low');
    recommendations.push('Prioritize high-risk asset remediation');
  }

  if (compliancePercentage < 90) {
    recommendations.push('Continue security hardening efforts');
    recommendations.push('Implement automated compliance monitoring');
  }

  if (totalAssets === 0) {
    recommendations.push('Begin asset discovery to establish baseline inventory');
  }

  if (recommendations.length === 0) {
    recommendations.push('Maintain current security posture');
    recommendations.push('Schedule regular compliance assessments');
  }

  return recommendations;
}