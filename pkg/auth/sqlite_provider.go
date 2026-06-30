// pkg/auth/sqlite_provider.go — on-premise SQLite-backed AuthProvider.
//
// This is the real implementation of Profile B's sovereign auth claim
// (Adinkhepra-ASAF README: "On-premise SQLite — no external auth calls").
// LocalProvider in providers.go is explicitly dev-only (in-memory, fixed
// salt, ValidateToken/VerifyPermission stubbed to always-true) — this
// replaces it for any deployment that needs real persistence and real
// authorization.
//
// Per-user random salts (pkg/kms Argon2id, OWASP 2024 params), persisted
// sessions, and VerifyPermission wired to the existing PermissionEvaluator
// + PredefinedRoles rather than a stub.
package auth

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"runtime"
	"time"

	_ "github.com/glebarez/go-sqlite"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/kms"
)

// SQLiteProvider is the sovereign, on-premise AuthProvider backed by SQLite.
// Zero external calls — every credential check happens against the local
// database file.
type SQLiteProvider struct {
	BaseAuthProvider
	db   *sql.DB
	perm *PermissionEvaluator
}

// NewSQLiteProvider opens (or creates) the auth database at dbPath and
// ensures the schema exists. Predefined ADINKHEPRA roles are loaded into
// the permission evaluator so VerifyPermission works out of the box.
func NewSQLiteProvider(dbPath string) (*SQLiteProvider, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("auth: open sqlite db %s: %w", dbPath, err)
	}
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("auth: ping sqlite db %s: %w", dbPath, err)
	}

	// This file holds password hashes (Argon2id-protected, but still worth
	// defending in depth) and session tokens. Explicitly restrict to
	// owner-only — don't rely solely on the parent directory's permissions
	// (pkg/asaf/daemon/keys.go uses the same skip-on-Windows pattern, where
	// the ACL model is fundamentally different and "trust the administrator"
	// already applies to key material in this codebase).
	if runtime.GOOS != "windows" {
		if err := os.Chmod(dbPath, 0600); err != nil {
			db.Close()
			return nil, fmt.Errorf("auth: restrict permissions on %s: %w", dbPath, err)
		}
	}

	p := &SQLiteProvider{
		BaseAuthProvider: BaseAuthProvider{name: string(ProviderLocal)},
		db:               db,
		perm:             NewPermissionEvaluator(),
	}
	for _, role := range PredefinedRoles {
		_ = p.perm.DefineRole(role) // PredefinedRoles entries are always valid (non-empty Name)
	}

	if err := p.initSchema(); err != nil {
		db.Close()
		return nil, err
	}
	return p, nil
}

func (p *SQLiteProvider) initSchema() error {
	const schema = `
	CREATE TABLE IF NOT EXISTS users (
		id            TEXT PRIMARY KEY,
		username      TEXT UNIQUE NOT NULL,
		email         TEXT UNIQUE NOT NULL,
		first_name    TEXT,
		last_name     TEXT,
		password_hash TEXT NOT NULL,
		password_salt TEXT NOT NULL,
		roles         TEXT NOT NULL DEFAULT '[]',
		organizations TEXT NOT NULL DEFAULT '[]',
		created_at    DATETIME NOT NULL,
		updated_at    DATETIME NOT NULL
	);
	CREATE TABLE IF NOT EXISTS sessions (
		session_id    TEXT PRIMARY KEY,
		user_id       TEXT NOT NULL,
		username      TEXT NOT NULL,
		roles         TEXT NOT NULL DEFAULT '[]',
		created_at    DATETIME NOT NULL,
		last_activity DATETIME NOT NULL,
		expires_at    DATETIME NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
	CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
	`
	_, err := p.db.Exec(schema)
	if err != nil {
		return fmt.Errorf("auth: init schema: %w", err)
	}
	return nil
}

// ── Password hashing (per-user random salt, OWASP 2024 Argon2id params) ───

func hashPassword(password string) (hashHex, saltHex string, err error) {
	salt, err := kms.NewSalt()
	if err != nil {
		return "", "", fmt.Errorf("auth: generate salt: %w", err)
	}
	derived := kms.DeriveKey([]byte(password), salt, kms.DefaultKDFParams)
	return hex.EncodeToString(derived), hex.EncodeToString(salt), nil
}

