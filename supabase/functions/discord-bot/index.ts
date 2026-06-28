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
        bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
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
        let color = 0x00CC66;
        if (riskScore > 70) {
            color = 0xFF0000;
        } else if (riskScore > 40) {
            color = 0xFF6B00;
        }

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
        let color = 0xFF0000;
        if (score >= 80) {
            color = 0x00CC66;
        } else if (score >= 50) {
            color = 0xFFD700;
        }
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

async function handleAlerts(options?: any[]) {
    const severity = options?.find((o: any) => o.name === "severity")?.value;
    const count = options?.find((o: any) => o.name === "count")?.value || 10;

    try {
        const supabase = getSupabase();
        let query = supabase
            .from("alerts")
            .select("id, title, severity, risk_score, status, created_at")
            .order("created_at", { ascending: false })
            .limit(count);

        if (severity) {
            query = query.eq("severity", severity);
        }

        const { data: alerts, error } = await query;

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
                components: [],
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

// --- New Command Handlers ---

async function handleFirewall(options: any[]) {
    const action = options?.find((o: any) => o.name === "action")?.value;
    const ip = options?.find((o: any) => o.name === "ip")?.value;

    try {
        switch (action) {
            case "list": {
                const res = await khepraFetch("/api/v1/firewall/rules");
                const data = await res.json();
                const rules = data.rules || [];
                if (rules.length === 0) return { embeds: [infoEmbed("🔥 Firewall Rules", "No active rules.", [], 0x808080)] };
                const lines = rules.map((r: any) => `\`${r.action}\` | \`${r.source || "*"}\` → \`${r.target || "*"}\` | ${r.description || ""}`);
                return { embeds: [infoEmbed("🔥 Active Firewall Rules", lines.join("\n"), [], 0xFF6B00)] };
            }
            case "block": {
                if (!ip) return { embeds: [errorEmbed("Provide an IP: `/firewall block ip:1.2.3.4`")] };
                await khepraFetch("/api/v1/firewall/block", {
                    method: "POST",
                    body: JSON.stringify({ ip, reason: "Blocked via Discord bot" }),
                });
                return { embeds: [infoEmbed("🔥 IP Blocked", `\`${ip}\` has been blocked at the Polymorphic firewall.`, [], 0xFF0000)] };
            }
            case "unblock": {
                if (!ip) return { embeds: [errorEmbed("Provide an IP: `/firewall unblock ip:1.2.3.4`")] };
                await khepraFetch("/api/v1/firewall/unblock", {
                    method: "POST",
                    body: JSON.stringify({ ip }),
                });
                return { embeds: [infoEmbed("🔥 IP Unblocked", `\`${ip}\` has been removed from the blocklist.`, [], 0x00CC66)] };
            }
            case "blocked": {
                const res = await khepraFetch("/api/v1/firewall/blocked");
                const data = await res.json();
                const ips = data.blocked || [];
                if (ips.length === 0) return { embeds: [infoEmbed("🔥 Blocked IPs", "No IPs are currently blocked.", [], 0x808080)] };
                return { embeds: [infoEmbed("🔥 Blocked IPs", ips.map((b: any) => `\`${b.ip}\` — ${b.reason || "No reason"}`).join("\n"), [], 0xFF0000)] };
            }
            default:
                return { embeds: [errorEmbed(`Unknown firewall action: ${action}`)] };
        }
    } catch (e: any) {
        return { embeds: [errorEmbed(`Firewall error: ${e.message}`)] };
    }
}

async function handleThreatFeed(options: any[]) {
    const source = options?.find((o: any) => o.name === "source")?.value || "all";

    try {
        const supabase = getSupabase();
        let query = supabase
            .from("threat_intel_cache")
            .select("indicator, source, threat_type, risk_score, created_at")
            .order("created_at", { ascending: false })
            .limit(10);

        if (source !== "all") {
            query = query.ilike("source", `%${source}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) {
            return { embeds: [infoEmbed("🌐 Threat Feed", `No recent entries for \`${source}\`.`, [], 0x808080)] };
        }

        const lines = data.map((t: any) => {
            const time = `<t:${Math.floor(new Date(t.created_at).getTime() / 1000)}:R>`;
            return `\`${t.indicator}\` | **${t.threat_type || "unknown"}** | Risk: ${t.risk_score || 0} | ${t.source} | ${time}`;
        });

        return { embeds: [infoEmbed(`🌐 Threat Feed — ${source.toUpperCase()}`, lines.join("\n"), [], 0x00BFFF)] };
    } catch (e: any) {
        return { embeds: [errorEmbed(`Threat feed error: ${e.message}`)] };
    }
}

