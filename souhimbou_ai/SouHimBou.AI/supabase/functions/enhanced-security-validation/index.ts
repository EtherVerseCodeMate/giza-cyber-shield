import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get the authorization header
    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authorization.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { action, data } = await req.json()

    switch (action) {
      case 'validate_password_strength': {
        const { password } = data
        if (!password || typeof password !== 'string') {
          return new Response(
            JSON.stringify({ error: 'Password is required' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        // Password strength validation logic
        let score = 0
        const feedback = []
        const minLength = 12

        // Length check
        if (password.length < minLength) {
          feedback.push(`Password must be at least ${minLength} characters`)
        } else {
          score += 25
        }

        // Character variety checks
        if (/[A-Z]/.test(password)) {
          score += 15
        } else {
          feedback.push('Add uppercase letters')
        }

        if (/[a-z]/.test(password)) {
          score += 15
        } else {
          feedback.push('Add lowercase letters')
        }

        if (/[0-9]/.test(password)) {
          score += 15
        } else {
          feedback.push('Add numbers')
        }

        if (/[^A-Za-z0-9]/.test(password)) {
          score += 20
        } else {
          feedback.push('Add special characters')
        }

        // Common pattern checks
        const commonPatterns = ['password', '123456', 'qwerty', 'admin', 'letmein']
        for (const pattern of commonPatterns) {
          if (password.toLowerCase().includes(pattern)) {
            score -= 30
            feedback.push('Avoid common passwords and patterns')
            break
          }
        }

        // Length bonus
        if (password.length > 16) {
          score += 10
        }

        const finalScore = Math.max(0, Math.min(100, score))

        return new Response(
          JSON.stringify({
            score: finalScore,
            is_strong: finalScore >= 80,
            feedback: feedback
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      case 'check_security_compliance': {
        // Get user role for authorization
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, master_admin')
          .eq('user_id', user.id)
          .single()

        if (!profile || (!profile.master_admin && !['admin', 'compliance_officer'].includes(profile.role))) {
          return new Response(
            JSON.stringify({ error: 'Insufficient privileges for compliance check' }),
            { 
              status: 403, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        // Call the compliance check function
        const { data: complianceResult, error: complianceError } = await supabase
          .rpc('check_security_policy_compliance')

        if (complianceError) {
          console.error('Compliance check error:', complianceError)
          return new Response(
            JSON.stringify({ error: 'Failed to run compliance check' }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        return new Response(
          JSON.stringify(complianceResult),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      case 'correlate_security_alerts': {
        // Get user role for authorization
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, master_admin')
          .eq('user_id', user.id)
          .single()

        if (!profile || (!profile.master_admin && !['admin'].includes(profile.role))) {
          return new Response(
            JSON.stringify({ error: 'Insufficient privileges for alert correlation' }),
            { 
              status: 403, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        // Call the alert correlation function
        const { error: correlationError } = await supabase
          .rpc('correlate_security_alerts')

        if (correlationError) {
          console.error('Alert correlation error:', correlationError)
          return new Response(
            JSON.stringify({ error: 'Failed to correlate alerts' }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Alert correlation completed' }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      case 'generate_security_report': {
        // Get user role for authorization
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, master_admin')
          .eq('user_id', user.id)
          .single()

        if (!profile || (!profile.master_admin && !['admin', 'compliance_officer'].includes(profile.role))) {
          return new Response(
            JSON.stringify({ error: 'Insufficient privileges for security reporting' }),
            { 
              status: 403, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        // Generate comprehensive security report
        const report = {
          generated_at: new Date().toISOString(),
          generated_by: user.id,
          sections: {
            authentication_security: {
              mfa_enabled_users: 0,
              total_users: 0,
              recent_failed_logins: 0,
              locked_accounts: 0
            },
            device_security: {
              trusted_devices: 0,
              suspicious_device_activity: 0,
              device_verification_pending: 0
            },
            session_security: {
              active_sessions: 0,
              high_risk_sessions: 0,
              session_security_events: 0
            }
          },
          recommendations: [],
          risk_score: 0
        }

        // Get authentication metrics
        const { data: authMetrics } = await supabase
          .from('profiles')
          .select('mfa_enabled')

        if (authMetrics) {
          report.sections.authentication_security.total_users = authMetrics.length
          report.sections.authentication_security.mfa_enabled_users = 
            authMetrics.filter(u => u.mfa_enabled).length
        }

        // Calculate MFA adoption rate and add recommendations
        const mfaRate = report.sections.authentication_security.total_users > 0 
          ? (report.sections.authentication_security.mfa_enabled_users / report.sections.authentication_security.total_users) * 100
          : 0

        if (mfaRate < 70) {
          report.recommendations.push({
            category: 'Authentication',
            severity: 'HIGH',
            description: 'Increase MFA adoption across the organization',
            action: 'Enforce MFA for all users or provide training on MFA setup'
          })
        }

        // Calculate overall risk score
        report.risk_score = Math.max(0, 100 - (mfaRate * 0.6) - 
          (report.sections.authentication_security.locked_accounts * 10))

        return new Response(
          JSON.stringify(report),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})