func verifyPassword(password, hashHex, saltHex string) bool {
	salt, err := hex.DecodeString(saltHex)
	if err != nil {
		return false
	}
	derived := kms.DeriveKey([]byte(password), salt, kms.DefaultKDFParams)
	computedHex := hex.EncodeToString(derived)
	return subtle.ConstantTimeCompare([]byte(computedHex), []byte(hashHex)) == 1
}

// ── Row <-> User marshaling ────────────────────────────────────────────────

type userRow struct {
	id, username, email, firstName, lastName string
	passwordHash, passwordSalt               string
	rolesJSON, orgsJSON                      string
	createdAt, updatedAt                     time.Time
}

func (r *userRow) toUser() *User {
	var roles, orgs []string
	_ = json.Unmarshal([]byte(r.rolesJSON), &roles)
	_ = json.Unmarshal([]byte(r.orgsJSON), &orgs)
	return &User{
		ID:            r.id,
		Username:      r.username,
		Email:         r.email,
		FirstName:     r.firstName,
		LastName:      r.lastName,
		Roles:         roles,
		Organizations: orgs,
		Attributes:    map[string]interface{}{"password_hash": r.passwordHash, "password_salt": r.passwordSalt},
	}
}

const userColumns = "id, username, email, first_name, last_name, password_hash, password_salt, roles, organizations, created_at, updated_at"

func scanUserRow(scanner interface{ Scan(...any) error }) (*userRow, error) {
	var r userRow
	if err := scanner.Scan(&r.id, &r.username, &r.email, &r.firstName, &r.lastName,
		&r.passwordHash, &r.passwordSalt, &r.rolesJSON, &r.orgsJSON, &r.createdAt, &r.updatedAt); err != nil {
		return nil, err
	}
	return &r, nil
}

// ── AuthProvider implementation ─────────────────────────────────────────────

// Authenticate verifies username+password against the local SQLite store.
// Zero network calls — this is the entire point of Profile B.
func (p *SQLiteProvider) Authenticate(ctx context.Context, creds *Credentials) (*User, error) {
	row := p.db.QueryRowContext(ctx,
		"SELECT "+userColumns+" FROM users WHERE username = ? OR email = ?",
		creds.Username, creds.Username)
	r, err := scanUserRow(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("auth: query user: %w", err)
	}

	if !verifyPassword(creds.Password, r.passwordHash, r.passwordSalt) {
		return nil, errors.New("invalid credentials")
	}
	return r.toUser(), nil
}

// RefreshToken is a no-op passthrough — sessions are validated by ID, not rotated.
func (p *SQLiteProvider) RefreshToken(ctx context.Context, refreshToken string) (string, error) {
	return refreshToken, nil
}

// hashToken returns the SHA-256 hex digest of a session token. The sessions
// table stores this hash, never the raw token — a leaked DB file (backup,
// misconfigured volume mount, etc.) shouldn't hand out instantly-usable
// bearer credentials for every active session. The raw token (256-bit
// entropy from generateSessionID) is the only thing a legitimate client
// ever holds; SHA-256 is sufficient here (unlike password hashing, this
// isn't defending against offline brute force of a low-entropy secret).
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// ValidateToken checks a session ID against the persisted sessions table.
// Unlike LocalProvider's stub, this actually rejects unknown/expired sessions.
func (p *SQLiteProvider) ValidateToken(ctx context.Context, token string) (bool, error) {
	sess, err := p.GetSession(ctx, token)
	if err != nil {
		return false, err
	}
	return sess != nil, nil
}

// GetSession returns the full session record (user ID, username, roles) for
// a token, or nil if the token is unknown or expired. Callers that need to
// authorize an action by role (e.g. remediation requires the "remediation"
// resource permission) need this — ValidateToken's plain bool isn't enough.
// Expired sessions are deleted on lookup, same as ValidateToken always did.
func (p *SQLiteProvider) GetSession(ctx context.Context, token string) (*Session, error) {
	tokenHash := hashToken(token)
	var sess Session
	var rolesJSON string
	err := p.db.QueryRowContext(ctx,
		"SELECT user_id, username, roles, created_at, last_activity, expires_at FROM sessions WHERE session_id = ?",
		tokenHash).Scan(&sess.UserID, &sess.Username, &rolesJSON, &sess.CreatedAt, &sess.LastActivity, &sess.ExpiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("auth: query session: %w", err)
	}
	if time.Now().After(sess.ExpiresAt) {
		_, _ = p.db.ExecContext(ctx, "DELETE FROM sessions WHERE session_id = ?", tokenHash)
		return nil, nil
	}
	sess.SessionID = token // the raw token the caller already holds, not the stored hash
	_ = json.Unmarshal([]byte(rolesJSON), &sess.Roles)
	_, _ = p.db.ExecContext(ctx, "UPDATE sessions SET last_activity = ? WHERE session_id = ?", time.Now().UTC(), tokenHash)
	return &sess, nil
}

