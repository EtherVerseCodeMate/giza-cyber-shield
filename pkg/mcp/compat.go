// Package mcp — backward compatibility shim.
//
// This file re-exports legacy types and functions that existing consumers
// (pkg/apiserver, cmd/khepra-mcp, cmd/apiserver) still import from "pkg/mcp".
//
// These exist ONLY for backward compatibility and are NOT part of the new
// hardened MCP wrapper (types.go, manifest.go, router.go, server.go, executor.go).
//
// Consumer migration path:
//   1. Import "pkg/mcp/legacy" instead of "pkg/mcp"
//   2. Or update to use the new MCP types directly
//
// These shims will be removed once all consumers are migrated.
package mcp

import (
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/mcp/legacy"
)

// ─── Re-exported Legacy Types (used by pkg/apiserver, cmd/khepra-mcp) ──────────

// NLProcessor is the legacy natural language processor.
type NLProcessor = legacy.NLProcessor

// NLQuery is the legacy natural language query envelope.
type NLQuery = legacy.NLQuery

// NLResponse is the legacy NL response envelope.
type NLResponse = legacy.NLResponse

// ToolExecutor is the legacy tool executor interface (used by apiserver).
type ToolExecutor = legacy.ToolExecutor

// ToolResult is the legacy tool result.
type ToolResult = legacy.ToolResult

// ContentItem is the legacy content item for tool results.
type ContentItem = legacy.ContentItem

// LegacyServer is the old MCP server (use Server from server.go for the hardened server).
type LegacyServer = legacy.Server

// LegacyTool is the old tool definition format.
type LegacyTool = legacy.Tool

// ToolInvocation is the legacy tool invocation record.
type ToolInvocation = legacy.ToolInvocation

// LLMProvider is the legacy LLM provider interface.
type LLMProvider = legacy.LLMProvider

// LegacyConfig is the old server configuration.
type LegacyConfig = legacy.Config

// LegacyAuditLogger is the old audit logger interface.
type LegacyAuditLogger = legacy.AuditLogger

// LegacyStore is the old store interface.
type LegacyStore = legacy.Store

// LegacyRequest is the old JSON-RPC request type.
type LegacyRequest = legacy.Request

// LegacyResponse is the old JSON-RPC response type.
type LegacyResponse = legacy.Response

// ─── Re-exported Legacy Functions ──────────────────────────────────────────────

// NewLegacyServer creates a legacy MCP server instance.
// Deprecated: Use NewServer() from server.go for the hardened implementation.
var NewLegacyServer = legacy.NewServer

// LegacyKhepraTools returns the legacy tool definitions.
// Deprecated: Tools are now defined in signed manifests.
var LegacyKhepraTools = legacy.KhepraTools

// NewNLProcessor creates a legacy NL processor.
var NewNLProcessor = legacy.NewNLProcessor
