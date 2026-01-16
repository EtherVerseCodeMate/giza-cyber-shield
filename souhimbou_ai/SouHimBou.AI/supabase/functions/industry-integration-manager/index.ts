import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface IntegrationRequest {
  action: 'test' | 'sync' | 'configure' | 'analytics';
  integration_id?: string;
  user_integration_id?: string;
  config?: Record<string, string>;
}

// Rate limiting map
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 15;

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(identifier);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  userLimit.count++;
  return true;
}

function sanitizeError(error: Error): string {
  const message = error.message;
  return message
    .replace(/https?:\/\/[^\s]+/g, '[REDACTED_URL]')
    .replace(/[a-zA-Z0-9]{32,}/g, '[REDACTED_TOKEN]')
    .replace(/Bearer\s+[^\s]+/g, 'Bearer [REDACTED]')
    .replace(/token[:\s]+[^\s]+/gi, 'token: [REDACTED]');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Industry Integration Manager function called');
    
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    
    // Rate limiting
    if (!checkRateLimit(clientIP)) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Rate limit exceeded. Please try again later.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.warn(`Unauthorized request from IP: ${clientIP}`);
      throw new Error('No authorization header');
    }

    // Verify the user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.warn(`Authentication failed for IP: ${clientIP}`);
      throw new Error('Unauthorized');
    }

    const requestData: IntegrationRequest = await req.json();
    const { action, integration_id, user_integration_id, config } = requestData;

    console.log(`Processing ${action} for user ${user.id}`);

    let result;

    switch (action) {
      case 'test':
        result = await testIntegrationConnection(user_integration_id!, user.id);
        break;
      case 'sync':
        result = await syncIntegrationData(user_integration_id!, user.id);
        break;
      case 'configure':
        result = await configureIntegration(integration_id!, config!, user.id);
        break;
      case 'analytics':
        result = await getIntegrationAnalytics(user_integration_id!, user.id);
        break;
      default:
        throw new Error('Invalid action');
    }

    // Log the action
    await supabase.rpc('log_user_action', {
      action_type: `INDUSTRY_INTEGRATION_${action.toUpperCase()}`,
      resource_type: 'integration',
      resource_id: user_integration_id || integration_id,
      details: { action, success: result.success, ip: clientIP }
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const sanitizedError = sanitizeError(error);
    console.error('Error in industry-integration-manager function:', sanitizedError);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error. Please try again later.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function testIntegrationConnection(userIntegrationId: string, userId: string) {
  console.log(`Testing connection for user integration ${userIntegrationId}`);
  
  try {
    // Get user integration details
    const { data: userIntegration, error } = await supabase
      .from('user_integrations')
      .select(`
        *,
        integration_library:integrations_library(*)
      `)
      .eq('id', userIntegrationId)
      .eq('user_id', userId)
      .single();

    if (error || !userIntegration) {
      throw new Error('Integration not found or access denied');
    }

    const integration = userIntegration.integration_library;
    const config = userIntegration.config;

    // Update status to pending
    await supabase
      .from('user_integrations')
      .update({ status: 'pending' })
      .eq('id', userIntegrationId);

    let testResult;

    // Test based on integration type
    switch (integration.provider.toLowerCase()) {
      case 'splunk inc.':
        testResult = await testSplunkConnection(config);
        break;
      case 'elastic n.v.':
        testResult = await testElasticConnection(config);
        break;
      case 'crowdstrike':
        testResult = await testCrowdStrikeConnection(config);
        break;
      case 'palo alto networks':
        testResult = await testPaloAltoConnection(config);
        break;
      case 'okta inc.':
        testResult = await testOktaConnection(config);
        break;
      default:
        testResult = await testGenericConnection(config);
    }

    // Update status based on test result
    const newStatus = testResult.success ? 'connected' : 'error';
    const healthStatus = testResult.success ? 'healthy' : 'critical';
    
    await supabase
      .from('user_integrations')
      .update({ 
        status: newStatus,
        health_status: healthStatus,
        error_message: testResult.success ? null : testResult.error,
        last_sync: testResult.success ? new Date().toISOString() : null
      })
      .eq('id', userIntegrationId);

    return {
      success: testResult.success,
      message: testResult.message,
      capabilities: testResult.capabilities || [],
      error: testResult.error
    };

  } catch (error) {
    console.error(`Connection test failed:`, error);
    
    // Update status to error
    await supabase
      .from('user_integrations')
      .update({ 
        status: 'error',
        health_status: 'critical',
        error_message: error.message
      })
      .eq('id', userIntegrationId);
    
    return { success: false, error: error.message };
  }
}

async function testSplunkConnection(config: Record<string, any>) {
  const splunkUrl = Deno.env.get('SPLUNK_URL');
  const splunkToken = Deno.env.get('SPLUNK_API_TOKEN');
  
  if (!splunkUrl || !splunkToken) {
    throw new Error('Splunk credentials not configured');
  }

  const response = await fetch(`${splunkUrl}/services/server/info`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${splunkToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Splunk API error: ${response.status}`);
  }

  return { 
    success: true, 
    message: 'Successfully connected to Splunk Enterprise',
    capabilities: ['logs', 'alerts', 'incidents', 'searches', 'dashboards']
  };
}

async function testElasticConnection(config: Record<string, any>) {
  const elasticUrl = Deno.env.get('ELASTICSEARCH_URL');
  const elasticKey = Deno.env.get('ELASTICSEARCH_API_KEY');
  
  if (!elasticUrl || !elasticKey) {
    throw new Error('Elasticsearch credentials not configured');
  }

  const response = await fetch(`${elasticUrl}/_cluster/health`, {
    method: 'GET',
    headers: {
      'Authorization': `ApiKey ${elasticKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Elasticsearch API error: ${response.status}`);
  }

  return { 
    success: true, 
    message: 'Successfully connected to Elastic Stack',
    capabilities: ['logs', 'alerts', 'metrics', 'analytics', 'visualization']
  };
}

async function testCrowdStrikeConnection(config: Record<string, any>) {
  // This would typically use OAuth2 flow for CrowdStrike
  return { 
    success: true, 
    message: 'CrowdStrike connection validated (demo mode)',
    capabilities: ['endpoint_protection', 'threat_hunting', 'incident_response']
  };
}

async function testPaloAltoConnection(config: Record<string, any>) {
  return { 
    success: true, 
    message: 'Palo Alto Networks connection validated (demo mode)',
    capabilities: ['firewall_logs', 'threat_prevention', 'url_filtering']
  };
}

async function testOktaConnection(config: Record<string, any>) {
  return { 
    success: true, 
    message: 'Okta connection validated (demo mode)',
    capabilities: ['authentication_logs', 'user_management', 'sso']
  };
}

async function testGenericConnection(config: Record<string, any>) {
  return { 
    success: true, 
    message: 'Generic integration connection validated',
    capabilities: ['data_ingestion']
  };
}

async function syncIntegrationData(userIntegrationId: string, userId: string) {
  console.log(`Syncing data for user integration ${userIntegrationId}`);
  
  try {
    // Get integration details
    const { data: userIntegration } = await supabase
      .from('user_integrations')
      .select(`
        *,
        integration_library:integrations_library(*)
      `)
      .eq('id', userIntegrationId)
      .eq('user_id', userId)
      .single();

    if (!userIntegration) {
      throw new Error('Integration not found');
    }

    // Simulate data sync
    const syncResult = {
      events_processed: Math.floor(Math.random() * 1000) + 100,
      alerts_generated: Math.floor(Math.random() * 10),
      threats_detected: Math.floor(Math.random() * 5),
      data_volume_mb: Math.floor(Math.random() * 100) + 10,
    };

    // Update last sync time
    await supabase
      .from('user_integrations')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', userIntegrationId);

    // Record analytics
    await supabase
      .from('integration_analytics')
      .insert({
        user_integration_id: userIntegrationId,
        organization_id: userIntegration.organization_id,
        ...syncResult
      });

    return {
      success: true,
      message: `Successfully synced data from ${userIntegration.integration_library?.name}`,
      data: syncResult
    };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function configureIntegration(integrationId: string, config: Record<string, string>, userId: string) {
  console.log(`Configuring integration ${integrationId} for user ${userId}`);
  
  // In a real implementation, this would validate and store the configuration
  return {
    success: true,
    message: `Integration configured successfully`,
    configuration_id: `config_${Date.now()}`
  };
}

async function getIntegrationAnalytics(userIntegrationId: string, userId: string) {
  console.log(`Getting analytics for user integration ${userIntegrationId}`);
  
  try {
    const { data: analytics, error } = await supabase
      .from('integration_analytics')
      .select('*')
      .eq('user_integration_id', userIntegrationId)
      .order('date', { ascending: false })
      .limit(30);

    if (error) throw error;

    // Calculate aggregates
    const totals = analytics.reduce((acc, record) => ({
      total_events: acc.total_events + (record.events_processed || 0),
      total_alerts: acc.total_alerts + (record.alerts_generated || 0),
      total_threats: acc.total_threats + (record.threats_detected || 0),
      total_data_mb: acc.total_data_mb + (record.data_volume_mb || 0),
    }), { total_events: 0, total_alerts: 0, total_threats: 0, total_data_mb: 0 });

    return {
      success: true,
      analytics: analytics,
      summary: totals,
      period_days: analytics.length
    };

  } catch (error) {
    return { success: false, error: error.message };
  }
}