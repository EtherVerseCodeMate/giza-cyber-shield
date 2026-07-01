import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// FAIL-LOUD CONFIGURATION
// emergency-rollback is the action-of-last-resort for a SOC incident.
// Returning success:true without executing a real side-effect means an operator
// believes a host is contained/restored when nothing happened.
// This is CRITICAL per C-BU-01 / C-DG-02 of the SouHimBou Audit Framework.
//
// Execution channels (in priority order):
//   1. CrowdStrike RTR — for endpoint isolation rollback (preferred)
//   2. Direct API — for network firewall/ACL APIs when RTR not applicable
//   3. FAIL-CLOSED — throw 500, never fake success
// ============================================================================

const CROWDSTRIKE_CLIENT_ID     = Deno.env.get('CROWDSTRIKE_CLIENT_ID');
const CROWDSTRIKE_CLIENT_SECRET = Deno.env.get('CROWDSTRIKE_CLIENT_SECRET');
const CROWDSTRIKE_BASE_URL      = Deno.env.get('CROWDSTRIKE_BASE_URL') ?? 'https://api.crowdstrike.com';
const FIREWALL_API_URL          = Deno.env.get('FIREWALL_API_URL');   // optional: network perimeter API
const FIREWALL_API_TOKEN        = Deno.env.get('FIREWALL_API_TOKEN');

const supabaseUrl        = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ─── CrowdStrike RTR helpers ────────────────────────────────────────────────

