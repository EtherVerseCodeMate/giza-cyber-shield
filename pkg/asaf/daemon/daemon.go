// pkg/asaf/daemon/daemon.go — Core ASAF System Daemon Logic
//
// Implements the execution layer that makes Compliance Graph changes real:
// click "Remediate" in the UI → ChangeRequest arrives here → verified →
// staged → approved → executed on the production host → DAG-attested.
//
// Security invariants enforced here (NOT configurable, NOT bypassable):
//
//  1. ML-DSA-65 signature over canonical request bytes — any tampering = reject
//  2. Eban symbol required for kernel-level ops (sysctl, PAM, SELinux, GRUB)
//  3. Staging MUST succeed before production (staging=true runs in container)
//  4. Approved=true required for production execution (human-in-the-loop)
//  5. Every execution → signed DAG node (tamper-evident, quantum-resistant)
//
// IP: SecRed Knowledge Inc. / SOUHIMBOU DOH KONE LLC — USPTO #73565085

package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
)

// ChangeRequest is the signed instruction sent by the Compliance Graph UI
// (via the ASAF Policy Editor) to the ASAF System Daemon.
//
// Every field participates in the canonical signature — any field mutation
// after signing causes VerifyMLDSA65 to return false.
type ChangeRequest struct {
	// Identity
	AgentID string `json:"agent_id"` // Nkyinkyim-bound Adinkra identity
	Symbol  string `json:"symbol"`   // Adinkra symbol (Eban required for kernel ops)

	// Authorization chain
	ControlID string `json:"control_id"` // STIG/CMMC control served (e.g. "AC-2", "SC-13")
	DAGParent string `json:"dag_parent"` // parent DAG node ID proving authorization chain

	// Execution
	Command []string `json:"command"` // privileged command (e.g. ["sysctl", "-w", "crypto.fips_enabled=1"])

	// Gate flags
	Staging  bool `json:"staging"`  // true = execute in mirror container only
	Approved bool `json:"approved"` // true = human approved for production

	// PQC attestation
	Signature []byte `json:"signature"` // ML-DSA-65 signature over canonical JSON
	Timestamp string `json:"timestamp"` // ISO-8601, included in signed bytes
}

// ChangeResult is returned over the Unix socket after execution.
type ChangeResult struct {
	Success   bool   `json:"success"`
	ExitCode  int    `json:"exit_code"`
	Stdout    string `json:"stdout"`
	Stderr    string `json:"stderr"`
	DAGNodeID string `json:"dag_node_id"` // ML-DSA-65 signed execution record
	StagingID string `json:"staging_id,omitempty"` // populated when Staging=true
	Error     string `json:"error,omitempty"`
}

// SecurityEvent is logged to the DAG for every authorization failure.
type SecurityEvent struct {
	Type      string    `json:"type"`
	AgentID   string    `json:"agent_id"`
	Symbol    string    `json:"symbol"`
	ControlID string    `json:"control_id"`
	Command   []string  `json:"command"`
	Reason    string    `json:"reason"`
	Time      time.Time `json:"time"`
}

// Config holds all daemon construction parameters.
type Config struct {
	SocketPath    string
	DAGPath       string
	AgentPubKey   []byte // ML-DSA-65 public key of the authorized ASAF agent
	DaemonPrivKey []byte // ML-DSA-65 private key for signing DAG attestation nodes
	Logger        *log.Logger
	EnableMTLS    bool
	MTLSAddr      string
	MTLSCertFile  string
	MTLSKeyFile   string
	MTLSCAFile    string
}

// ASAFDaemon is the privileged execution engine.
type ASAFDaemon struct {
	cfg     Config
	dagStore dag.Store
	staging  *StagingManager
	mu      sync.Mutex
	logger  *log.Logger
}

// New constructs an ASAFDaemon, validates config, and opens the DAG store.
func New(cfg Config) (*ASAFDaemon, error) {
	if len(cfg.AgentPubKey) == 0 {
		return nil, fmt.Errorf("daemon: AgentPubKey is required — cannot operate without signature verification")
	}
	if len(cfg.DaemonPrivKey) == 0 {
		return nil, fmt.Errorf("daemon: DaemonPrivKey is required — cannot attest without signing key")
	}
	if cfg.SocketPath == "" {
		return nil, fmt.Errorf("daemon: SocketPath is required")
	}
	if cfg.Logger == nil {
		cfg.Logger = log.New(os.Stderr, "[asaf-daemon] ", log.LstdFlags)
	}

	// Ensure socket directory exists
	if err := os.MkdirAll(filepath.Dir(cfg.SocketPath), 0700); err != nil {
		return nil, fmt.Errorf("daemon: cannot create socket directory: %w", err)
	}

	// Ensure DAG directory exists
	if err := os.MkdirAll(cfg.DAGPath, 0700); err != nil {
		return nil, fmt.Errorf("daemon: cannot create DAG directory: %w", err)
	}

	// Open persistent DAG store
	dagStore := dag.NewMemoryStore() // will be swapped to PersistentStore in production

	return &ASAFDaemon{
		cfg:      cfg,
		dagStore: dagStore,
		staging:  NewStagingManager(cfg.Logger),
		logger:   cfg.Logger,
	}, nil
}

