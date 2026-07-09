// cmd/license-authority — NouchiX License Authority REST server.
//
// Runs on the Hostinger VPS (187.124.225.91). This is the OPERATIONAL license
// signing path — the Shamir ceremony is the DISASTER RECOVERY backup only.
//
// The master ML-DSA-65 private key lives at /opt/khepra-authority/master.key
// on the VPS. It never leaves that machine. The customer's machine sends a
// LicenseRequest (from qkd_distribution.go), receives a LicenseCapsule, and
// installs it with `adinkhepra license install`.
//
// Setup (ONE TIME on VPS):
//
//	# 1. After root ceremony, export the reconstructed private key bytes:
//	adinkhepra keygen --dilithium --hex > /tmp/master.hex
//	# 2. Move to protected path:
//	sudo mv /tmp/master.hex /opt/khepra-authority/master.key
//	sudo chmod 600 /opt/khepra-authority/master.key
//	sudo chown license-authority:license-authority /opt/khepra-authority/master.key
//
// Run:
//
//	AUTHORITY_BEARER_TOKEN=<secret> license-authority -key /opt/khepra-authority/master.key -port 7443
//
// Endpoints:
//
//	POST /v1/license/request   → body: LicenseRequest JSON → returns LicenseCapsule JSON
//	POST /v1/license/revoke    → body: { "license_id": "...", "reason": "..." }
//	GET  /v1/license/crl       → current CRL CID
//	GET  /healthz              → liveness probe
//
// IP: SOUHIMBOU DOH KONE LLC, exclusively licensed to SecRed Knowledge Inc.
// USPTO #73565085.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/cloudflare/circl/sign/mldsa/mldsa65"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
)

// ─── Config ───────────────────────────────────────────────────────────────────

type config struct {
	keyPath      string
	port         int
	ttl          time.Duration
	bearerToken  string
	ipfsGateway  string
	telemetryURL string
}

// ─── Authority State ──────────────────────────────────────────────────────────

type server struct {
	cfg config
	sla *license.SovereignLicenseAuthority
	log *log.Logger
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	cfg := config{}
	flag.StringVar(&cfg.keyPath, "key", "/opt/khepra-authority/master.key", "Path to master ML-DSA-65 private key (hex-encoded bytes)")
	flag.IntVar(&cfg.port, "port", 7443, "HTTP listen port")
	flag.DurationVar(&cfg.ttl, "ttl", 365*24*time.Hour, "Default license TTL")
	flag.StringVar(&cfg.bearerToken, "token", os.Getenv("AUTHORITY_BEARER_TOKEN"), "Bearer token for POST endpoints")
	flag.StringVar(&cfg.ipfsGateway, "ipfs", "https://ipfs.io", "IPFS gateway for CRL publishing")
	flag.StringVar(&cfg.telemetryURL, "telemetry", "", "Optional telemetry URL")
	flag.Parse()

	logger := log.New(os.Stdout, "[KHEPRA-AUTHORITY] ", log.LstdFlags|log.LUTC)

	if cfg.bearerToken == "" {
		logger.Fatal("FATAL: AUTHORITY_BEARER_TOKEN env var or -token flag must be set — authority cannot run unauthenticated")
	}

	sla, err := loadAuthority(cfg.keyPath, cfg.telemetryURL, cfg.ipfsGateway)
	if err != nil {
		logger.Fatalf("FATAL: load authority key from %s: %v", cfg.keyPath, err)
	}
	logger.Printf("Authority ready — key fingerprint: %x…", sla.PublicKey[:8])

	srv := &server{cfg: cfg, sla: sla, log: logger}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", srv.handleHealth)
	mux.HandleFunc("/v1/license/request", srv.authMiddleware(srv.handleRequest))
	mux.HandleFunc("/v1/license/revoke", srv.authMiddleware(srv.handleRevoke))
	mux.HandleFunc("/v1/license/crl", srv.handleCRL)

	addr := fmt.Sprintf(":%d", cfg.port)
	logger.Printf("License Authority listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		logger.Fatalf("Server error: %v", err)
	}
}

// ─── Middleware ───────────────────────────────────────────────────────────────

func (s *server) authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		expected := "Bearer " + s.cfg.bearerToken
		if auth != expected {
			s.writeError(w, http.StatusUnauthorized, "invalid or missing bearer token")
			return
		}
		next(w, r)
	}
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

// POST /v1/license/request
// Body: license.LicenseRequest JSON
// Returns: license.LicenseCapsule JSON
func (s *server) handleRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.writeError(w, http.StatusMethodNotAllowed, "POST required")
		return
	}

	var req license.LicenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeError(w, http.StatusBadRequest, "parse request: "+err.Error())
		return
	}

	// Only pilot and enterprise tiers via online path; master is internal.
	allowed := map[string]bool{
		license.TierCommunity:  true,
		license.TierPilot:      true,
		license.TierEnterprise: true,
	}
	if !allowed[req.RequestedTier] {
		s.writeError(w, http.StatusBadRequest, fmt.Sprintf("tier %q not available via this endpoint", req.RequestedTier))
		return
	}

	s.log.Printf("License request: tenant=%q tier=%s deviceID=%s…",
		req.Tenant, req.RequestedTier, safePrefix(req.DeviceID, 16))

	capsule, err := s.sla.IssueLicenseCapsule(&req, s.cfg.ttl)
	if err != nil {
		s.log.Printf("ERROR IssueLicenseCapsule: %v", err)
		s.writeError(w, http.StatusInternalServerError, "issue capsule: "+err.Error())
		return
	}

	s.log.Printf("Issued capsule %s for %q (%s, exp %s)",
		capsule.CapsuleID, req.Tenant, req.RequestedTier, capsule.ExpiresAt.Format(time.RFC3339))
	s.writeJSON(w, http.StatusOK, capsule)
}

