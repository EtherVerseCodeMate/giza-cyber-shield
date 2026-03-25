import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ComplianceAnalysisRequest {
  organization_id: string;
  analysis_type: 'comprehensive' | 'targeted' | 'risk_based';
  focus_areas?: string[];
  timeframe?: string;
}

interface ComplianceGap {
  control_id: string;
  title: string;
  family: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  gap_type: 'not_implemented' | 'partially_implemented' | 'needs_improvement';
  risk_score: number;
  implementation_complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  estimated_effort_hours: number;
  automation_potential: number;
  ai_recommendation: string;
  required_resources: string[];
  dependencies: string[];
}

interface AIRecommendation {
  category: 'implementation' | 'automation' | 'remediation' | 'monitoring';
  title: string;
  description: string;
  confidence_score: number;
  implementation_steps: string[];
  expected_benefit: string;
  risk_mitigation: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { organization_id, analysis_type, focus_areas, timeframe }: ComplianceAnalysisRequest = await req.json();

    console.log('Starting AI compliance analysis:', { organization_id, analysis_type });

    // Fetch current compliance state
    const { data: nistControls, error: controlsError } = await supabaseClient
      .from('nist_controls')
      .select('*');

    if (controlsError) throw controlsError;

    const { data: implementations, error: implError } = await supabaseClient
      .from('compliance_implementations')
      .select('*')
      .eq('organization_id', organization_id);

    if (implError) throw implError;

    // Perform gap analysis
    const gaps = await performGapAnalysis(nistControls, implementations, analysis_type);
    
    // Generate AI recommendations
    const recommendations = await generateAIRecommendations(gaps, focus_areas);

    // Create implementation roadmap
    const roadmap = await createImplementationRoadmap(gaps, recommendations);

    // Update AI agent learning data
    await updateAgentLearning(supabaseClient, organization_id, gaps, recommendations);

    // Store analysis results
    const analysisResult = {
      analysis_id: crypto.randomUUID(),
      organization_id,
      analysis_type,
      generated_at: new Date().toISOString(),
      gaps_identified: gaps.length,
      critical_gaps: gaps.filter(g => g.priority === 'CRITICAL').length,
      high_priority_gaps: gaps.filter(g => g.priority === 'HIGH').length,
      automation_potential: Math.round(gaps.reduce((sum, g) => sum + g.automation_potential, 0) / gaps.length),
      total_effort_estimate: gaps.reduce((sum, g) => sum + g.estimated_effort_hours, 0),
      compliance_score: calculateComplianceScore(nistControls, implementations),
      recommendations: recommendations.slice(0, 10), // Top 10 recommendations
      roadmap: roadmap,
      gaps: gaps.slice(0, 50) // Limit for response size
    };

