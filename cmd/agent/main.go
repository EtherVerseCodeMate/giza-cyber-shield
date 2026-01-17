package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	mrand "math/rand/v2"
	"net/http"

	"os"
	"os/signal"
	"syscall"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/agi"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/attest"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/config"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/lorentz"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/net/tailnet"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/nkyinkyim"
)

type server struct {
	cfg   config.Config
	store dag.Store
	agi   *agi.Engine
}

func main() {
	// CLI Flags for license management
	showMachineID := flag.Bool("machine-id", false, "Print machine ID and exit (for license registration)")
	flag.Parse()

	// If --machine-id flag, print and exit
	if *showMachineID {
		machineID := license.GenerateMachineID()
		fmt.Println("===========================================")
		fmt.Println("  KHEPRA MACHINE ID (License Fingerprint)")
		fmt.Println("===========================================")
		fmt.Printf("  Machine ID: %s\n", machineID)
		fmt.Println("===========================================")
		fmt.Println("")
		fmt.Println("Send this Machine ID to your administrator")
		fmt.Println("to receive your license activation.")
		fmt.Println("")
		os.Exit(0)
	}

	cfg := config.Load()
	// [DAG]: Use the global singleton immutable DAG (production-grade)
	// This ensures the agent server, standalone DAG viewer, and ERT all
	// write to the same cryptographically-secured data structure
	store := dag.GlobalDAG()

	// [LICENSE]: Initialize License Manager
	licenseServer := os.Getenv("KHEPRA_LICENSE_SERVER")
	if licenseServer == "" {
		licenseServer = "https://telemetry.souhimbou.org"
	}

	licMgr, err := license.NewManager(licenseServer)
	if err != nil {
		log.Printf("[LICENSE] Failed to create manager: %v", err)
	} else {
		// Attempt validation (blocking or strict?)
		// We'll log warning and proceed if it fails (Community Edition fallback)
		if err := licMgr.Initialize(); err != nil {
			log.Printf("[LICENSE] Validation warning: %v. Running in Community Mode.", err)
		} else {
			defer licMgr.Stop()
		}
	}

	// [AGI]: Initialize the Autonomous Architect
	arch := agi.NewEngine(store)
	s := &server{cfg: cfg, store: store, agi: arch}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.health)
	mux.HandleFunc("/attest/new", s.attestNew)
	mux.HandleFunc("/dag/add", s.dagAdd)
	mux.HandleFunc("/dag/state", s.dagState)
	mux.HandleFunc("/agi/state", s.agiState) // AGI Status
	mux.HandleFunc("/agi/chat", s.agiChat)   // AGI Chat
	mux.HandleFunc("/agi/scan", s.agiScan)   // AGI Commando Scan

	// Start the AGI in the background
	arch.Start()

	// Handle Graceful Shutdown
	go func() {
		// [ZERO-TRUST FABRIC]: If Tailscale Auth Key is present, join the mesh.
		if cfg.TailscaleAuthKey != "" {
			log.Println("[ADINKHEPRA] 🛡️  Initializing ZERO-TRUST FABRIC (Tailscale)...")
			ts, err := tailnet.NewServer("adinkhepra-node-" + randID())
			if err != nil {
				log.Fatalf("[ADINKHEPRA] Failed to start Tailscale: %v", err)
			}
			listener, err := ts.Listen(context.TODO(), ":45444")
			if err != nil {
				log.Fatalf("[ADINKHEPRA] Failed to listen on Tailscale: %v", err)
			}
			log.Printf("[ADINKHEPRA] 🟢 Agent is LIVE on Tailscale Mesh.")
			log.Fatal(http.Serve(listener, withJSON(mux)))
		} else {
			// SECURITY: Bind ONLY to localhost to prevent external access by default.
			addr := "127.0.0.1:" + itoa(cfg.AgentListenPort)
			log.Printf("ADINKHEPRA agent :: %s (Shadow Mode: Local Only)\n", addr)
			log.Fatal(http.ListenAndServe(addr, withJSON(mux)))
		}
	}()

	// Wait for interrupt signal
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("\n[Main] Shutting down...")
	arch.Stop()
	log.Println("[Main] Goodbye.")
}

