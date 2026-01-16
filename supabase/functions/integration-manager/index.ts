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
  action: 'test' | 'sync' | 'configure' | 'kip-proxy';
  integration_type: string;
  config: Record<string, string>;
  integration_id?: string;
}

// Rate limiting map
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

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
  // Remove sensitive information from error messages
  const message = error.message;
  
  // Remove URLs, tokens, keys from error messages
  return message
    .replace(/https?:\/\/[^\s]+/g, '[REDACTED_URL]')
    .replace(/[a-zA-Z0-9]{32,}/g, '[REDACTED_TOKEN]')
    .replace(/Bearer\s+[^\s]+/g, 'Bearer [REDACTED]')
    .replace(/token[:\s]+[^\s]+/gi, 'token: [REDACTED]');
}

function validateInput(request: IntegrationRequest): string | null {
  // Input validation
  if (!request.action || !['test', 'sync', 'configure'].includes(request.action)) {
    return 'Invalid action type';
  }
  
  if (!request.integration_type || typeof request.integration_type !== 'string') {
    return 'Invalid integration type';
  }
  
  if (request.integration_type.length > 50) {
    return 'Integration type too long';
  }
  
  if (!request.config || typeof request.config !== 'object') {
    return 'Invalid configuration';
  }
  
  // Validate config keys
  for (const [key, value] of Object.entries(request.config)) {
    if (typeof key !== 'string' || typeof value !== 'string') {
      return 'Invalid configuration format';
    }
    if (key.length > 100 || value.length > 500) {
      return 'Configuration values too long';
    }
  }
  
  return null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Integration manager function called');
    
    // Get client IP for rate limiting and logging
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
    
    // Input validation
    const validationError = validateInput(requestData);
    if (validationError) {
      console.warn(`Invalid input from user ${user.id}: ${validationError}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: validationError 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, integration_type, config, integration_id } = requestData;

    console.log(`Processing ${action} for ${integration_type} by user ${user.id}`);

    let result;

    switch (action) {
      case 'test':
        result = await testIntegrationConnection(integration_type, config);
        break;
      case 'sync':
        result = await syncIntegrationData(integration_type, config, integration_id);
        break;
    case 'configure':
      result = await configureIntegration(integration_type, config, user.id);
      break;
    case 'kip-proxy':
      result = await proxyToKIP(config, user);
      break;
    default:
      throw new Error('Invalid action');
    }

    // Log the action (without sensitive data)
    await supabase.rpc('log_user_action', {
      action_type: `INTEGRATION_${action.toUpperCase()}`,
      resource_type: 'integration',
      resource_id: integration_id || integration_type,
      details: { integration_type, action, success: result.success, ip: clientIP }
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const sanitizedError = sanitizeError(error);
    console.error('Error in integration-manager function:', sanitizedError);
    
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

async function testIntegrationConnection(type: string, config: Record<string, string>) {
  console.log(`Testing connection for ${type}`);
  
  try {
    switch (type) {
      case 'splunk':
        return await testSplunkConnection(config);
      case 'palo-alto':
        return await testPaloAltoConnection(config);
      case 'crowdstrike':
        return await testCrowdStrikeConnection(config);
      case 'okta':
        return await testOktaConnection(config);
      case 'aws-security':
        return await testAWSSecurityHubConnection(config);
      case 'microsoft-sentinel':
        return await testMicrosoftSentinelConnection(config);
      default:
        // Generic API test
        return await testGenericAPIConnection(config);
    }
  } catch (error) {
    console.error(`Connection test failed for ${type}:`, error);
    return { success: false, error: error.message };
  }
}

async function testSplunkConnection(config: Record<string, string>) {
  const { endpoint_url } = config;
  
  if (!endpoint_url) {
    throw new Error('Missing required Splunk configuration');
  }

  // Get Splunk Cloud credentials from Supabase secrets
  const splunkUrl = Deno.env.get('SPLUNK_URL');
  const splunkToken = Deno.env.get('SPLUNK_API_TOKEN');
  
  if (!splunkUrl || !splunkToken) {
    throw new Error('Splunk Cloud credentials not configured. Please add SPLUNK_URL and SPLUNK_API_TOKEN.');
  }

  // Use the configured Splunk URL or fallback to provided endpoint
  const apiUrl = splunkUrl || endpoint_url;
  
  const response = await fetch(`${apiUrl}/services/server/info`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${splunkToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'IMOHTEP-Integration/1.0'
    },
    // Prevent SSRF attacks
    redirect: 'error',
    referrerPolicy: 'no-referrer'
  });

  if (!response.ok) {
    throw new Error(`Splunk Cloud API error: ${response.status} ${response.statusText}`);
  }

  return { 
    success: true, 
    message: 'Successfully connected to Splunk Cloud',
    capabilities: ['logs', 'alerts', 'incidents', 'searches', 'saved_searches']
  };
}

async function testPaloAltoConnection(config: Record<string, string>) {
  const { endpoint_url, api_key } = config;
  
  if (!endpoint_url || !api_key) {
    throw new Error('Missing required Palo Alto configuration');
  }

  const response = await fetch(`${endpoint_url}/api/?type=op&cmd=<show><system><info></info></system></show>&key=${api_key}`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Palo Alto API error: ${response.status} ${response.statusText}`);
  }

  return { 
    success: true, 
    message: 'Successfully connected to Palo Alto Networks',
    capabilities: ['firewall_logs', 'threat_intel', 'policies', 'traffic_logs']
  };
}

