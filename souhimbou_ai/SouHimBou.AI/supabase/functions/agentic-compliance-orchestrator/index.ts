import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrchestrationRequest {
  action: 'start_orchestration' | 'pause_orchestration' | 'get_status';
  organization_id: string;
  target_controls?: string[];
  priority_level?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface AgentTask {
  agent_name: string;
  control_family: string;
  task_type: 'assessment' | 'implementation' | 'validation' | 'monitoring';
  target_controls: string[];
  priority: number;
  estimated_duration: number;
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

    const { action, organization_id, target_controls, priority_level }: OrchestrationRequest = await req.json();

    console.log('Agentic orchestration request:', { action, organization_id, priority_level });

    switch (action) {
      case 'start_orchestration':
        return await startOrchestration(supabaseClient, organization_id, target_controls, priority_level);
      case 'pause_orchestration':
        return await pauseOrchestration(supabaseClient, organization_id);
      case 'get_status':
        return await getOrchestrationStatus(supabaseClient, organization_id);
      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Error in agentic orchestrator:', error);
    return new Response(JSON.stringify({ 
      error: 'Orchestration failed', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function startOrchestration(
  supabaseClient: any,
  organizationId: string,
  targetControls?: string[],
  priorityLevel?: string
) {
  console.log('Starting agentic compliance orchestration');

  // Get current compliance state
  const { data: implementations, error: implError } = await supabaseClient
    .from('compliance_implementations')
    .select('*')
    .eq('organization_id', organizationId);

  if (implError) throw implError;

  // Get NIST controls that need attention
  let controlsQuery = supabaseClient.from('nist_controls').select('*');
  
  if (targetControls && targetControls.length > 0) {
    controlsQuery = controlsQuery.in('control_id', targetControls);
  }

  const { data: controls, error: controlsError } = await controlsQuery;
  if (controlsError) throw controlsError;

  // Create agent tasks
  const agentTasks = await createAgentTasks(controls, implementations, priorityLevel);

  // Initialize or update AI agents
  const agentResults = [];
  for (const task of agentTasks) {
    const result = await initializeAgent(supabaseClient, organizationId, task);
    agentResults.push(result);
  }

  // Start execution of high-priority tasks
  const executionResults = await executeAgentTasks(supabaseClient, organizationId, agentTasks);

  return new Response(JSON.stringify({
    status: 'orchestration_started',
    agents_initialized: agentResults.length,
    tasks_created: agentTasks.length,
    high_priority_tasks: agentTasks.filter(t => t.priority > 80).length,
    estimated_completion: calculateEstimatedCompletion(agentTasks),
    execution_summary: executionResults
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function pauseOrchestration(supabaseClient: any, organizationId: string) {
  console.log('Pausing agentic compliance orchestration');

  // Update all running agents to paused state
  const { data, error } = await supabaseClient
    .from('ai_compliance_agents')
    .update({ execution_status: 'idle' })
    .eq('organization_id', organizationId)
    .eq('execution_status', 'running');

  if (error) throw error;

  return new Response(JSON.stringify({
    status: 'orchestration_paused',
    agents_paused: data?.length || 0
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getOrchestrationStatus(supabaseClient: any, organizationId: string) {
  console.log('Getting orchestration status');

  const { data: agents, error: agentsError } = await supabaseClient
    .from('ai_compliance_agents')
    .select('*')
    .eq('organization_id', organizationId);

  if (agentsError) throw agentsError;

  const { data: implementations, error: implError } = await supabaseClient
    .from('compliance_implementations')
    .select('*')
    .eq('organization_id', organizationId);

  if (implError) throw implError;

  const status = {
    total_agents: agents?.length || 0,
    active_agents: agents?.filter(a => a.execution_status === 'running').length || 0,
    total_tasks: implementations?.length || 0,
    completed_tasks: implementations?.filter(i => i.implementation_status === 'implemented').length || 0,
    in_progress_tasks: implementations?.filter(i => i.implementation_status === 'in_progress').length || 0,
    overall_progress: calculateOverallProgress(implementations),
    agent_details: agents?.map(agent => ({
      name: agent.agent_name,
      family: agent.control_family,
      status: agent.execution_status,
      recommendations: agent.recommendations_generated,
      automations: agent.automations_executed,
      confidence: agent.confidence_score
    })) || []
  };

  return new Response(JSON.stringify(status), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function createAgentTasks(
  controls: any[],
  implementations: any[],
  priorityLevel?: string
): Promise<AgentTask[]> {
  const tasks: AgentTask[] = [];
  const implMap = new Map(implementations.map(impl => [impl.control_id, impl]));

  // Group controls by family
  const familyGroups = controls.reduce((acc, control) => {
    if (!acc[control.family]) acc[control.family] = [];
    acc[control.family].push(control);
    return acc;
  }, {} as Record<string, any[]>);

  // Create tasks for each control family
  for (const [family, familyControls] of Object.entries(familyGroups)) {
    // Assessment tasks for unimplemented controls
    const unimplemented = familyControls.filter(c => !implMap.has(c.control_id));
    if (unimplemented.length > 0) {
      tasks.push({
        agent_name: `${family} Assessment Agent`,
        control_family: family,
        task_type: 'assessment',
        target_controls: unimplemented.map(c => c.control_id),
        priority: calculateTaskPriority(unimplemented, 'assessment', priorityLevel),
        estimated_duration: unimplemented.length * 30 // 30 minutes per control
      });
    }

    // Implementation tasks for planned controls
    const planned = familyControls.filter(c => {
      const impl = implMap.get(c.control_id);
      return impl && impl.implementation_status === 'planned';
    });
    if (planned.length > 0) {
      tasks.push({
        agent_name: `${family} Implementation Agent`,
        control_family: family,
        task_type: 'implementation',
        target_controls: planned.map(c => c.control_id),
        priority: calculateTaskPriority(planned, 'implementation', priorityLevel),
        estimated_duration: planned.length * 120 // 2 hours per control
      });
    }

    // Validation tasks for implemented controls
    const needsValidation = familyControls.filter(c => {
      const impl = implMap.get(c.control_id);
      return impl && impl.implementation_status === 'implemented' && impl.validation_status !== 'validated';
    });
    if (needsValidation.length > 0) {
      tasks.push({
        agent_name: `${family} Validation Agent`,
        control_family: family,
        task_type: 'validation',
        target_controls: needsValidation.map(c => c.control_id),
        priority: calculateTaskPriority(needsValidation, 'validation', priorityLevel),
        estimated_duration: needsValidation.length * 60 // 1 hour per control
      });
    }

    // Monitoring tasks for validated controls
    const validated = familyControls.filter(c => {
      const impl = implMap.get(c.control_id);
      return impl && impl.validation_status === 'validated';
    });
    if (validated.length > 0) {
      tasks.push({
        agent_name: `${family} Monitoring Agent`,
        control_family: family,
        task_type: 'monitoring',
        target_controls: validated.map(c => c.control_id),
        priority: calculateTaskPriority(validated, 'monitoring', priorityLevel),
        estimated_duration: validated.length * 15 // 15 minutes per control
      });
    }
  }

  return tasks.sort((a, b) => b.priority - a.priority);
}

async function initializeAgent(
  supabaseClient: any,
  organizationId: string,
  task: AgentTask
) {
  const agentData = {
    agent_name: task.agent_name,
    control_family: task.control_family,
    organization_id: organizationId,
    execution_status: 'running',
    last_execution: new Date().toISOString(),
    confidence_score: calculateInitialConfidence(task),
    learning_data: {
      task_type: task.task_type,
      target_controls: task.target_controls,
      priority: task.priority,
      estimated_duration: task.estimated_duration,
      created_at: new Date().toISOString()
    }
  };

  const { data, error } = await supabaseClient
    .from('ai_compliance_agents')
    .upsert(agentData);

  if (error) {
    console.error('Error initializing agent:', error);
    throw error;
  }

  return { agent_name: task.agent_name, status: 'initialized', controls: task.target_controls.length };
}

async function executeAgentTasks(
  supabaseClient: any,
  organizationId: string,
  tasks: AgentTask[]
) {
  const executionResults = [];

  // Execute high-priority tasks immediately
  const highPriorityTasks = tasks.filter(t => t.priority > 80);
  
  for (const task of highPriorityTasks.slice(0, 5)) { // Limit concurrent executions
    try {
      const result = await executeTask(supabaseClient, organizationId, task);
      executionResults.push(result);
    } catch (error) {
      console.error(`Error executing task for ${task.agent_name}:`, error);
      executionResults.push({
        agent_name: task.agent_name,
        status: 'failed',
        error: error.message
      });
    }
  }

  return executionResults;
}

async function executeTask(supabaseClient: any, organizationId: string, task: AgentTask) {
  console.log(`Executing ${task.task_type} task for ${task.agent_name}`);

  const results = {
    agent_name: task.agent_name,
    task_type: task.task_type,
    controls_processed: 0,
    recommendations_generated: 0,
    automations_executed: 0,
    status: 'in_progress'
  };

  // Process each target control
  for (const controlId of task.target_controls.slice(0, 10)) { // Limit processing
    try {
      await processControl(supabaseClient, organizationId, controlId, task.task_type);
      results.controls_processed++;

      // Generate AI recommendations based on task type
      if (task.task_type === 'assessment' || task.task_type === 'implementation') {
        const recommendation = await generateControlRecommendation(supabaseClient, controlId, task.task_type);
        if (recommendation) {
          results.recommendations_generated++;
        }
      }

      // Simulate automation execution for automatable controls
      const { data: control } = await supabaseClient
        .from('nist_controls')
        .select('automation_possible')
        .eq('control_id', controlId)
        .single();

      if (control?.automation_possible && task.task_type === 'implementation') {
        results.automations_executed++;
      }

    } catch (error) {
      console.error(`Error processing control ${controlId}:`, error);
    }
  }

  results.status = 'completed';

  // Update agent statistics
  await supabaseClient
    .from('ai_compliance_agents')
    .update({
      recommendations_generated: results.recommendations_generated,
      automations_executed: results.automations_executed,
      execution_status: 'complete'
    })
    .eq('agent_name', task.agent_name)
    .eq('organization_id', organizationId);

  return results;
}

async function processControl(
  supabaseClient: any,
  organizationId: string,
  controlId: string,
  taskType: string
) {
  const now = new Date().toISOString();
  
  // Check if implementation record exists
  const { data: existing } = await supabaseClient
    .from('compliance_implementations')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('control_id', controlId)
    .single();

  if (existing) {
    // Update existing record based on task type
    let updateData: any = { updated_at: now };
    
    switch (taskType) {
      case 'assessment':
        updateData.ai_recommendations = { 
          assessment_completed: true, 
          assessed_at: now,
          next_action: 'implementation'
        };
        break;
      case 'implementation':
        if (existing.implementation_status === 'planned') {
          updateData.implementation_status = 'in_progress';
          updateData.implementation_date = now;
        }
        break;
      case 'validation':
        if (existing.implementation_status === 'implemented') {
          updateData.validation_status = 'validated';
          updateData.validation_date = now;
        }
        break;
      case 'monitoring':
        updateData.next_review_date = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 90 days
        break;
    }

    await supabaseClient
      .from('compliance_implementations')
      .update(updateData)
      .eq('id', existing.id);
  } else {
    // Create new implementation record
    await supabaseClient
      .from('compliance_implementations')
      .insert({
        organization_id: organizationId,
        control_id: controlId,
        implementation_status: 'planned',
        ai_recommendations: { 
          initial_assessment: true, 
          assessed_at: now 
        },
        priority_score: 70
      });
  }
}

async function generateControlRecommendation(
  supabaseClient: any,
  controlId: string,
  taskType: string
) {
  // Get control details
  const { data: control } = await supabaseClient
    .from('nist_controls')
    .select('*')
    .eq('control_id', controlId)
    .single();

  if (!control) return null;

  const recommendations = {
    assessment: [
      `Review current ${control.title} implementation`,
      `Identify gaps in ${controlId} controls`,
      `Assess ${control.family} family dependencies`
    ],
    implementation: [
      `Deploy automated ${control.title} controls`,
      `Configure ${controlId} monitoring`,
      `Implement ${control.family} best practices`
    ]
  };

  return recommendations[taskType as keyof typeof recommendations]?.[0] || null;
}

function calculateTaskPriority(
  controls: any[],
  taskType: string,
  priorityLevel?: string
): number {
  let basePriority = 50;

  // Adjust for task type
  const taskPriorities = {
    assessment: 90,
    implementation: 85,
    validation: 70,
    monitoring: 40
  };
  basePriority = taskPriorities[taskType as keyof typeof taskPriorities] || 50;

  // Adjust for control characteristics
  const hasHighBaseline = controls.some(c => c.baseline_high);
  const hasModerateBaseline = controls.some(c => c.baseline_moderate);
  const hasAutomation = controls.some(c => c.automation_possible);

  if (hasHighBaseline) basePriority += 20;
  else if (hasModerateBaseline) basePriority += 10;
  
  if (hasAutomation) basePriority += 15;

  // Adjust for priority level filter
  if (priorityLevel === 'CRITICAL') basePriority = Math.max(basePriority, 95);
  else if (priorityLevel === 'HIGH') basePriority = Math.max(basePriority, 80);

  return Math.min(basePriority, 100);
}

function calculateInitialConfidence(task: AgentTask): number {
  let confidence = 0.75; // Base confidence

  // Higher confidence for simpler tasks
  if (task.task_type === 'monitoring') confidence += 0.15;
  else if (task.task_type === 'assessment') confidence += 0.10;

  // Lower confidence for complex implementations
  if (task.target_controls.length > 10) confidence -= 0.10;
  if (task.estimated_duration > 600) confidence -= 0.05; // Over 10 hours

  return Math.max(0.5, Math.min(0.95, confidence));
}

function calculateEstimatedCompletion(tasks: AgentTask[]): string {
  const totalMinutes = tasks.reduce((sum, task) => sum + task.estimated_duration, 0);
  const completionDate = new Date(Date.now() + totalMinutes * 60 * 1000);
  return completionDate.toISOString();
}

function calculateOverallProgress(implementations: any[]): number {
  if (!implementations || implementations.length === 0) return 0;
  
  const completed = implementations.filter(i => 
    i.implementation_status === 'implemented' && i.validation_status === 'validated'
  ).length;
  
  return Math.round((completed / implementations.length) * 100);
}