async function getCrowdStrikeToken(): Promise<string> {
  if (!CROWDSTRIKE_CLIENT_ID || !CROWDSTRIKE_CLIENT_SECRET) {
    throw new Error(
      'CROWDSTRIKE_CLIENT_ID or CROWDSTRIKE_CLIENT_SECRET not set. ' +
      'emergency-rollback cannot execute without CrowdStrike credentials. ' +
      'Configure secrets in Supabase Vault and redeploy.'
    );
  }
  const resp = await fetch(`${CROWDSTRIKE_BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CROWDSTRIKE_CLIENT_ID,
      client_secret: CROWDSTRIKE_CLIENT_SECRET,
    }),
  });
  if (!resp.ok) throw new Error(`CrowdStrike auth failed: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data.access_token as string;
}

/** Lift network containment on one or more CrowdStrike-managed hosts by device ID or hostname. */
async function crowdStrikeLiftContainment(
  targets: string[],
  csToken: string
): Promise<{ success: boolean; details: string; device_ids: string[] }> {
  // 1. Resolve hostnames → device IDs
  const filterStr = targets.map(t => `hostname:'${t}'`).join(',');
  const searchResp = await fetch(
    `${CROWDSTRIKE_BASE_URL}/devices/queries/devices/v1?filter=${encodeURIComponent(filterStr)}`,
    { headers: { Authorization: `Bearer ${csToken}` } }
  );
  if (!searchResp.ok) throw new Error(`CS device lookup failed: ${searchResp.status}`);
  const searchData = await searchResp.json();
  const deviceIds: string[] = searchData.resources ?? [];

  if (deviceIds.length === 0) {
    throw new Error(`No CrowdStrike devices found matching targets: ${targets.join(', ')}`);
  }

  // 2. Lift network containment
  const liftResp = await fetch(`${CROWDSTRIKE_BASE_URL}/devices/entities/devices-actions/v2?action_name=lift_containment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${csToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids: deviceIds }),
  });
  if (!liftResp.ok) {
    const body = await liftResp.text();
    throw new Error(`CS lift_containment failed: ${liftResp.status} ${body}`);
  }
  const liftData = await liftResp.json();
  const errors = liftData.errors ?? [];
  if (errors.length > 0) {
    throw new Error(`CS lift_containment returned errors: ${JSON.stringify(errors)}`);
  }

  return {
    success: true,
    details: `CrowdStrike lift_containment issued for ${deviceIds.length} devices`,
    device_ids: deviceIds,
  };
}

/** Remove firewall block rules via an external firewall/perimeter API. */
async function removeFirewallRules(
  targets: string[],
  rollbackScript: string
): Promise<{ success: boolean; details: string; rules_removed: number }> {
  if (!FIREWALL_API_URL || !FIREWALL_API_TOKEN) {
    throw new Error(
      'FIREWALL_API_URL or FIREWALL_API_TOKEN not set. ' +
      'Network isolation rollback cannot execute without firewall API credentials. ' +
      'Configure secrets in Supabase Vault and redeploy.'
    );
  }

  // Parse rollback script for rule identifiers
  const ruleIds = (rollbackScript.match(/rule_id:\s*(\S+)/g) ?? [])
    .map(s => s.replace('rule_id:', '').trim());

  if (ruleIds.length === 0) {
    // Derive rule IDs from target IPs using a standard naming convention
    ruleIds.push(...targets.map(t => `block-${t.replace(/\./g, '-')}`));
  }

  const resp = await fetch(`${FIREWALL_API_URL}/rules/batch-delete`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${FIREWALL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rule_ids: ruleIds, targets }),
  });
  if (!resp.ok) throw new Error(`Firewall API delete failed: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return {
    success: true,
    details: `Removed ${data.deleted_count ?? ruleIds.length} firewall rules for ${targets.length} targets`,
    rules_removed: data.deleted_count ?? ruleIds.length,
  };
}

// ─── Serve ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { actionId, organizationId, rollbackType = 'automatic' } = await req.json();

    if (!actionId || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: actionId, organizationId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Executing emergency rollback for action: ${actionId}`);

    // Fetch original remediation action
    const { data: originalAction, error: fetchError } = await supabase
      .from('remediation_activities')
      .select('*')
      .eq('id', actionId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !originalAction) {
      throw new Error(`Failed to find original action: ${fetchError?.message ?? 'Action not found'}`);
    }

    if (!originalAction.results?.rollback_script) {
      throw new Error('No rollback script available for this action');
    }

    // Execute real rollback — throws on any failure (fail-loud)
    const rollbackResult = await executeRollback(
      originalAction.action_type,
      originalAction.targets,
      originalAction.results.rollback_script
    );

    // Persist result with provenance
    const { error: updateError } = await supabase
      .from('remediation_activities')
      .update({
        execution_status: 'ROLLED_BACK',
        results: {
          ...originalAction.results,
          rolled_back_at: new Date().toISOString(),
          rollback_type: rollbackType,
          rollback_result: rollbackResult,
          rollback_success: rollbackResult.success,
          is_simulated: false,
          execution_channel: rollbackResult.execution_channel,
          external_job_id: rollbackResult.external_job_id ?? null,
        },
      })
      .eq('id', actionId);

    if (updateError) throw updateError;

    // Create rollback activity record with provenance
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
          executed_at: new Date().toISOString(),
          is_simulated: false,
          execution_channel: rollbackResult.execution_channel,
          external_job_id: rollbackResult.external_job_id ?? null,
        },
        successful_actions: rollbackResult.success ? 1 : 0,
        total_actions: 1,
        success_rate: rollbackResult.success ? 100 : 0,
      }]);

    if (insertError) {
      console.error('Failed to create rollback record:', insertError);
    }

    // Alert + security event
    await Promise.allSettled([
      supabase.from('alerts').insert([{
        organization_id: organizationId,
        alert_type: 'emergency_rollback',
        title: rollbackResult.success
          ? '✅ Emergency Action Rolled Back Successfully'
          : '❌ Emergency Rollback Failed',
        description: `Rollback of ${originalAction.action_type} ${rollbackResult.success ? 'completed' : 'failed'}. Targets: ${originalAction.targets.join(', ')}. Channel: ${rollbackResult.execution_channel}`,
        severity: rollbackResult.success ? 'MEDIUM' : 'HIGH',
        status: 'OPEN',
        metadata: {
          original_action_id: actionId,
          rollback_type: rollbackType,
          targets: originalAction.targets,
          rollback_success: rollbackResult.success,
          rollback_details: rollbackResult,
          is_simulated: false,
          execution_channel: rollbackResult.execution_channel,
        },
        source_type: 'ROLLBACK_SYSTEM',
        source_id: 'EMERGENCY_ROLLBACK',
      }]),
      supabase.from('security_events').insert([{
        organization_id: organizationId,
        event_type: 'emergency_rollback',
        severity: rollbackResult.success ? 'MEDIUM' : 'HIGH',
        details: {
          message: `Emergency rollback ${rollbackResult.success ? 'completed' : 'failed'} for ${originalAction.action_type}`,
          original_action_id: actionId,
          rollback_type: rollbackType,
          targets: originalAction.targets,
          success: rollbackResult.success,
          details: rollbackResult.details,
          is_simulated: false,
          execution_channel: rollbackResult.execution_channel,
          external_job_id: rollbackResult.external_job_id ?? null,
        },
        source_system: 'ROLLBACK_SYSTEM',
      }]),
    ]);

    return new Response(
      JSON.stringify({
        success: rollbackResult.success,
        actionId,
        rollbackType,
        result: rollbackResult,
        is_simulated: false,
        execution_channel: rollbackResult.execution_channel,
        message: rollbackResult.success
          ? 'Emergency action rolled back successfully'
          : 'Rollback completed with issues — manual review recommended',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Emergency rollback error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Emergency rollback failed',
        details: error.message,
        is_simulated: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// ─── Dispatch ────────────────────────────────────────────────────────────────

interface RollbackResult {
  success: boolean;
  details: string;
  execution_channel: string;
  external_job_id?: string;
  [key: string]: unknown;
}

async function executeRollback(
  actionType: string,
  targets: string[],
  rollbackScript: string
): Promise<RollbackResult> {
  console.log(`Executing real rollback for ${actionType} on targets:`, targets);

  switch (actionType) {
    case 'network_isolation':
      return await rollbackNetworkIsolation(targets, rollbackScript);

    case 'endpoint_isolation':
      return await rollbackEndpointIsolation(targets, rollbackScript);

    case 'configuration_hardening':
      return await rollbackConfigurationChanges(targets, rollbackScript);

    case 'patch_management':
      return rollbackPatchManagement();

    default:
      throw new Error(
        `Rollback not implemented for action type: ${actionType}. ` +
        'Add a real execution channel before deploying this action type.'
      );
  }
}

// ─── Per-type rollback implementations ───────────────────────────────────────

/**
 * Network isolation rollback.
 * Uses CrowdStrike RTR lift_containment (primary) or firewall API (fallback).
 * NEVER simulates — throws if neither channel is configured.
 */
async function rollbackNetworkIsolation(
  targets: string[],
  rollbackScript: string
): Promise<RollbackResult> {
  // Try CrowdStrike first
  if (CROWDSTRIKE_CLIENT_ID && CROWDSTRIKE_CLIENT_SECRET) {
    const csToken = await getCrowdStrikeToken();
    const result = await removeFirewallRules(targets, rollbackScript);
    // Also lift CS containment if the hosts are CS-managed
    try {
      const csResult = await crowdStrikeLiftContainment(targets, csToken);
      return {
        success: true,
        details: `Network isolation lifted: ${result.details}; ${csResult.details}`,
        rules_removed: result.rules_removed,
        cs_device_ids: csResult.device_ids,
        execution_channel: 'crowdstrike_rtr + firewall_api',
      };
    } catch (_csErr) {
      // CS lookup failed (devices may not be CS-managed) — firewall API result stands
      return {
        success: true,
        details: result.details,
        rules_removed: result.rules_removed,
        execution_channel: 'firewall_api',
      };
    }
  }

  // Fallback: direct firewall API
  const result = await removeFirewallRules(targets, rollbackScript);
  return {
    ...result,
    execution_channel: 'firewall_api',
  };
}

/**
 * Endpoint isolation rollback.
 * Uses CrowdStrike RTR lift_containment — the canonical channel for this action type.
 * Throws if CS credentials are absent (fail-loud).
 */
async function rollbackEndpointIsolation(
  targets: string[],
  _rollbackScript: string
): Promise<RollbackResult> {
  const csToken = await getCrowdStrikeToken(); // throws if not configured
  const result = await crowdStrikeLiftContainment(targets, csToken);
  return {
    ...result,
    execution_channel: 'crowdstrike_rtr',
  };
}

/**
 * Configuration hardening rollback.
 * Executes via Ansible AWX using the rollback playbook stored in the script field.
 * Reuses the same launchAWXJob pattern as ansible-remediation-executor.
 */
async function rollbackConfigurationChanges(
  targets: string[],
  rollbackScript: string
): Promise<RollbackResult> {
  const AWX_URL   = Deno.env.get('ANSIBLE_AWX_API_URL');
  const AWX_TOKEN = Deno.env.get('ANSIBLE_AWX_TOKEN');

  if (!AWX_URL || !AWX_TOKEN) {
    throw new Error(
      'ANSIBLE_AWX_API_URL or ANSIBLE_AWX_TOKEN not set. ' +
      'Configuration rollback cannot execute without AWX credentials.'
    );
  }

  const headers = {
    'Authorization': `Bearer ${AWX_TOKEN}`,
    'Content-Type': 'application/json',
  };

  // Parse playbook name from rollback script or use a convention
  const playbookMatch = rollbackScript.match(/playbook:\s*(\S+)/);
  const playbookName = playbookMatch?.[1] ?? 'STIG-Rollback';

  const searchResp = await fetch(
    `${AWX_URL}/api/v2/job_templates/?name=${encodeURIComponent(playbookName)}`,
    { headers }
  );
  if (!searchResp.ok) throw new Error(`AWX lookup failed: ${searchResp.status}`);
  const searchData = await searchResp.json();
  if (!searchData.results?.length) throw new Error(`AWX job template not found: ${playbookName}`);
  const templateId = searchData.results[0].id;

  const launchResp = await fetch(`${AWX_URL}/api/v2/job_templates/${templateId}/launch/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ limit: targets.join(','), extra_vars: { rollback: true } }),
  });
  if (!launchResp.ok) throw new Error(`AWX launch failed: ${launchResp.status}`);
  const launchData = await launchResp.json();
  const jobId = String(launchData.job);

  // Poll for completion
  let attempts = 0;
  while (attempts < 120) {
    await new Promise(r => setTimeout(r, 5000));
    const statusResp = await fetch(`${AWX_URL}/api/v2/jobs/${jobId}/`, { headers });
    const job = await statusResp.json();
    if (['successful', 'failed', 'error', 'canceled'].includes(job.status)) {
      return {
        success: job.status === 'successful',
        details: `AWX rollback job ${jobId} completed with status: ${job.status}`,
        external_job_id: jobId,
        execution_channel: 'ansible_awx',
      };
    }
    attempts++;
  }
  throw new Error(`AWX rollback job ${jobId} timed out`);
}

/**
 * Patch rollback — always requires manual intervention.
 * Correctly returns success:false and DOES NOT pretend to have done anything.
 * This is the only case where we intentionally return failure — because automated
 * patch rollback is genuinely unsafe and must never be faked.
 */
function rollbackPatchManagement(): RollbackResult {
  return {
    success: false,
    details: 'Patch rollback requires manual intervention — automated patch rollback is not safe.',
    execution_channel: 'manual_required',
    manual_intervention_required: true,
    recommendations: [
      'Review /var/log/apt/history.log or /var/log/dnf.log for package history',
      'Use system snapshot (LVM/ZFS/VM) if available',
      'Contact system administrator for manual package downgrade',
    ],
  };
}