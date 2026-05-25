package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/g0dm0d3"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/logging"
)

const (
	watchDivider      = "═══════════════════════════════════════════════════════════════"
	watchContentType  = "Content-Type"
	watchAppJSON      = "application/json"
	watchCORSOrigin   = "Access-Control-Allow-Origin"
)

// watchCmd starts the ASAF wrapper + live dashboard
//
// Usage:
//
//	adinkhepra watch [-port 45444]
//
// This is the money demo: user runs watch, uses Claude Code for 5 minutes,
// opens the dashboard, sees every signed AI action. "That's what an auditor sees."
func watchCmd(args []string) {
	port := parseWatchPort(args)

	printWatchBanner()

	dagStore := dag.GlobalDAG()
	fmt.Printf("  ✅ DAG connected (%d nodes)\n", len(dagStore.All()))

	logger := logging.NewDoDLogger(os.Stdout, logging.RedactSensitive, "default", "asaf-watch")
	wrapper := asaf.NewASAFWrapper(dagStore, logger)
	recorder := asaf.NewRecorder(wrapper)

	brain := g0dm0d3.NewServer(dagStore)
	fmt.Printf("  🧠 G0DM0D3 AI: %s\n", brain.Provider.Name())

	defaultAgent, err := wrapper.WrapMCPAgent("default-watch", "mcp-interceptor")
	if err != nil {
		log.Printf("  ⚠️  Could not start default session: %v", err)
	} else {
		fmt.Printf("  📡 ASAF session: %s\n", defaultAgent.SessionID)
	}

	mux := http.NewServeMux()
	registerWatchRoutes(mux, recorder, brain, dagStore, wrapper, defaultAgent)

	addr := fmt.Sprintf("0.0.0.0:%d", port)
	srv := &http.Server{Addr: addr, Handler: mux}

	printWatchEndpoints(port)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		fmt.Println("\n\n🛑 Shutting down ASAF...")
		if defaultAgent != nil {
			wrapper.EndSession(defaultAgent)
		}
		shutCtx, shutCancel := context.WithTimeout(ctx, 3*time.Second)
		defer shutCancel()
		srv.Shutdown(shutCtx) //nolint:errcheck
	}()

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("❌ Server error: %v\n", err)
	}
	fmt.Println("✅ ASAF stopped. All sessions signed and sealed in DAG.")
}

// parseWatchPort extracts the -port flag value from args (default 45444).
func parseWatchPort(args []string) int {
	port := 45444
	for i, arg := range args {
		if arg == "-port" && i+1 < len(args) {
			fmt.Sscanf(args[i+1], "%d", &port)
		}
	}
	return port
}

// printWatchBanner prints the ASAF startup banner.
func printWatchBanner() {
	fmt.Println(watchDivider)
	fmt.Println("  🔒 ADINKHEPRA ASAF // Security Camera + Flight Recorder")
	fmt.Println(watchDivider)
	fmt.Println()
	fmt.Println("  Your AI agents are being recorded.")
	fmt.Println("  Every action. Signed. Tamper-proof. Auditor-ready.")
	fmt.Println()
}

// printWatchEndpoints prints the listening address and endpoint list.
func printWatchEndpoints(port int) {
	fmt.Println()
	fmt.Println("  📊 Endpoints:")
	fmt.Printf("     http://localhost:%d/api/asaf/stream    — Live SSE feed\n", port)
	fmt.Printf("     http://localhost:%d/api/asaf/sessions  — Active sessions\n", port)
	fmt.Printf("     http://localhost:%d/api/asaf/record    — Record MCP action\n", port)
	fmt.Printf("     http://localhost:%d/api/g0dm0d3/chat   — AI chat\n", port)
	fmt.Printf("     http://localhost:%d/api/dag/nodes      — DAG nodes\n", port)
	fmt.Printf("     http://localhost:%d/healthz            — Health check\n", port)
	fmt.Println()
	fmt.Printf("  🌐 Dashboard: http://localhost:%d\n", port)
	fmt.Println("  Press Ctrl+C to stop")
	fmt.Println(watchDivider)
}

