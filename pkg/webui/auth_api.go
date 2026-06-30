// AuthAPI hosts the sovereign (Profile B) authentication HTTP surface for
// `adinkhepra serve`. Backed by auth.SQLiteProvider — on-premise SQLite,
// zero external calls, matching the Adinkhepra-ASAF README's published
// Profile B claim.
//
// Replaces the dead-port reference in the dashboard's AuthProvider.tsx
// (localhost:45444/api/v1/license/validate — the retired khepra-daemon
// port, never connected to anything real). These routes are mounted on
// the same mux as DAGAPI, under /api/v1/auth/*.
package webui

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/auth"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
)

// SessionTTL is how long a sovereign login session stays valid before the
// engineer must re-authenticate.
const SessionTTL = 12 * time.Hour

// Login rate limiting — server-side, since the frontend's lockout tracking
// (useSecurityHardening's isAccountLocked/trackAuthAttempt) is browser-side
// UX only and trivially bypassed by calling this endpoint directly (this was
// confirmed during testing: curl hits /api/v1/auth/login with no lockout at
// all). In-memory and per-process — acceptable for a single-instance
// sovereign deployment; a restart resets counters, which is an intentional
// tradeoff against the complexity of persisting rate-limit state for a
// product that has no clustering story.
const (
	maxLoginAttempts = 5
	loginAttemptWindow = 15 * time.Minute
	loginLockoutDuration = 15 * time.Minute
)

type loginAttemptState struct {
	count       int
	windowStart time.Time
	lockedUntil time.Time
}

// AuthAPI carries the SQLite-backed auth provider and registers the
// sovereign login/bootstrap/validate routes.
type AuthAPI struct {
	provider *auth.SQLiteProvider

	attemptsMu sync.Mutex
	attempts   map[string]*loginAttemptState // keyed by lowercased username
}

// NewAuthAPI wraps an already-opened SQLiteProvider for HTTP registration.
// The provider's lifecycle (Close) is owned by the caller (cmd/adinkhepra),
// not by AuthAPI.
func NewAuthAPI(provider *auth.SQLiteProvider) *AuthAPI {
	return &AuthAPI{provider: provider, attempts: make(map[string]*loginAttemptState)}
}

// RegisterRoutes mounts the sovereign auth endpoints onto mux.
func (a *AuthAPI) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/auth/login", a.handleLogin)
	mux.HandleFunc("/api/v1/auth/validate", a.handleValidate)
	mux.HandleFunc("/api/v1/auth/bootstrap", a.handleBootstrap)
}

// checkRateLimit returns a positive remaining-lockout duration if key is
// currently locked out, else zero. Does not record an attempt — call
// recordFailedAttempt/clearAttempts separately based on the auth outcome.
func (a *AuthAPI) checkRateLimit(key string) time.Duration {
	a.attemptsMu.Lock()
	defer a.attemptsMu.Unlock()
	st, ok := a.attempts[key]
	if !ok {
		return 0
	}
	if remaining := time.Until(st.lockedUntil); remaining > 0 {
		return remaining
	}
	return 0
}

func (a *AuthAPI) recordFailedAttempt(key string) {
	a.attemptsMu.Lock()
	defer a.attemptsMu.Unlock()
	now := time.Now()
	st, ok := a.attempts[key]
	if !ok || now.Sub(st.windowStart) > loginAttemptWindow {
		st = &loginAttemptState{windowStart: now}
		a.attempts[key] = st
	}
	st.count++
	if st.count >= maxLoginAttempts {
		st.lockedUntil = now.Add(loginLockoutDuration)
	}
}

func (a *AuthAPI) clearAttempts(key string) {
	a.attemptsMu.Lock()
	defer a.attemptsMu.Unlock()
	delete(a.attempts, key)
}

type loginRequest struct {
	Username string `json:"username"` // username OR email
	Password string `json:"password"`
}

type authUserPayload struct {
	ID            string   `json:"id"`
	Username      string   `json:"username"`
	Email         string   `json:"email"`
	Roles         []string `json:"roles"`
	Organizations []string `json:"organizations"`
}

type loginResponse struct {
	User         authUserPayload `json:"user"`
	SessionToken string          `json:"session_token"`
	ExpiresAt    string          `json:"expires_at"`
}