async function handleStig(options: any[]) {
    const action = options?.find((o: any) => o.name === "action")?.value;

    try {
        const supabase = getSupabase();

        switch (action) {
            case "summary": {
                const res = await khepraFetch("/api/v1/stig/summary");
                if (!res.ok) {
                    const { count: total } = await supabase.from("stig_findings").select("*", { count: "exact", head: true });
                    const { count: open } = await supabase.from("stig_findings").select("*", { count: "exact", head: true }).eq("status", "OPEN");
                    return {
                        embeds: [infoEmbed("📜 STIG Summary", "STIG benchmark status", [
                            { name: "📊 Total Findings", value: `${total || 0}`, inline: true },
                            { name: "🔓 Open", value: `${open || 0}`, inline: true },
                            { name: "✅ Resolved", value: `${(total || 0) - (open || 0)}`, inline: true },
                        ], 0xFFD700)],
                    };
                }
                const data = await res.json();
                return {
                    embeds: [infoEmbed("📜 STIG Summary", `Benchmark: **${data.benchmark || "N/A"}**`, [
                        { name: "📊 Total", value: `${data.total || 0}`, inline: true },
                        { name: "🔓 Open", value: `${data.open || 0}`, inline: true },
                        { name: "🔴 CAT I", value: `${data.cat1 || 0}`, inline: true },
                        { name: "🟠 CAT II", value: `${data.cat2 || 0}`, inline: true },
                        { name: "🟡 CAT III", value: `${data.cat3 || 0}`, inline: true },
                    ], 0xFFD700)],
                };
            }
            case "open": {
                const { data, error } = await supabase
                    .from("stig_findings")
                    .select("rule_id, title, severity")
                    .eq("status", "OPEN")
                    .order("severity", { ascending: true })
                    .limit(15);
                if (error) throw error;
                if (!data?.length) return { embeds: [infoEmbed("📜 Open STIG Findings", "No open findings! 🎉", [], 0x00CC66)] };
                const lines = data.map((f: any) => `\`${f.rule_id}\` **${f.severity}** — ${f.title}`);
                return { embeds: [infoEmbed(`📜 Open Findings (${data.length})`, lines.join("\n"), [], 0xFF6B00)] };
            }
            case "changes": {
                const { data, error } = await supabase
                    .from("stig_findings")
                    .select("rule_id, title, status, updated_at")
                    .order("updated_at", { ascending: false })
                    .limit(10);
                if (error) throw error;
                if (!data?.length) return { embeds: [infoEmbed("📜 STIG Changes", "No recent changes.", [], 0x808080)] };
                const lines = data.map((f: any) => {
                    const time = `<t:${Math.floor(new Date(f.updated_at).getTime() / 1000)}:R>`;
                    return `\`${f.rule_id}\` → **${f.status}** | ${time}`;
                });
                return { embeds: [infoEmbed("📜 Recent STIG Changes", lines.join("\n"), [], 0x00BFFF)] };
            }
            default:
                return { embeds: [errorEmbed(`Unknown STIG action: ${action}`)] };
        }
    } catch (e: any) {
        return { embeds: [errorEmbed(`STIG error: ${e.message}`)] };
    }
}

async function handleDeployLast() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("deployment_log")
        .select("*")
        .order("deployed_at", { ascending: false })
        .limit(1)
        .single();
    if (error || !data) return { embeds: [infoEmbed("🚀 Last Deployment", "No deployment records found.", [], 0x808080)] };
    const time = `<t:${Math.floor(new Date(data.deployed_at).getTime() / 1000)}:R>`;
    const depColor = data.status === "success" ? 0x00CC66 : 0xFF0000;
    return {
        embeds: [infoEmbed("🚀 Last Deployment", `Deployed ${time}`, [
            { name: "📦 Service", value: `\`${data.service || "all"}\``, inline: true },
            { name: "📍 Status", value: `\`${data.status || "unknown"}\``, inline: true },
            { name: "👤 By", value: data.deployed_by || "system", inline: true },
        ], depColor)],
    };
}

