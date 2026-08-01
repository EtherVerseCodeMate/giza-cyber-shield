package auth

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/argon2"
)

// NativeUser represents a STARGATE embedded user
type NativeUser struct {
	ID           string
	Email        string
	PasswordHash string
	CreatedAt    time.Time
}

// NativeSession represents an active login session
type NativeSession struct {
	ID        string
	UserID    string
	ExpiresAt time.Time
}

// NativeAuthManager handles SQLite + Argon2id auth for STARGATE standalone
type NativeAuthManager struct {
	db *sql.DB
}

// NewNativeAuthManager initializes the local SQLite DB for auth
func NewNativeAuthManager(db *sql.DB) (*NativeAuthManager, error) {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT UNIQUE,
			password_hash TEXT,
			created_at DATETIME
		);
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT,
			expires_at DATETIME,
			FOREIGN KEY(user_id) REFERENCES users(id)
		);
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to create auth tables: %w", err)
	}
	return &NativeAuthManager{db: db}, nil
}

// HashPassword creates an Argon2id hash
func HashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Hash := base64.RawStdEncoding.EncodeToString(hash)
	return fmt.Sprintf("$argon2id$v=19$m=65536,t=1,p=4$%s$%s", b64Salt, b64Hash), nil
}

// GenerateSessionToken creates a CSPRNG session token
func GenerateSessionToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// VerifyPassword checks an Argon2id hash against a plaintext password
func VerifyPassword(password, encodedHash string) (bool, error) {
	// Format: $argon2id$v=19$m=65536,t=1,p=4$salt$hash
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 {
		return false, fmt.Errorf("invalid hash format")
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, err
	}

	decodedHash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, err
	}

	var memory uint32
	var time uint32
	var threads uint8
	_, err = fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &time, &threads)
	if err != nil {
		return false, err
	}

	hash := argon2.IDKey([]byte(password), salt, time, memory, threads, uint32(len(decodedHash)))
	
	// Constant-time comparison
	if len(hash) != len(decodedHash) {
		return false, nil
	}
	var diff byte
	for i := 0; i < len(hash); i++ {
		diff |= hash[i] ^ decodedHash[i]
	}
	return diff == 0, nil
}

// CreateUser creates a new user in the local database
func (m *NativeAuthManager) CreateUser(email, password string) (*NativeUser, error) {
	userID, err := GenerateSessionToken() // reuse CSPRNG for ID
	if err != nil {
		return nil, err
	}
	hash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}

	user := &NativeUser{
		ID:           userID,
		Email:        email,
		PasswordHash: hash,
		CreatedAt:    time.Now().UTC(),
	}

	_, err = m.db.Exec("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
		user.ID, user.Email, user.PasswordHash, user.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}
	return user, nil
}

// Authenticate checks credentials and returns the User if valid
func (m *NativeAuthManager) Authenticate(email, password string) (*NativeUser, error) {
	row := m.db.QueryRow("SELECT id, email, password_hash, created_at FROM users WHERE email = ?", email)
	var u NativeUser
	if err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("invalid credentials") // Prevent user enumeration
		}
		return nil, err
	}

	valid, err := VerifyPassword(password, u.PasswordHash)
	if err != nil || !valid {
		return nil, fmt.Errorf("invalid credentials")
	}
	return &u, nil
}

// CreateSession generates a new session token for the user
func (m *NativeAuthManager) CreateSession(userID string) (*NativeSession, error) {
	token, err := GenerateSessionToken()
	if err != nil {
		return nil, err
	}

	// 30 day expiration
	expiresAt := time.Now().UTC().AddDate(0, 0, 30)
	session := &NativeSession{
		ID:        token,
		UserID:    userID,
		ExpiresAt: expiresAt,
	}

	_, err = m.db.Exec("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
		session.ID, session.UserID, session.ExpiresAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}
	return session, nil
}

// ValidateSession checks if a session token is valid and not expired
func (m *NativeAuthManager) ValidateSession(token string) (*NativeSession, error) {
	row := m.db.QueryRow("SELECT id, user_id, expires_at FROM sessions WHERE id = ?", token)
	var s NativeSession
	if err := row.Scan(&s.ID, &s.UserID, &s.ExpiresAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("invalid session")
		}
		return nil, err
	}

	if time.Now().UTC().After(s.ExpiresAt) {
		m.InvalidateSession(token) // cleanup
		return nil, fmt.Errorf("session expired")
	}

	// Sliding window: if less than 15 days left, extend by 30 days
	if s.ExpiresAt.Sub(time.Now().UTC()) < 15*24*time.Hour {
		s.ExpiresAt = time.Now().UTC().AddDate(0, 0, 30)
		m.db.Exec("UPDATE sessions SET expires_at = ? WHERE id = ?", s.ExpiresAt, s.ID)
	}

	return &s, nil
}

// InvalidateSession deletes a session
func (m *NativeAuthManager) InvalidateSession(token string) error {
	_, err := m.db.Exec("DELETE FROM sessions WHERE id = ?", token)
	return err
}

