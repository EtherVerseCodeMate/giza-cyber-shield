package auth

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"fmt"
	"time"

	"golang.org/x/crypto/argon2"
)

// User represents a STARGATE embedded user
type User struct {
	ID           string
	Email        string
	PasswordHash string
	CreatedAt    time.Time
}

// Session represents an active login session
type Session struct {
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
