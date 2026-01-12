// Supabase Edge Function: Node Registration
// Purpose: Register a node against a license and enforce node limits

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NodeRegistration {
  license_id: string;
  host_id: string;
  hostname?: string;
  os?: string;
  arch?: string;
  version?: string;
  timestamp?: number;
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

    // Parse request body
    const registration: NodeRegistration = await req.json();
    const { license_id, host_id, hostname, os, arch, version } = registration;

    // Validate required fields
    if (!license_id || !host_id) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Missing required fields: license_id and host_id",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch license details
    const { data: license, error: licenseError } = await supabase
      .from("licenses")
      .select("id, tenant_id, max_nodes, enforcement_mode, tier, expires_at")
      .eq("tenant_id", license_id)
      .single();

    if (licenseError || !license) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: `Invalid license: ${license_id}`,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check license expiry
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: `License expired on ${new Date(license.expires_at).toISOString().split('T')[0]}`,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check if node already registered
    const { data: existingNode } = await supabase
      .from("license_nodes")
      .select("id, status, hostname, version")
      .eq("license_id", license.id)
      .eq("host_id", host_id)
      .maybeSingle();

    if (existingNode) {
      // Update heartbeat for existing node
      await supabase
        .from("license_nodes")
        .update({
          last_heartbeat: new Date().toISOString(),
          hostname: hostname || existingNode.hostname,
          version: version || existingNode.version,
        })
        .eq("id", existingNode.id);

      // Log event
      await supabase.from("license_events").insert({
        license_id: license.id,
        event_type: "node_heartbeat",
        event_data: { host_id, hostname },
        triggered_by: "system",
        node_id: existingNode.id,
      });

      return new Response(
        JSON.stringify({
          status: "updated",
          message: "Node heartbeat updated",
          current_nodes: await getActiveNodeCount(supabase, license.id),
          max_nodes: license.max_nodes,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Count active nodes
    const activeNodes = await getActiveNodeCount(supabase, license.id);

    // 5. Enforce node limit
    if (activeNodes >= license.max_nodes) {
      // Log overage event
      await supabase.from("license_events").insert({
        license_id: license.id,
        event_type: "limit_exceeded",
        event_data: {
          active_nodes: activeNodes,
          max_nodes: license.max_nodes,
          attempted_host_id: host_id,
          enforcement_mode: license.enforcement_mode,
        },
        triggered_by: "system",
      });

      if (license.enforcement_mode === "strict") {
        return new Response(
          JSON.stringify({
            status: "denied",
            message: `Node limit exceeded: ${activeNodes}/${license.max_nodes} nodes active`,
            current_nodes: activeNodes,
            max_nodes: license.max_nodes,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (license.enforcement_mode === "grace_period") {
        // Allow registration but mark as grace_period status
        const { data: newNode, error: insertError } = await supabase
          .from("license_nodes")
          .insert({
            license_id: license.id,
            host_id,
            hostname,
            os,
            arch,
            version,
            status: "grace_period",
          })
          .select()
          .single();

        if (insertError) {
          return new Response(
            JSON.stringify({
              status: "error",
              message: `Registration failed: ${insertError.message}`,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Log registration event
        await supabase.from("license_events").insert({
          license_id: license.id,
          event_type: "node_registered",
          event_data: { host_id, hostname, status: "grace_period" },
          triggered_by: "system",
          node_id: newNode.id,
        });

        return new Response(
          JSON.stringify({
            status: "grace_period",
            message: `Node registered in grace period. Limit exceeded: ${activeNodes + 1}/${license.max_nodes}. Upgrade license within 7 days.`,
            current_nodes: activeNodes + 1,
            max_nodes: license.max_nodes,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 6. Register new node (within limits)
    const { data: newNode, error: insertError } = await supabase
      .from("license_nodes")
      .insert({
        license_id: license.id,
        host_id,
        hostname,
        os,
        arch,
        version,
        status: "active",
      })
      .select()
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: `Registration failed: ${insertError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log registration event
    await supabase.from("license_events").insert({
      license_id: license.id,
      event_type: "node_registered",
      event_data: { host_id, hostname, tier: license.tier },
      triggered_by: "system",
      node_id: newNode.id,
    });

    return new Response(
      JSON.stringify({
        status: "registered",
        message: "Node successfully registered",
        current_nodes: activeNodes + 1,
        max_nodes: license.max_nodes,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        message: (error as Error).message || "Internal server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper: Count active nodes for a license
async function getActiveNodeCount(supabase: any, licenseId: string): Promise<number> {
  const { count } = await supabase
    .from("license_nodes")
    .select("*", { count: "exact", head: true })
    .eq("license_id", licenseId)
    .eq("status", "active");

  return count || 0;
}
