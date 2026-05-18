# KHEPRA MCP Registry Publishing

This repo publishes the KHEPRA MCP server as an OCI package. The npm quickstart flow does not fit this project because the server is a Go stdio binary in `cmd/khepra-mcp`, and the root `package.json` is a private dashboard package.

## Package Identity

- Registry server name: `io.github.etherversecodemate/khepra-mcp`
- OCI image: `ghcr.io/etherversecodemate/khepra-mcp:<version>`
- Metadata file: `server.json`
- Runtime image: `Dockerfile.mcp`

The OCI image includes the MCP Registry ownership label:

```text
io.modelcontextprotocol.server.name=io.github.etherversecodemate/khepra-mcp
```

That label must match `server.json` exactly.

## Local Build

```powershell
docker build -f Dockerfile.mcp -t ghcr.io/etherversecodemate/khepra-mcp:1.0.0 .
docker run --rm -i ghcr.io/etherversecodemate/khepra-mcp:1.0.0
```

The server uses stdio transport. Send newline-delimited JSON-RPC requests on stdin; only JSON-RPC responses should appear on stdout.

## Smoke Test

```powershell
./scripts/mcp-smoke-test.ps1
```

To test a compiled binary:

```powershell
go build -mod=vendor -o bin/khepra-mcp.exe ./cmd/khepra-mcp
./scripts/mcp-smoke-test.ps1 -Command ./bin/khepra-mcp.exe -Arguments @()
```

## GitHub Actions Publish

Use `.github/workflows/publish-mcp-registry.yml`.

1. Run the workflow manually.
2. Set `version` to the release version.
3. Keep `publish_registry=false` for image-only validation.
4. Set `publish_registry=true` after the image is pushed and the registry metadata is ready.

The workflow:

- Builds `Dockerfile.mcp`.
- Pushes `ghcr.io/<owner>/khepra-mcp:<version>` and `latest`.
- Renders `server.json` with the selected image tag.
- Optionally logs in with GitHub OIDC and runs `mcp-publisher publish`.

## Manual Registry Publish

```powershell
mcp-publisher login github
mcp-publisher publish
```

After publishing, verify discovery:

```powershell
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.etherversecodemate/khepra-mcp"
```

## Sandbox Behavior

`ert_scan` is classified as sandboxed. In local developer installs, Docker may be unavailable. By default the executor falls back to the registered in-process handler and returns a warning. For enterprise or air-gapped deployments that must fail closed, set:

```powershell
$env:KHEPRA_MCP_STRICT_SANDBOX = "true"
```
