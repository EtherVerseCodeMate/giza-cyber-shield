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
        const { license_key, machine_id, product } = await req.json();

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

        // Register or validate license
        const { data, error } = await supabase
            .from("licenses")
            .upsert({
                license_key,
                machine_id,
                product: product || "khepra-protocol",
                registered_at: new Date().toISOString(),
                status: "active",
            }, { onConflict: "license_key,machine_id" })
            .select()
            .single();

        if (error) {
            console.error("License registration error:", error);
            return new Response(
                JSON.stringify({ error: "Failed to register license" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ registered: true, license: data }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("License register error:", err);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
