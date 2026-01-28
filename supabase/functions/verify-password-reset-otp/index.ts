import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VerifyOTPRequest {
  email: string;
  otp: string;
  newPassword: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Password reset OTP verification request received');
    
    const requestBody = await req.json();
    const { email, otp, newPassword }: VerifyOTPRequest = requestBody;
    
    // Enhanced input validation
    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    if (!otp || typeof otp !== 'string' || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return new Response(
        JSON.stringify({ error: 'Valid 6-digit OTP is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters long' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    if (!email || !otp || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Email, OTP, and new password are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify OTP
    const { data: otpData, error: otpError } = await supabase
      .from('password_reset_otps')
      .select('*')
      .eq('email', email)
      .eq('otp_code', otp)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpData) {
      console.log('Invalid or expired OTP for email:', email);
      
      // Log failed attempt
      await supabase.from('audit_logs').insert({
        action: 'password_reset_otp_verification_failed',
        resource_type: 'authentication',
        details: {
          email: email,
          reason: 'invalid_or_expired_otp',
          ip_address: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown'
        }
      });

      return new Response(
        JSON.stringify({ error: 'Invalid or expired verification code' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Mark OTP as used
    const { error: updateError } = await supabase
      .from('password_reset_otps')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('id', otpData.id);

    if (updateError) {
      console.error('Error marking OTP as used:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to process verification' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Update user password
    const { data: updateUserData, error: passwordError } = await supabase.auth.admin.updateUserById(
      otpData.user_id,
      { 
        password: newPassword,
        email_confirmed_at: new Date().toISOString() // Ensure email is confirmed
      }
    );

    if (passwordError) {
      console.error('Error updating password:', passwordError);
      
      // Handle specific password policy errors
      if (passwordError.message?.includes('Password should be at least')) {
        return new Response(
          JSON.stringify({ error: 'Password must be at least 20 characters long' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to update password. Please ensure your password meets security requirements.' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Log successful password reset
    await supabase.from('audit_logs').insert({
      user_id: otpData.user_id,
      action: 'password_reset_completed',
      resource_type: 'authentication',
      details: {
        email: email,
        reset_method: 'otp_verification',
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      }
    });

    // Clean up old/used OTPs for this user
    await supabase
      .from('password_reset_otps')
      .delete()
      .eq('user_id', otpData.user_id)
      .neq('id', otpData.id);

    console.log('Password reset completed successfully for user:', otpData.user_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password reset successfully. You can now log in with your new password.' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Password reset verification error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});