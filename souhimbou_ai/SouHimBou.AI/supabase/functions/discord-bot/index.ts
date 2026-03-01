import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Discord Interaction Types ---
const InteractionType = {
    PING: 1,
    APPLICATION_COMMAND: 2,
    MESSAGE_COMPONENT: 3,
};

const InteractionResponseType = {
    PONG: 1,
    CHANNEL_MESSAGE_WITH_SOURCE: 4,
    DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
    DEFERRED_UPDATE_MESSAGE: 6,
    UPDATE_MESSAGE: 7,
};

const KHEPRA_API = Deno.env.get("KHEPRA_API_URL") || "https://souhimbou-ai.fly.dev";

// --- DEMARC Boundary Authentication ---
// All outbound calls to the Fly.io Polymorphic API pass through the
// Mitochondrial DEMARC gateway. We attach service credentials so the
// Go PolymorphicEngine.HTTPMiddleware() recognises us as an authorised agent.
const DISCORD_AGENT_ID = "discord-bot";
const AGENT_SYMBOL = "Eban"; // Adinkra symbol for boundary-crossing agents

function khepraFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const serviceSecret = Deno.env.get("KHEPRA_SERVICE_SECRET") || "";
    const requestId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const headers = new Headers(init.headers || {});
    // Polymorphic Engine expects these headers for authenticated service calls
    headers.set("X-Agent-ID", DISCORD_AGENT_ID);
    headers.set("X-Khepra-Attestation", `${DISCORD_AGENT_ID}:${AGENT_SYMBOL}:${timestamp}`);
    headers.set("X-Khepra-Service-Secret", serviceSecret);
    headers.set("X-Request-ID", requestId);
    headers.set("User-Agent", "Khepra-Discord-Bot/1.0");
    if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const url = path.startsWith("http") ? path : `${KHEPRA_API}${path}`;
    return fetch(url, { ...init, headers });
}

// --- Ed25519 Signature Verification ---
async function verifyDiscordSignature(
    publicKey: string,
    signature: string,
    timestamp: string,
    body: string
): Promise<boolean> {
    try {
        const key = await crypto.subtle.importKey(
            "raw",
            hexToUint8Array(publicKey),
            { name: "Ed25519" },
            false,
            ["verify"]
        );
        const encoder = new TextEncoder();
        const message = encoder.encode(timestamp + body);
        const sig = hexToUint8Array(signature);
        return await crypto.subtle.verify("Ed25519", key, sig, message);
    } catch (e) {
        console.error("Signature verification failed:", e);
        return false;
    }
}

