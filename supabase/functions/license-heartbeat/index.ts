// Supabase Edge Function: License Heartbeat
// Purpose: Update last-seen timestamp for registered nodes

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HeartbeatRequest {
  license_id: string;
  host_id: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { license_id, host_id }: HeartbeatRequest = await req.json();

    if (!license_id || !host_id) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Missing required fields: license_id and host_id",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get license ID from tenant
    const { data: license } = await supabase
      .from("licenses")
      .select("id")
      .eq("tenant_id", license_id)
      .single();

    if (!license) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Invalid license",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update heartbeat
    const { error: updateError } = await supabase
      .from("license_nodes")
      .update({ last_heartbeat: new Date().toISOString() })
      .eq("license_id", license.id)
      .eq("host_id", host_id);

    if (updateError) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: `Heartbeat update failed: ${updateError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        message: "Heartbeat updated",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Heartbeat error:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        message: (error as Error).message || "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
