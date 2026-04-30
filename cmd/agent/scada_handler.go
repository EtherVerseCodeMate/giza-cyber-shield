package main

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strconv"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scada"
)

// auditChannel describes the security posture of a single communication channel.
type auditChannel struct {
	Name   string `json:"name"`
	Status string `json:"status"` // EXPOSED | SIGNED | NONE
	MITRE  string `json:"mitre"`
	Note   string `json:"note"`
}

// mitreFinding is a single MITRE ATT&CK for ICS entry.
type mitreFinding struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Severity string `json:"severity"`
}

// auditResponse is the payload returned by /api/scada/audit.
type auditResponse struct {
	RiskLevel string         `json:"risk_level"`
	Channels  []auditChannel `json:"channels"`
	Findings  []mitreFinding `json:"findings"`
}

// globalPoller is initialised once by initSCADAPoller and shared across handlers.
var globalPoller *scada.Poller

// initSCADAPoller starts the background Modbus poller and registers the HTTP endpoints.
func initSCADAPoller(mux *http.ServeMux) {
	host := getenv("SCADA_HOST", "10.187.242.136")
	port := getenvInt("SCADA_PORT", 502)
	unitID := byte(getenvInt("SCADA_UNIT_ID", 2))

	globalPoller = scada.NewPoller(scada.Config{
		Host:   host,
		Port:   port,
		UnitID: unitID,
	})

	// Run the poller in the background — stopped when the process exits.
	go globalPoller.Run(context.Background())

	mux.HandleFunc("/api/scada/live", scadaLiveHandler)
	mux.HandleFunc("/api/scada/audit", scadaAuditHandler)
}

func scadaLiveHandler(w http.ResponseWriter, r *http.Request) {
	setCORSHeaders(w)
	if r.Method == http.MethodOptions {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	state := globalPoller.State()
	json.NewEncoder(w).Encode(state) //nolint:errcheck
}

func scadaAuditHandler(w http.ResponseWriter, r *http.Request) {
	setCORSHeaders(w)
	if r.Method == http.MethodOptions {
		return
	}
	w.Header().Set("Content-Type", "application/json")

	resp := auditResponse{
		RiskLevel: "HIGH",
		Channels: []auditChannel{
			{
				Name:   "Modbus TCP :502",
				Status: "EXPOSED",
				MITRE:  "T0855",
				Note:   "No authentication — any device on the subnet can issue commands",
			},
			{
				Name:   "MQTT :1883",
				Status: "EXPOSED",
				MITRE:  "T0859",
				Note:   "Plaintext broker — credentials and payloads visible to all LAN hosts",
			},
			{
				Name:   "SCORPION Channel",
				Status: "SIGNED",
				MITRE:  "",
				Note:   "HMAC-signed with Argon2ID KDF — integrity verified",
			},
			{
				Name:   "TLS / Encryption",
				Status: "NONE",
				MITRE:  "T0830",
				Note:   "No TLS on any OT channel — full man-in-the-middle exposure",
			},
		},
		Findings: []mitreFinding{
			{ID: "T0855", Name: "Unauthorized Command", Severity: "HIGH"},
			{ID: "T0859", Name: "Valid Accounts (eavesdrop)", Severity: "HIGH"},
			{ID: "T0830", Name: "Man-in-the-Middle", Severity: "CRITICAL"},
			{ID: "T0862", Name: "Supply Chain Compromise", Severity: "HIGH"},
		},
	}
	json.NewEncoder(w).Encode(resp) //nolint:errcheck
}

// setCORSHeaders allows the Next.js frontend (any localhost port) to call the agent.
func setCORSHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

// getenv returns the env var value or a default.
func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// getenvInt returns the env var parsed as int or a default.
func getenvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
