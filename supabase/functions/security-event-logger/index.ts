import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { event_type, severity, details } = await req.json()

    // Validate required fields
    if (!event_type || !severity) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: event_type, severity' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate severity levels
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    if (!validSeverities.includes(severity.toUpperCase())) {
      return new Response(
        JSON.stringify({ error: 'Invalid severity level' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get client IP from headers
    const clientIP = req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown'

    // Enhanced security event data
    const securityEventData = {
      event_type,
      severity: severity.toLowerCase(),
      source_system: 'web_application',
      details: {
        ...details,
        user_id: user.id,
        client_ip: clientIP,
        user_agent: req.headers.get('user-agent') || 'unknown',
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID()
      },
      source_ip: clientIP,
      resolved: false
    }

    // Insert security event
    const { data: eventData, error: eventError } = await supabaseClient
      .from('security_events')
      .insert(securityEventData)
      .select()
      .single()

    if (eventError) {
      console.error('Error inserting security event:', eventError)
      return new Response(
        JSON.stringify({ error: 'Failed to log security event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For critical events, create additional audit log entry
    if (severity.toUpperCase() === 'CRITICAL') {
      await supabaseClient
        .from('audit_logs')
        .insert({
          user_id: user.id,
          action: 'critical_security_event',
          resource_type: 'security',
          resource_id: eventData.id,
          details: {
            event_type,
            severity,
            event_details: details,
            auto_generated: true
          },
          ip_address: clientIP
        })
    }

    // Check for privilege escalation patterns
    if (event_type === 'privilege_escalation_pattern_detected') {
      // Lock user account if too many escalation attempts
      const recentAttempts = await supabaseClient
        .from('security_events')
        .select('id')
        .eq('details->>user_id', user.id)
        .eq('event_type', 'privilege_escalation_pattern_detected')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      if (recentAttempts.data && recentAttempts.data.length >= 3) {
        // Create account lock security event
        await supabaseClient
          .from('security_events')
          .insert({
            event_type: 'account_locked_security_violation',
            severity: 'critical',
            source_system: 'security_monitor',
            details: {
              user_id: user.id,
              reason: 'multiple_privilege_escalation_attempts',
              attempt_count: recentAttempts.data.length,
              lock_duration: '24_hours',
              auto_generated: true
            },
            source_ip: clientIP,
            resolved: false
          })
      }
    }

    // Enhanced response with risk assessment
    const riskScore = calculateRiskScore(severity, event_type, details)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        event_id: eventData.id,
        risk_score: riskScore,
        recommendations: getSecurityRecommendations(severity, event_type)
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Security event logger error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Failed to log security event',
        message: 'Unable to record security event. Please try again.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function calculateRiskScore(severity: string, eventType: string, details: any): number {
  let baseScore = 0

  // Base score from severity
  switch (severity.toUpperCase()) {
    case 'CRITICAL': baseScore = 80; break
    case 'HIGH': baseScore = 60; break
    case 'MEDIUM': baseScore = 40; break
    case 'LOW': baseScore = 20; break
    default: baseScore = 10
  }

  // Adjust based on event type
  const riskMultipliers: Record<string, number> = {
    'privilege_escalation_pattern_detected': 1.5,
    'multiple_failed_logins': 1.3,
    'suspicious_login_pattern': 1.2,
    'unauthorized_access_attempt': 1.4,
    'data_exfiltration_detected': 1.8,
    'malware_detected': 1.6
  }

  const multiplier = riskMultipliers[eventType] || 1.0
  return Math.min(100, Math.round(baseScore * multiplier))
}

function getSecurityRecommendations(severity: string, eventType: string): string[] {
  const recommendations: string[] = []

  if (severity.toUpperCase() === 'CRITICAL') {
    recommendations.push('Immediate investigation required')
    recommendations.push('Consider temporary account lockdown')
    recommendations.push('Review access logs for anomalies')
  }

  switch (eventType) {
    case 'privilege_escalation_pattern_detected':
      recommendations.push('Review user role assignments')
      recommendations.push('Implement additional MFA requirements')
      break
    case 'multiple_failed_logins':
      recommendations.push('Enable account lockout policies')
      recommendations.push('Implement CAPTCHA for repeated failures')
      break
    case 'suspicious_login_pattern':
      recommendations.push('Verify login locations and devices')
      recommendations.push('Consider IP-based restrictions')
      break
  }

  return recommendations
}