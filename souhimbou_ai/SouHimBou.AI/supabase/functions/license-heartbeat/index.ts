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
        const { license_key, machine_id } = await req.json();

        if (!license_key || !machine_id) {
            return new Response(
                JSON.stringify({ error: "license_key and machine_id are required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Update heartbeat timestamp
        const { data, error } = await supabase
            .from("licenses")
            .update({
                last_heartbeat: new Date().toISOString(),
                status: "active",
            })
            .eq("license_key", license_key)
            .eq("machine_id", machine_id)
            .select()
            .single();

        if (error || !data) {
            return new Response(
                JSON.stringify({ valid: false, error: "License not found or expired" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({
                valid: true,
                tier: data.tier || "community",
                features: data.features || ["basic_pqc"],
                expires_at: data.expires_at,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("License heartbeat error:", err);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
