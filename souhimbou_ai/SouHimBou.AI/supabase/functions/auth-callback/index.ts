import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
  type: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Auth callback handler started');
    
    const url = new URL(req.url);
    const fragments = url.searchParams;
    
    // Extract auth tokens from URL parameters (these come from hash fragments)
    const access_token = fragments.get('access_token');
    const refresh_token = fragments.get('refresh_token');
    const expires_at = fragments.get('expires_at');
    const expires_in = fragments.get('expires_in');
    const token_type = fragments.get('token_type');
    const type = fragments.get('type');

    console.log('Received auth callback with type:', type);

    if (!access_token || !refresh_token) {
      console.error('Missing required tokens in callback');
      return new Response(
        JSON.stringify({ 
          error: 'Missing authentication tokens',
          redirect_url: '/auth?error=invalid_callback'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Set the session using the extracted tokens
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token
    });

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create session',
          redirect_url: '/auth?error=session_failed'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Session created successfully for user:', sessionData.user?.id);

    // Log security event for audit trail
    if (sessionData.user) {
      try {
        await supabase.from('audit_logs').insert({
          user_id: sessionData.user.id,
          action: 'secure_auth_callback_processed',
          resource_type: 'authentication',
          details: {
            callback_type: type,
            timestamp: new Date().toISOString(),
            user_agent: req.headers.get('user-agent'),
            ip_address: req.headers.get('x-forwarded-for') || 'unknown',
            security_enhancement: 'tokens_secured_via_callback_handler'
          }
        });
      } catch (auditError) {
        console.warn('Failed to log audit event:', auditError);
        // Don't fail the auth flow for audit logging issues
      }
    }

    // Determine redirect URL based on callback type
    let redirectUrl = '/dashboard';
    
    if (type === 'recovery') {
      // For password recovery, redirect to password reset page
      redirectUrl = '/auth?mode=reset&success=true';
    } else if (type === 'signup') {
      // For email confirmation, redirect to login with success message
      redirectUrl = '/auth?mode=login&confirmed=true';
    } else if (type === 'invite') {
      // For invitations, redirect to registration completion
      redirectUrl = '/auth?mode=register&invited=true';
    }

    console.log('Redirecting to:', redirectUrl);

    // Return secure response with clean redirect URL
    return new Response(
      JSON.stringify({ 
        success: true,
        redirect_url: redirectUrl,
        message: 'Authentication processed securely'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Auth callback handler error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Authentication failed',
        message: 'Unable to complete authentication. Please try again.',
        redirect_url: '/auth?error=callback_failed'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});