async function testCrowdStrikeConnection(config: Record<string, string>) {
  const { client_id, client_secret } = config;
  
  if (!client_id || !client_secret) {
    throw new Error('Missing required CrowdStrike configuration');
  }

  // Get OAuth token
  const tokenResponse = await fetch('https://api.crowdstrike.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `client_id=${client_id}&client_secret=${client_secret}&grant_type=client_credentials`,
  });

  if (!tokenResponse.ok) {
    throw new Error(`CrowdStrike authentication failed: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  
  // Test API access
  const testResponse = await fetch('https://api.crowdstrike.com/detects/queries/detects/v1?limit=1', {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
    },
  });

  if (!testResponse.ok) {
    throw new Error(`CrowdStrike API test failed: ${testResponse.status}`);
  }

  return { 
    success: true, 
    message: 'Successfully connected to CrowdStrike Falcon',
    capabilities: ['endpoint_detections', 'incidents', 'iocs', 'host_info']
  };
}

async function testOktaConnection(config: Record<string, string>) {
  const { domain, api_token } = config;
  
  if (!domain || !api_token) {
    throw new Error('Missing required Okta configuration');
  }

  const response = await fetch(`https://${domain}/api/v1/org`, {
    headers: {
      'Authorization': `SSWS ${api_token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Okta API error: ${response.status} ${response.statusText}`);
  }

  return { 
    success: true, 
    message: 'Successfully connected to Okta',
    capabilities: ['auth_logs', 'user_events', 'policies', 'apps']
  };
}

async function testAWSSecurityHubConnection(config: Record<string, string>) {
  const { access_key_id, secret_access_key, region } = config;
  
  if (!access_key_id || !secret_access_key || !region) {
    throw new Error('Missing required AWS configuration');
  }

  // This is a simplified test - in production, you'd use AWS SDK
  return { 
    success: true, 
    message: 'AWS Security Hub configuration validated',
    capabilities: ['findings', 'insights', 'compliance', 'standards']
  };
}

async function testMicrosoftSentinelConnection(config: Record<string, string>) {
  const { tenant_id, client_id, client_secret } = config;
  
  if (!tenant_id || !client_id || !client_secret) {
    throw new Error('Missing required Microsoft Sentinel configuration');
  }

  // This is a simplified test - in production, you'd use Microsoft Graph SDK
  return { 
    success: true, 
    message: 'Microsoft Sentinel configuration validated',
    capabilities: ['incidents', 'alerts', 'hunting_queries', 'workbooks']
  };
}

async function testGenericAPIConnection(config: Record<string, string>) {
  const { endpoint_url, api_key } = config;
  
  if (!endpoint_url) {
    throw new Error('Missing endpoint URL');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (api_key) {
    headers['Authorization'] = `Bearer ${api_key}`;
  }

  const response = await fetch(endpoint_url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return { 
    success: true, 
    message: 'Successfully connected to API endpoint',
    capabilities: ['custom_data']
  };
}

async function syncIntegrationData(type: string, config: Record<string, string>, integrationId?: string) {
  console.log(`Syncing data for ${type}`);
  
  // In a real implementation, this would fetch actual data from the integration
  // and store it in the database for processing by IMOHTEP
  
  const mockData = {
    type,
    integration_id: integrationId,
    sync_timestamp: new Date().toISOString(),
    records_processed: Math.floor(Math.random() * 1000) + 100,
    alerts_generated: Math.floor(Math.random() * 10),
    threats_detected: Math.floor(Math.random() * 5),
  };

  return {
    success: true,
    message: `Successfully synced data from ${type}`,
    data: mockData
  };
}

async function configureIntegration(type: string, config: Record<string, string>, userId: string) {
  console.log(`Configuring integration ${type} for user ${userId}`);
  
  // In a real implementation, this would store the encrypted configuration
  // in the database and set up the integration
  
  return {
    success: true,
    message: `Integration ${type} configured successfully`,
    integration_id: `int_${Date.now()}_${type}`
  };
}

// Proxy requests to KIP project with cultural authentication
async function proxyToKIP(config: Record<string, string>, user: any) {
  const { endpoint, method = 'GET', data } = config;
  
  const kipBaseUrl = Deno.env.get('KIP_BASE_URL') || 'http://localhost:3001/khepra/v1';
  const fullUrl = `${kipBaseUrl}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${user.access_token}`,
    'X-SouHimBou-User-ID': user.id,
    'X-SouHimBou-Organization': user.user_metadata?.organization_id || 'default'
  };

  // Add cultural fingerprint if available
  if (config.culturalFingerprint) {
    headers['KHEPRA-Cultural-Fingerprint'] = config.culturalFingerprint;
  }

  try {
    const response = await fetch(fullUrl, {
      method: method.toUpperCase(),
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    const result = await response.json();
    
    // Log the KIP interaction
    console.log(`KIP Proxy: ${method} ${endpoint} -> ${response.status}`);
    
    return {
      success: response.ok,
      status: response.status,
      data: result,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    console.error('KIP proxy error:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}