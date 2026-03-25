import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Default rate limits by API provider
const DEFAULT_RATE_LIMITS = {
  openai: {
    'chat/completions': { 
      requestsPerHour: 500, 
      requestsPerDay: 10000, 
      tokensPerHour: 150000, 
      tokensPerDay: 2000000 
    }
  },
  grok: {
    'v1/chat/completions': { 
      requestsPerHour: 300, 
      requestsPerDay: 5000, 
      tokensPerHour: 100000, 
      tokensPerDay: 1000000 
    }
  },
  shodan: {
    'host/search': { requestsPerHour: 100, requestsPerDay: 1000 }
  },
  virustotal: {
    'files/scan': { requestsPerHour: 200, requestsPerDay: 2000 }
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    const { 
      organizationId, 
      apiProvider, 
      apiEndpoint, 
      tokensRequested = 0 
    } = await req.json();

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get recent usage for this organization and API
    const { data: recentUsage, error: usageError } = await supabase
      .from('api_usage_tracking')
      .select('tokens_used, created_at')
      .eq('organization_id', organizationId)
      .eq('api_provider', apiProvider)
      .eq('api_endpoint', apiEndpoint)
      .gte('created_at', dayAgo.toISOString())
      .order('created_at', { ascending: false });

    if (usageError) {
      throw usageError;
    }

    // Get rate limit configuration
    const { data: rateLimitConfig } = await supabase
      .from('external_api_costs')
      .select('rate_limit_per_hour, rate_limit_per_day')
      .eq('api_provider', apiProvider)
      .ilike('endpoint_pattern', `%${apiEndpoint}%`)
      .single();

    // Use configured limits or defaults
    const defaultLimits = DEFAULT_RATE_LIMITS[apiProvider as keyof typeof DEFAULT_RATE_LIMITS]?.[apiEndpoint];
    const hourlyRequestLimit = rateLimitConfig?.rate_limit_per_hour || defaultLimits?.requestsPerHour || 1000;
    const dailyRequestLimit = rateLimitConfig?.rate_limit_per_day || defaultLimits?.requestsPerDay || 10000;
    const hourlyTokenLimit = defaultLimits?.tokensPerHour || 500000;
    const dailyTokenLimit = defaultLimits?.tokensPerDay || 5000000;

    // Calculate current usage
    const hourlyRequests = recentUsage?.filter(r => 
      new Date(r.created_at) > hourAgo
    ).length || 0;

    const dailyRequests = recentUsage?.length || 0;

    const hourlyTokens = recentUsage?.filter(r => 
      new Date(r.created_at) > hourAgo
    ).reduce((sum, r) => sum + (r.tokens_used || 0), 0) || 0;

    const dailyTokens = recentUsage?.reduce((sum, r) => sum + (r.tokens_used || 0), 0) || 0;

    // Check limits
    const rateLimitStatus = {
      allowed: true,
      reason: '',
      resetTime: null as Date | null,
      remainingRequests: 0,
      remainingTokens: 0,
      usage: {
        hourlyRequests,
        dailyRequests,
        hourlyTokens,
        dailyTokens
      },
      limits: {
        hourlyRequestLimit,
        dailyRequestLimit,
        hourlyTokenLimit,
        dailyTokenLimit
      }
    };

    // Check request limits
    if (hourlyRequests >= hourlyRequestLimit) {
      rateLimitStatus.allowed = false;
      rateLimitStatus.reason = `Hourly request limit exceeded (${hourlyRequestLimit}/hour)`;
      rateLimitStatus.resetTime = new Date(Math.ceil(now.getTime() / (60 * 60 * 1000)) * (60 * 60 * 1000));
    } else if (dailyRequests >= dailyRequestLimit) {
      rateLimitStatus.allowed = false;
      rateLimitStatus.reason = `Daily request limit exceeded (${dailyRequestLimit}/day)`;
      rateLimitStatus.resetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }

    // Check token limits
    if (rateLimitStatus.allowed && tokensRequested > 0) {
      if ((hourlyTokens + tokensRequested) > hourlyTokenLimit) {
        rateLimitStatus.allowed = false;
        rateLimitStatus.reason = `Hourly token limit exceeded (${hourlyTokenLimit}/hour)`;
        rateLimitStatus.resetTime = new Date(Math.ceil(now.getTime() / (60 * 60 * 1000)) * (60 * 60 * 1000));
      } else if ((dailyTokens + tokensRequested) > dailyTokenLimit) {
        rateLimitStatus.allowed = false;
        rateLimitStatus.reason = `Daily token limit exceeded (${dailyTokenLimit}/day)`;
        rateLimitStatus.resetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      }
    }

    if (rateLimitStatus.allowed) {
      rateLimitStatus.remainingRequests = Math.min(
        hourlyRequestLimit - hourlyRequests,
        dailyRequestLimit - dailyRequests
      );
      rateLimitStatus.remainingTokens = Math.min(
        hourlyTokenLimit - hourlyTokens,
        dailyTokenLimit - dailyTokens
      );
    } else {
      // Record rate limit hit
      await supabase
        .from('rate_limit_tracking')
        .insert({
          organization_id: organizationId,
          api_provider: apiProvider,
          api_endpoint: apiEndpoint,
          limit_type: rateLimitStatus.reason.includes('token') ? 'token_limit' : 'request_limit',
          hit_at: now.toISOString()
        });
    }

    return new Response(JSON.stringify(rateLimitStatus), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error checking rate limit:', error);
    return new Response(JSON.stringify({ 
      error: 'Rate limit check failed',
      message: 'Unable to verify rate limits. Please try again.',
      allowed: true // Fail open for rate limiting
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});