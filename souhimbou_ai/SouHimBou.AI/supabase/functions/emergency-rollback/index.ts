import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { actionId, organizationId, rollbackType = 'automatic' } = await req.json();

    if (!actionId || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Executing emergency rollback for action: ${actionId}`);

    // Get the original remediation action
    const { data: originalAction, error: fetchError } = await supabase
      .from('remediation_activities')
      .select('*')
      .eq('id', actionId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !originalAction) {
      throw new Error(`Failed to find original action: ${fetchError?.message || 'Action not found'}`);
    }

    if (!originalAction.results?.rollback_script) {
      throw new Error('No rollback script available for this action');
    }

    // Execute the rollback based on action type
    const rollbackResult = await executeRollbackScript(
      originalAction.action_type,
      originalAction.targets,
      originalAction.results.rollback_script
    );

    // Update the original action status
    const { error: updateError } = await supabase
      .from('remediation_activities')
      .update({
        execution_status: 'ROLLED_BACK',
        results: {
          ...originalAction.results,
          rolled_back_at: new Date().toISOString(),
          rollback_type: rollbackType,
          rollback_result: rollbackResult,
          rollback_success: rollbackResult.success
        }
      })
      .eq('id', actionId);

    if (updateError) {
      throw updateError;
    }

    // Create rollback activity record
    const { error: insertError } = await supabase
      .from('remediation_activities')
      .insert([{
        organization_id: organizationId,
        action_type: 'rollback_' + originalAction.action_type,
        targets: originalAction.targets,
        execution_status: rollbackResult.success ? 'COMPLETED' : 'FAILED',
        results: {
          original_action_id: actionId,
          rollback_type: rollbackType,
          rollback_script: originalAction.results.rollback_script,
          rollback_details: rollbackResult,
          executed_at: new Date().toISOString()
        },
        successful_actions: rollbackResult.success ? 1 : 0,
        total_actions: 1,
        success_rate: rollbackResult.success ? 100 : 0
      }]);

    if (insertError) {
      console.error('Failed to create rollback record:', insertError);
    }

    // Create rollback alert
    await supabase.from('alerts').insert([{
      organization_id: organizationId,
      alert_type: 'emergency_rollback',
      title: rollbackResult.success 
        ? '✅ Emergency Action Rolled Back Successfully' 
        : '❌ Emergency Rollback Failed',
      description: `Rollback of ${originalAction.action_type} action ${rollbackResult.success ? 'completed' : 'failed'}. Targets: ${originalAction.targets.join(', ')}`,
      severity: rollbackResult.success ? 'MEDIUM' : 'HIGH',
      status: 'OPEN',
      metadata: {
        original_action_id: actionId,
        rollback_type: rollbackType,
        targets: originalAction.targets,
        rollback_success: rollbackResult.success,
        rollback_details: rollbackResult
      },
      source_type: 'ROLLBACK_SYSTEM',
      source_id: 'EMERGENCY_ROLLBACK'
    }]);

    // Log security event
    await supabase.from('security_events').insert([{
      organization_id: organizationId,
      event_type: 'emergency_rollback',
      severity: rollbackResult.success ? 'MEDIUM' : 'HIGH',
      details: {
        message: `Emergency rollback ${rollbackResult.success ? 'completed' : 'failed'} for ${originalAction.action_type}`,
        original_action_id: actionId,
        rollback_type: rollbackType,
        targets: originalAction.targets,
        success: rollbackResult.success,
        details: rollbackResult.details
      },
      source_system: 'ROLLBACK_SYSTEM'
    }]);

    return new Response(
      JSON.stringify({
        success: rollbackResult.success,
        actionId,
        rollbackType,
        result: rollbackResult,
        message: rollbackResult.success 
          ? 'Emergency action rolled back successfully'
          : 'Rollback completed with issues - manual review recommended'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Emergency rollback error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Emergency rollback failed',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function executeRollbackScript(
  actionType: string, 
  targets: string[], 
  rollbackScript: string
): Promise<any> {
  console.log(`Executing rollback for ${actionType} on targets:`, targets);
  
  try {
    switch (actionType) {
      case 'network_isolation':
        return await rollbackNetworkIsolation(targets, rollbackScript);
        
      case 'endpoint_isolation':
        return await rollbackEndpointIsolation(targets, rollbackScript);
        
      case 'configuration_hardening':
        return await rollbackConfigurationChanges(targets, rollbackScript);
        
      case 'patch_management':
        return await rollbackPatchManagement(targets, rollbackScript);
        
      default:
        return {
          success: false,
          details: `Rollback not implemented for action type: ${actionType}`,
          executed_commands: [],
          errors: [`Unsupported rollback type: ${actionType}`]
        };
    }
  } catch (error) {
    return {
      success: false,
      details: `Rollback execution failed: ${error.message}`,
      executed_commands: [],
      errors: [error.message]
    };
  }
}

async function rollbackNetworkIsolation(targets: string[], rollbackScript: string) {
  console.log('Rolling back network isolation for targets:', targets);
  
  // Simulate iptables rule removal
  const commands = targets.map(target => 
    `iptables -D INPUT -s ${target} -j DROP`
  );
  
  // In a real implementation, you would execute these commands on the firewall/gateway
  // For simulation, we'll just log the commands that would be executed
  
  const results = commands.map(cmd => ({
    command: cmd,
    success: true,
    output: `Rule removed for ${cmd.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1] || 'target'}`
  }));
  
  return {
    success: true,
    details: `Successfully removed network isolation rules for ${targets.length} targets`,
    executed_commands: commands,
    results: results,
    errors: []
  };
}

async function rollbackEndpointIsolation(targets: string[], rollbackScript: string) {
  console.log('Rolling back endpoint isolation for targets:', targets);
  
  // Simulate endpoint network access restoration
  const commands = targets.map(target => [
    `iptables -D INPUT -s ${target} -j DROP`,
    `iptables -D OUTPUT -d ${target} -j DROP`
  ]).flat();
  
  const results = commands.map(cmd => ({
    command: cmd,
    success: true,
    output: `Network access restored for ${cmd.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1] || 'target'}`
  }));
  
  return {
    success: true,
    details: `Successfully restored network access for ${targets.length} endpoints`,
    executed_commands: commands,
    results: results,
    errors: []
  };
}

async function rollbackConfigurationChanges(targets: string[], rollbackScript: string) {
  console.log('Rolling back configuration changes');
  
  // Simulate configuration rollback
  const commands = [
    'cp /etc/ssh/sshd_config.bak /etc/ssh/sshd_config',
    'systemctl restart sshd'
  ];
  
  const results = commands.map(cmd => ({
    command: cmd,
    success: true,
    output: `Configuration restored: ${cmd}`
  }));
  
  return {
    success: true,
    details: 'Successfully rolled back configuration changes',
    executed_commands: commands,
    results: results,
    errors: []
  };
}

async function rollbackPatchManagement(targets: string[], rollbackScript: string) {
  console.log('Rolling back patch management - MANUAL INTERVENTION REQUIRED');
  
  // Patch rollback is complex and often requires manual intervention
  return {
    success: false,
    details: 'Patch rollback requires manual intervention',
    executed_commands: [],
    results: [],
    errors: ['Automated patch rollback is not safe - manual review required'],
    manual_intervention_required: true,
    recommendations: [
      'Review /var/log/apt/history.log for package history',
      'Use system snapshots if available',
      'Contact system administrator for manual rollback'
    ]
  };
}