async function handleDeployServices() {
    const services = [
        { name: "Fly.io (ML API)", endpoint: "/" },
    ];
    const checks = [];
    for (const svc of services) {
        try {
            const res = await khepraFetch(svc.endpoint, { signal: AbortSignal.timeout(5000) });
            checks.push({ name: `📦 ${svc.name}`, value: res.ok ? "`ONLINE`" : `\`ERROR ${res.status}\``, inline: true });
        } catch {
            checks.push({ name: `📦 ${svc.name}`, value: "`OFFLINE`", inline: true });
        }
    }
    try {
        const supabase = getSupabase();
        const { error } = await supabase.from("profiles").select("id").limit(1);
        checks.push({ name: "🗄️ Supabase", value: error ? "`ERROR`" : "`ONLINE`", inline: true });
    } catch {
        checks.push({ name: "🗄️ Supabase", value: "`OFFLINE`", inline: true });
    }
    return { embeds: [infoEmbed("🚀 Service Status", "Current deployment health:", checks, 0x00BFFF)] };
}

async function handleDeploy(options: any[]) {
    const action = options?.find((o: any) => o.name === "action")?.value;

    try {
        switch (action) {
            case "last":
                return await handleDeployLast();
            case "services":
                return await handleDeployServices();
            default:
                return { embeds: [errorEmbed(`Unknown deploy action: ${action}`)] };
        }
    } catch (e: any) {
        return { embeds: [errorEmbed(`Deploy error: ${e.message}`)] };
    }
}

async function handleAudit(options: any[]) {
    const count = options?.find((o: any) => o.name === "count")?.value || 10;

    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from("audit_log")
            .select("action, agent_id, details, created_at")
            .order("created_at", { ascending: false })
            .limit(count);

        if (error) throw error;
        if (!data?.length) return { embeds: [infoEmbed("📝 Audit Log", "No audit entries found.", [], 0x808080)] };

        const lines = data.map((a: any) => {
            const time = `<t:${Math.floor(new Date(a.created_at).getTime() / 1000)}:R>`;
            return `\`${a.action}\` | ${a.agent_id || "system"} | ${time}`;
        });

        return { embeds: [infoEmbed(`📝 Audit Log (last ${data.length})`, lines.join("\n"), [], 0x9B59B6)] };
    } catch (e: any) {
        return { embeds: [errorEmbed(`Audit log error: ${e.message}`)] };
    }
}

async function handleUsers(options: any[]) {
    const action = options?.find((o: any) => o.name === "action")?.value;
    const query = options?.find((o: any) => o.name === "query")?.value;

    try {
        const supabase = getSupabase();

        switch (action) {
            case "list": {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("id, email, role, created_at")
                    .order("created_at", { ascending: false })
                    .limit(15);
                if (error) throw error;
                if (!data?.length) return { embeds: [infoEmbed("👥 Users", "No users found.", [], 0x808080)] };
                const lines = data.map((u: any) => {
                    const time = `<t:${Math.floor(new Date(u.created_at).getTime() / 1000)}:R>`;
                    return `\`${u.role || "user"}\` | ${u.email || u.id.substring(0, 8)} | ${time}`;
                });
                return { embeds: [infoEmbed(`👥 Recent Users (${data.length})`, lines.join("\n"), [], 0x00BFFF)] };
            }
            case "stats": {
                const { data, error } = await supabase.from("profiles").select("role");
                if (error) throw error;
                const counts: Record<string, number> = {};
                (data || []).forEach((u: any) => {
                    const role = u.role || "user";
                    counts[role] = (counts[role] || 0) + 1;
                });
                const fields = Object.entries(counts).map(([role, count]) => ({
                    name: `🏷️ ${role}`, value: `${count}`, inline: true,
                }));
                fields.push({ name: "📊 Total", value: `${data?.length || 0}`, inline: true });
                return { embeds: [infoEmbed("👥 User Stats", "Users by role:", fields, 0x00BFFF)] };
            }
            case "search": {
                if (!query) return { embeds: [errorEmbed("Provide a search query: `/users search query:email@example.com`")] };
                const { data, error } = await supabase
                    .from("profiles")
                    .select("id, email, role, created_at")
                    .ilike("email", `%${query}%`)
                    .limit(10);
                if (error) throw error;
                if (!data?.length) return { embeds: [infoEmbed("👥 Search Results", `No users matching \`${query}\`.`, [], 0x808080)] };
                const lines = data.map((u: any) => `\`${u.role || "user"}\` | ${u.email} | ID: \`${u.id.substring(0, 8)}...\``);
                return { embeds: [infoEmbed(`👥 Search: "${query}"`, lines.join("\n"), [], 0x00BFFF)] };
            }
            default:
                return { embeds: [errorEmbed(`Unknown users action: ${action}`)] };
        }
    } catch (e: any) {
        return { embeds: [errorEmbed(`Users error: ${e.message}`)] };
    }
}

