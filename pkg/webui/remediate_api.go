// RemediateAPI exposes the asaf-daemon ChangeRequest pipeline over HTTP, so
// the Compliance Graph UI's "Remediate" button has something real to call.
// Backed by pkg/asaf/client — every request here gets signed and relayed
// over the daemon's Unix socket; this process holds no privileges of its
// own, the daemon does the actual privileged execution.
//
// Every route here requires a valid session with the "remediation:write"
// permission (security-engineer or admin role — see PredefinedRoles in
// pkg/auth/provider.go). This is the HTTP-side authorization gate: without
// it, anyone who can reach this port could trigger privileged daemon
// operations without ever logging in — the daemon's own ML-DSA-65 signature
// check only verifies the request came from this process's agent identity,
// it has no concept of which human asked for it. Added 2026-06-30 after a
// security review caught the gap before first release.
package webui

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/client"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/auth"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
)

// RemediateAPI carries the daemon client and registers the remediation routes.
type RemediateAPI struct {
	client       *client.Client
	authProvider *auth.SQLiteProvider
}

// NewRemediateAPI wraps an already-constructed daemon Client and the auth
// provider used to authorize callers, for HTTP registration.
func NewRemediateAPI(c *client.Client, authProvider *auth.SQLiteProvider) *RemediateAPI {
	return &RemediateAPI{client: c, authProvider: authProvider}
}

// RegisterRoutes mounts the remediation endpoints onto mux.
func (a *RemediateAPI) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/asaf/remediate", a.handleRemediate)
	mux.HandleFunc("/api/v1/asaf/staging", a.handleStagingPoll)
}

// authorize checks the Authorization: Bearer <session_token> header against
// the sovereign auth store and requires the "remediation:write" permission.
// Returns the authenticated session on success, or writes an error response
// and returns nil on failure — callers should return immediately when nil.
func (a *RemediateAPI) authorize(w http.ResponseWriter, r *http.Request) *auth.Session {
	authHeader := r.Header.Get("Authorization")
	token := strings.TrimPrefix(authHeader, "Bearer ")
	if token == "" || token == authHeader {
		writeJSONError(w, http.StatusUnauthorized, "missing or malformed Authorization: Bearer <session_token> header")
		return nil
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	sess, err := a.authProvider.GetSession(ctx, token)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "session validation failed")
		return nil
	}
	if sess == nil {
		writeJSONError(w, http.StatusUnauthorized, "invalid or expired session")
		return nil
	}

	allowed, err := a.authProvider.VerifyPermission(ctx, sess.UserID, "remediation", "write")
	if err != nil || !allowed {
		writeJSONError(w, http.StatusForbidden, "session does not have remediation:write permission")
		return nil
	}
	return sess
}

type remediateRequest struct {
	ControlID string   `json:"control_id"`
	Symbol    string   `json:"symbol"`
	Command   []string `json:"command"`
	DAGParent string   `json:"dag_parent"`
	Staging   bool     `json:"staging"`
	Approved  bool     `json:"approved"`
}

// handleRemediate submits a signed ChangeRequest to asaf-daemon. With
// staging=true (the normal path — production execution requires the staging
// gate to have already passed), the response is an immediate ack carrying a
// staging_id; poll /api/v1/asaf/staging?id=... for the eventual result.
//
// Every call is recorded in the DAG as REMEDIATE_REQUESTED before the
// daemon is contacted — this is the "who asked for it" record. The daemon
// separately records "what actually executed" (attestExecution/
// logSecurityEvent in daemon.go) under its own signing identity; the two
// trails are linked by timestamp + control_id, not a shared node ID, since
// the daemon doesn't know which human is behind its caller's agent identity.
func (a *RemediateAPI) handleRemediate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	sess := a.authorize(w, r)
	if sess == nil {
		return
	}
	var req remediateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.Command) == 0 {
		writeJSONError(w, http.StatusBadRequest, "command is required")
		return
	}
	if req.Symbol == "" {
		req.Symbol = "Nkyinkyim" // adaptability — default non-kernel symbol
	}

	logRemediateRequested(sess, req)

	// 35s: comfortably above the daemon's own 30s connection deadline.
	ctx, cancel := context.WithTimeout(r.Context(), 35*time.Second)
	defer cancel()

	result, err := a.client.Submit(ctx, req.ControlID, req.Symbol, req.Command, req.DAGParent, req.Staging, req.Approved)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, "asaf-daemon unreachable: "+err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result) //nolint:errcheck
}

// handleStagingPoll returns the current state of a staging job by ID.
// Requires the same remediation:write permission as submission — staging
// job output can include command stdout/diffs, which is sensitive enough
// to gate the same way as triggering the job in the first place.
func (a *RemediateAPI) handleStagingPoll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if a.authorize(w, r) == nil {
		return
	}
	jobID := r.URL.Query().Get("id")
	if jobID == "" {
		writeJSONError(w, http.StatusBadRequest, "id query parameter is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := a.client.Poll(ctx, jobID)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, "asaf-daemon unreachable: "+err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result) //nolint:errcheck
}

// logRemediateRequested writes a best-effort DAG node recording which
// authenticated user requested a remediation, before the daemon is ever
// contacted. Failure to write is logged but never blocks the actual
// request — the daemon's own attestation is still the authoritative
// execution record either way.
func logRemediateRequested(sess *auth.Session, req remediateRequest) {
	node := &dag.Node{
		Action: "REMEDIATE_REQUESTED",
		Symbol: req.Symbol,
		Time:   time.Now().UTC().Format(time.RFC3339),
		PQC: map[string]string{
			"user_id":    sess.UserID,
			"username":   sess.Username,
			"control_id": req.ControlID,
			"staging":    boolStr(req.Staging),
			"approved":   boolStr(req.Approved),
		},
	}
	node.ID = node.ComputeHash()
	node.Hash = node.ID
	_ = dag.GlobalDAG().Add(node, nil) //nolint:errcheck — best-effort audit log, never blocks the request
}

func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