    console.log('AI compliance analysis completed:', {
      gaps_found: gaps.length,
      recommendations_generated: recommendations.length,
      compliance_score: analysisResult.compliance_score
    });

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in AI compliance analyzer:', error);
    return new Response(JSON.stringify({ 
      error: 'Analysis failed', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function performGapAnalysis(
  nistControls: any[], 
  implementations: any[], 
  analysisType: string
): Promise<ComplianceGap[]> {
  const gaps: ComplianceGap[] = [];
  const implMap = new Map(implementations.map(impl => [impl.control_id, impl]));

  for (const control of nistControls) {
    const implementation = implMap.get(control.control_id);
    
    let gapType: ComplianceGap['gap_type'] = 'not_implemented';
    let riskScore = 100;
    
    if (implementation) {
      switch (implementation.implementation_status) {
        case 'implemented':
          if (implementation.validation_status !== 'validated') {
            gapType = 'needs_improvement';
            riskScore = 30;
          } else {
            continue; // No gap
          }
          break;
        case 'in_progress':
          gapType = 'partially_implemented';
          riskScore = 60;
          break;
        default:
          gapType = 'not_implemented';
          riskScore = 100;
      }
    }

    // Calculate priority based on baseline requirements and risk
    let priority: ComplianceGap['priority'] = 'LOW';
    if (control.baseline_high || control.baseline_moderate) {
      priority = riskScore > 80 ? 'CRITICAL' : riskScore > 60 ? 'HIGH' : 'MEDIUM';
    } else if (control.baseline_low) {
      priority = riskScore > 80 ? 'HIGH' : 'MEDIUM';
    }

    // Estimate implementation complexity
    const complexity = estimateComplexity(control);
    const effortHours = estimateEffort(control, complexity);
    const automationPotential = control.automation_possible ? 
      Math.min(90, 50 + (control.family === 'AU' ? 30 : control.family === 'CM' ? 25 : 15)) : 10;

    const gap: ComplianceGap = {
      control_id: control.control_id,
      title: control.title,
      family: control.family,
      priority,
      gap_type: gapType,
      risk_score: riskScore,
      implementation_complexity: complexity,
      estimated_effort_hours: effortHours,
      automation_potential: automationPotential,
      ai_recommendation: generateControlRecommendation(control, gapType),
      required_resources: getRequiredResources(control),
      dependencies: control.related_controls || []
    };

    gaps.push(gap);
  }

  // Sort by priority and risk score
  return gaps.sort((a, b) => {
    const priorityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const aPriority = priorityOrder[a.priority];
    const bPriority = priorityOrder[b.priority];
    
    if (aPriority !== bPriority) return bPriority - aPriority;
    return b.risk_score - a.risk_score;
  });
}

async function generateAIRecommendations(
  gaps: ComplianceGap[], 
  focusAreas?: string[]
): Promise<AIRecommendation[]> {
  const recommendations: AIRecommendation[] = [];

  // Implementation recommendations for critical gaps
  const criticalGaps = gaps.filter(g => g.priority === 'CRITICAL').slice(0, 5);
  for (const gap of criticalGaps) {
    recommendations.push({
      category: 'implementation',
      title: `Urgent Implementation: ${gap.control_id}`,
      description: `Critical control "${gap.title}" requires immediate implementation to address high-risk security gaps.`,
      confidence_score: 0.95,
      implementation_steps: [
        'Conduct detailed control assessment',
        'Develop implementation plan',
        'Allocate required resources',
        'Execute implementation',
        'Validate and test controls'
      ],
      expected_benefit: 'Significant risk reduction and compliance improvement',
      risk_mitigation: `Reduces risk score by ${gap.risk_score} points`
    });
  }

  // Automation recommendations
  const automationCandidates = gaps
    .filter(g => g.automation_potential > 70)
    .slice(0, 5);
    
  for (const candidate of automationCandidates) {
    recommendations.push({
      category: 'automation',
      title: `Automate ${candidate.control_id} Implementation`,
      description: `High automation potential (${candidate.automation_potential}%) for efficient control implementation.`,
      confidence_score: candidate.automation_potential / 100,
      implementation_steps: [
        'Review automation requirements',
        'Develop automation scripts',
        'Test in staging environment',
        'Deploy to production',
        'Monitor and validate'
      ],
      expected_benefit: `Reduce manual effort by ${Math.round(candidate.estimated_effort_hours * 0.7)} hours`,
      risk_mitigation: 'Consistent and reliable control implementation'
    });
  }

  // Family-based recommendations
  const familyGaps = gaps.reduce((acc, gap) => {
    acc[gap.family] = (acc[gap.family] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topFamilies = Object.entries(familyGaps)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);

  for (const [family, count] of topFamilies) {
    recommendations.push({
      category: 'remediation',
      title: `${family} Control Family Remediation`,
      description: `${count} gaps identified in ${family} family. Coordinated remediation approach recommended.`,
      confidence_score: 0.85,
      implementation_steps: [
        `Audit all ${family} controls`,
        'Develop family-wide implementation strategy',
        'Implement controls in dependency order',
        'Cross-validate control interactions'
      ],
      expected_benefit: 'Systematic approach reduces implementation time and costs',
      risk_mitigation: 'Comprehensive coverage of control family requirements'
    });
  }

  return recommendations.slice(0, 15);
}

async function createImplementationRoadmap(
  gaps: ComplianceGap[], 
  recommendations: AIRecommendation[]
): Promise<any> {
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const roadmap = quarters.map(q => ({ quarter: q, items: [] }));

  // Distribute gaps across quarters based on priority and effort
  const sortedGaps = [...gaps].sort((a, b) => {
    const priorityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  let quarterIndex = 0;
  let quarterEffort = 0;
  const maxQuarterlyEffort = 500; // hours per quarter

  for (const gap of sortedGaps.slice(0, 40)) {
    if (quarterEffort + gap.estimated_effort_hours > maxQuarterlyEffort && quarterIndex < 3) {
      quarterIndex++;
      quarterEffort = 0;
    }

    roadmap[quarterIndex].items.push({
      control_id: gap.control_id,
      title: gap.title,
      priority: gap.priority,
      effort_hours: gap.estimated_effort_hours,
      automation_potential: gap.automation_potential
    });

    quarterEffort += gap.estimated_effort_hours;
  }

  return roadmap;
}

async function updateAgentLearning(
  supabaseClient: any,
  organizationId: string,
  gaps: ComplianceGap[],
  recommendations: AIRecommendation[]
): Promise<void> {
  // Update or create AI agents for each control family
  const families = [...new Set(gaps.map(g => g.family))];
  
  for (const family of families) {
    const familyGaps = gaps.filter(g => g.family === family);
    const avgAutomationPotential = familyGaps.reduce((sum, g) => sum + g.automation_potential, 0) / familyGaps.length;
    
    const learningData = {
      gaps_analyzed: familyGaps.length,
      avg_automation_potential: avgAutomationPotential,
      recommendations_count: recommendations.filter(r => r.title.includes(family)).length,
      last_analysis: new Date().toISOString()
    };

    await supabaseClient
      .from('ai_compliance_agents')
      .upsert({
        agent_name: `${family} Compliance Agent`,
        control_family: family,
        organization_id: organizationId,
        execution_status: 'complete',
        recommendations_generated: recommendations.length,
        confidence_score: 0.85,
        learning_data: learningData
      });
  }
}

function estimateComplexity(control: any): 'LOW' | 'MEDIUM' | 'HIGH' {
  const complexityFactors = [
    control.related_controls?.length > 3,
    control.family === 'SC' || control.family === 'SA',
    control.baseline_high,
    !control.automation_possible
  ];
  
  const complexityScore = complexityFactors.filter(f => f).length;
  
  if (complexityScore >= 3) return 'HIGH';
  if (complexityScore >= 2) return 'MEDIUM';
  return 'LOW';
}

function estimateEffort(control: any, complexity: string): number {
  const baseEffort = {
    LOW: 8,
    MEDIUM: 24,
    HIGH: 72
  };
  
  let effort = baseEffort[complexity];
  
  // Adjust based on control characteristics
  if (control.automation_possible) effort *= 0.7;
  if (control.baseline_high) effort *= 1.3;
  if (control.related_controls?.length > 5) effort *= 1.2;
  
  return Math.round(effort);
}

function generateControlRecommendation(control: any, gapType: string): string {
  const recommendations = {
    not_implemented: [
      `Establish ${control.title} controls as high priority`,
      `Implement automated monitoring for ${control.control_id}`,
      `Deploy policy-based controls for ${control.family} family`
    ],
    partially_implemented: [
      `Complete implementation of ${control.title}`,
      `Enhance existing ${control.control_id} controls`,
      `Validate current ${control.family} implementations`
    ],
    needs_improvement: [
      `Optimize ${control.title} effectiveness`,
      `Update ${control.control_id} validation procedures`,
      `Strengthen ${control.family} control monitoring`
    ]
  };
  
  const options = recommendations[gapType as keyof typeof recommendations];
  // Return first recommendation (deterministic) - full list available via gap analysis
  return options[0];
}

function getRequiredResources(control: any): string[] {
  const resources = ['Security Team'];
  
  if (control.family === 'AC' || control.family === 'IA') {
    resources.push('Identity Management Team', 'Authentication Systems');
  } else if (control.family === 'CM' || control.family === 'SA') {
    resources.push('DevOps Team', 'Configuration Management Tools');
  } else if (control.family === 'AU' || control.family === 'IR') {
    resources.push('SOC Team', 'SIEM Systems', 'Log Management Tools');
  } else if (control.family === 'SC') {
    resources.push('Network Security Team', 'Encryption Systems');
  }
  
  if (control.automation_possible) {
    resources.push('Automation Tools', 'Scripting Resources');
  }
  
  return resources;
}

function calculateComplianceScore(controls: any[], implementations: any[]): number {
  if (controls.length === 0) return 0;
  
  const implementedCount = implementations.filter(impl => 
    impl.implementation_status === 'implemented' && 
    impl.validation_status === 'validated'
  ).length;
  
  return Math.round((implementedCount / controls.length) * 100);
}