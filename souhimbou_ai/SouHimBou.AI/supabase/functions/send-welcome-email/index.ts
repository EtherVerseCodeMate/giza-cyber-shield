import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.16";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  userId: string;
  email: string;
  fullName?: string;
  organizationName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, fullName, organizationName }: WelcomeEmailRequest = await req.json();

    if (!userId || !email) {
      throw new Error("Missing required parameters: userId and email");
    }

    // Create Supabase client for server-side operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user profile data
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    const displayName = fullName || profile?.full_name || 'User';
    const userRole = profile?.role || 'viewer';
    const securityClearance = profile?.security_clearance || 'UNCLASSIFIED';

    const transporter = nodemailer.createTransport({
      host: Deno.env.get('SMTP_HOST') || 'smtp.autosend.com',
      port: Number.parseInt(Deno.env.get('SMTP_PORT') || '587'),
      secure: false,
      auth: {
        user: Deno.env.get('SMTP_USER') || 'autosend',
        pass: Deno.env.get('SMTP_PASS'),
      },
    });

    const emailResponse = await transporter.sendMail({
      from: `SouHimBou AI <${Deno.env.get('SMTP_FROM') || 'support@souhimbou.ai'}>`,
      to: email,
      subject: "Welcome to SouHimBou AI - Your Defense Intelligence Platform",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to SouHimBou AI</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f8fafc; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
            .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
            .content { padding: 40px 30px; }
            .welcome-badge { display: inline-block; background-color: #ef4444; color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; }
            .security-info { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px; }
            .user-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .user-details h3 { margin-top: 0; color: #1e40af; }
            .detail-row { display: flex; justify-content: space-between; margin: 8px 0; }
            .detail-label { font-weight: 600; color: #64748b; }
            .detail-value { color: #1e293b; }
            .cta-button { display: inline-block; background-color: #1e40af; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .features { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0; }
            .feature { text-align: center; padding: 20px; background-color: #f8fafc; border-radius: 8px; }
            .feature-icon { font-size: 24px; margin-bottom: 10px; }
            .footer { background-color: #1e293b; color: #94a3b8; padding: 30px; text-align: center; font-size: 14px; }
            .footer a { color: #60a5fa; text-decoration: none; }
            @media (max-width: 600px) {
              .features { grid-template-columns: 1fr; }
              .container { margin: 0; border-radius: 0; }
              .content { padding: 30px 20px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🛡️ SouHimBou AI</h1>
              <p>Defense Intelligence & Threat Analysis Platform</p>
            </div>
            
            <div class="content">
              <div class="welcome-badge">🔒 DoD CLASSIFIED ACCESS</div>
              
              <h2>Welcome, ${displayName}!</h2>
              
              <p>Your access to the SouHimBou AI defense intelligence platform has been successfully provisioned. This secure environment provides advanced threat analysis, real-time monitoring, and comprehensive security oversight capabilities.</p>
              
              <div class="user-details">
                <h3>📋 Access Profile</h3>
                <div class="detail-row">
                  <span class="detail-label">Email:</span>
                  <span class="detail-value">${email}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Role:</span>
                  <span class="detail-value">${userRole.toUpperCase()}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Security Clearance:</span>
                  <span class="detail-value">${securityClearance}</span>
                </div>
                ${organizationName ? `
                <div class="detail-row">
                  <span class="detail-label">Organization:</span>
                  <span class="detail-value">${organizationName}</span>
                </div>
                ` : ''}
              </div>
              
              <div class="security-info">
                <strong>🔐 Security Reminder:</strong> This platform contains classified information. Ensure you're accessing from a secure, authorized network and follow all security protocols.
              </div>
              
              <div style="text-align: center;">
                <a href="${Deno.env.get("SUPABASE_URL")?.replace('supabase.co', 'lovableproject.com')}" class="cta-button">
                  Access SouHimBou AI Platform
                </a>
              </div>
              
              <div class="features">
                <div class="feature">
                  <div class="feature-icon">🎯</div>
                  <h4>Threat Intelligence</h4>
                  <p>Real-time threat analysis and monitoring</p>
                </div>
                <div class="feature">
                  <div class="feature-icon">🤖</div>
                  <h4>AI Analysis</h4>
                  <p>Advanced AI-powered security insights</p>
                </div>
                <div class="feature">
                  <div class="feature-icon">📊</div>
                  <h4>Live Dashboards</h4>
                  <p>Comprehensive operational visibility</p>
                </div>
                <div class="feature">
                  <div class="feature-icon">🔒</div>
                  <h4>Secure Operations</h4>
                  <p>DoD-compliant security standards</p>
                </div>
              </div>
              
              <h3>🚀 Next Steps</h3>
              <ol>
                <li><strong>Complete your profile</strong> - Update your department and contact information</li>
                <li><strong>Enable MFA</strong> - Set up multi-factor authentication for enhanced security</li>
                <li><strong>Review dashboards</strong> - Familiarize yourself with the available modules</li>
                <li><strong>Contact support</strong> - Reach out if you need assistance or additional access</li>
              </ol>
              
              <div class="security-info">
                <strong>⚠️ Important:</strong> If you did not request this access or believe this email was sent in error, please contact your security administrator immediately.
              </div>
            </div>
            
            <div class="footer">
              <p><strong>SouHimBou AI Defense Platform</strong></p>
              <p>This email contains sensitive information. Handle according to your organization's security policies.</p>
              <p>Need help? Contact your system administrator or <a href="mailto:support@souhimbou.ai">technical support</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    // Log the email action
    await supabaseClient
      .from('audit_logs')
      .insert([{
        user_id: userId,
        action: 'welcome_email_sent',
        resource_type: 'email',
        details: {
          email,
          template: 'welcome',
          timestamp: new Date().toISOString()
        }
      }]);

    console.log("Welcome email sent successfully:", emailResponse.messageId);

    return new Response(JSON.stringify({
      success: true,
      messageId: emailResponse.messageId
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);