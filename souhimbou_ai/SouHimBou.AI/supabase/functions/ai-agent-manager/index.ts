import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AgentRequest {
  action: 'create' | 'update' | 'delete' | 'execute' | 'get_performance';
  agentId?: string;
  organizationId?: string;
  agentData?: any;
  actionData?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (error || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const { action, agentId, organizationId, agentData, actionData }: AgentRequest = await req.json();

    switch (action) {
      case 'create':
        return await createAgent(supabase, agentData);
      case 'update':
        return await updateAgent(supabase, agentId!, agentData);
      case 'execute':
        return await executeAgentAction(supabase, agentId!, actionData);
      case 'get_performance':
        return await getAgentPerformance(supabase, agentId!);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Agent manager error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function createAgent(supabase: any, agentData: any) {
  const { data, error } = await supabase
    .from('ai_agents')
    .insert({
      organization_id: agentData.organizationId,
      agent_name: agentData.name,
      agent_type: agentData.type,
      specialization: agentData.specialization,
      capabilities: agentData.capabilities || [],
      trust_level: 0, // Start with trainee level
      status: 'training',
      deployment_status: 'draft'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create agent: ${error.message}`);
  }

  // Initialize default permissions based on agent type
  await initializeAgentPermissions(supabase, data.id, agentData.type);

  return new Response(JSON.stringify({ agent: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function updateAgent(supabase: any, agentId: string, updateData: any) {
  // Log the update action
  await supabase
    .from('agent_actions')
    .insert({
      agent_id: agentId,
      organization_id: updateData.organizationId,
      action_type: 'agent_update',
      action_context: 'Agent configuration updated',
      action_data: updateData,
      success: true
    });

  const { data, error } = await supabase
    .from('ai_agents')
    .update(updateData)
    .eq('id', agentId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update agent: ${error.message}`);
  }

  return new Response(JSON.stringify({ agent: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function executeAgentAction(supabase: any, agentId: string, actionData: any) {
  const startTime = Date.now();
  
  try {
    // Get agent details
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('*, ai_agent_roles(*)')
      .eq('id', agentId)
      .single();

    if (!agent) {
      throw new Error('Agent not found');
    }

    // Check if agent has permission for this action
    const hasPermission = await checkAgentPermission(supabase, agentId, actionData.type);
    if (!hasPermission) {
      throw new Error('Agent lacks permission for this action');
    }

    // Execute the action (this would integrate with actual tools/APIs)
    const result = await performAgentAction(actionData);

    // Log successful action
    await supabase
      .from('agent_actions')
      .insert({
        agent_id: agentId,
        organization_id: agent.organization_id,
        action_type: actionData.type,
        action_context: actionData.context || 'Agent action executed',
        action_data: actionData,
        success: true,
        execution_time_ms: Date.now() - startTime,
        risk_score: calculateRiskScore(actionData)
      });

    // Update agent performance metrics
    await updateAgentPerformance(supabase, agentId, true);

    return new Response(JSON.stringify({ result, success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // Log failed action
    await supabase
      .from('agent_actions')
      .insert({
        agent_id: agentId,
        organization_id: actionData.organizationId,
        action_type: actionData.type,
        action_context: actionData.context || 'Agent action failed',
        action_data: actionData,
        success: false,
        error_message: error.message,
        execution_time_ms: Date.now() - startTime
      });

    throw error;
  }
}

async function getAgentPerformance(supabase: any, agentId: string) {
  const { data: metrics } = await supabase
    .from('agent_performance')
    .select('*')
    .eq('agent_id', agentId)
    .order('recorded_at', { ascending: false })
    .limit(10);

  const { data: actions } = await supabase
    .from('agent_actions')
    .select('success, created_at, action_type')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(100);

  // Calculate performance stats
  const successRate = actions.length > 0 ? 
    (actions.filter(a => a.success).length / actions.length) * 100 : 0;
  
  const actionsLast24h = actions.filter(a => 
    new Date(a.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  ).length;

  return new Response(JSON.stringify({
    metrics,
    successRate,
    actionsLast24h,
    totalActions: actions.length
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function initializeAgentPermissions(supabase: any, agentId: string, agentType: string) {
  const defaultPermissions = getDefaultPermissions(agentType);
  
  for (const permission of defaultPermissions) {
    await supabase
      .from('agent_permissions')
      .insert({
        agent_id: agentId,
        resource_type: permission.resource_type,
        resource_identifier: permission.resource_identifier,
        permission_level: permission.level
      });
  }
}

function getDefaultPermissions(agentType: string) {
  const basePermissions = [
    { resource_type: 'system', resource_identifier: 'logs', level: 'read' },
    { resource_type: 'system', resource_identifier: 'metrics', level: 'read' }
  ];

  switch (agentType) {
    case 'finance':
      return [
        ...basePermissions,
        { resource_type: 'database', resource_identifier: 'billing_periods', level: 'read' },
        { resource_type: 'database', resource_identifier: 'resource_usage', level: 'read' },
        { resource_type: 'api', resource_identifier: 'finance_apis', level: 'read' }
      ];
    case 'security':
      return [
        ...basePermissions,
        { resource_type: 'database', resource_identifier: 'security_events', level: 'read' },
        { resource_type: 'database', resource_identifier: 'alerts', level: 'write' },
        { resource_type: 'api', resource_identifier: 'security_tools', level: 'execute' }
      ];
    case 'hr':
      return [
        ...basePermissions,
        { resource_type: 'database', resource_identifier: 'profiles', level: 'read' },
        { resource_type: 'api', resource_identifier: 'hr_systems', level: 'read' }
      ];
    case 'operations':
      return [
        ...basePermissions,
        { resource_type: 'database', resource_identifier: 'infrastructure_assets', level: 'read' },
        { resource_type: 'api', resource_identifier: 'deployment_tools', level: 'execute' }
      ];
    default:
      return basePermissions;
  }
}

async function checkAgentPermission(supabase: any, agentId: string, actionType: string): Promise<boolean> {
  const { data: permissions } = await supabase
    .from('agent_permissions')
    .select('*')
    .eq('agent_id', agentId);

  // Simple permission check - in production this would be more sophisticated
  return permissions && permissions.length > 0;
}

async function performAgentAction(actionData: any): Promise<any> {
  // This is where the agent would actually perform the requested action
  // For now, return a simulated result
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 900));
  
  return {
    action: actionData.type,
    result: 'Action completed successfully',
    timestamp: new Date().toISOString(),
    data: actionData
  };
}

function calculateRiskScore(actionData: any): number {
  // Simple risk calculation - in production this would be more sophisticated
  const riskFactors = {
    'database_write': 7,
    'api_call': 3,
    'system_command': 9,
    'file_access': 5,
    'user_interaction': 2
  };

  return riskFactors[actionData.type] || 1;
}

async function updateAgentPerformance(supabase: any, agentId: string, success: boolean) {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  await supabase
    .from('agent_performance')
    .insert({
      agent_id: agentId,
      metric_type: 'action_success_rate',
      metric_value: success ? 1 : 0,
      measurement_period_start: startOfDay.toISOString(),
      measurement_period_end: endOfDay.toISOString(),
      metadata: { action_timestamp: new Date().toISOString() }
    });
}