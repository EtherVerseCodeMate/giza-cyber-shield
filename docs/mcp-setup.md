# ASAF MCP Integration Guide

**Add ASAF security tools to any AI coding assistant in 60 seconds.**

ASAF ships a fully compliant [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server.
Once configured, your AI assistant (Claude Code, Cursor, Windsurf, VS Code Copilot) can
run compliance scans, query STIG controls, and issue ADINKHEPRA attestations — with
**PQC-signed results** and a full DAG audit trail — without leaving your editor.

---

## Quick Setup

### 1. Install ASAF

```bash
curl -sSL https://get.nouchix.com/asaf | sh
```

Verify:
```bash
asaf version
# ASAF v1.0.0 — NouchiX / Sacred Knowledge Inc
```

### 2. Add to `.mcp.json` (project-level)

Create or update `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "asaf": {
      "command": "asaf",
      "args": ["mcp"],
      "description": "ASAF — PQC-secured compliance scanning and ADINKHEPRA attestation",
      "env": {
        "KHEPRA_API_URL": "https://api.nouchix.com"
      }
    }
  }
}
```

**Air-gapped / offline mode** (no cloud, SQLite only):
```json
{
  "mcpServers": {
    "asaf": {
      "command": "asaf",
      "args": ["mcp", "--offline"],
      "description": "ASAF — local-only PQC compliance tools"
    }
  }
}
```

### 3. Restart your AI tool

Claude Code, Cursor, and Windsurf auto-detect `.mcp.json` on startup or project reload.
You should see `asaf` appear in your tool list.

---

## Available Tools

Once connected, your AI assistant has access to:

| Tool | Description |
|------|-------------|
| `khepra_run_compliance_scan` | Scan a target host for compliance gaps (CMMC, STIG, NIST 800-171) |
| `khepra_get_compliance_score` | Get the current compliance score for an org/framework |
| `khepra_query_stig` | Look up a STIG control by ID, with remediation guidance |
| `khepra_export_attestation` | Export a PQC-signed attestation package (PDF or JSON) |
| `khepra_get_dag_chain` | Retrieve the cryptographic DAG audit chain for any entity |
| `khepra_get_anomaly_score` | Get ML-based anomaly detection score (Souhimbou engine) |
| `khepra_query_threat_intel` | Query CISA KEV, NVD, and MITRE ATT&CK threat feed |

### Example: Ask your AI assistant

```
"Scan 192.168.1.100 for CMMC Level 2 gaps and give me a prioritized remediation plan"
```

Your AI calls `khepra_run_compliance_scan`, gets PQC-signed findings, and builds the plan.

```
"Export an ADINKHEPRA attestation for org acme-corp under NIST 800-171 as JSON"
```

Your AI calls `khepra_export_attestation` → returns a Dilithium-3 signed artifact.

---

## Remote MCP (SSE Transport)

For teams, deploy the MCP server centrally on your VPS and connect remotely:

```json
{
  "mcpServers": {
    "asaf-remote": {
      "transport": "sse",
      "url": "https://mcp.nouchix.com/sse",
      "headers": {
        "Authorization": "Bearer YOUR_ASAF_LICENSE_KEY"
      }
    }
  }
}
```

This gives your entire team shared access to a single PQC-secured MCP server,
with all tool calls logged to the DAG audit chain.

---

## Every Tool Call Is PQC-Audited

Every MCP tool invocation:

1. Is scanned for **prompt injection** (6 pattern checks)
2. Returns results signed with **Dilithium-3** (NIST ML-DSA-65)
3. Is anchored in the **ADINKHEPRA DAG chain** (tamper-evident)
4. Is optionally synced to your Supabase org (if configured)

The DAG chain means every AI-assisted compliance decision has a **cryptographic paper trail** — 
auditor-ready, C3PAO-compatible.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KHEPRA_API_URL` | `https://api.nouchix.com` | API server URL |
| `MCP_PQC_ENABLED` | `true` | Enable Dilithium-3 signing on responses |
| `MCP_DEBUG` | `false` | Verbose logging to stderr |
| `SUPABASE_URL` | *(none)* | Supabase project URL for persistence |
| `SUPABASE_SERVICE_ROLE_KEY` | *(none)* | Supabase service key |

---

## Troubleshooting

**Tool not appearing in Claude/Cursor:**
```bash
asaf mcp --test
# Should print: MCP server ready — 7 tools registered
```

**Connection refused:**
```bash
# Check if API server is reachable
curl https://api.nouchix.com/healthz

# Or run locally
asaf serve --port 45444
```

**Offline/air-gap mode:**
```bash
asaf mcp --offline --data-dir ~/.asaf/data
# Runs with local SQLite, no external connections
```

---

## Security Notes

- The MCP server binary is a **statically compiled Go binary** — zero runtime dependencies
- All tool results are **Dilithium-3 signed** before returning to the AI client
- The server scans every tool call for prompt injection before execution
- In `--offline` mode: zero network connections, verifiable via `strace`/`tcpdump`

---

*Built by NouchiX / Sacred Knowledge Inc — [security@nouchix.com](mailto:security@nouchix.com)*
