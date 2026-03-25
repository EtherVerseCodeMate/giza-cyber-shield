import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Verify JWT — this function requires authenticated users
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Authorization required" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: "Invalid or expired token" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const body = await req.json();
        const { action, agent_id, payload } = body;

        if (!action) {
            return new Response(
                JSON.stringify({ error: "action is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Use service role for database operations
        const adminClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        let result;

        switch (action) {
            case "register": {
                const { data, error } = await adminClient
                    .from("mcp_agents")
                    .upsert({
                        agent_id: agent_id || crypto.randomUUID(),
                        user_id: user.id,
                        status: "registered",
                        capabilities: payload?.capabilities || [],
                        registered_at: new Date().toISOString(),
                    })
                    .select()
                    .single();
                result = { registered: !error, agent: data };
                break;
            }

            case "heartbeat": {
                const { data, error } = await adminClient
                    .from("mcp_agents")
                    .update({
                        last_seen: new Date().toISOString(),
                        status: "active",
                    })
                    .eq("agent_id", agent_id)
                    .eq("user_id", user.id)
                    .select()
                    .single();
                result = { alive: !error, agent: data };
                break;
            }

            case "execute": {
                // Log the execution request
                await adminClient.from("mcp_agent_logs").insert({
                    agent_id,
                    user_id: user.id,
                    action: payload?.command || "unknown",
                    timestamp: new Date().toISOString(),
                });
                result = { queued: true, message: "Command queued for agent execution" };
                break;
            }

            default:
                result = { error: `Unknown action: ${action}` };
        }

        return new Response(
            JSON.stringify(result),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("MCP agent bridge error:", err);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
