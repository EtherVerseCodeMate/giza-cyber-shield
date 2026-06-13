@echo off
cd /d "C:\Users\intel\blackbox\khepra protocol"
set CGO_ENABLED=0
go run ./cmd/khepra-mcp/main.go %*
