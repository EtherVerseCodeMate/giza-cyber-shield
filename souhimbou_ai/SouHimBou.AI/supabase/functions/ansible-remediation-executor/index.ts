import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// FAIL-LOUD CONFIGURATION CHECK
// When AWX credentials are absent this function MUST fail closed.
// It MUST NOT compute a fake success or write a simulated completion record.
// Writing success=true without a real side-effect breaks the audit trail and
// is treated as CRITICAL per the SouHimBou audit framework (C-TD-03 / C-DG-02).
// ============================================================================
const AWX_URL   = Deno.env.get('ANSIBLE_AWX_API_URL');
const AWX_TOKEN = Deno.env.get('ANSIBLE_AWX_TOKEN');

interface RemediationRequest {
  action: 'execute' | 'validate' | 'rollback' | 'sync_playbooks';
  organization_id: string;
  execution_id?: string;
  asset_id?: string;
  stig_rule_ids?: string[];
  platform?: string;
  approved?: boolean;
}

/** Launch an AWX/Tower job template and poll until completion (max 10 min). */
async function launchAWXJob(
  playbookName: string,
  inventoryHosts: string[],
  extraVars: Record<string, unknown>
): Promise<{ success: boolean; jobId: string; stdout: string; rc: number }> {
  if (!AWX_URL || !AWX_TOKEN) {
    throw new Error(
      'ANSIBLE_AWX_API_URL or ANSIBLE_AWX_TOKEN not set. ' +
      'Remediation cannot execute without real AWX credentials. ' +
      'Configure secrets in Supabase Vault and redeploy.'
    );
  }

  const headers = {
    'Authorization': `Bearer ${AWX_TOKEN}`,
    'Content-Type': 'application/json',
  };

  // 1. Find the job template by name
  const searchResp = await fetch(
    `${AWX_URL}/api/v2/job_templates/?name=${encodeURIComponent(playbookName)}`,
    { headers }
  );
  if (!searchResp.ok) {
    throw new Error(`AWX job template lookup failed: ${searchResp.status} ${await searchResp.text()}`);
  }
  const searchData = await searchResp.json();
  if (!searchData.results?.length) {
    throw new Error(`AWX job template not found: ${playbookName}`);
  }
  const templateId = searchData.results[0].id;

  // 2. Launch the job
  const launchResp = await fetch(`${AWX_URL}/api/v2/job_templates/${templateId}/launch/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      limit: inventoryHosts.join(','),
      extra_vars: extraVars,
    }),
  });
  if (!launchResp.ok) {
    throw new Error(`AWX launch failed: ${launchResp.status} ${await launchResp.text()}`);
  }
  const launchData = await launchResp.json();
  const jobId: number = launchData.job;

  // 3. Poll for completion (max 120 attempts x 5 s = 10 min)
  let attempts = 0;
  while (attempts < 120) {
    await new Promise(r => setTimeout(r, 5000));
    const statusResp = await fetch(`${AWX_URL}/api/v2/jobs/${jobId}/`, { headers });
    if (!statusResp.ok) throw new Error(`AWX status poll failed: ${statusResp.status}`);
    const job = await statusResp.json();

    if (['successful', 'failed', 'error', 'canceled'].includes(job.status)) {
      // Fetch stdout
      const stdoutResp = await fetch(`${AWX_URL}/api/v2/jobs/${jobId}/stdout/?format=txt`, { headers });
      const stdout = stdoutResp.ok ? await stdoutResp.text() : `Job ${jobId} completed with status: ${job.status}`;
      return {
        success: job.status === 'successful',
        jobId: String(jobId),
        stdout,
        rc: job.status === 'successful' ? 0 : 1,
      };
    }
    attempts++;
  }
  throw new Error(`AWX job ${jobId} timed out after 10 minutes`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const requestData: RemediationRequest = await req.json();
    const { action, organization_id } = requestData;

    console.log(`Ansible Remediation Executor - Action: ${action}, Org: ${organization_id}`);

    switch (action) {
      case 'sync_playbooks': {
        const platforms = ['RHEL8', 'RHEL9', 'Ubuntu22', 'Windows-2019', 'Windows-2022'];
        let playbooksAdded = 0;

        for (const platform of platforms) {
          const repoUrl = `https://raw.githubusercontent.com/ansible-lockdown/${platform}-STIG/main/defaults/main.yml`;
          
          try {
            const response = await fetch(repoUrl);
            if (response.ok) {
              const playbookContent = await response.text();
              const stigRules = extractSTIGRulesFromPlaybook(playbookContent);
              
              await supabase
                .from('remediation_playbooks')
                .upsert({
                  organization_id,
                  playbook_name: `${platform} DISA STIG Remediation`,
                  playbook_source: 'ansible_lockdown',
                  platform: platform.replace(/[0-9-]/g, '').trim(),
                  stig_version: 'latest',
                  applicable_rules: stigRules,
                  playbook_yaml: playbookContent,
                  requires_approval: true,
                  is_active: true,
                  created_by: user.id,
                });
              
              playbooksAdded++;
            }
          } catch (error) {
            console.warn(`Failed to sync ${platform} playbook:`, error.message);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          playbooks_added: playbooksAdded,
          message: 'Ansible Lockdown playbooks synchronized',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'execute': {
        const { execution_id, asset_id, stig_rule_ids, approved } = requestData;

        if (!execution_id && (!asset_id || !stig_rule_ids)) {
          throw new Error('Either execution_id or asset_id + stig_rule_ids required');
        }

        let executionRecord;

        if (execution_id) {
          const { data } = await supabase
            .from('remediation_executions')
            .select('*')
            .eq('id', execution_id)
            .single();
          
          executionRecord = data;

          if (executionRecord.execution_status !== 'pending' && !approved) {
            throw new Error('Execution requires approval');
          }
        } else {
          const { data: asset } = await supabase
            .from('security_assets')
            .select('*')
            .eq('id', asset_id)
            .single();

          if (!asset) throw new Error('Asset not found');

          const { data: playbook } = await supabase
            .from('remediation_playbooks')
            .select('*')
            .eq('organization_id', organization_id)
            .eq('platform', asset.asset_type)
            .eq('is_active', true)
            .single();

          if (!playbook) throw new Error('No active playbook found for this platform');

          const { data: newExecution } = await supabase
            .from('remediation_executions')
            .insert({
              organization_id,
              asset_id: asset.id,
              playbook_id: playbook.id,
              stig_rule_id: stig_rule_ids![0],
              execution_status: playbook.requires_approval ? 'pending' : 'approved',
              initiated_by: user.id,
              approved_by: playbook.requires_approval ? null : user.id,
              is_simulated: false,
              execution_channel: 'ansible_awx',
            })
            .select()
            .single();

          executionRecord = newExecution;

          if (playbook.requires_approval && !approved) {
            return new Response(JSON.stringify({
              success: true,
              execution_id: newExecution.id,
              requires_approval: true,
              message: 'Execution created, waiting for approval',
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        const startTime = Date.now();
        await supabase
          .from('remediation_executions')
          .update({
            execution_status: 'running',
            started_at: new Date().toISOString(),
            approved_by: user.id,
          })
          .eq('id', executionRecord.id);

        const [{ data: playbook }, { data: asset }] = await Promise.all([
          supabase.from('remediation_playbooks').select('*').eq('id', executionRecord.playbook_id).single(),
          supabase.from('security_assets').select('*').eq('id', executionRecord.asset_id).single(),
        ]);

        // ----------------------------------------------------------------
        // REAL AWX EXECUTION — throws (fail-loud) if credentials absent
        // ----------------------------------------------------------------
        const awxResult = await launchAWXJob(
          playbook.playbook_name,
          [asset.asset_name],
          {
            stig_rule_id: executionRecord.stig_rule_id,
            target_host: asset.asset_name,
            organization_id,
          }
        );

        const duration = Math.floor((Date.now() - startTime) / 1000);
        const changesApplied = awxResult.success ? [{
          rule_id: executionRecord.stig_rule_id,
          action: 'applied',
          timestamp: new Date().toISOString(),
          details: `STIG rule ${executionRecord.stig_rule_id} remediated via AWX job ${awxResult.jobId}`,
        }] : [];

        await supabase
          .from('remediation_executions')
          .update({
            execution_status: awxResult.success ? 'completed' : 'failed',
            completed_at: new Date().toISOString(),
            duration_seconds: duration,
            stdout_log: awxResult.stdout,
            stderr_log: awxResult.success ? '' : 'See stdout_log for failure details',
            exit_code: awxResult.rc,
            changes_applied: changesApplied,
            rollback_available: awxResult.success,
            is_simulated: false,
            execution_channel: 'ansible_awx',
            awx_job_id: awxResult.jobId,
          })
          .eq('id', executionRecord.id);

        await supabase.rpc('increment', { row_id: playbook.id, table_name: 'remediation_playbooks', column_name: 'total_executions' });

        if (awxResult.success) {
          await supabase.rpc('increment', { row_id: playbook.id, table_name: 'remediation_playbooks', column_name: 'successful_executions' });

          await supabase.from('stig_assessment_results').upsert({
            organization_id,
            asset_id: asset.id,
            stig_rule_id: executionRecord.stig_rule_id,
            assessment_status: 'pass',
            finding_details: `Automatically remediated via Ansible AWX job ${awxResult.jobId}`,
            assessed_by: user.id,
            assessed_at: new Date().toISOString(),
          });

          await supabase.from('stig_evidence').insert({
            organization_id,
            asset_id: asset.id,
            stig_rule_id: executionRecord.stig_rule_id,
            evidence_type: 'automated_remediation',
            evidence_data: {
              execution_id: executionRecord.id,
              playbook_id: playbook.id,
              awx_job_id: awxResult.jobId,
              stdout: awxResult.stdout,
              changes: changesApplied,
              is_simulated: false,
              execution_channel: 'ansible_awx',
            },
            collection_method: 'ansible_awx',
            collected_by: user.id,
          });
        }

        return new Response(JSON.stringify({
          success: awxResult.success,
          execution_id: executionRecord.id,
          awx_job_id: awxResult.jobId,
          duration_seconds: duration,
          changes_applied: changesApplied,
          stdout: awxResult.stdout,
          message: awxResult.success ? 'Remediation completed successfully' : 'Remediation failed',
          is_simulated: false,
          execution_channel: 'ansible_awx',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'rollback': {
        const { execution_id } = requestData;

        if (!execution_id) throw new Error('execution_id required');

        const { data: execution } = await supabase
          .from('remediation_executions')
          .select('*')
          .eq('id', execution_id)
          .single();

        if (!execution || !execution.rollback_available) {
          throw new Error('Rollback not available for this execution');
        }

        if (!execution.awx_job_id) {
          throw new Error('Cannot rollback: original execution has no AWX job ID — rollback anchor missing');
        }

        const [{ data: playbook }, { data: asset }] = await Promise.all([
          supabase.from('remediation_playbooks').select('*').eq('id', execution.playbook_id).single(),
          supabase.from('security_assets').select('*').eq('id', execution.asset_id).single(),
        ]);

        const rollbackResult = await launchAWXJob(
          `${playbook.playbook_name} - Rollback`,
          [asset.asset_name],
          { stig_rule_id: execution.stig_rule_id, original_awx_job_id: execution.awx_job_id, rollback: true }
        );

        await supabase.from('remediation_executions').update({
          execution_status: rollbackResult.success ? 'rolled_back' : 'rollback_failed',
          is_simulated: false,
          execution_channel: 'ansible_awx',
        }).eq('id', execution_id);

        if (rollbackResult.success) {
          await supabase.from('stig_assessment_results').update({
            assessment_status: 'not_reviewed',
            finding_details: `Remediation rolled back via AWX job ${rollbackResult.jobId}`,
          }).eq('asset_id', execution.asset_id).eq('stig_rule_id', execution.stig_rule_id);
        }

        return new Response(JSON.stringify({
          success: rollbackResult.success,
          awx_job_id: rollbackResult.jobId,
          message: rollbackResult.success ? 'Remediation rolled back successfully' : 'Rollback failed — manual intervention required',
          is_simulated: false,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Ansible Remediation Executor Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractSTIGRulesFromPlaybook(playbookContent: string): string[] {
  const rules: string[] = [];
  const ruleMatches = playbookContent.matchAll(/(?:rhel|ubuntu|win)_\d{2}_\d{6}/gi);
  
  for (const match of ruleMatches) {
    rules.push(match[0].toUpperCase());
  }
  
  return [...new Set(rules)];
}

function generateSuccessOutput(ruleId: string, assetName: string): string {
  return `PLAY [Apply STIG ${ruleId}] ****************************************************

TASK [Gathering Facts] *********************************************************
ok: [${assetName}]

TASK [Apply ${ruleId}] *********************************************************
changed: [${assetName}]

PLAY RECAP *********************************************************************
${assetName}               : ok=2    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0`;
}

function generateFailureOutput(ruleId: string, assetName: string): string {
  return `PLAY [Apply STIG ${ruleId}] ****************************************************

TASK [Gathering Facts] *********************************************************
ok: [${assetName}]

TASK [Apply ${ruleId}] *********************************************************
fatal: [${assetName}]: FAILED! => {"changed": false, "msg": "Prerequisites not met"}

PLAY RECAP *********************************************************************
${assetName}               : ok=1    changed=0    unreachable=0    failed=1    skipped=0    rescued=0    ignored=0`;
}
