package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"log"
	"math/rand/v2"
	"net/http"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/attest"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/config"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/lorentz"
)

type server struct {
	cfg   config.Config
	store *dag.Memory
}

func main() {
	cfg := config.Load()
	s := &server{cfg: cfg, store: dag.NewMemory()}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.health)
	mux.HandleFunc("/attest/new", s.attestNew)
	mux.HandleFunc("/dag/add", s.dagAdd)
	mux.HandleFunc("/dag/state", s.dagState)

	addr := ":" + itoa(cfg.AgentListenPort)
	log.Printf("KHEPRA agent :: %s (external %s:15171 via Shells PF)\n", addr, cfg.ExternalIP)
	log.Fatal(http.ListenAndServe(addr, withJSON(mux)))
}

func withJSON(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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

type attestRes struct {
	Assertion attest.Assertion `json:"assertion"`
	PubKey    []byte           `json:"pub_key"`
	Signature []byte           `json:"signature"`
}

func (s *server) attestNew(w http.ResponseWriter, _ *http.Request) {
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	a := attest.Assertion{
		Schema: "https://khepra.dev/attest/v1",
		Symbol: "Eban",
		Semantics: attest.Semantics{Boundary: s.cfg.Tenant, Purpose: "agent-attest", LeastPrivilege: true},
		Lifecycle: attest.Lifecycle{Journey: "Nkyinkyim"},
		Binding:   attest.Binding{Comment: s.cfg.GitEmail},
	}
	msg, _ := json.Marshal(a)
	sig := ed25519.Sign(priv, msg)
	_ = json.NewEncoder(w).Encode(attestRes{Assertion: a, PubKey: pub, Signature: sig})
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
		ID:     randID(),
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

func itoa(n int) string {
	if n == 0 { return "0" }
	var b [20]byte
	i := len(b)
	neg := n < 0
	if neg { n = -n }
	for n > 0 {
		i--
		b[i] = byte('0' + (n % 10))
		n /= 10
	}
	if neg { i--; b[i] = '-' }
	return string(b[i:])
}

func randID() string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 12)
	for i := range b {
		b[i] = letters[rand.IntN(len(letters))]
	}
	return string(b)
}
