import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface STIGManagerRequest {
  action: 'sync_stigs' | 'fetch_assessments' | 'update_assessment' | 'get_collections';
  organization_id: string;
  stig_manager_url?: string;
  api_key?: string;
  collection_name?: string;
  asset_name?: string;
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

    const requestData: STIGManagerRequest = await req.json();
    const { action, organization_id, stig_manager_url, api_key } = requestData;

    console.log(`STIG Manager Bridge - Action: ${action}, Org: ${organization_id}`);

    switch (action) {
      case 'sync_stigs': {
        // Get STIG Manager configuration
        const { data: config } = await supabase
          .from('stig_manager_sync')
          .select('*')
          .eq('organization_id', organization_id)
          .single();

        const stigManagerUrl = stig_manager_url || config?.stig_manager_url;
        const stigManagerKey = api_key || config?.api_key_encrypted;

        if (!stigManagerUrl || !stigManagerKey) {
          throw new Error('STIG Manager URL and API key required');
        }

        // Update sync status
        await supabase
          .from('stig_manager_sync')
          .upsert({
            organization_id,
            stig_manager_url: stigManagerUrl,
            api_key_encrypted: stigManagerKey,
            sync_status: 'syncing',
          });

        // Fetch STIGs from STIG Manager API
        const stigsResponse = await fetch(`${stigManagerUrl}/api/stigs`, {
          headers: {
            'Authorization': `Bearer ${stigManagerKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!stigsResponse.ok) {
          throw new Error(`STIG Manager API error: ${stigsResponse.statusText}`);
        }

        const stigs = await stigsResponse.json();
        let rulesInserted = 0;

        // Process each STIG and insert rules
        for (const stig of stigs) {
          const rulesResponse = await fetch(`${stigManagerUrl}/api/stigs/${stig.benchmarkId}/rules`, {
            headers: {
              'Authorization': `Bearer ${stigManagerKey}`,
              'Content-Type': 'application/json',
            },
          });

          if (rulesResponse.ok) {
            const rules = await rulesResponse.json();
            
            for (const rule of rules) {
              await supabase
                .from('stig_rules_library')
                .upsert({
                  rule_id: rule.ruleId,
                  group_id: rule.groupId,
                  vuln_id: rule.vulnId || rule.ruleId,
                  stig_id: stig.benchmarkId,
                  stig_title: stig.title,
                  stig_version: stig.version,
                  severity: mapSeverity(rule.severity),
                  cat_level: mapCategoryLevel(rule.severity),
                  rule_title: rule.title,
                  discussion: rule.discussion,
                  check_content: rule.checkContent || rule.check,
                  fix_text: rule.fixText || rule.fix,
                  cci_references: rule.cciRefs || [],
                  nist_controls: extractNISTControls(rule.cciRefs || []),
                  platform: extractPlatform(stig.title),
                  technology: stig.title,
                  automation_available: false,
                }, { onConflict: 'rule_id,stig_version' });
              
              rulesInserted++;
            }
          }
        }

        // Update sync status
        await supabase
          .from('stig_manager_sync')
          .update({
            sync_status: 'success',
            last_sync_at: new Date().toISOString(),
            stigs_synced: stigs.length,
            rules_synced: rulesInserted,
          })
          .eq('organization_id', organization_id);

        return new Response(JSON.stringify({
          success: true,
          stigs_synced: stigs.length,
          rules_synced: rulesInserted,
          message: 'STIG library synchronized successfully',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'fetch_assessments': {
        const { data: config } = await supabase
          .from('stig_manager_sync')
          .select('*')
          .eq('organization_id', organization_id)
          .single();

        if (!config) {
          throw new Error('STIG Manager not configured for this organization');
        }

        // Fetch collections from STIG Manager
        const collectionsResponse = await fetch(`${config.stig_manager_url}/api/collections`, {
          headers: {
            'Authorization': `Bearer ${config.api_key_encrypted}`,
            'Content-Type': 'application/json',
          },
        });

        const collections = await collectionsResponse.json();

        return new Response(JSON.stringify({
          success: true,
          collections,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_collections': {
        const { data: config } = await supabase
          .from('stig_manager_sync')
          .select('*')
          .eq('organization_id', organization_id)
          .single();

        if (!config) {
          return new Response(JSON.stringify({
            success: false,
            message: 'STIG Manager not configured',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const collectionsResponse = await fetch(`${config.stig_manager_url}/api/collections`, {
          headers: {
            'Authorization': `Bearer ${config.api_key_encrypted}`,
            'Content-Type': 'application/json',
          },
        });

        if (!collectionsResponse.ok) {
          throw new Error('Failed to fetch collections');
        }

        const collections = await collectionsResponse.json();

        return new Response(JSON.stringify({
          success: true,
          collections,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid action',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('STIG Manager Bridge Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function mapSeverity(stigSeverity: string): string {
  const severityMap: { [key: string]: string } = {
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
    'critical': 'high',
  };
  return severityMap[stigSeverity?.toLowerCase()] || 'medium';
}

function mapCategoryLevel(stigSeverity: string): string {
  const catMap: { [key: string]: string } = {
    'high': 'CAT I',
    'critical': 'CAT I',
    'medium': 'CAT II',
    'low': 'CAT III',
  };
  return catMap[stigSeverity?.toLowerCase()] || 'CAT II';
}

function extractNISTControls(cciRefs: string[]): string[] {
  // CCI to NIST mapping (simplified - full mapping would be extensive)
  const cciToNist: { [key: string]: string } = {
    'CCI-000001': 'AC-2',
    'CCI-000015': 'AC-2',
    'CCI-000016': 'AC-2',
    // Add more mappings as needed
  };
  
  return [...new Set(cciRefs.map(cci => cciToNist[cci]).filter(Boolean))];
}

function extractPlatform(stigTitle: string): string {
  const title = stigTitle.toLowerCase();
  if (title.includes('windows')) return 'Windows';
  if (title.includes('rhel') || title.includes('red hat')) return 'RHEL';
  if (title.includes('ubuntu')) return 'Ubuntu';
  if (title.includes('linux')) return 'Linux';
  if (title.includes('solaris')) return 'Solaris';
  if (title.includes('aix')) return 'AIX';
  return 'Generic';
}
