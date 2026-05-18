# KHEPRA MCP Quickstart

KHEPRA MCP wraps agent tool calls with input validation, risk classification, post-quantum signatures, and DAG-oriented evidence.

## Run Locally

```powershell
go run ./cmd/khepra-mcp
```

The server speaks MCP over stdio. Diagnostics go to stderr; stdout is reserved for JSON-RPC frames.

## Project `.mcp.json`

```json
{
  "mcpServers": {
    "khepra-mcp": {
      "command": "go",
      "args": ["run", "./cmd/khepra-mcp"],
      "env": {
        "KHEPRA_MANIFEST_PATH": "./manifest.json",
        "PHANTOM_SYMBOL": "Eban"
      }
    }
  }
}
```

For a released local binary:

```json
{
  "mcpServers": {
    "khepra-mcp": {
      "command": "khepra-mcp",
      "args": [],
      "env": {
        "KHEPRA_MANIFEST_PATH": "./manifest.json",
        "PHANTOM_SYMBOL": "Eban"
      }
    }
  }
}
```

## Tools

| Tool | Risk | Purpose |
| --- | --- | --- |
| `acp_status` | read-only | List active Agent Control Plane credentials. |
| `acp_issue` | destructive | Issue a new PQC credential. |
| `acp_revoke` | destructive | Revoke an ACP credential. |
| `nhi_inventory` | read-only | List non-human identities. |
| `nhi_orphans` | read-only | Identify identities without active owners. |
| `nhi_excessive` | read-only | Identify identities with broad permissions. |
| `nhi_expired` | read-only | List expired or soon-to-expire identities. |
| `nhi_revoke` | destructive | Revoke a non-human identity credential. |
| `ert_scan` | sandboxed | Run an ERT security scan. |

## Developer Demo

```powershell
./scripts/mcp-smoke-test.ps1
```

Expected output:

```json
{
  "server": "khepra-mcp",
  "version": "1.0.0",
  "protocolVersion": "2024-11-05",
  "toolCount": 9,
  "ping": "pong"
}
```

## Security Notes

- Keep stdout clean. MCP clients parse stdout as JSON-RPC.
- Keep `manifest.json` pinned and versioned with releases.
- Use `KHEPRA_MCP_STRICT_SANDBOX=true` for fail-closed enterprise deployments.
- Treat destructive tools as privileged. The stdio confirmation gate assumes a single-tenant local subprocess model.
