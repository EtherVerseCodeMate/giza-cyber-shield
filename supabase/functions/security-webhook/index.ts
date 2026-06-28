import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Security validation for webhook payloads
class WebhookValidator {
  private static readonly MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB
  private static readonly ALLOWED_SOURCES = ['splunk', 'palo-alto', 'paloalto', 'crowdstrike', 'okta', 'aws-security', 'imohtep-test'];
  
  static validate(payload: any, headers: Headers): { isValid: boolean; errors: string[]; sanitized?: any } {
    const errors: string[] = [];
    
    // Check content length
    const contentLength = headers.get('content-length');
    if (contentLength && parseInt(contentLength) > this.MAX_PAYLOAD_SIZE) {
      errors.push('Payload too large');
      return { isValid: false, errors };
    }
    
    if (!payload || typeof payload !== 'object') {
      errors.push('Invalid payload format');
      return { isValid: false, errors };
    }

    const { source, event_type, timestamp, data, signature } = payload;

    // Validate required fields
    if (!source || typeof source !== 'string' || source.length > 100) {
      errors.push('Valid source is required (max 100 characters)');
    } else if (!this.ALLOWED_SOURCES.includes(source.toLowerCase())) {
      errors.push(`Source '${source}' is not allowed`);
    }

    if (!event_type || typeof event_type !== 'string' || event_type.length > 100) {
      errors.push('Valid event_type is required (max 100 characters)');
    }

    if (!timestamp || typeof timestamp !== 'string') {
      errors.push('Valid timestamp is required');
    } else if (!this.isValidTimestamp(timestamp)) {
      errors.push('Invalid timestamp format');
    }

    if (!data) {
      errors.push('Event data is required');
    }

    // Basic signature validation for production sources
    if (source !== 'imohtep-test' && !signature) {
      console.warn(`Missing signature for production source: ${source}`);
    }

    const sanitized = errors.length === 0 ? {
      source: this.sanitizeString(source),
      event_type: this.sanitizeString(event_type),
      timestamp,
      data: this.sanitizeObject(data),
      signature
    } : undefined;

    return { isValid: errors.length === 0, errors, sanitized };
  }

  private static isValidTimestamp(timestamp: string): boolean {
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && Math.abs(Date.now() - date.getTime()) < 24 * 60 * 60 * 1000; // Within 24 hours
  }

