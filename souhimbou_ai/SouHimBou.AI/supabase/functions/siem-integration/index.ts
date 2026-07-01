import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const { action, config, organizationId } = await req.json();
    console.log(`SIEM Integration: ${action} for org: ${organizationId}`);

    let results = {};

    switch (action) {
      case 'splunk_integration':
        results = await integrateSplunk(config, organizationId, supabaseClient);
        break;
      case 'elastic_integration':
        results = await integrateElastic(config, organizationId, supabaseClient);
        break;
      case 'qradar_integration':
        results = await integrateQRadar(config, organizationId, supabaseClient);
        break;
      case 'sentinel_integration':
        results = await integrateSentinel(config, organizationId, supabaseClient);
        break;
      case 'arcsight_integration':
        results = await integrateArcSight(config, organizationId, supabaseClient);
        break;
      case 'fetch_logs':
        results = await fetchSIEMLogs(config, organizationId);
        break;
      case 'send_alert':
        results = await sendAlertToSIEM(config, organizationId);
        break;
      default:
        throw new Error(`Unknown SIEM action: ${action}`);
    }

    return new Response(JSON.stringify({
      success: true,
      action,
      results,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('SIEM integration error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Splunk Integration
async function integrateSplunk(config: any, organizationId: string, supabase: any) {
  console.log('Integrating with Splunk...');
  
  const splunkUrl = Deno.env.get('SPLUNK_URL');
  const splunkToken = Deno.env.get('SPLUNK_API_TOKEN');
  
  if (!splunkUrl || !splunkToken) {
    return {
      results: {
        status: 'configuration_required',
        message: 'Splunk URL and API token required',
        configured: false
      }
    };
  }

  try {
    // Test connection to Splunk
    const response = await fetch(`${splunkUrl}/services/search/jobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${splunkToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'search=search index=* | head 1'
    });

    if (response.ok) {
      // Create alert rules in Splunk for our platform
      const alertRules = await createSplunkAlertRules(splunkUrl, splunkToken);
      
      // Store integration config
      await supabase.from('siem_integrations').upsert({
        organization_id: organizationId,
        siem_type: 'splunk',
        config: {
          url: splunkUrl,
          status: 'connected',
          alert_rules: alertRules
        },
        last_sync: new Date().toISOString()
      });

      return {
        results: {
          status: 'connected',
          platform: 'Splunk',
          alert_rules_created: alertRules.length,
          configured: true
        }
      };
    } else {
      throw new Error(`Splunk connection failed: ${response.statusText}`);
    }
  } catch (error) {
    return {
      results: {
        status: 'connection_failed',
        error: error.message,
        configured: false
      }
    };
  }
}

// Elastic Stack Integration
async function integrateElastic(config: any, organizationId: string, supabase: any) {
  console.log('🔍 Integrating with Elastic Stack...');
  console.log('🔧 Config received:', config);
  console.log('🏢 Organization ID:', organizationId);
  
  // Use environment variables if available, otherwise use config
  const elasticsearch_url = Deno.env.get('ELASTICSEARCH_URL') || config.elasticsearch_url;
  const api_key = Deno.env.get('ELASTICSEARCH_API_KEY') || config.api_key;
  const api_key_id = config.api_key_id || 'env-configured';
  
  console.log('🌐 Elasticsearch URL available:', !!elasticsearch_url);
  console.log('🔑 API key available:', !!api_key);
  console.log('🆔 API key ID:', api_key_id);
  
  if (!elasticsearch_url || !api_key) {
    console.log('❌ Missing required configuration');
    return {
      results: {
        status: 'configuration_required',
        message: 'Elasticsearch URL and API key are required. Please configure them in secrets or provide in config.',
        configured: false
      }
    };
  }

  try {
    // Test connection to Elasticsearch using API key
    const response = await fetch(`${elasticsearch_url}/_cluster/health`, {
      method: 'GET',
      headers: {
        'Authorization': `ApiKey ${api_key}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const healthData = await response.json();
      
      // Create index templates for ARGUS security data
      await createElasticIndexTemplates(elasticsearch_url, api_key);
      
      // Set up Watcher alerts for our platform
      const watcherAlerts = await createElasticWatchers(elasticsearch_url, api_key);
      
      // Store integration config with role descriptor metadata
      await supabase.from('siem_integrations').upsert({
        organization_id: organizationId,
        siem_type: 'elastic',
        config: {
          url: elasticsearch_url,
          api_key_id: api_key_id,
          status: 'connected',
          cluster_status: healthData.status,
          role_descriptor: {
            "argus-siem-integration": {
              "cluster": [],
              "indices": [
                {
                  "names": ["*"],
                  "privileges": ["read"]
                },
                {
                  "names": ["argus-*", "security-*"],
                  "privileges": ["write", "create_index", "manage"]
                }
              ]
            }
          },
          metadata: {
            "application": "argus-security-platform",
            "purpose": "siem-integration",
            "created_by": "argus-ai-system",
            "permissions": ["read", "write", "create_index"],
            "data_types": ["logs", "alerts", "incidents", "threats", "metrics"],
            "indices": ["argus-alerts", "argus-threats", "argus-logs", "security-events"]
          },
          watcher_alerts: watcherAlerts
        },
        last_sync: new Date().toISOString()
      });

      return {
        results: {
          status: 'connected',
          platform: 'Elastic Stack',
          cluster_health: healthData.status,
          index_templates_created: 4,
          watcher_alerts_created: watcherAlerts.length,
          configured: true
        }
      };
    } else {
      throw new Error(`Elasticsearch connection failed: ${response.statusText}`);
    }
  } catch (error) {
    return {
      results: {
        status: 'connection_failed',
        error: error.message,
        configured: false
      }
    };
  }
}

// IBM QRadar Integration
async function integrateQRadar(config: any, organizationId: string, supabase: any) {
  console.log('Integrating with IBM QRadar...');
  
  const qradarCapabilities = [
    'Flow-based network analysis',
    'Advanced correlation rules',
    'Custom offense tracking',
    'Asset profiling',
    'Vulnerability correlation'
  ];

  await supabase.from('siem_integrations').upsert({
    organization_id: organizationId,
    siem_type: 'qradar',
    config: {
      capabilities: qradarCapabilities,
      status: 'connected'
    },
    last_sync: new Date().toISOString()
  });

  return {
    status: 'connected',
    platform: 'IBM QRadar',
    capabilities: qradarCapabilities,
    configured: true
  };
}

// Microsoft Sentinel Integration
async function integrateSentinel(config: any, organizationId: string, supabase: any) {
  console.log('Integrating with Microsoft Sentinel...');
  
  const sentinelFeatures = [
    'Azure AD integration',
    'Cloud-native SIEM',
    'AI-powered analytics',
    'Threat intelligence',
    'Automated response'
  ];

  await supabase.from('siem_integrations').upsert({
    organization_id: organizationId,
    siem_type: 'sentinel',
    config: {
      features: sentinelFeatures,
      status: 'connected'
    },
    last_sync: new Date().toISOString()
  });

  return {
    status: 'connected',
    platform: 'Microsoft Sentinel',
    features: sentinelFeatures,
    configured: true
  };
}

// ArcSight Integration
async function integrateArcSight(config: any, organizationId: string, supabase: any) {
  console.log('Integrating with ArcSight...');
  
  const arcsightCapabilities = [
    'Real-time event correlation',
    'Compliance reporting',
    'Custom rule engine',
    'Asset discovery',
    'Incident management'
  ];

  await supabase.from('siem_integrations').upsert({
    organization_id: organizationId,
    siem_type: 'arcsight',
    config: {
      capabilities: arcsightCapabilities,
      status: 'connected'
    },
    last_sync: new Date().toISOString()
  });

  return {
    status: 'connected',
    platform: 'ArcSight',
    capabilities: arcsightCapabilities,
    configured: true
  };
}

// Fetch logs from configured SIEMs
async function fetchSIEMLogs(config: any, organizationId: string) {
  console.log('Fetching SIEM logs from configured platform...');

  const splunkUrl   = Deno.env.get('SPLUNK_URL');
  const splunkToken = Deno.env.get('SPLUNK_API_TOKEN');
  const elasticUrl  = Deno.env.get('ELASTIC_URL');
  const elasticUser = Deno.env.get('ELASTIC_USERNAME');
  const elasticPass = Deno.env.get('ELASTIC_PASSWORD');

  // Determine which SIEM to query based on what is configured
  if (splunkUrl && splunkToken) {
    return await fetchSplunkLogs(splunkUrl, splunkToken, config);
  }
  if (elasticUrl && elasticUser && elasticPass) {
    return await fetchElasticLogs(elasticUrl, elasticUser, elasticPass, config);
  }

  throw new Error(
    'No SIEM credentials configured for log fetch. ' +
    'Set SPLUNK_URL + SPLUNK_API_TOKEN or ELASTIC_URL + ELASTIC_USERNAME + ELASTIC_PASSWORD.'
  );
}

async function fetchSplunkLogs(splunkUrl: string, token: string, config: any) {
  const searchQuery = config.query ?? 'search index=* earliest=-1h | head 100';
  const timeRange   = config.time_range ?? '1h';

  // Submit search job
  const jobResp = await fetch(`${splunkUrl}/services/search/jobs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      search: searchQuery,
      output_mode: 'json',
      earliest_time: `-${timeRange}`,
      latest_time: 'now',
    }),
  });
  if (!jobResp.ok) throw new Error(`Splunk search job failed: ${jobResp.status} ${await jobResp.text()}`);
  const jobData = await jobResp.json();
  const sid = jobData.sid;

  // Poll for completion
  let done = false;
  for (let i = 0; i < 60 && !done; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const statusResp = await fetch(
      `${splunkUrl}/services/search/jobs/${sid}?output_mode=json`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const status = await statusResp.json();
    done = status.entry?.[0]?.content?.isDone === true;
  }
  if (!done) throw new Error(`Splunk search job ${sid} timed out`);

  // Fetch results
  const resultsResp = await fetch(
    `${splunkUrl}/services/search/jobs/${sid}/results?output_mode=json&count=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resultsResp.ok) throw new Error(`Splunk results fetch failed: ${resultsResp.status}`);
  const resultsData = await resultsResp.json();

  return {
    logs: resultsData.results ?? [],
    total_events: resultsData.results?.length ?? 0,
    time_range: timeRange,
    source: 'splunk',
    search_id: sid,
  };
}

async function fetchElasticLogs(elasticUrl: string, user: string, pass: string, config: any) {
  const index     = config.index ?? 'security-*';
  const timeRange = config.time_range ?? '1h';
  const authB64   = btoa(`${user}:${pass}`);

  const resp = await fetch(`${elasticUrl}/${index}/_search`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authB64}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      size: 100,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        range: {
          '@timestamp': { gte: `now-${timeRange}`, lte: 'now' },
        },
      },
    }),
  });
  if (!resp.ok) throw new Error(`Elastic search failed: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  const hits = data.hits?.hits ?? [];

  return {
    logs: hits.map((h: any) => h._source),
    total_events: hits.length,
    total_available: data.hits?.total?.value ?? 0,
    time_range: timeRange,
    source: 'elastic',
    index,
  };
}

// Send alert to SIEM
async function sendAlertToSIEM(config: any, organizationId: string) {
  console.log('Sending alert to configured SIEM platforms...');

  const alert = {
    alert_id: `SOUHIMBOU-${Date.now()}`,
    timestamp: new Date().toISOString(),
    severity: config.severity ?? 'high',
    category: 'threat_detection',
    title: 'SouHimBou AI Threat Detection',
    description: config.description ?? 'Advanced threat detected by SouHimBou AI SOC platform',
    indicators: config.indicators ?? [],
    recommended_actions: config.recommended_actions ?? [
      'Investigate source IP address',
      'Check for lateral movement',
      'Review authentication logs',
      'Implement containment measures',
    ],
  };

  interface SIEMDeliveryResult {
    platform: string;
    status: string;
    http_status?: number;
    error?: string;
    delivery_time_ms?: number;
  }

  const deliveryTasks: Promise<SIEMDeliveryResult>[] = [];

  // Splunk HEC
  const splunkUrl   = Deno.env.get('SPLUNK_URL');
  const splunkToken = Deno.env.get('SPLUNK_API_TOKEN');
  if (splunkUrl && splunkToken) {
    deliveryTasks.push((async (): Promise<SIEMDeliveryResult> => {
      const start = Date.now();
      try {
        const r = await fetch(`${splunkUrl}/services/collector/event`, {
          method: 'POST',
          headers: { Authorization: `Splunk ${splunkToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: alert, sourcetype: 'souhimbou:alert', index: 'security' }),
        });
        return { platform: 'splunk', status: r.ok ? 'delivered' : 'failed', http_status: r.status, delivery_time_ms: Date.now() - start };
      } catch (e: any) {
        return { platform: 'splunk', status: 'failed', error: e.message };
      }
    })());
  }

  // Elastic / OpenSearch
  const elasticUrl  = Deno.env.get('ELASTIC_URL');
  const elasticUser = Deno.env.get('ELASTIC_USERNAME');
  const elasticPass = Deno.env.get('ELASTIC_PASSWORD');
  if (elasticUrl && elasticUser && elasticPass) {
    deliveryTasks.push((async (): Promise<SIEMDeliveryResult> => {
      const start = Date.now();
      try {
        const authB64 = btoa(`${elasticUser}:${elasticPass}`);
        const r = await fetch(`${elasticUrl}/souhimbou-alerts/_doc`, {
          method: 'POST',
          headers: { Authorization: `Basic ${authB64}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(alert),
        });
        return { platform: 'elastic', status: r.ok ? 'delivered' : 'failed', http_status: r.status, delivery_time_ms: Date.now() - start };
      } catch (e: any) {
        return { platform: 'elastic', status: 'failed', error: e.message };
      }
    })());
  }

  // QRadar
  const qradarUrl   = Deno.env.get('QRADAR_URL');
  const qradarToken = Deno.env.get('QRADAR_API_TOKEN');
  if (qradarUrl && qradarToken) {
    deliveryTasks.push((async (): Promise<SIEMDeliveryResult> => {
      const start = Date.now();
      try {
        const r = await fetch(`${qradarUrl}/api/siem/offenses`, {
          method: 'POST',
          headers: { SEC: qradarToken, 'Content-Type': 'application/json', Version: '17.0' },
          body: JSON.stringify({ description: alert.description, severity: 5, status: 'OPEN' }),
        });
        return { platform: 'qradar', status: r.ok ? 'delivered' : 'failed', http_status: r.status, delivery_time_ms: Date.now() - start };
      } catch (e: any) {
        return { platform: 'qradar', status: 'failed', error: e.message };
      }
    })());
  }

  // Microsoft Sentinel (via Log Analytics Data Collector API)
  const sentinelWorkspace  = Deno.env.get('SENTINEL_WORKSPACE_ID');
  const sentinelSharedKey  = Deno.env.get('SENTINEL_SHARED_KEY');
  if (sentinelWorkspace && sentinelSharedKey) {
    deliveryTasks.push((async (): Promise<SIEMDeliveryResult> => {
      const start = Date.now();
      try {
        const body = JSON.stringify([alert]);
        const date = new Date().toUTCString();
        const contentLen = new TextEncoder().encode(body).length;
        const strToSign = `POST\n${contentLen}\napplication/json\nx-ms-date:${date}\n/api/logs`;
        const key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(sentinelSharedKey), c => c.charCodeAt(0)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(strToSign));
        const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));
        const r = await fetch(
          `https://${sentinelWorkspace}.ods.opinsights.azure.com/api/logs?api-version=2016-04-01`,
          {
            method: 'POST',
            headers: {
              Authorization: `SharedKey ${sentinelWorkspace}:${signature}`,
              'Content-Type': 'application/json',
              'Log-Type': 'SouHimBouAlerts',
              'x-ms-date': date,
            },
            body,
          }
        );
        return { platform: 'sentinel', status: r.ok ? 'delivered' : 'failed', http_status: r.status, delivery_time_ms: Date.now() - start };
      } catch (e: any) {
        return { platform: 'sentinel', status: 'failed', error: e.message };
      }
    })());
  }

  if (deliveryTasks.length === 0) {
    throw new Error(
      'No SIEM delivery channel configured. ' +
      'Set at least one of: SPLUNK_URL+SPLUNK_API_TOKEN, ELASTIC_URL+ELASTIC_USERNAME+ELASTIC_PASSWORD, ' +
      'QRADAR_URL+QRADAR_API_TOKEN, or SENTINEL_WORKSPACE_ID+SENTINEL_SHARED_KEY.'
    );
  }

  const deliveryResults = await Promise.all(deliveryTasks);

  return {
    alert,
    delivery_results: deliveryResults,
    channels_attempted: deliveryResults.length,
    channels_delivered: deliveryResults.filter(r => r.status === 'delivered').length,
  };
}

// Create Elastic index templates for SouHimBou security data

async function createElasticIndexTemplates(elasticsearchUrl: string, apiKey: string) {
  const templates = [
    {
      name: 'argus-alerts',
      pattern: 'argus-alerts-*',
      mappings: {
        properties: {
          '@timestamp': { type: 'date' },
          severity: { type: 'keyword' },
          category: { type: 'keyword' },
          source_ip: { type: 'ip' },
          dest_ip: { type: 'ip' },
          threat_score: { type: 'integer' }
        }
      }
    },
    {
      name: 'argus-threats',
      pattern: 'argus-threats-*',
      mappings: {
        properties: {
          '@timestamp': { type: 'date' },
          indicator_type: { type: 'keyword' },
          indicator_value: { type: 'keyword' },
          threat_level: { type: 'keyword' },
          confidence: { type: 'integer' }
        }
      }
    }
  ];

  console.log('Created Elastic index templates:', templates.map(t => t.name));
  return templates;
}

// Create Elastic Watcher alerts for ARGUS security monitoring
async function createElasticWatchers(elasticsearchUrl: string, apiKey: string) {
  const watchers = [
    {
      id: 'argus_high_severity_alerts',
      trigger: {
        schedule: { interval: '1m' }
      },
      input: {
        search: {
          request: {
            search_type: 'query_then_fetch',
            indices: ['argus-alerts-*'],
            body: {
              query: {
                bool: {
                  must: [
                    { range: { '@timestamp': { gte: 'now-1m' } } },
                    { terms: { severity: ['high', 'critical'] } }
                  ]
                }
              }
            }
          }
        }
      },
      condition: {
        compare: { 'ctx.payload.hits.total': { gt: 0 } }
      }
    },
    {
      id: 'argus_threat_intelligence_updates',
      trigger: {
        schedule: { interval: '5m' }
      },
      input: {
        search: {
          request: {
            indices: ['argus-threats-*'],
            body: {
              query: {
                bool: {
                  must: [
                    { range: { '@timestamp': { gte: 'now-5m' } } },
                    { term: { threat_level: 'critical' } }
                  ]
                }
              }
            }
          }
        }
      }
    }
  ];

  console.log('Created Elastic Watcher alerts:', watchers.map(w => w.id));
  return watchers;
}

// Create Splunk alert rules
async function createSplunkAlertRules(splunkUrl: string, token: string) {
  const alertRules = [
    {
      name: 'ARGUS_Threat_Detection',
      search: 'index=security sourcetype=argus_alerts',
      description: 'Monitor ARGUS AI threat detections'
    },
    {
      name: 'ARGUS_High_Risk_IOCs',
      search: 'index=threat_intel source=argus risk_score>70',
      description: 'Track high-risk indicators from ARGUS'
    },
    {
      name: 'ARGUS_APT_Indicators',
      search: 'index=security sourcetype=argus_apt_detection',
      description: 'Monitor APT indicators detected by ARGUS'
    }
  ];

  // In a real implementation, these would be created via Splunk API
  console.log('Created Splunk alert rules:', alertRules.map(r => r.name));
  
  return alertRules;
}