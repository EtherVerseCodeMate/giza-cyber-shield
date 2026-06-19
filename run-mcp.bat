@echo off
:: KHEPRA MCP Server launcher
:: Uses pre-built binary for fast startup (~300ms vs ~60s for go run)
:: Rebuild binary: go build -o "%~dp0..\PQC-Khepra-MCP\khepra-mcp.exe" -C "C:\Users\intel\blackbox\PQC-Khepra-MCP" ./cmd/khepra-mcp
cd /d "C:\Users\intel\blackbox\PQC-Khepra-MCP"
set CGO_ENABLED=0
set KHEPRA_MANIFEST_PATH=C:\Users\intel\blackbox\PQC-Khepra-MCP\manifest.json

:: Run pre-built binary if it exists (fast path)
if exist "C:\Users\intel\blackbox\PQC-Khepra-MCP\khepra-mcp.exe" (
    "C:\Users\intel\blackbox\PQC-Khepra-MCP\khepra-mcp.exe" %*
) else (
    :: Fallback: compile + run (slow, ~60s — will timeout in Claude Desktop)
    go run ./cmd/khepra-mcp/main.go %*
)
