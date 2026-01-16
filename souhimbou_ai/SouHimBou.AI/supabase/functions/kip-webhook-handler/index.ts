import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, khepra-cultural-fingerprint, khepra-platform-id',
};

interface KIPWebhookPayload {
  event_type: 'cultural_transformation' | 'security_event' | 'audit_log' | 'trust_score_update';
  timestamp: string;
  platform_id: string;
  cultural_context: string;
  data: Record<string, any>;
  signature?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: KIPWebhookPayload = await req.json();
    const culturalFingerprint = req.headers.get('khepra-cultural-fingerprint');
    const platformId = req.headers.get('khepra-platform-id') || payload.platform_id;

    console.log('KIP Webhook received:', {
      event_type: payload.event_type,
      platform_id: platformId,
      cultural_context: payload.cultural_context,
      timestamp: payload.timestamp
    });

    // Validate platform ID matches SouHimBou AI platform
    if (platformId !== 'souhimbou-ai') {
      console.warn('Invalid platform ID:', platformId);
      return new Response('Unauthorized platform', { 
        status: 403, 
        headers: corsHeaders 
      });
    }

    // Process different event types
    switch (payload.event_type) {
      case 'cultural_transformation':
        await handleCulturalTransformation(supabase, payload, culturalFingerprint);
        break;
      
      case 'security_event':
        await handleSecurityEvent(supabase, payload, culturalFingerprint);
        break;
      
      case 'audit_log':
        await handleAuditLog(supabase, payload, culturalFingerprint);
        break;
      
      case 'trust_score_update':
        await handleTrustScoreUpdate(supabase, payload, culturalFingerprint);
        break;
      
      default:
        console.warn('Unknown event type:', payload.event_type);
        return new Response('Unknown event type', { 
          status: 400, 
          headers: corsHeaders 
        });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed_at: new Date().toISOString(),
      event_type: payload.event_type
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('KIP webhook processing error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal processing error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function handleCulturalTransformation(
  supabase: any, 
  payload: KIPWebhookPayload, 
  culturalFingerprint: string | null
) {
  console.log('Processing cultural transformation:', payload.data);
  
  // Store cultural transformation data
  const { error } = await supabase.from('ai_agent_chats').insert({
    message_type: 'cultural_transformation',
    message: `KIP Cultural Transformation: ${payload.data.symbol}`,
    response: JSON.stringify(payload.data),
    context: {
      cultural_fingerprint: culturalFingerprint,
      platform_id: payload.platform_id,
      transformation_type: payload.data.transformation_type,
      symbol: payload.data.symbol
    },
    metadata: {
      source: 'kip_webhook',
      event_type: payload.event_type,
      timestamp: payload.timestamp
    },
    user_id: payload.data.user_id || '00000000-0000-0000-0000-000000000000',
    organization_id: payload.data.organization_id || '00000000-0000-0000-0000-000000000000'
  });

  if (error) {
    console.error('Error storing cultural transformation:', error);
    throw error;
  }
}

async function handleSecurityEvent(
  supabase: any, 
  payload: KIPWebhookPayload, 
  culturalFingerprint: string | null
) {
  console.log('Processing security event:', payload.data);

  // Create security alert
  const { error } = await supabase.from('alerts').insert({
    title: `KIP Security Event: ${payload.data.event_name}`,
    description: payload.data.description || 'Security event from KIP platform',
    severity: payload.data.severity || 'MEDIUM',
    alert_type: 'kip_security',
    source_type: 'cultural_ai',
    source_id: payload.platform_id,
    status: 'OPEN',
    metadata: {
      cultural_fingerprint: culturalFingerprint,
      platform_id: payload.platform_id,
      kip_event_data: payload.data,
      timestamp: payload.timestamp
    },
    organization_id: payload.data.organization_id || '00000000-0000-0000-0000-000000000000'
  });

  if (error) {
    console.error('Error creating security alert:', error);
    throw error;
  }
}

async function handleAuditLog(
  supabase: any, 
  payload: KIPWebhookPayload, 
  culturalFingerprint: string | null
) {
  console.log('Processing audit log:', payload.data);

  // Create audit log entry
  const { error } = await supabase.from('audit_logs').insert({
    action: `kip_${payload.data.action}`,
    resource_type: 'cultural_ai',
    resource_id: payload.platform_id,
    details: {
      cultural_fingerprint: culturalFingerprint,
      platform_id: payload.platform_id,
      kip_data: payload.data,
      timestamp: payload.timestamp
    },
    user_id: payload.data.user_id || null,
    ip_address: payload.data.source_ip || null
  });

  if (error) {
    console.error('Error creating audit log:', error);
    throw error;
  }
}

async function handleTrustScoreUpdate(
  supabase: any, 
  payload: KIPWebhookPayload, 
  culturalFingerprint: string | null
) {
  console.log('Processing trust score update:', payload.data);

  // Store behavioral analytics for trust score
  const { error } = await supabase.from('behavioral_analytics').insert({
    entity_type: 'cultural_ai_agent',
    entity_identifier: culturalFingerprint || payload.platform_id,
    behavior_type: 'trust_score_update',
    current_metrics: {
      trust_score: payload.data.new_score,
      previous_score: payload.data.previous_score,
      change_reason: payload.data.reason
    },
    baseline_metrics: {
      baseline_score: payload.data.baseline_score || 75
    },
    analysis_period_start: new Date(payload.timestamp),
    analysis_period_end: new Date(),
    anomaly_score: Math.abs((payload.data.new_score || 75) - (payload.data.previous_score || 75)),
    risk_level: payload.data.new_score < 50 ? 'high' : payload.data.new_score < 75 ? 'medium' : 'low',
    organization_id: payload.data.organization_id || '00000000-0000-0000-0000-000000000000'
  });

  if (error) {
    console.error('Error storing trust score update:', error);
    throw error;
  }
}