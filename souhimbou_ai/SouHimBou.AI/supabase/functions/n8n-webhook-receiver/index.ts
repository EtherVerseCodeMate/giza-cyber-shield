import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

async function verifyHmac(secret: string, body: string, signature: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const hex = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return hex === signature;
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const signature = req.headers.get("x-webhook-signature");
        const webhookSecret = Deno.env.get("KHEPRA_WEBHOOK_SECRET");

        const body = await req.text();

        if (webhookSecret && signature) {
            const valid = await verifyHmac(webhookSecret, body, signature);
            if (!valid) {
                return new Response(
                    JSON.stringify({ error: "Invalid webhook signature" }),
                    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        const payload = JSON.parse(body);
        const { event, data, workflow_id } = payload;

        if (!event) {
            return new Response(
                JSON.stringify({ error: "event is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { error } = await supabase.from("webhook_events").insert({
            source: "n8n",
            event_type: event,
            workflow_id: workflow_id || null,
            payload: data || {},
            received_at: new Date().toISOString(),
        });

        if (error) {
            console.error("Failed to log webhook event:", error);
        }

        return new Response(
            JSON.stringify({ received: true, event }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("n8n webhook error:", err);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