  private static sanitizeString(value: string): string {
    return value
      .replace(/[<>&"']/g, '')
      .replace(/\0/g, '')
      .trim()
      .slice(0, 100);
  }

  private static sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}

// Rate limiter for webhooks
const webhookRateLimiter = new Map<string, number[]>();
function checkWebhookRateLimit(source: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
  const now = Date.now();
  const requests = webhookRateLimiter.get(source) || [];
  const recentRequests = requests.filter(time => time > now - windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false;
  }
  
  recentRequests.push(now);
  webhookRateLimiter.set(source, recentRequests);
  return true;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};

// Enhanced webhook activity logging
async function logWebhookActivity(req: Request, source: string, validation: any, processingTimeMs: number) {
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  const userAgent = req.headers.get('user-agent');
  
  try {
    await supabase.from('webhook_activity').insert({
      source,
      source_ip: clientIP,
      endpoint: new URL(req.url).pathname,
      payload_hash: await generatePayloadHash(req.clone()),
      validation_result: validation,
      processing_time_ms: processingTimeMs,
      user_agent: userAgent
    });
  } catch (error) {
    console.error('Failed to log webhook activity:', error);
  }
}

async function generatePayloadHash(req: Request): Promise<string> {
  try {
    const text = await req.text();
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  } catch {
    return 'unknown';
  }
}

// Get source configuration and apply auto-tagging
async function getSourceConfig(sourceName: string) {
  try {
    const { data: sourceConfig } = await supabase
      .from('event_sources')
      .select('*')
      .eq('source_name', sourceName.toLowerCase())
      .single();
    
    return sourceConfig;
  } catch {
    return null;
  }
}

// Apply processing rules to events
async function applyProcessingRules(event: any) {
  try {
    const { data: rules } = await supabase
      .from('event_processing_rules')
      .select('*')
      .eq('enabled', true)
      .order('priority', { ascending: false });
    
    if (!rules) return event;
    
    for (const rule of rules) {
      const sourceMatches = !rule.source_pattern || new RegExp(rule.source_pattern, 'i').test(event.source_system);
      const eventMatches = !rule.event_type_pattern || new RegExp(rule.event_type_pattern, 'i').test(event.event_type);
      
      if (sourceMatches && eventMatches) {
        // Apply auto tags
        event.event_tags = { ...event.event_tags, ...rule.auto_tags };
        
        // Apply severity override
        if (rule.severity_override) {
          event.severity = rule.severity_override;
        }
        
        // Mark for auto resolution
        if (rule.auto_resolve) {
          event.resolved = true;
          event.resolved_at = new Date().toISOString();
        }
        
        // Add escalation flag
        if (rule.escalation_required) {
          event.details = {
            ...event.details,
            escalation_required: true,
            processing_rule: rule.rule_name
          };
        }
        
        console.log(`Applied processing rule: ${rule.rule_name}`);
        break; // Apply only the highest priority matching rule
      }
    }
    
    return event;
  } catch (error) {
    console.error('Error applying processing rules:', error);
    return event;
  }
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  const startTime = Date.now();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let source = 'unknown';
  let validation: any = null;

  try {
    console.log('Security webhook received');
    
    // Parse and validate the webhook payload
    const rawPayload = await req.json();
    validation = WebhookValidator.validate(rawPayload, req.headers);
    source = rawPayload?.source || 'unknown';
    
    if (!validation.isValid) {
      console.warn('Webhook validation failed:', validation.errors);
      await logWebhookActivity(req, source, validation, Date.now() - startTime);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid webhook payload',
          details: validation.errors 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { event_type, timestamp, data, signature } = validation.sanitized!;
    source = validation.sanitized!.source;

    // Get source configuration
    const sourceConfig = await getSourceConfig(source);
    
    // Check rate limit per source
    const maxRequests = sourceConfig?.rate_limit_per_minute || 100;
    if (!checkWebhookRateLimit(source, maxRequests)) {
      console.warn(`Rate limit exceeded for source: ${source}`);
      await logWebhookActivity(req, source, { ...validation, rate_limited: true }, Date.now() - startTime);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded for this source' 
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Processing webhook from ${source}: ${event_type}`);

    // Process the security event based on source
    let processedEvent = await processSecurityEvent(source, event_type, data, timestamp);
    
    // Apply source configuration and auto-tagging
    if (sourceConfig) {
      processedEvent.event_tags = { ...processedEvent.event_tags, ...sourceConfig.auto_tag_rules };
      processedEvent.source_metadata = {
        source_type: sourceConfig.source_type,
        trusted: sourceConfig.trusted,
        environment: sourceConfig.environment
      };
      
      // Update last activity for source
      await supabase
        .from('event_sources')
        .update({ last_activity: new Date().toISOString() })
        .eq('source_name', source);
    }
    
    // Apply processing rules
    processedEvent = await applyProcessingRules(processedEvent);
    
    // Add request metadata
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
    processedEvent.source_ip = clientIP;

    // Store the event in the security_events table
    const { error: insertError } = await supabase
      .from('security_events')
      .insert({
        event_type: processedEvent.event_type,
        severity: processedEvent.severity,
        source_system: source,
        details: processedEvent.details,
        event_tags: processedEvent.event_tags,
        source_ip: clientIP,
        source_metadata: processedEvent.source_metadata,
        resolved: processedEvent.resolved || false,
        resolved_at: processedEvent.resolved_at || null
      });

    if (insertError) {
      console.error('Failed to store security event:', insertError);
      throw insertError;
    }

    // Check if this event triggers any automated responses
    await checkAutomatedResponses(processedEvent);

    // Log successful webhook activity
    await logWebhookActivity(req, source, validation, Date.now() - startTime);

    console.log(`Security event processed successfully: ${processedEvent.event_type}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Security event processed',
      event_id: processedEvent.id,
      tags: processedEvent.event_tags
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in security-webhook function:', error);
    
    // Log failed webhook activity
    try {
      await logWebhookActivity(req, source, validation, Date.now() - startTime);
    } catch (logError) {
      console.error('Failed to log webhook activity:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function processSecurityEvent(source: string, eventType: string, data: any, timestamp: string) {
  const processedEvent = {
    id: `evt_${Date.now()}_${crypto.randomUUID().substring(0, 9)}`,
    event_type: eventType,
    severity: 'INFO' as 'INFO' | 'WARNING' | 'CRITICAL',
    source_system: source,
    details: data,
    timestamp,
    event_tags: {
      environment: 'unknown',
      type: 'unknown',
      real_or_test: 'unknown'
    },
    source_metadata: {}
  };

  // Determine severity based on event type and source
  switch (source.toLowerCase()) {
    case 'splunk':
      processedEvent.severity = processSplunkEvent(eventType, data);
      break;
    case 'palo-alto':
    case 'paloalto':
      processedEvent.severity = processPaloAltoEvent(eventType, data);
      break;
    case 'crowdstrike':
      processedEvent.severity = processCrowdStrikeEvent(eventType, data);
      break;
    case 'okta':
      processedEvent.severity = processOktaEvent(eventType, data);
      break;
    case 'aws-security':
      processedEvent.severity = processAWSEvent(eventType, data);
      break;
    default:
      processedEvent.severity = processGenericEvent(eventType, data);
  }

  // Enhance event with IMOHTEP analysis
  processedEvent.details = {
    ...processedEvent.details,
    imohtep_analysis: {
      risk_score: calculateRiskScore(processedEvent),
      correlation_id: generateCorrelationId(processedEvent),
      recommended_actions: getRecommendedActions(processedEvent),
      threat_category: categorizeThreat(processedEvent)
    }
  };

  return processedEvent;
}

function processSplunkEvent(eventType: string, data: any): 'INFO' | 'WARNING' | 'CRITICAL' {
  if (eventType.includes('CRITICAL') || eventType.includes('HIGH')) return 'CRITICAL';
  if (eventType.includes('MEDIUM') || eventType.includes('WARNING')) return 'WARNING';
  return 'INFO';
}

function processPaloAltoEvent(eventType: string, data: any): 'INFO' | 'WARNING' | 'CRITICAL' {
  if (eventType.includes('threat') || eventType.includes('malware')) return 'CRITICAL';
  if (eventType.includes('policy-violation') || eventType.includes('suspicious')) return 'WARNING';
  return 'INFO';
}

function processCrowdStrikeEvent(eventType: string, data: any): 'INFO' | 'WARNING' | 'CRITICAL' {
  if (eventType.includes('detection') || eventType.includes('incident')) return 'CRITICAL';
  if (eventType.includes('suspicious-activity')) return 'WARNING';
  return 'INFO';
}

function processOktaEvent(eventType: string, data: any): 'INFO' | 'WARNING' | 'CRITICAL' {
  if (eventType.includes('policy-violation') || eventType.includes('suspicious-login')) return 'WARNING';
  if (eventType.includes('security-alert')) return 'CRITICAL';
  return 'INFO';
}

function processAWSEvent(eventType: string, data: any): 'INFO' | 'WARNING' | 'CRITICAL' {
  if (data.severity === 'HIGH' || data.severity === 'CRITICAL') return 'CRITICAL';
  if (data.severity === 'MEDIUM') return 'WARNING';
  return 'INFO';
}

function processGenericEvent(eventType: string, data: any): 'INFO' | 'WARNING' | 'CRITICAL' {
  const criticalKeywords = ['attack', 'breach', 'malware', 'exploit', 'critical'];
  const warningKeywords = ['suspicious', 'anomaly', 'violation', 'warning'];
  
  const eventText = `${eventType} ${JSON.stringify(data)}`.toLowerCase();
  
  if (criticalKeywords.some(keyword => eventText.includes(keyword))) return 'CRITICAL';
  if (warningKeywords.some(keyword => eventText.includes(keyword))) return 'WARNING';
  return 'INFO';
}

function calculateRiskScore(event: any): number {
  let score = 0;
  
  // Base score by severity
  switch (event.severity) {
    case 'CRITICAL': score += 75; break;
    case 'WARNING': score += 45; break;
    case 'INFO': score += 15; break;
  }
  
  // Additional scoring based on event characteristics
  const eventText = `${event.event_type} ${JSON.stringify(event.details)}`.toLowerCase();
  
  if (eventText.includes('external')) score += 20;
  if (eventText.includes('admin') || eventText.includes('privileged')) score += 15;
  if (eventText.includes('multiple') || eventText.includes('repeated')) score += 10;
  if (eventText.includes('failed') && eventText.includes('login')) score += 25;
  
  return Math.min(score, 100);
}

function generateCorrelationId(event: any): string {
  // Generate a correlation ID based on event characteristics
  const hash = btoa(`${event.source_system}-${event.event_type}-${event.timestamp.slice(0, 10)}`);
  return `corr_${hash.slice(0, 8)}`;
}

function getRecommendedActions(event: any): string[] {
  const actions: string[] = [];
  
  switch (event.severity) {
    case 'CRITICAL':
      actions.push('Immediate investigation required');
      actions.push('Consider isolating affected systems');
      actions.push('Notify incident response team');
      break;
    case 'WARNING':
      actions.push('Review event details');
      actions.push('Monitor for related activities');
      actions.push('Update security policies if needed');
      break;
    case 'INFO':
      actions.push('Log for audit purposes');
      actions.push('Periodic review recommended');
      break;
  }
  
  // Add specific actions based on event type
  if (event.event_type.includes('login') || event.event_type.includes('auth')) {
    actions.push('Verify user identity');
    actions.push('Check for account compromise indicators');
  }
  
  if (event.event_type.includes('malware') || event.event_type.includes('threat')) {
    actions.push('Run full system scan');
    actions.push('Update threat intelligence');
  }
  
  return actions;
}

function categorizeThreat(event: any): string {
  const eventText = `${event.event_type} ${JSON.stringify(event.details)}`.toLowerCase();
  
  if (eventText.includes('malware') || eventText.includes('virus')) return 'MALWARE';
  if (eventText.includes('phishing') || eventText.includes('social')) return 'PHISHING';
  if (eventText.includes('insider') || eventText.includes('privilege')) return 'INSIDER_THREAT';
  if (eventText.includes('ddos') || eventText.includes('dos')) return 'DDOS';
  if (eventText.includes('data') && eventText.includes('exfil')) return 'DATA_EXFILTRATION';
  if (eventText.includes('auth') || eventText.includes('login')) return 'AUTHENTICATION';
  if (eventText.includes('network') || eventText.includes('traffic')) return 'NETWORK_INTRUSION';
  
  return 'OTHER';
}

async function checkAutomatedResponses(event: any) {
  console.log(`Checking automated responses for ${event.event_type}`);
  
  // In a real implementation, this would check configured automation rules
  // and trigger appropriate responses like:
  // - Blocking IP addresses
  // - Isolating compromised systems
  // - Sending notifications
  // - Creating tickets in ITSM systems
  
  if (event.severity === 'CRITICAL') {
    console.log('CRITICAL event detected - would trigger emergency response protocols');
    
    // Example automated responses:
    // await blockSuspiciousIP(event.details.source_ip);
    // await notifySOCTeam(event);
    // await createIncidentTicket(event);
  }
  
  console.log('Automated response check completed');
}