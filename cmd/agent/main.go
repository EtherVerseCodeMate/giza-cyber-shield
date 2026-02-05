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
	"strings"
	"syscall"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/agi"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/billing"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/config"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/net/tailnet"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/sekhem"
)

const (
	BannerSeparator     = "==========================================="
	HeaderContentType   = "Content-Type"
	MIMEApplicationJSON = "application/json"
)

type server struct {
	cfg    config.Config
	store  dag.Store
	agi    *agi.Engine
	sekhem *sekhem.SekhemTriad
	licAPI *LicensingAPI
}

func main() {
	showMachineID := flag.Bool("machine-id", false, "Print machine ID and exit")
	enrollmentToken := flag.String("enrollment-token", "", "Enrollment token")
	flag.Parse()

	if *showMachineID {
		printMachineID()
		return
	}

	initializeAgent(*enrollmentToken)
}

func printMachineID() {
	machineID := license.GenerateMachineID()
	fmt.Println(BannerSeparator)
	fmt.Println("  KHEPRA MACHINE ID (License Fingerprint)")
	fmt.Println(BannerSeparator)
	fmt.Printf("  Machine ID: %s\n", machineID)
	fmt.Println(BannerSeparator)
	fmt.Println("\nSend this Machine ID to your administrator\nto receive your license activation.\n")
	os.Exit(0)
}

func initializeAgent(token string) {
	if token == "" {
		token = os.Getenv("KHEPRA_ENROLLMENT_TOKEN")
	}

	cfg := config.Load()
	store := dag.GlobalDAG()

	// 1. Setup Licensing
	clientMgr, regMgr, enforcer := setupLicensing(token, store)

	// 2. Setup AGI and Sekhem
	arch := agi.NewEngine(store)
	triad := setupSekhem(arch, store)

	// 3. Setup API
	licAPI := NewLicensingAPI(LicensingDeps{
		ClientManager:      clientMgr,
		RegistryManager:    regMgr,
		DagLicenseEnforcer: enforcer,
		BillingCalculator:  billing.NewHybridBillingCalculator(500.0),
		TelemetryClient:    nil,
		DagStore:           store,
		IsAirGapped:        false,
		MachineID:          license.GenerateMachineID(),
	})

	s := &server{cfg: cfg, store: store, agi: arch, sekhem: triad, licAPI: licAPI}
	runServer(s, cfg)
}

func setupLicensing(token string, store dag.Store) (*license.Manager, *license.LicenseManager, *license.DAGLicenseEnforcer) {
	licenseServer := os.Getenv("KHEPRA_LICENSE_SERVER")
	if licenseServer == "" {
		licenseServer = "https://telemetry.souhimbou.org"
	}

	m, err := license.NewManager(licenseServer)
	if err != nil {
		log.Printf("[LICENSE] Error: %v", err)
	}

	if key := getMasterKey(); key != "" && m != nil {
		m.SetPrivateKey(key)
		log.Printf("[LICENSE] ✅ Sovereign mode enabled")
	}

	if token != "" && m != nil {
		m.SetEnrollmentToken(token)
	}
	if m != nil {
		if err := m.Initialize(); err != nil {
			log.Printf("[LICENSE] Warning: Using community mode: %v", err)
		}
	}

	regMgr := license.NewLicenseManager()
	enforcer := license.NewDAGLicenseEnforcer(regMgr)

	return m, regMgr, enforcer
}

func getMasterKey() string {
	if key := os.Getenv("KHEPRA_MASTER_KEY"); key != "" {
		return key
	}
	path := os.Getenv("KHEPRA_MASTER_KEY_PATH")
	if path == "" {
		path = "keys/offline/OFFLINE_ROOT_KEY.secret"
	}
	if data, err := os.ReadFile(path); err == nil {
		return strings.TrimSpace(string(data))
	}
	return ""
}

func setupSekhem(arch *agi.Engine, store dag.Store) *sekhem.SekhemTriad {
	mode := getDeploymentMode()
	triad, err := sekhem.NewSekhemTriad(arch, store, mode)
	if err != nil {
		log.Fatalf("[SEKHEM] Failed: %v", err)
	}
	_ = triad.Harmonize()
	return triad
}

func getDeploymentMode() sekhem.DeploymentMode {
	switch strings.ToLower(os.Getenv("KHEPRA_MODE")) {
	case "hybrid":
		return sekhem.ModeHybrid
	case "sovereign":
		return sekhem.ModeSovereign
	case "ironbank":
		return sekhem.ModeIronBank
	default:
		return sekhem.ModeEdge
	}
}

func runServer(s *server, cfg config.Config) {
	mux := http.NewServeMux()
	registerRoutes(mux, s)
	s.agi.Start()

	go func() {
		if cfg.TailscaleAuthKey != "" {
			startTailscale(mux, cfg)
		} else {
			startLocal(mux, cfg)
		}
	}()

	waitForInterrupt()
	s.agi.Stop()
	if s.sekhem != nil {
		s.sekhem.Stop()
	}
}

func registerRoutes(mux *http.ServeMux, s *server) {
	mux.HandleFunc("/healthz", s.health)
	mux.HandleFunc("/attest/new", s.attestNew)
	mux.HandleFunc("/dag/add", s.dagAdd)
	mux.HandleFunc("/dag/state", s.dagState)
	mux.HandleFunc("/agi/state", s.agiState)
	mux.HandleFunc("/agi/chat", s.agiChat)
	mux.HandleFunc("/agi/scan", s.agiScan)

	if s.licAPI != nil {
		s.licAPI.RegisterEndpoints(mux)
	}
}

func (s *server) health(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "time": time.Now()})
}

func (s *server) attestNew(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "attestation_not_implemented"})
}

func (s *server) dagAdd(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "dag_add_not_implemented"})
}

func (s *server) dagState(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "dag_state_not_implemented"})
}

func (s *server) agiState(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(s.agi.GetState())
}

func (s *server) agiChat(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "chat_not_implemented"})
}

func (s *server) agiScan(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "scan_started"})
}

func startTailscale(mux *http.ServeMux, cfg config.Config) {
	ts, _ := tailnet.NewServer("adinkhepra-node-" + randID())
	ln, _ := ts.Listen(context.TODO(), ":45444")
	log.Fatal(http.Serve(ln, sWithJSON(mux)))
}

func startLocal(mux *http.ServeMux, cfg config.Config) {
	addr := "127.0.0.1:" + itoa(cfg.AgentListenPort)
	log.Printf("ADINKHEPRA agent alive @ %s", addr)
	log.Fatal(http.ListenAndServe(addr, sWithJSON(mux)))
}

func waitForInterrupt() {
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
}

func sWithJSON(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set(HeaderContentType, MIMEApplicationJSON)
		h.ServeHTTP(w, r)
	})
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
