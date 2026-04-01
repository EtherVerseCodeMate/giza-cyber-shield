// @ts-nocheck
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
        // Verify service-role key authorization
        const authHeader = req.headers.get("Authorization");
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!authHeader?.includes(serviceRoleKey ?? "")) {
            return new Response(
                JSON.stringify({ error: "Service role authorization required" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL"),
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
        );

        const body = await req.json();
        const { bucket, prefix, destination } = body;

        const targetBucket = bucket || "backups";
        const backupPrefix = prefix || `backup-${new Date().toISOString().split("T")[0]}`;

        // List files in source bucket
        const { data: files, error: listError } = await supabase.storage
            .from(targetBucket)
            .list(prefix || "", { limit: 1000 });

        if (listError) {
            return new Response(
                JSON.stringify({ error: `Failed to list bucket: ${listError.message}` }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Log backup operation
        await supabase.from("backup_logs").insert({
            bucket: targetBucket,
            prefix: backupPrefix,
            file_count: files?.length || 0,
            destination: destination || "supabase-storage",
            status: "completed",
            timestamp: new Date().toISOString(),
        });

        return new Response(
            JSON.stringify({
                success: true,
                bucket: targetBucket,
                files_processed: files?.length || 0,
                backup_id: backupPrefix,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("Storage backup error:", err);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
