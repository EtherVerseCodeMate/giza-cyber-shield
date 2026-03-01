#!/usr/bin/env node
/**
 * Discord Slash Command Registration Script
 * Run once: node scripts/discord-register-commands.js
 *
 * Requires: DISCORD_BOT_TOKEN and DISCORD_APPLICATION_ID env vars
 * Or pass as args: node scripts/discord-register-commands.js <APP_ID> <BOT_TOKEN>
 */

const APP_ID = process.argv[2] || process.env.DISCORD_APPLICATION_ID || "1477741085219619020";
const TOKEN = process.argv[3] || process.env.DISCORD_BOT_TOKEN;

if (!TOKEN) {
    console.error("❌ Missing DISCORD_BOT_TOKEN. Pass as 2nd arg or set env var.");
    process.exit(1);
}

const commands = [
    {
        name: "scan",
        description: "🔍 Scan an IP address or domain for threat intelligence",
        options: [
            {
                name: "target",
                description: "IP address or domain to scan (e.g. 192.168.1.1 or example.com)",
                type: 3, // STRING
                required: true,
            },
        ],
    },
    {
        name: "compliance",
        description: "📋 Check current CMMC compliance status and score",
    },
    {
        name: "status",
        description: "✅ Check health status of all Khepra services",
    },
    {
        name: "alerts",
        description: "📬 Show the 10 most recent security alerts",
    },
    {
        name: "license",
        description: "🔑 Look up a license key status",
        options: [
            {
                name: "key",
                description: "The license key to check",
                type: 3, // STRING
                required: true,
            },
        ],
    },
];

async function registerCommands() {
    console.log(`🤖 Registering ${commands.length} slash commands for Khepra-Protocol-Crypto-PQC-Cyber...`);
    console.log(`   Application ID: ${APP_ID}`);

    const url = `https://discord.com/api/v10/applications/${APP_ID}/commands`;

    const response = await fetch(url, {
        method: "PUT",
        headers: {
            "Authorization": `Bot ${TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(commands),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Failed to register commands: ${response.status}`);
        console.error(error);
        process.exit(1);
    }

    const result = await response.json();
    console.log(`✅ Registered ${result.length} commands:`);
    result.forEach((cmd) => {
        console.log(`   /${cmd.name} — ${cmd.description}`);
    });
}

registerCommands().catch(console.error);