// POST /v1/license/revoke
// Body: { "license_id": "...", "reason": "..." }
func (s *server) handleRevoke(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.writeError(w, http.StatusMethodNotAllowed, "POST required")
		return
	}
	var body struct {
		LicenseID string `json:"license_id"`
		Reason    string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.writeError(w, http.StatusBadRequest, "parse body: "+err.Error())
		return
	}
	if body.LicenseID == "" {
		s.writeError(w, http.StatusBadRequest, "license_id required")
		return
	}
	if err := s.sla.RevokeLicense(body.LicenseID, body.Reason); err != nil {
		s.writeError(w, http.StatusInternalServerError, "revoke: "+err.Error())
		return
	}
	s.log.Printf("Revoked %s: %s", body.LicenseID, body.Reason)
	s.writeJSON(w, http.StatusOK, map[string]string{
		"status":     "revoked",
		"license_id": body.LicenseID,
	})
}

// GET /v1/license/crl
func (s *server) handleCRL(w http.ResponseWriter, r *http.Request) {
	s.writeJSON(w, http.StatusOK, map[string]string{
		"crl_cid": s.sla.RevocationDB.CurrentCID(),
		"note":    "fetch full CRL from IPFS using the crl_cid value",
	})
}

// GET /healthz
func (s *server) handleHealth(w http.ResponseWriter, r *http.Request) {
	s.writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "khepra-license-authority",
		"pubkey":  fmt.Sprintf("%x…", s.sla.PublicKey[:8]),
	})
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func (s *server) writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func (s *server) writeError(w http.ResponseWriter, code int, msg string) {
	s.writeJSON(w, code, map[string]string{"error": msg})
}

func safePrefix(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// ─── Authority Key Loading ────────────────────────────────────────────────────

// loadAuthority loads the master ML-DSA-65 private key from keyPath and returns
// a SovereignLicenseAuthority ready to sign license capsules.
//
// keyPath must contain the raw private key bytes (hex-encoded, one line).
//
// The ML-DSA-65 (mldsa65) PrivateKey struct in CIRCL contains the public key.
// PrivateKey.Public() extracts it — no separate derivation needed.
func loadAuthority(keyPath, telemetryURL, ipfsGateway string) (*license.SovereignLicenseAuthority, error) {
	raw, err := os.ReadFile(keyPath)
	if err != nil {
		return nil, fmt.Errorf("read key file: %w", err)
	}

	hexStr := strings.TrimSpace(string(raw))
	privBytes := make([]byte, mldsa65.PrivateKeySize)

	// Try hex decode first (recommended storage format).
	decoded, err := hexDecodeString(hexStr)
	if err == nil && len(decoded) == mldsa65.PrivateKeySize {
		copy(privBytes, decoded)
	} else if len(raw) == mldsa65.PrivateKeySize {
		// Raw binary fallback.
		copy(privBytes, raw)
	} else {
		return nil, fmt.Errorf("key file must be %d-byte ML-DSA-65 private key (hex or raw binary), got %d hex chars",
			mldsa65.PrivateKeySize, len(hexStr)/2)
	}

	// Unpack private key to extract the embedded public key.
	var sk mldsa65.PrivateKey
	sk.Unpack((*[mldsa65.PrivateKeySize]byte)(privBytes))
	pubKey := sk.Public().(*mldsa65.PublicKey)
	pubBytes := make([]byte, mldsa65.PublicKeySize)
	pubKey.Pack((*[mldsa65.PublicKeySize]byte)(pubBytes))

	return &license.SovereignLicenseAuthority{
		PrivateKey:   privBytes,
		PublicKey:    pubBytes,
		RevocationDB: license.NewRevocationDatabase(),
		TelemetryURL: telemetryURL,
		IPFSGateway:  ipfsGateway,
	}, nil
}

func hexDecodeString(s string) ([]byte, error) {
	if len(s)%2 != 0 {
		return nil, fmt.Errorf("odd hex string length")
	}
	b := make([]byte, len(s)/2)
	for i := 0; i < len(s); i += 2 {
		var v byte
		hi := hexNibble(s[i])
		lo := hexNibble(s[i+1])
		if hi < 0 || lo < 0 {
			return nil, fmt.Errorf("invalid hex char at position %d", i)
		}
		v = byte(hi<<4) | byte(lo)
		b[i/2] = v
	}
	return b, nil
}

func hexNibble(c byte) int {
	switch {
	case c >= '0' && c <= '9':
		return int(c - '0')
	case c >= 'a' && c <= 'f':
		return int(c-'a') + 10
	case c >= 'A' && c <= 'F':
		return int(c-'A') + 10
	}
	return -1
}