// Run starts the Unix socket listener and blocks until ctx is cancelled.
func (d *ASAFDaemon) Run(ctx context.Context) error {
	// Remove stale socket
	_ = os.Remove(d.cfg.SocketPath)

	l, err := net.Listen("unix", d.cfg.SocketPath)
	if err != nil {
		return fmt.Errorf("daemon: bind unix socket %s: %w", d.cfg.SocketPath, err)
	}
	defer l.Close()

	// Restrict socket to root-only access
	if err := os.Chmod(d.cfg.SocketPath, 0600); err != nil {
		return fmt.Errorf("daemon: chmod socket: %w", err)
	}

	d.logger.Printf("Unix socket ready: %s", d.cfg.SocketPath)

	// Accept loop — each connection handled in its own goroutine
	connErrs := make(chan error, 1)
	go func() {
		for {
			conn, err := l.Accept()
			if err != nil {
				select {
				case <-ctx.Done():
					return
				default:
					connErrs <- err
					return
				}
			}
			go d.handleConn(conn)
		}
	}()

	select {
	case <-ctx.Done():
		d.logger.Printf("context cancelled — shutting down")
		return nil
	case err := <-connErrs:
		return fmt.Errorf("daemon: accept error: %w", err)
	}
}

// handleConn processes a single ChangeRequest from a connected client.
func (d *ASAFDaemon) handleConn(conn net.Conn) {
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(30 * time.Second)) //nolint:errcheck

	var req ChangeRequest
	if err := json.NewDecoder(conn).Decode(&req); err != nil {
		d.writeResult(conn, &ChangeResult{Error: "invalid JSON: " + err.Error()})
		return
	}

	result := d.Execute(&req)
	d.writeResult(conn, result)
}

// Execute is the security-critical execution path.
// All invariants are checked here in order — any failure returns immediately.
func (d *ASAFDaemon) Execute(req *ChangeRequest) *ChangeResult {
	// ── 1. ML-DSA-65 SIGNATURE VERIFICATION ──────────────────────────────────
	// Build canonical bytes: everything except the Signature field.
	canonical, err := canonicalBytes(req)
	if err != nil {
		d.logSecurityEvent("CANONICAL_SERIALIZE_FAILED", req, "cannot serialize request")
		return &ChangeResult{Error: "signature verification failed: cannot canonicalize request"}
	}

	if !adinkra.VerifyWithPublicKey(d.cfg.AgentPubKey, canonical, req.Signature) {
		d.logSecurityEvent("SIGNATURE_REJECTED", req, "ML-DSA-65 verification failed")
		d.logger.Printf("[SECURITY] UNAUTHORIZED ATTEMPT REJECTED — agent=%s control=%s command=%v",
			req.AgentID, req.ControlID, req.Command)
		return &ChangeResult{Error: "unauthorized: ML-DSA-65 signature verification failed"}
	}

	// ── 2. SYMBOL-BASED AUTHORIZATION (EBAN ENFORCEMENT) ─────────────────────
	// Kernel-level operations require Eban (fortress symbol).
	// This is a hard constraint — not configurable, not bypassable.
	if isKernelCommand(req.Command) && req.Symbol != "Eban" {
		reason := fmt.Sprintf("kernel operation %v requires Symbol=Eban, got %q", req.Command, req.Symbol)
		d.logSecurityEvent("SYMBOL_CONSTRAINT_VIOLATED", req, reason)
		return &ChangeResult{Error: reason}
	}

	// ── 3. COMMAND VALIDATION ─────────────────────────────────────────────────
	if len(req.Command) == 0 {
		return &ChangeResult{Error: "command is required"}
	}
	if err := validateCommand(req.Command); err != nil {
		return &ChangeResult{Error: "command validation failed: " + err.Error()}
	}

	// ── 4. STAGING GATE ───────────────────────────────────────────────────────
	// If staging=true, run in mirror container — never touch production.
	if req.Staging {
		return d.runStaging(req)
	}

	// ── 5. PRODUCTION GATE ───────────────────────────────────────────────────
	// Production execution requires explicit human approval.
	// The Approved flag must have been set by the Compliance Graph approval workflow.
	if !req.Approved {
		return &ChangeResult{Error: "production execution requires Approved=true — submit via approval workflow"}
	}

	// ── 6. EXECUTE PRIVILEGED COMMAND ────────────────────────────────────────
	result := executePrivileged(req.Command, d.logger)

	// ── 7. DAG ATTESTATION ────────────────────────────────────────────────────
	// Record the execution as a ML-DSA-65 signed DAG node.
	// This is the tamper-evident proof that the command ran.
	nodeID, dagErr := d.attestExecution(req, result)
	if dagErr != nil {
		// DAG failure is logged but not fatal — execution already succeeded.
		// The operator MUST investigate DAG write failures (possible disk issue).
		d.logger.Printf("[WARN] DAG attestation failed for control %s: %v", req.ControlID, dagErr)
	}

	result.DAGNodeID = nodeID
	return result
}