// CreateSession persists a new session row (keyed by the token's SHA-256
// hash — see hashToken), returning a Session whose SessionID is the raw,
// unhashed token. That raw value is the bearer credential to hand back to
// the client (e.g. as the HTTP response's session_token field) — it is
// never itself written to disk.
// Call this after a successful Authenticate() — it is not part of the
// AuthProvider interface but is the SQLite-backed counterpart to
// SessionManager.CreateSession for callers that want persistence across
// process restarts (sessions are short-lived, but a restart mid-session
// shouldn't force every connected engineer to re-auth).
func (p *SQLiteProvider) CreateSession(ctx context.Context, user *User, ttl time.Duration) (*Session, error) {
	rolesJSON, _ := json.Marshal(user.Roles)
	rawToken := generateSessionID()
	sess := &Session{
		SessionID:    rawToken,
		UserID:       user.ID,
		Username:     user.Username,
		Roles:        user.Roles,
		CreatedAt:    time.Now().UTC(),
		LastActivity: time.Now().UTC(),
		ExpiresAt:    time.Now().UTC().Add(ttl),
	}
	_, err := p.db.ExecContext(ctx,
		"INSERT INTO sessions (session_id, user_id, username, roles, created_at, last_activity, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		hashToken(rawToken), sess.UserID, sess.Username, string(rolesJSON), sess.CreatedAt, sess.LastActivity, sess.ExpiresAt)
	if err != nil {
		return nil, fmt.Errorf("auth: create session: %w", err)
	}
	return sess, nil
}

// GetUser retrieves a user by ID.
func (p *SQLiteProvider) GetUser(ctx context.Context, userID string) (*User, error) {
	row := p.db.QueryRowContext(ctx, "SELECT "+userColumns+" FROM users WHERE id = ?", userID)
	r, err := scanUserRow(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("auth: get user: %w", err)
	}
	return r.toUser(), nil
}

// ListUsers returns every local user account.
func (p *SQLiteProvider) ListUsers(ctx context.Context) ([]*User, error) {
	rows, err := p.db.QueryContext(ctx, "SELECT "+userColumns+" FROM users ORDER BY created_at ASC")
	if err != nil {
		return nil, fmt.Errorf("auth: list users: %w", err)
	}
	defer rows.Close()

	var users []*User
	for rows.Next() {
		r, err := scanUserRow(rows)
		if err != nil {
			return nil, fmt.Errorf("auth: scan user row: %w", err)
		}
		users = append(users, r.toUser())
	}
	return users, rows.Err()
}

// CreateUser inserts a new local user account. The plaintext password must
// be supplied via user.Attributes["password"] — it is hashed here with a
// fresh random salt and never stored or logged in plaintext.
func (p *SQLiteProvider) CreateUser(ctx context.Context, user *User) error {
	if user.ID == "" {
		return errors.New("auth: user ID cannot be empty")
	}
	plaintext, _ := user.Attributes["password"].(string)
	if plaintext == "" {
		return errors.New("auth: password is required (set in user.Attributes[\"password\"])")
	}
	hashHex, saltHex, err := hashPassword(plaintext)
	if err != nil {
		return err
	}

	rolesJSON, _ := json.Marshal(user.Roles)
	orgsJSON, _ := json.Marshal(user.Organizations)
	now := time.Now().UTC()

	_, err = p.db.ExecContext(ctx,
		`INSERT INTO users (id, username, email, first_name, last_name, password_hash, password_salt, roles, organizations, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		user.ID, user.Username, user.Email, user.FirstName, user.LastName,
		hashHex, saltHex, string(rolesJSON), string(orgsJSON), now, now)
	if err != nil {
		return fmt.Errorf("auth: create user: %w", err)
	}
	return nil
}

// DeleteUser removes a local user account and any active sessions.
func (p *SQLiteProvider) DeleteUser(ctx context.Context, userID string) error {
	res, err := p.db.ExecContext(ctx, "DELETE FROM users WHERE id = ?", userID)
	if err != nil {
		return fmt.Errorf("auth: delete user: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errUserNotFound
	}
	_, _ = p.db.ExecContext(ctx, "DELETE FROM sessions WHERE user_id = ?", userID)
	return nil
}

// UpdateUser modifies user profile fields and/or roles. Password is only
// updated if user.Attributes["password"] is non-empty.
func (p *SQLiteProvider) UpdateUser(ctx context.Context, user *User) error {
	rolesJSON, _ := json.Marshal(user.Roles)
	orgsJSON, _ := json.Marshal(user.Organizations)
	now := time.Now().UTC()

	if plaintext, _ := user.Attributes["password"].(string); plaintext != "" {
		hashHex, saltHex, err := hashPassword(plaintext)
		if err != nil {
			return err
		}
		res, err := p.db.ExecContext(ctx,
			`UPDATE users SET email=?, first_name=?, last_name=?, password_hash=?, password_salt=?, roles=?, organizations=?, updated_at=? WHERE id=?`,
			user.Email, user.FirstName, user.LastName, hashHex, saltHex, string(rolesJSON), string(orgsJSON), now, user.ID)
		if err != nil {
			return fmt.Errorf("auth: update user: %w", err)
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return errUserNotFound
		}
		return nil
	}

	res, err := p.db.ExecContext(ctx,
		`UPDATE users SET email=?, first_name=?, last_name=?, roles=?, organizations=?, updated_at=? WHERE id=?`,
		user.Email, user.FirstName, user.LastName, string(rolesJSON), string(orgsJSON), now, user.ID)
	if err != nil {
		return fmt.Errorf("auth: update user: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errUserNotFound
	}
	return nil
}

// AssignRole grants a role to a user (idempotent — re-assigning is a no-op).
func (p *SQLiteProvider) AssignRole(ctx context.Context, userID string, role string) error {
	user, err := p.GetUser(ctx, userID)
	if err != nil {
		return err
	}
	for _, r := range user.Roles {
		if r == role {
			return nil
		}
	}
	user.Roles = append(user.Roles, role)
	rolesJSON, _ := json.Marshal(user.Roles)
	_, err = p.db.ExecContext(ctx, "UPDATE users SET roles=?, updated_at=? WHERE id=?", string(rolesJSON), time.Now().UTC(), userID)
	if err != nil {
		return fmt.Errorf("auth: assign role: %w", err)
	}
	return nil
}

// RevokeRole removes a role from a user.
func (p *SQLiteProvider) RevokeRole(ctx context.Context, userID string, role string) error {
	user, err := p.GetUser(ctx, userID)
	if err != nil {
		return err
	}
	var newRoles []string
	for _, r := range user.Roles {
		if r != role {
			newRoles = append(newRoles, r)
		}
	}
	rolesJSON, _ := json.Marshal(newRoles)
	_, err = p.db.ExecContext(ctx, "UPDATE users SET roles=?, updated_at=? WHERE id=?", string(rolesJSON), time.Now().UTC(), userID)
	if err != nil {
		return fmt.Errorf("auth: revoke role: %w", err)
	}
	return nil
}

// VerifyPermission checks the user's actual roles against PredefinedRoles —
// unlike LocalProvider's stub (always true), this is a real authorization
// check using the PermissionEvaluator already defined in provider.go.
func (p *SQLiteProvider) VerifyPermission(ctx context.Context, userID string, resource string, action string) (bool, error) {
	user, err := p.GetUser(ctx, userID)
	if err != nil {
		return false, err
	}
	return p.perm.Evaluate(user.Roles, resource, action), nil
}

// Close closes the underlying database connection.
func (p *SQLiteProvider) Close() error {
	return p.db.Close()
}

// HasAnyUsers reports whether at least one user account exists — used to
// decide whether first-run bootstrap (create the initial admin) is needed.
func (p *SQLiteProvider) HasAnyUsers(ctx context.Context) (bool, error) {
	var count int
	if err := p.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		return false, fmt.Errorf("auth: count users: %w", err)
	}
	return count > 0, nil
}
