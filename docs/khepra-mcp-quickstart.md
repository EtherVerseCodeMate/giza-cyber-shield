# KHEPRA MCP Quickstart

KHEPRA MCP wraps agent tool calls with input validation, risk classification, post-quantum Dilithium-3 signatures, and DAG-oriented audit evidence.

## Run Locally

```bash
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

## Smoke Test

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

To test a compiled binary:

```powershell
go build -mod=vendor -o bin/khepra-mcp ./cmd/khepra-mcp
./scripts/mcp-smoke-test.ps1 -Command ./bin/khepra-mcp -Arguments @()
```

## OCI / Registry

```bash
docker build -f Dockerfile.mcp \
  -t ghcr.io/etherversecodemate/khepra-mcp:1.0.0 .

docker run --rm -i ghcr.io/etherversecodemate/khepra-mcp:1.0.0
```

The server uses stdio transport. Send newline-delimited JSON-RPC on stdin; only JSON-RPC responses appear on stdout.

After pushing the image, verify MCP Registry discovery:

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.etherversecodemate/khepra-mcp"
```

## Security Notes

- Keep stdout clean. MCP clients parse stdout as JSON-RPC.
- Keep `manifest.json` pinned and versioned with releases.
- Use `KHEPRA_MCP_STRICT_SANDBOX=true` for fail-closed enterprise deployments.
- Treat destructive tools as privileged. The stdio confirmation gate assumes a single-tenant local subprocess model.
- All tool responses are Dilithium-3 signed and DAG-attested by default.

## Sample Signed Response

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "result": {
    "envelope": {
      "request_id": "req-demo-001",
      "tool_name": "nhi_inventory",
      "result": {
        "success": true,
        "data": {
          "identities": [],
          "summary": { "total": 0, "high_risk": 0 }
        }
      },
      "attestation_id": "dag-demo-node-001",
      "signature": "ml-dsa-demo-signature-redacted",
      "created_at": "2026-05-19T00:00:00Z",
      "schema_version": "1.0.0",
      "provenance": "local-stdio-demo"
    },
    "warnings": []
  }
}
```
