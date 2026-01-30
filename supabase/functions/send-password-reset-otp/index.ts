import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Autosend email service - https://docs.autosend.com/quickstart/email-using-api
async function sendEmailWithAutosend(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = Deno.env.get('AUTOSEND_API_KEY');
  if (!apiKey) {
    return { success: false, error: 'AUTOSEND_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://api.autosend.com/v1/mails/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: {
          email: 'support@souhimbou.ai',
          name: 'SouHimBou AI Security'
        },
        to: {
          email: to,
          name: to.split('@')[0]
        },
        subject: subject,
        html: html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Autosend error:', errorData);
      return { success: false, error: `Autosend returned ${response.status}: ${errorData}` };
    }

    return { success: true };
  } catch (err) {
    console.error('Autosend fetch error:', err);
    return { success: false, error: err.message };
  }
}

interface PasswordResetRequest {
  email: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Password reset OTP request received');
    
    const { email }: PasswordResetRequest = await req.json();
    
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
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

    // Look up user by email using auth admin API
    console.log('Looking up user by email:', email);
    const { data: userList, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      console.error('Error listing users:', userError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const userData = userList.users.find(user => user.email === email);

    if (!userData) {
      console.log('User not found for email:', email);
      // Return success even if user doesn't exist to prevent email enumeration
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If this email exists, an OTP has been sent'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('User found:', userData.id);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database
    const { error: otpError } = await supabase
      .from('password_reset_otps')
      .upsert({
        user_id: userData.id,
        email: email,
        otp_code: otp,
        expires_at: expiresAt.toISOString(),
        used: false,
        created_at: new Date().toISOString()
      });

    if (otpError) {
      console.error('Error storing OTP:', otpError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate reset code' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Send OTP via email using Autosend
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">SouHimBou AI</h1>
          <p style="color: #6b7280; margin: 5px 0;">Secure Password Reset</p>
        </div>

        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb;">
          <h2 style="color: #1f2937; margin-top: 0;">Password Reset Verification</h2>
          <p style="color: #4b5563;">You requested a password reset for your SouHimBou AI account.</p>

          <div style="text-align: center; margin: 30px 0;">
            <div style="background: white; padding: 20px; border-radius: 8px; border: 2px dashed #2563eb; display: inline-block;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Your verification code:</p>
              <h1 style="margin: 10px 0; color: #2563eb; font-size: 36px; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</h1>
            </div>
          </div>

          <p style="color: #ef4444; font-weight: bold;">⚠️ This code expires in 10 minutes</p>
          <p style="color: #4b5563; font-size: 14px;">Enter this code in the SouHimBou AI platform to reset your password securely.</p>
        </div>

        <div style="margin-top: 30px; padding: 20px; background: #fef2f2; border-radius: 8px;">
          <h3 style="color: #dc2626; margin-top: 0;">Security Notice</h3>
          <ul style="color: #7f1d1d; margin: 0; padding-left: 20px;">
            <li>Never share this code with anyone</li>
            <li>SouHimBou AI will never ask for this code via phone or email</li>
            <li>If you didn't request this reset, ignore this email</li>
            <li>This code can only be used once</li>
          </ul>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 12px;">
            SouHimBou AI Security Team<br>
            This is an automated security notification
          </p>
        </div>
      </div>
    `;

    const emailResponse = await sendEmailWithAutosend(
      email,
      'Password Reset Verification Code',
      emailHtml
    );

    if (!emailResponse.success) {
      console.error('Error sending email:', emailResponse.error);
      return new Response(
        JSON.stringify({ error: 'Failed to send verification code' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Log security event (non-blocking, don't fail if audit_logs doesn't exist)
    supabase.from('audit_logs').insert({
      user_id: userData.id,
      action: 'password_reset_otp_sent',
      resource_type: 'authentication',
      details: {
        email: email,
        otp_expires_at: expiresAt.toISOString(),
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      }
    }).then(() => console.log('Audit log created'))
      .catch(err => console.warn('Audit log failed (non-critical):', err));

    console.log('Password reset OTP sent successfully to:', email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Verification code sent to your email',
        expires_in: 600 // 10 minutes in seconds
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Password reset OTP error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});