// registerWatchRoutes wires all HTTP routes onto mux.
func registerWatchRoutes(
	mux *http.ServeMux,
	recorder *asaf.Recorder,
	brain *g0dm0d3.G0DM0D3Server,
	dagStore *dag.PersistentMemory,
	wrapper *asaf.ASAFWrapper,
	defaultAgent *asaf.WrappedAgent,
) {
	// ASAF endpoints
	mux.HandleFunc("/api/asaf/stream", recorder.HandleSSE)
	mux.HandleFunc("/api/asaf/sessions", recorder.HandleSessions)
	mux.HandleFunc("/api/asaf/history", recorder.HandleHistory)
	mux.HandleFunc("/api/asaf/record", buildRecordHandler(wrapper, recorder, defaultAgent))

	// G0DM0D3 AI endpoints
	mux.HandleFunc("/api/g0dm0d3/chat", brain.HandleChat)
	mux.HandleFunc("/api/g0dm0d3/status", brain.HandleStatus)

	// DAG endpoints
	mux.HandleFunc("/api/dag/nodes", buildDAGNodesHandler(dagStore))
	mux.HandleFunc("/api/dag/stats", buildDAGStatsHandler(dagStore))

	// Sovereign scan API (mirrors cloud /api/v1/onboarding/scan)
	// Allows `adinkhepra scan --target <host>` to work fully offline.
	registerScanRoutes(mux)

	// Health checks
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(watchContentType, watchAppJSON)
		json.NewEncoder(w).Encode(map[string]string{ //nolint:errcheck
			"status": "ok", "engine": "AdinKhepra ASAF", "version": "1.0",
		})
	})
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(watchContentType, watchAppJSON)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"}) //nolint:errcheck
	})
}

// buildDAGNodesHandler returns the /api/dag/nodes handler.
func buildDAGNodesHandler(dagStore *dag.PersistentMemory) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(watchContentType, watchAppJSON)
		w.Header().Set(watchCORSOrigin, "*")
		nodes := dagStore.All()
		json.NewEncoder(w).Encode(map[string]interface{}{ //nolint:errcheck
			"nodes": nodes,
			"count": len(nodes),
		})
	}
}

// buildDAGStatsHandler returns the /api/dag/stats handler.
func buildDAGStatsHandler(dagStore *dag.PersistentMemory) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(watchContentType, watchAppJSON)
		w.Header().Set(watchCORSOrigin, "*")
		nodes := dagStore.All()
		signed, asafNodes := 0, 0
		for _, n := range nodes {
			if n.Signature != "" {
				signed++
			}
			if len(n.Action) > 4 && n.Action[:4] == "ASAF" {
				asafNodes++
			}
		}
		json.NewEncoder(w).Encode(map[string]interface{}{ //nolint:errcheck
			"total_nodes": len(nodes), "signed_nodes": signed, "asaf_nodes": asafNodes,
		})
	}
}

// buildRecordHandler returns the /api/asaf/record POST handler.
func buildRecordHandler(
	wrapper *asaf.ASAFWrapper,
	recorder *asaf.Recorder,
	defaultAgent *asaf.WrappedAgent,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(watchContentType, watchAppJSON)
		w.Header().Set(watchCORSOrigin, "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Key")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		var action asaf.MCPAction
		if err := json.NewDecoder(r.Body).Decode(&action); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		if action.Timestamp.IsZero() {
			action.Timestamp = time.Now().UTC()
		}

		agent := defaultAgent
		if action.SessionID != "" {
			if sess, ok := wrapper.GetSession(action.SessionID); ok {
				agent = sess
			}
		}
		if agent == nil {
			http.Error(w, `{"error":"no active session"}`, http.StatusBadRequest)
			return
		}

		node, err := wrapper.RecordAction(agent, action)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
			return
		}

		recorder.Broadcast(asaf.ActionEvent{
			Type: "action", NodeID: node.ID, SessionID: agent.SessionID,
			AgentID: agent.AgentID, AgentType: agent.AgentType,
			Tool: action.Tool, Timestamp: action.Timestamp,
		})

		json.NewEncoder(w).Encode(map[string]string{ //nolint:errcheck
			"status": "recorded", "node_id": node.ID,
		})
	}
}