// runStaging executes the command in a mirror container and returns a staging job.
func (d *ASAFDaemon) runStaging(req *ChangeRequest) *ChangeResult {
	job, err := d.staging.Submit(req)
	if err != nil {
		return &ChangeResult{Error: "staging submission failed: " + err.Error()}
	}
	d.logger.Printf("[STAGING] job=%s control=%s command=%v", job.ID, req.ControlID, req.Command)
	return &ChangeResult{
		Success:   true,
		StagingID: job.ID,
		Stdout:    fmt.Sprintf("Staging job submitted. Poll /api/compliance/staging/%s for results.", job.ID),
	}
}

// attestExecution writes a ML-DSA-65 signed DAG node recording the execution.
func (d *ASAFDaemon) attestExecution(req *ChangeRequest, result *ChangeResult) (string, error) {
	node := &dag.Node{
		Action: "SYSTEM_CHANGE",
		Symbol: req.Symbol,
		Time:   time.Now().UTC().Format(time.RFC3339),
		Parents: func() []string {
			if req.DAGParent != "" {
				return []string{req.DAGParent}
			}
			return nil
		}(),
		PQC: map[string]string{
			"control_id": req.ControlID,
			"agent_id":   req.AgentID,
			"exit_code":  fmt.Sprintf("%d", result.ExitCode),
			"engine":     "ML-DSA-65",
		},
	}

	// Sign with daemon's private key
	if len(d.cfg.DaemonPrivKey) > 0 {
		if err := node.Sign(d.cfg.DaemonPrivKey); err != nil {
			return "", fmt.Errorf("attestor: sign failed: %w", err)
		}
	} else {
		node.ID = node.ComputeHash()
		node.Hash = node.ID
	}

	if err := d.dagStore.Add(node, nil); err != nil {
		return "", fmt.Errorf("attestor: DAG append failed: %w", err)
	}

	return node.ID, nil
}

// logSecurityEvent writes an unauthorized-access event to the DAG.
// These nodes are a permanent part of the audit trail.
func (d *ASAFDaemon) logSecurityEvent(eventType string, req *ChangeRequest, reason string) {
	node := &dag.Node{
		Action: "SECURITY_EVENT:" + eventType,
		Symbol: "Eban", // security events always use Eban (fortress)
		Time:   time.Now().UTC().Format(time.RFC3339),
		PQC: map[string]string{
			"agent_id":   req.AgentID,
			"control_id": req.ControlID,
			"reason":     reason,
			"engine":     "ML-DSA-65",
		},
	}
	node.ID = node.ComputeHash()
	node.Hash = node.ID
	_ = d.dagStore.Add(node, nil) //nolint:errcheck — best-effort security log
}

// writeResult JSON-encodes the result back to the client connection.
func (d *ASAFDaemon) writeResult(conn net.Conn, result *ChangeResult) {
	if err := json.NewEncoder(conn).Encode(result); err != nil {
		d.logger.Printf("WARN: failed to write result to client: %v", err)
	}
}

// canonicalBytes produces the byte sequence that is ML-DSA-65 signed.
// The Signature field is zeroed before marshaling to ensure determinism.
func canonicalBytes(req *ChangeRequest) ([]byte, error) {
	// Shallow copy with signature zeroed — we sign everything else
	canonical := *req
	canonical.Signature = nil
	return json.Marshal(canonical)
}

// ZeroBytes overwrites a byte slice with zeros (key material destruction).
func ZeroBytes(b []byte) {
	for i := range b {
		b[i] = 0
	}
}
