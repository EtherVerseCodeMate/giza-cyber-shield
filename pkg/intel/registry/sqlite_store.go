package registry

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

// Vulnerability represents a single entry in the registry
type Vulnerability struct {
	ID          string    `json:"id"`          // CVE-ID or other identifier
	Source      string    `json:"source"`      // MITRE, CISA, etc.
	CVSS        float64   `json:"cvss"`        // Severity score
	Description string    `json:"description"` // Brief summary
	Exploited   bool      `json:"exploited"`   // CISA KEV status
	PublishedAt time.Time `json:"published_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Store manages the SQLite database for vulnerabilities
type Store struct {
	db *sql.DB
}

// NewStore initializes a new vulnerability store
func NewStore(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	s := &Store{db: db}
	if err := s.initSchema(); err != nil {
		db.Close()
		return nil, err
	}

	return s, nil
}

// initSchema creates the necessary tables and indexes
func (s *Store) initSchema() error {
	query := `
	CREATE TABLE IF NOT EXISTS vulnerabilities (
		id TEXT PRIMARY KEY,
		source TEXT NOT NULL,
		cvss REAL DEFAULT 0.0,
		description TEXT,
		exploited BOOLEAN DEFAULT 0,
		published_at DATETIME,
		updated_at DATETIME
	);
	CREATE INDEX IF NOT EXISTS idx_source ON vulnerabilities(source);
	CREATE INDEX IF NOT EXISTS idx_exploited ON vulnerabilities(exploited);
	`
	_, err := s.db.Exec(query)
	return err
}

// SaveVulnerability inserts or updates a record
func (s *Store) SaveVulnerability(v *Vulnerability) error {
	query := `
	INSERT INTO vulnerabilities (id, source, cvss, description, exploited, published_at, updated_at)
	VALUES (?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		source = excluded.source,
		cvss = excluded.cvss,
		description = excluded.description,
		exploited = excluded.exploited,
		updated_at = excluded.updated_at
	`
	_, err := s.db.Exec(query, v.ID, v.Source, v.CVSS, v.Description, v.Exploited, v.PublishedAt, v.UpdatedAt)
	return err
}

// GetVulnerability retrieves a record by ID
func (s *Store) GetVulnerability(id string) (*Vulnerability, error) {
	v := &Vulnerability{}
	query := `SELECT id, source, cvss, description, exploited, published_at, updated_at FROM vulnerabilities WHERE id = ?`
	err := s.db.QueryRow(query, id).Scan(&v.ID, &v.Source, &v.CVSS, &v.Description, &v.Exploited, &v.PublishedAt, &v.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return v, nil
}

// Close closes the database connection
func (s *Store) Close() error {
	return s.db.Close()
}
