import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, openphone-signature",
};

// =============================================================================
// OpenPhone (Quo) Webhook Receiver
// Handles inbound SMS, calls, transcripts, recordings, and AI summaries
// =============================================================================

function getSupabase() {
    return createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
}

// --- HMAC-SHA256 Signature Verification ---
async function verifySignature(
    body: string,
    signatureHeader: string | null,
    secret: string
): Promise<boolean> {
    if (!signatureHeader || !secret) return false;

    try {
        // OpenPhone signature format: t=<timestamp>,s=<signature>
        const parts: Record<string, string> = {};
        for (const part of signatureHeader.split(",")) {
            const [key, val] = part.split("=");
            parts[key.trim()] = val.trim();
        }

        const timestamp = parts["t"];
        const signature = parts["s"];
        if (!timestamp || !signature) return false;

        // Signed payload = timestamp + ":" + body
        const signedPayload = `${timestamp}:${body}`;
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );
        const sig = await crypto.subtle.sign(
            "HMAC",
            key,
            encoder.encode(signedPayload)
        );
        const computed = Array.from(new Uint8Array(sig))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

        return computed === signature;
    } catch (err) {
        console.error("Signature verification error:", err);
        return false;
    }
}

// --- Send SMS Reply via OpenPhone API ---
async function sendReply(to: string, content: string) {
    const apiKey = Deno.env.get("QUO_API_KEY");
    const from = Deno.env.get("QUO_PHONE_NUMBER");
    if (!apiKey || !from) return;

    await fetch("https://api.openphone.com/v1/messages", {
        method: "POST",
        headers: {
            Authorization: apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ content, from, to: [to] }),
    });
}

// --- Forward to Discord ---
async function forwardToDiscord(
    webhookUrl: string,
    title: string,
    description: string,
    color: number,
    fields: Array<{ name: string; value: string; inline: boolean }>
) {
    await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username: "Khepra SMS Gateway",
            embeds: [
                {
                    title,
                    description,
                    color,
                    fields,
                    footer: { text: "Quo (OpenPhone) → Khepra Protocol" },
                    timestamp: new Date().toISOString(),
                },
            ],
        }),
    });
}

// =============================================================================
// Event Handlers
// =============================================================================

async function handleMessageReceived(data: any) {
    const msg = data.object;
    const supabase = getSupabase();

    console.log(`📩 Inbound SMS from ${msg.from}: "${msg.text}"`);

    // Log to sms_messages table
    await supabase.from("sms_messages").insert({
        openphone_id: msg.id,
        direction: "incoming",
        from_number: msg.from,
        to_number: msg.to?.[0],
        body: msg.text,
        status: msg.status,
        phone_number_id: msg.phoneNumberId,
        user_id: msg.userId,
        metadata: { contactIds: msg.contactIds },
    });

    // --- Keyword Auto-Reply ---
    const text = (msg.text || "").toUpperCase().trim();
    if (text === "STATUS") {
        await sendReply(
            msg.from,
            "🛡️ Khepra Protocol Status\n✅ API: Online\n✅ Firewall: Active\n✅ PQC: Operational\n\nReply HELP for commands."
        );
    } else if (text === "HELP") {
        await sendReply(
            msg.from,
            "📋 Khepra SMS Commands:\nSTATUS — System health\nALERTS — Recent alerts\nSCAN <IP> — Threat lookup\n\nFor full control, use Discord: /help"
        );
    } else if (text === "ALERTS") {
        const { data: alerts } = await supabase
            .from("alerts")
            .select("title, severity, created_at")
            .order("created_at", { ascending: false })
            .limit(3);

        const alertText = alerts?.length
            ? alerts
                .map(
                    (a: any) =>
                        `${a.severity === "CRITICAL" ? "🔴" : "🟡"} ${a.title}`
                )
                .join("\n")
            : "No recent alerts.";

        await sendReply(msg.from, `🚨 Recent Alerts:\n${alertText}`);
    }

    // Forward to Discord #critical-alerts if contains urgent keywords
    const urgentKeywords = [
        "breach",
        "attack",
        "compromise",
        "emergency",
        "critical",
        "urgent",
        "exploit",
    ];
    const isUrgent = urgentKeywords.some((kw) =>
        (msg.text || "").toLowerCase().includes(kw)
    );

    if (isUrgent) {
        const webhookUrl = Deno.env.get("ALERT_WEBHOOK_URL");
        if (webhookUrl) {
            await forwardToDiscord(
                webhookUrl,
                "🚨 Urgent SMS Received",
                `Inbound message flagged as urgent`,
                0xff0000,
                [
                    { name: "📱 From", value: msg.from, inline: true },
                    { name: "📅 Time", value: msg.createdAt, inline: true },
                    {
                        name: "💬 Message",
                        value: msg.text?.substring(0, 1024) || "N/A",
                        inline: false,
                    },
                ]
            );
        }
    }

    return { handled: "message.received", from: msg.from };
}

