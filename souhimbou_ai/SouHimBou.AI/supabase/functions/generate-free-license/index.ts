import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@3.1.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { email } = await req.json();

        if (!email) {
            return new Response(
                JSON.stringify({ error: "email is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? '';
        const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '';
        const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? '';

        if (!resendApiKey) {
            console.error("Missing RESEND_API_KEY");
            return new Response(
                JSON.stringify({ error: "Email service configuration error" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
        const resend = new Resend(resendApiKey);

        // Generate a random 16-character alphanumeric key
        const uuid = crypto.randomUUID().replace(/-/g, '').substring(0, 16).toUpperCase();
        const license_key = `FREE-${uuid}`;

        // 1. Save to database
        const { data, error } = await supabase
            .from("licenses")
            .upsert({
                email,
                license_key,
                tier: "community",
                status: "active",
                product: "khepra-protocol",
                registered_at: new Date().toISOString()
            }, { onConflict: "email" }) // Assuming one free license per email
            .select()
            .single();

        if (error) {
            console.error("License registration error:", error);
            // If the table doesn't have an email column yet, this will fail.
            // Ensure you run a migration to add `email` and `tier` if they don't exist.
            return new Response(
                JSON.stringify({ error: "Failed to provision license in vault" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const assignedKey = data.license_key || license_key;

        // 2. Send email via Resend
        const emailResponse = await resend.emails.send({
            from: 'KHEPRA Protocol <support@nouchix.com>', // Update with your verified Resend domain
            to: email,
            subject: 'Your KHEPRA Community License Key',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome to the Cryptographic Governance Layer</h2>
                    <p>Your KHEPRA Community License Key is ready. Keep this secure, as it is required to run the open-source compliance engine.</p>
                    
                    <div style="background-color: #f4f4f5; padding: 16px; border-radius: 8px; margin: 24px 0; font-family: monospace; font-size: 18px; text-align: center; letter-spacing: 2px;">
                        <strong>${assignedKey}</strong>
                    </div>

                    <h3>Quickstart (Zero Install)</h3>
                    <p>To connect your AI assistant (Claude, Cursor, etc.) to the sovereign engine, point your MCP client to our hosted endpoint:</p>
                    <pre style="background-color: #18181b; color: #a1a1aa; padding: 12px; border-radius: 6px; overflow-x: auto;">
{
  "mcpServers": {
    "khepra": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.souhimbou.ai/sse"]
    }
  }
}
                    </pre>

                    <p>For Docker and Air-Gap deployment instructions, please view our <a href="https://github.com/nouchix/PQC-Khepra-MCP">Documentation</a>.</p>
                    
                    <hr style="border: 1px solid #e4e4e7; margin: 32px 0;" />
                    <p style="color: #71717a; font-size: 12px;">SecRed Knowledge Inc. dba NouchiX, Albany, NY</p>
                </div>
            `
        });

        if (emailResponse.error) {
            console.error("Resend error:", emailResponse.error);
            return new Response(
                JSON.stringify({ error: "License created but failed to send email." }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Return success (do not return the key directly in the HTTP response to enforce email validity)
        return new Response(
            JSON.stringify({ 
                success: true, 
                message: "License generated and emailed successfully."
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("Edge function error:", err);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