async function handlePapyrus(options: any[]) {
    const message = options?.find((o: any) => o.name === "message")?.value;
    if (!message) return { embeds: [errorEmbed("Please provide a message.")] };

    try {
        const res = await khepraFetch("/api/v1/papyrus/chat", {
            method: "POST",
            body: JSON.stringify({ message, agent: "discord-bot" }),
        });

        if (!res.ok) {
            return { embeds: [infoEmbed("🤖 Papyrus AI", "Papyrus is currently unavailable. Try again shortly.", [], 0xFF6B00)] };
        }

        const data = await res.json();
        return {
            embeds: [infoEmbed(
                "🤖 Papyrus AI",
                data.response || data.message || "No response generated.",
                data.sources ? [{ name: "📚 Sources", value: data.sources.join(", ") }] : [],
                0x9B59B6,
            )],
        };
    } catch (e: any) {
        return { embeds: [errorEmbed(`Papyrus error: ${e.message}`)] };
    }
}

function handleHelp() {
    return {
        embeds: [infoEmbed(
            "❓ Khepra Bot Commands",
            "All available slash commands:",
            [
                { name: "🔍 /scan `target`", value: "Scan an IP or domain for threats", inline: false },
                { name: "📬 /alerts `[severity]` `[count]`", value: "Show recent security alerts", inline: false },
                { name: "🔥 /firewall `action` `[ip]`", value: "Manage Polymorphic API firewall", inline: false },
                { name: "🌐 /threat-feed `[source]`", value: "View threat intelligence entries", inline: false },
                { name: "📋 /compliance", value: "Check CMMC compliance score", inline: false },
                { name: "📜 /stig `action`", value: "View STIG findings & benchmarks", inline: false },
                { name: "✅ /status", value: "Health check all services", inline: false },
                { name: "🚀 /deploy `action`", value: "View deployment status", inline: false },
                { name: "📝 /audit `[count]`", value: "View DAG audit log entries", inline: false },
                { name: "👥 /users `action` `[query]`", value: "View and search users", inline: false },
                { name: "🔑 /license `key`", value: "Look up a license key", inline: false },
                { name: "🤖 /papyrus `message`", value: "Chat with Papyrus AI", inline: false },
                { name: "❓ /help", value: "Show this help message", inline: false },
            ],
            0x00BFFF,
        )],
    };
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
            case "alerts":
                responseData = await handleAlerts(options);
                break;
            case "firewall":
                responseData = await handleFirewall(options);
                break;
            case "threat-feed":
                responseData = await handleThreatFeed(options);
                break;
            case "compliance":
                responseData = await handleCompliance();
                break;
            case "stig":
                responseData = await handleStig(options);
                break;
            case "status":
                responseData = await handleStatus();
                break;
            case "deploy":
                responseData = await handleDeploy(options);
                break;
            case "audit":
                responseData = await handleAudit(options);
                break;
            case "users":
                responseData = await handleUsers(options);
                break;
            case "license":
                responseData = await handleLicense(options);
                break;
            case "papyrus":
                responseData = await handlePapyrus(options);
                break;
            case "help":
                responseData = handleHelp();
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