function hexToUint8Array(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

// --- Supabase Client ---
function getSupabase() {
    return createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
}

// --- Embed Helpers ---
function errorEmbed(message: string) {
    return {
        title: "❌ Error",
        description: message,
        color: 0xFF0000,
        footer: { text: "Khepra-Protocol-Crypto-PQC-Cyber" },
        timestamp: new Date().toISOString(),
    };
}

function infoEmbed(title: string, description: string, fields: any[] = [], color = 0x00BFFF) {
    return {
        title,
        description,
        color,
        fields,
        footer: { text: "Khepra-Protocol-Crypto-PQC-Cyber" },
        timestamp: new Date().toISOString(),
    };
}

// --- Slash Command Handlers ---

async function handleScan(options: any[]) {
    const target = options?.find((o: any) => o.name === "target")?.value;
    if (!target) {
        return { embeds: [errorEmbed("Please provide a target IP or domain.")] };
    }

    try {
        const res = await khepraFetch("/api/v1/threat-intel/lookup", {
            method: "POST",
            body: JSON.stringify({ target }),
        });

        if (!res.ok) {
            return {
                embeds: [infoEmbed(
                    `🔍 Scan: ${target}`,
                    `Threat intelligence lookup initiated.\nAPI returned status: ${res.status}`,
                    [{ name: "Target", value: `\`${target}\``, inline: true }],
                    0xFFD700,
                )],
            };
        }

        const data = await res.json();
        const riskScore = data.risk_score || data.anomaly_score || 0;
        const color = riskScore > 70 ? 0xFF0000 : riskScore > 40 ? 0xFF6B00 : 0x00CC66;

        return {
            embeds: [infoEmbed(
                `🔍 Scan Results: ${target}`,
                data.summary || "Scan complete.",
                [
                    { name: "📊 Risk Score", value: `**${riskScore}/100**`, inline: true },
                    { name: "🏷️ Type", value: `\`${data.type || "unknown"}\``, inline: true },
                    { name: "🔗 Source", value: data.source || "Khepra Engine", inline: true },
                ],
                color,
            )],
        };
    } catch (e: any) {
        return { embeds: [errorEmbed(`Scan failed: ${e.message}`)] };
    }
}

async function handleCompliance() {
    try {
        const res = await khepraFetch("/api/v1/compliance/cmmc");
        const data = await res.json();

        const score = data.score || 0;
        const color = score >= 80 ? 0x00CC66 : score >= 50 ? 0xFFD700 : 0xFF0000;
        const controls = data.controls || { total: 110, passing: 0, failing: 0 };

        return {
            embeds: [infoEmbed(
                "📋 CMMC Compliance Status",
                `Current compliance level: **${data.level || "Unknown"}**`,
                [
                    { name: "🎯 Score", value: `**${score}%**`, inline: true },
                    { name: "✅ Passing", value: `${controls.passing}/${controls.total}`, inline: true },
                    { name: "❌ Failing", value: `${controls.failing}`, inline: true },
                ],
                color,
            )],
        };
    } catch (e: any) {
        return { embeds: [errorEmbed(`Compliance check failed: ${e.message}`)] };
    }
}

async function handleStatus() {
    const checks = [];
    let allUp = true;

    // Fly.io
    try {
        const res = await khepraFetch("/", { signal: AbortSignal.timeout(5000) });
        const data = await res.json();
        checks.push({ name: "🛸 Fly.io (ML API)", value: `\`${data.status || "ONLINE"}\``, inline: true });
    } catch {
        checks.push({ name: "🛸 Fly.io (ML API)", value: "`OFFLINE`", inline: true });
        allUp = false;
    }

    // Supabase
    try {
        const supabase = getSupabase();
        const { error } = await supabase.from("profiles").select("id").limit(1);
        checks.push({ name: "🗄️ Supabase", value: error ? "`ERROR`" : "`ONLINE`", inline: true });
        if (error) allUp = false;
    } catch {
        checks.push({ name: "🗄️ Supabase", value: "`OFFLINE`", inline: true });
        allUp = false;
    }

    checks.push({ name: "⏰ Checked At", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true });

    return {
        embeds: [infoEmbed(
            allUp ? "✅ All Systems Operational" : "⚠️ Degraded Service",
            allUp ? "All Khepra services are running normally." : "One or more services are experiencing issues.",
            checks,
            allUp ? 0x00CC66 : 0xFF6B00,
        )],
    };
}

async function handleAlerts() {
    try {
        const supabase = getSupabase();
        const { data: alerts, error } = await supabase
            .from("alerts")
            .select("id, title, severity, risk_score, status, created_at")
            .order("created_at", { ascending: false })
            .limit(10);

        if (error) throw error;
        if (!alerts || alerts.length === 0) {
            return { embeds: [infoEmbed("📬 Recent Alerts", "No alerts found.", [], 0x808080)] };
        }

        const severityEmoji: Record<string, string> = {
            CRITICAL: "🔴", HIGH: "🟠", MEDIUM: "🟡", LOW: "🟢",
        };

        const lines = alerts.map((a: any) => {
            const emoji = severityEmoji[a.severity] || "⚪";
            const time = `<t:${Math.floor(new Date(a.created_at).getTime() / 1000)}:R>`;
            return `${emoji} **${a.severity}** | ${a.title} | Risk: ${a.risk_score || 0} | ${a.status || "OPEN"} | ${time}`;
        });

        return {
            embeds: [infoEmbed(
                `📬 Last ${alerts.length} Alerts`,
                lines.join("\n"),
                [],
                0x00BFFF,
            )],
        };
    } catch (e: any) {
        return { embeds: [errorEmbed(`Failed to fetch alerts: ${e.message}`)] };
    }
}

async function handleLicense(options: any[]) {
    const key = options?.find((o: any) => o.name === "key")?.value;
    if (!key) {
        return { embeds: [errorEmbed("Please provide a license key.")] };
    }

    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from("licenses")
            .select("*")
            .eq("license_key", key)
            .single();

        if (error || !data) {
            return { embeds: [infoEmbed("🔑 License Lookup", `No license found for \`${key}\``, [], 0xFF6B00)] };
        }

        return {
            embeds: [infoEmbed(
                "🔑 License Status",
                `License key: \`${key.substring(0, 8)}...\``,
                [
                    { name: "📦 Tier", value: `\`${data.tier || "community"}\``, inline: true },
                    { name: "📍 Status", value: `\`${data.status || "unknown"}\``, inline: true },
                    { name: "🕐 Last Heartbeat", value: data.last_heartbeat ? `<t:${Math.floor(new Date(data.last_heartbeat).getTime() / 1000)}:R>` : "Never", inline: true },
                ],
                data.status === "active" ? 0x00CC66 : 0xFF6B00,
            )],
        };
    } catch (e: any) {
        return { embeds: [errorEmbed(`License check failed: ${e.message}`)] };
    }
}

