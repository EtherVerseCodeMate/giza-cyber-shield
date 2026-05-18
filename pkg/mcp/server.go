package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"
)

// ─── MCP Server (AD-008: stdio default) ────────────────────────────────────────
//
// The Server owns transport ONLY. It reads JSON-RPC requests from stdin,
// dispatches them through the Router, and writes JSON-RPC responses to stdout.
//
// CRITICAL: stdout = JSON-RPC frames ONLY. stderr = human-readable logs.
// Any non-JSON output on stdout breaks MCP interoperability.

const (
	// ServerName identifies this server in the MCP `initialize` response.
	ServerName = "khepra-mcp"
	// ServerVersion is the current server version.
	ServerVersion = "1.0.0"
	// ProtocolVersion is the MCP protocol version we implement.
	ProtocolVersion = "2024-11-05"
)

// Server is the MCP transport layer.
type Server struct {
	mode     TransportMode
	router   *Router
	logger   *log.Logger
	running  atomic.Bool
	cred     any    // Default credential for stdio sessions (e.g. ACP token)
	addr     string // Remote address — "local" for stdio
}

// ServerConfig configures the MCP Server.
type ServerConfig struct {
	Mode       TransportMode // Default: TransportStdio
	Router     *Router
	Logger     *log.Logger
	Credential any    // Default session credential (for stdio: pre-authenticated)
}

// NewServer creates a new MCP Server.
func NewServer(cfg ServerConfig) (*Server, error) {
	if cfg.Router == nil {
		return nil, fmt.Errorf("mcp/server: Router is required")
	}
	mode := cfg.Mode
	if mode == "" {
		mode = TransportStdio
	}
	logger := cfg.Logger
	if logger == nil {
		// CRITICAL: Server logs go to stderr, never stdout.
		logger = log.New(os.Stderr, "[MCP] ", log.LstdFlags|log.Lmicroseconds)
	}
	return &Server{
		mode:   mode,
		router: cfg.Router,
		logger: logger,
		cred:   cfg.Credential,
		addr:   "local",
	}, nil
}

// Run starts the server on the configured transport.
// It blocks until the context is cancelled or a shutdown signal is received.
func (s *Server) Run(ctx context.Context) error {
	s.running.Store(true)
	defer s.running.Store(false)

	switch s.mode {
	case TransportStdio:
		return s.runStdio(ctx)
	case TransportHTTP:
		return fmt.Errorf("mcp/server: HTTP transport not yet implemented (AD-008: stdio recommended)")
	default:
		return fmt.Errorf("mcp/server: unsupported transport: %s", s.mode)
	}
}

// ─── stdio Transport ───────────────────────────────────────────────────────────

func (s *Server) runStdio(ctx context.Context) error {
	s.logger.Println("starting MCP server on stdio")

	// Set up signal handling for graceful shutdown.
	ctx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer stop()

	reader := bufio.NewReader(os.Stdin)
	encoder := json.NewEncoder(os.Stdout)

	for {
		select {
		case <-ctx.Done():
			s.logger.Println("shutting down (context cancelled)")
			return nil
		default:
		}

		// Read one JSON-RPC request per line from stdin.
		line, err := reader.ReadBytes('\n')
		if err != nil {
			if err == io.EOF {
				s.logger.Println("stdin closed — shutting down")
				return nil
			}
			s.logger.Printf("read error: %v", err)
			continue
		}

		// Parse JSON-RPC request.
		var req JSONRPCRequest
		if err := json.Unmarshal(line, &req); err != nil {
			resp := JSONRPCResponse{
				JSONRPC: "2.0",
				ID:      nil,
				Error: &JSONRPCError{
					Code:    ErrCodeParseError,
					Message: "parse error: " + err.Error(),
				},
			}
			_ = encoder.Encode(resp)
			continue
		}

		// Dispatch based on method.
		resp := s.handleRequest(ctx, req)
		if err := encoder.Encode(resp); err != nil {
			s.logger.Printf("write error: %v", err)
		}
	}
}

// ─── Method Dispatch ───────────────────────────────────────────────────────────

func (s *Server) handleRequest(ctx context.Context, req JSONRPCRequest) JSONRPCResponse {
	if req.JSONRPC != "2.0" {
		return JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &JSONRPCError{
				Code:    ErrCodeInvalidRequest,
				Message: "invalid jsonrpc version",
			},
		}
	}

	switch req.Method {
	case "initialize":
		return s.handleInitialize(req)
	case "ping":
		return s.handlePing(req)
	case "tools/list":
		return s.handleToolsList(req)
	case "tools/call":
		return s.handleToolsCall(ctx, req)
	case "notifications/initialized":
		// Client notification — no response needed, but we acknowledge.
		s.logger.Println("client initialized notification received")
		return JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result:  mustMarshal(map[string]string{"status": "acknowledged"}),
		}
	default:
		return JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &JSONRPCError{
				Code:    ErrCodeMethodNotFound,
				Message: fmt.Sprintf("method not found: %s", req.Method),
			},
		}
	}
}

// ─── initialize ────────────────────────────────────────────────────────────────

func (s *Server) handleInitialize(req JSONRPCRequest) JSONRPCResponse {
	info := ServerInfo{
		Name:            ServerName,
		Version:         ServerVersion,
		ProtocolVersion: ProtocolVersion,
		Capabilities: Capabilities{
			Tools: &ToolsCapability{
				ListChanged: false,
			},
		},
	}
	return JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  mustMarshal(info),
	}
}

// ─── ping ──────────────────────────────────────────────────────────────────────

func (s *Server) handlePing(req JSONRPCRequest) JSONRPCResponse {
	return JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  mustMarshal(map[string]string{"status": "pong"}),
	}
}

// ─── tools/list ────────────────────────────────────────────────────────────────

func (s *Server) handleToolsList(req JSONRPCRequest) JSONRPCResponse {
	tools := s.router.ListTools()
	return JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  mustMarshal(map[string]any{"tools": tools}),
	}
}

// ─── tools/call ────────────────────────────────────────────────────────────────

func (s *Server) handleToolsCall(ctx context.Context, req JSONRPCRequest) JSONRPCResponse {
	// Parse tool call parameters.
	var params struct {
		Name      string         `json:"name"`
		Arguments map[string]any `json:"arguments"`
	}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &JSONRPCError{
				Code:    ErrCodeInvalidParams,
				Message: "invalid tool call params: " + err.Error(),
			},
		}
	}

	// Build MCPToolCall.
	call := MCPToolCall{
		RequestID:   fmt.Sprintf("req-%d", time.Now().UnixNano()),
		ToolName:    params.Name,
		Args:        params.Arguments,
		RawPayload:  req.Params,
		Transport:   s.mode,
		SubmittedAt: time.Now().UTC(),
	}

	// Route through the full security chain.
	resp, err := s.router.HandleToolCall(ctx, call, s.cred, s.addr)
	if err != nil {
		return JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &JSONRPCError{
				Code:    ErrCodeInternal,
				Message: err.Error(),
			},
		}
	}

	// Return the tool response.
	return JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  mustMarshal(resp),
	}
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

func mustMarshal(v any) json.RawMessage {
	b, err := json.Marshal(v)
	if err != nil {
		// This should never happen with known types.
		return json.RawMessage(`{"error":"marshal failed"}`)
	}
	return b
}