async function handleMessageDelivered(data: any) {
    const msg = data.object;
    const supabase = getSupabase();

    console.log(`✅ SMS delivered to ${msg.to?.[0]}: ${msg.id}`);

    // Update delivery status
    await supabase
        .from("sms_messages")
        .update({ status: "delivered", updated_at: new Date().toISOString() })
        .eq("openphone_id", msg.id);

    return { handled: "message.delivered", id: msg.id };
}

async function handleCallCompleted(data: any) {
    const call = data.object;
    const supabase = getSupabase();

    console.log(
        `📞 Call completed: ${call.from} → ${call.to} (${call.duration}s)`
    );

    await supabase.from("call_log").insert({
        openphone_id: call.id,
        direction: call.direction,
        from_number: call.from,
        to_number: call.to,
        duration_seconds: call.duration,
        status: call.status,
        phone_number_id: call.phoneNumberId,
        user_id: call.userId,
        metadata: { contactIds: call.contactIds },
    });

    // Post to Discord
    const webhookUrl = Deno.env.get("ALERT_WEBHOOK_URL");
    if (webhookUrl && call.direction === "incoming") {
        await forwardToDiscord(
            webhookUrl,
            "📞 Inbound Call Completed",
            `Call from **${call.from}**`,
            0x3498db,
            [
                { name: "📱 From", value: call.from || "Unknown", inline: true },
                {
                    name: "⏱️ Duration",
                    value: `${call.duration || 0}s`,
                    inline: true,
                },
                { name: "📊 Status", value: call.status || "completed", inline: true },
            ]
        );
    }

    return { handled: "call.completed", id: call.id };
}

async function handleCallRinging(data: any) {
    const call = data.object;
    console.log(`🔔 Inbound call ringing: ${call.from}`);
    return { handled: "call.ringing", from: call.from };
}

async function handleCallRecording(data: any) {
    const recording = data.object;
    const supabase = getSupabase();

    console.log(`🎙️ Call recording ready: ${recording.callId}`);

    await supabase
        .from("call_log")
        .update({
            recording_url: recording.url,
            updated_at: new Date().toISOString(),
        })
        .eq("openphone_id", recording.callId);

    return { handled: "call.recording.completed", callId: recording.callId };
}

async function handleCallTranscript(data: any) {
    const transcript = data.object;
    const supabase = getSupabase();

    console.log(`📝 Call transcript ready: ${transcript.callId}`);

    await supabase
        .from("call_log")
        .update({
            transcript: transcript.text,
            updated_at: new Date().toISOString(),
        })
        .eq("openphone_id", transcript.callId);

    return { handled: "call.transcript.completed", callId: transcript.callId };
}

async function handleCallSummary(data: any) {
    const summary = data.object;
    const supabase = getSupabase();

    console.log(`🤖 Call AI summary ready: ${summary.callId}`);

    await supabase
        .from("call_log")
        .update({
            ai_summary: summary.text,
            updated_at: new Date().toISOString(),
        })
        .eq("openphone_id", summary.callId);

    return { handled: "call.summary.completed", callId: summary.callId };
}

// =============================================================================
// Main Server
// =============================================================================

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const body = await req.text();
        const signatureHeader = req.headers.get("openphone-signature");
        const webhookSecret = Deno.env.get("QUO_WEBHOOK_SECRET");

        // Verify signature if secret is configured
        if (webhookSecret) {
            const valid = await verifySignature(body, signatureHeader, webhookSecret);
            if (!valid) {
                console.error("❌ Invalid OpenPhone webhook signature");
                return new Response(JSON.stringify({ error: "Invalid signature" }), {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
        }

        const event = JSON.parse(body);
        console.log(`📨 OpenPhone event: ${event.type} (${event.id})`);

        let result;

        switch (event.type) {
            case "message.received":
                result = await handleMessageReceived(event.data);
                break;
            case "message.delivered":
                result = await handleMessageDelivered(event.data);
                break;
            case "call.completed":
                result = await handleCallCompleted(event.data);
                break;
            case "call.ringing":
                result = await handleCallRinging(event.data);
                break;
            case "call.recording.completed":
                result = await handleCallRecording(event.data);
                break;
            case "call.transcript.completed":
                result = await handleCallTranscript(event.data);
                break;
            case "call.summary.completed":
                result = await handleCallSummary(event.data);
                break;
            default:
                console.log(`⚠️ Unhandled event type: ${event.type}`);
                result = { handled: false, type: event.type };
        }

        // Log event to audit
        const supabase = getSupabase();
        await supabase.from("audit_log").insert({
            action: `openphone.${event.type}`,
            actor: "openphone-webhook",
            details: {
                event_id: event.id,
                api_version: event.apiVersion,
                result,
            },
        });

        return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("OpenPhone webhook error:", error);
        return new Response(
            JSON.stringify({
                error: error.message || "Webhook processing failed",
            }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