// --- Button Interaction Handlers ---

async function handleButton(customId: string, message: any) {
    const [action, alertId] = customId.split(":");
    if (!alertId) return { embeds: [errorEmbed("Invalid button interaction.")] };

    const supabase = getSupabase();

    switch (action) {
        case "ack_alert": {
            const { error } = await supabase
                .from("alerts")
                .update({ status: "ACKNOWLEDGED", updated_at: new Date().toISOString() })
                .eq("id", alertId);

            if (error) return { embeds: [errorEmbed(`Failed to acknowledge: ${error.message}`)] };

            return {
                content: `✅ Alert \`${alertId}\` acknowledged.`,
                embeds: message.embeds,
                components: [], // Remove buttons after action
            };
        }

        case "escalate_alert": {
            const { data: alert } = await supabase.from("alerts").select("escalation_level").eq("id", alertId).single();
            const newLevel = ((alert?.escalation_level || 0) + 1);

            const { error } = await supabase
                .from("alerts")
                .update({ escalated: true, escalation_level: newLevel, updated_at: new Date().toISOString() })
                .eq("id", alertId);

            if (error) return { embeds: [errorEmbed(`Failed to escalate: ${error.message}`)] };

            return {
                content: `⬆️ Alert \`${alertId}\` escalated to level ${newLevel}.`,
                embeds: message.embeds,
                components: [],
            };
        }

        default:
            return { embeds: [errorEmbed(`Unknown action: ${action}`)] };
    }
}

// --- Main Handler ---
serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, {
            headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
        });
    }

    const publicKey = Deno.env.get("DISCORD_PUBLIC_KEY");
    if (!publicKey) {
        console.error("DISCORD_PUBLIC_KEY not configured");
        return new Response("Server misconfigured", { status: 500 });
    }

    // Verify Discord signature
    const signature = req.headers.get("x-signature-ed25519");
    const timestamp = req.headers.get("x-signature-timestamp");
    const body = await req.text();

    if (!signature || !timestamp) {
        return new Response("Missing signature", { status: 401 });
    }

    const isValid = await verifyDiscordSignature(publicKey, signature, timestamp, body);
    if (!isValid) {
        return new Response("Invalid signature", { status: 401 });
    }

    const interaction = JSON.parse(body);

    // Handle PING (Discord verification handshake)
    if (interaction.type === InteractionType.PING) {
        return new Response(JSON.stringify({ type: InteractionResponseType.PONG }), {
            headers: { "Content-Type": "application/json" },
        });
    }

    // Handle Slash Commands
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        const { name, options } = interaction.data;
        let responseData;

        switch (name) {
            case "scan":
                responseData = await handleScan(options);
                break;
            case "compliance":
                responseData = await handleCompliance();
                break;
            case "status":
                responseData = await handleStatus();
                break;
            case "alerts":
                responseData = await handleAlerts();
                break;
            case "license":
                responseData = await handleLicense(options);
                break;
            default:
                responseData = { embeds: [errorEmbed(`Unknown command: /${name}`)] };
        }

        return new Response(
            JSON.stringify({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: responseData,
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    }

    // Handle Button Clicks
    if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
        const responseData = await handleButton(interaction.data.custom_id, interaction.message);

        return new Response(
            JSON.stringify({
                type: InteractionResponseType.UPDATE_MESSAGE,
                data: responseData,
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    }

    return new Response("Unknown interaction type", { status: 400 });
});