// handleLogin authenticates against the local SQLite store and issues a
// persisted session. Zero network calls — the whole request is served
// from the on-disk auth database. Every attempt (success or failure) is
// recorded in the DAG — CMMC/NIST AU-2 expects logon events to be
// auditable, and this product's whole value proposition is an immutable
// audit trail; auth itself shouldn't be the one event class that's invisible.
func (a *AuthAPI) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Username == "" || req.Password == "" {
		writeJSONError(w, http.StatusBadRequest, "username and password are required")
		return
	}

	rateLimitKey := normalizeLoginKey(req.Username)
	if remaining := a.checkRateLimit(rateLimitKey); remaining > 0 {
		logAuthEvent("LOGIN_RATE_LIMITED", req.Username, false)
		w.Header().Set("Retry-After", fmt_Itoa(int(remaining.Seconds())))
		writeJSONError(w, http.StatusTooManyRequests, "too many failed attempts — try again later")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	user, err := a.provider.Authenticate(ctx, &auth.Credentials{Username: req.Username, Password: req.Password})
	if err != nil {
		a.recordFailedAttempt(rateLimitKey)
		logAuthEvent("LOGIN_FAILED", req.Username, false)
		// Same response for "not found" and "wrong password" — don't leak
		// which one it was (standard auth hygiene).
		writeJSONError(w, http.StatusUnauthorized, "invalid username or password")
		return
	}
	a.clearAttempts(rateLimitKey)

	sess, err := a.provider.CreateSession(ctx, user, SessionTTL)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create session")
		return
	}
	logAuthEvent("LOGIN_SUCCESS", user.Username, true)

	resp := loginResponse{
		User: authUserPayload{
			ID: user.ID, Username: user.Username, Email: user.Email,
			Roles: user.Roles, Organizations: user.Organizations,
		},
		SessionToken: sess.SessionID,
		ExpiresAt:    sess.ExpiresAt.Format(time.RFC3339),
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp) //nolint:errcheck
}

type validateRequest struct {
	SessionToken string `json:"session_token"`
}

type validateResponse struct {
	Valid bool `json:"valid"`
}

// handleValidate checks whether a session token is still active — called on
// page load so the frontend doesn't trust whatever's in localStorage forever.
func (a *AuthAPI) handleValidate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req validateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SessionToken == "" {
		writeJSONError(w, http.StatusBadRequest, "session_token is required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	valid, err := a.provider.ValidateToken(ctx, req.SessionToken)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "validation failed")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(validateResponse{Valid: valid}) //nolint:errcheck
}

type bootstrapRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type bootstrapStatusResponse struct {
	NeedsBootstrap bool `json:"needs_bootstrap"`
}

// handleBootstrap creates the very first admin account. Only works while
// zero users exist — once an admin is created, this endpoint always 403s.
// This is the on-prem equivalent of a setup wizard: the installing engineer
// opens the dashboard, sees no admin configured, and creates one directly
// (no pre-shared secret to distribute, no external IdP to configure).
//
// GET checks whether bootstrap is still available (drives the frontend's
// decision to show a "create admin" form instead of the normal login form).
// POST performs the actual creation.
func (a *AuthAPI) handleBootstrap(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		hasUsers, err := a.provider.HasAnyUsers(ctx)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, "failed to check existing users")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(bootstrapStatusResponse{NeedsBootstrap: !hasUsers}) //nolint:errcheck
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	hasUsers, err := a.provider.HasAnyUsers(ctx)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to check existing users")
		return
	}
	if hasUsers {
		writeJSONError(w, http.StatusForbidden, "an admin account already exists — bootstrap is a one-time operation")
		return
	}

	var req bootstrapRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Username == "" || req.Email == "" || req.Password == "" {
		writeJSONError(w, http.StatusBadRequest, "username, email, and password are required")
		return
	}
	if len(req.Password) < 12 {
		writeJSONError(w, http.StatusBadRequest, "password must be at least 12 characters")
		return
	}

	admin := &auth.User{
		ID:       generateUserID(),
		Username: req.Username,
		Email:    req.Email,
		Roles:    []string{"admin"},
		Attributes: map[string]interface{}{"password": req.Password},
	}
	if err := a.provider.CreateUser(ctx, admin); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to create admin account")
		return
	}

	sess, err := a.provider.CreateSession(ctx, admin, SessionTTL)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "admin created but failed to create session — please log in")
		return
	}
	logAuthEvent("BOOTSTRAP_ADMIN_CREATED", admin.Username, true)

	resp := loginResponse{
		User: authUserPayload{
			ID: admin.ID, Username: admin.Username, Email: admin.Email,
			Roles: admin.Roles,
		},
		SessionToken: sess.SessionID,
		ExpiresAt:    sess.ExpiresAt.Format(time.RFC3339),
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp) //nolint:errcheck
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message}) //nolint:errcheck
}

func generateUserID() string {
	return "user_" + time.Now().UTC().Format("20060102T150405.000000000")
}

func normalizeLoginKey(username string) string {
	out := make([]byte, len(username))
	for i := 0; i < len(username); i++ {
		c := username[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		out[i] = c
	}
	return string(out)
}

// logAuthEvent writes a best-effort DAG node for an authentication event.
// Never blocks or fails the actual auth flow — this is an audit record, not
// a gate. Username is logged even on failure (standard practice — knowing
// WHO was being impersonated/guessed matters for incident response), the
// attempted password never is.
func logAuthEvent(eventType, username string, success bool) {
	node := &dag.Node{
		Action: eventType,
		Symbol: "OwoForoAdobe", // vigilance — matches KASA's own usage for monitoring events
		Time:   time.Now().UTC().Format(time.RFC3339),
		PQC: map[string]string{
			"username": username,
			"success":  boolStr(success),
		},
	}
	node.ID = node.ComputeHash()
	node.Hash = node.ID
	_ = dag.GlobalDAG().Add(node, nil) //nolint:errcheck — best-effort audit log
}

// fmt_Itoa avoids importing "fmt" solely for one integer-to-string call in
// a Retry-After header.
func fmt_Itoa(n int) string {
	if n <= 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