func withJSON(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// CORS headers
		origin := r.Header.Get("Origin")
		// Allow local development origins
		if origin == "http://localhost:3000" || origin == "http://localhost:3001" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Cache-Control")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		h.ServeHTTP(w, r)
	})
}

func (s *server) health(w http.ResponseWriter, _ *http.Request) {
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok": true, "tenant": s.cfg.Tenant, "repo": s.cfg.RepoName, "email": s.cfg.GitEmail,
	})
}

func (s *server) attestNew(w http.ResponseWriter, _ *http.Request) {
	// [ADINKRA]: Generate Post-Quantum Identity (Dilithium)
	pub, priv, err := adinkra.GenerateDilithiumKey()
	if err != nil {
		http.Error(w, `{"error":"adinkra fizzle"}`, http.StatusInternalServerError)
		return
	}

	a := attest.Assertion{
		Schema:    "https://adinkhepra.dev/attest/v1",
		Symbol:    "Eban",
		Semantics: attest.Semantics{Boundary: s.cfg.Tenant, Purpose: "agent-attest", LeastPrivilege: true},
		Lifecycle: attest.Lifecycle{Journey: "Nkyinkyim"},
		Binding:   attest.Binding{Comment: s.cfg.GitEmail},
	}
	msg, _ := json.Marshal(a)

	// [ADINKRA]: Sign with the Spear
	sig, err := adinkra.Sign(priv, msg)
	if err != nil {
		http.Error(w, `{"error":"signing failure"}`, http.StatusInternalServerError)
		return
	}

	// [NKYINKYIM]: Shroud the Sacred Lattice
	shroud := nkyinkyim.Shroud(sig)

	// [DAG]: Automatically record this event in the constellation
	// We create a new node to represent this attestation
	node := dag.Node{
		Action: "attestation-forged",
		Symbol: a.Symbol,
		Time:   lorentz.StampNow(),
	}
	// Add to store (as a root node for now, or link to previous if we tracked tips)
	if err := s.store.Add(&node, []string{}); err != nil {
		log.Printf("[DAG] Warning: Failed to record attestation event: %v", err)
	} else {
		log.Printf("[DAG] Recorded attestation event: %s", node.ID)
	}

	// Return the Poetic Proof (Obfuscated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"assertion":           a,
		"pub_key":             pub,
		"x_adinkhepra_shroud": shroud, // The Hidden Verse
	})
}

type dagAddReq struct {
	Action  string   `json:"action"`
	Symbol  string   `json:"symbol"`
	Parents []string `json:"parent_ids"`
}

func (s *server) dagAdd(w http.ResponseWriter, r *http.Request) {
	var req dagAddReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Action == "" || req.Symbol == "" {
		http.Error(w, `{"error":"bad request"}`, http.StatusBadRequest)
		return
	}
	n := dag.Node{
		Action: req.Action,
		Symbol: req.Symbol,
		Time:   lorentz.StampNow(),
	}
	if err := s.store.Add(&n, req.Parents); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}
	_ = json.NewEncoder(w).Encode(n)
}

func (s *server) dagState(w http.ResponseWriter, _ *http.Request) {
	_ = json.NewEncoder(w).Encode(s.store.All())
}

func (s *server) agiState(w http.ResponseWriter, _ *http.Request) {
	_ = json.NewEncoder(w).Encode(s.agi.GetState())
}

func (s *server) agiChat(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad request"}`, http.StatusBadRequest)
		return
	}
	response := s.agi.Chat(req.Message)
	_ = json.NewEncoder(w).Encode(map[string]string{"response": response})
}

func (s *server) agiScan(w http.ResponseWriter, r *http.Request) {
	// Trigger a scan
	go s.agi.RunScan("localhost")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "Mission Initiated"})
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [20]byte
	i := len(b)
	neg := n < 0
	if neg {
		n = -n
	}
	for n > 0 {
		i--
		b[i] = byte('0' + (n % 10))
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

func randID() string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 12)
	for i := range b {
		b[i] = letters[mrand.IntN(len(letters))]
	}
	return string(b)
}
