package mcp

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"time"
)

// SignedToolManifest is a PQC-signed snapshot of the server's registered tools.
// Capturing it at startup and diffing periodically detects T01 (Tool Poisoning),
// T03 (Manifest Rug Pull), and T10 (Schema Drift).
type SignedToolManifest struct {
	ServerName   string            `json:"server_name"`
	ComputedAt   time.Time         `json:"computed_at"`
	ToolHashes   map[string]string `json:"tool_hashes"`   // toolName → SHA-256(name+description+schema)
	ManifestHash string            `json:"manifest_hash"` // SHA-256 over sorted ToolHashes
	PQCSignature string            `json:"pqc_signature,omitempty"`
}

// ComputeManifest builds a SignedToolManifest from the server's current tool
// registry. Call once at startup to capture the baseline, then again to detect
// drift (T03/T10).
func (s *Server) ComputeManifest() *SignedToolManifest {
	m := &SignedToolManifest{
		ServerName: s.cfg.ServerName,
		ComputedAt: time.Now().UTC(),
		ToolHashes: make(map[string]string, len(s.tools)),
	}

	for name, t := range s.tools {
		schema, _ := json.Marshal(t.InputSchema)
		h := sha256.Sum256([]byte(name + t.Description + string(schema)))
		m.ToolHashes[name] = hex.EncodeToString(h[:])
	}

	// Deterministic manifest hash: sort names then hash concatenated entries.
	names := make([]string, 0, len(m.ToolHashes))
	for n := range m.ToolHashes {
		names = append(names, n)
	}
	sort.Strings(names)
	h := sha256.New()
	for _, n := range names {
		fmt.Fprintf(h, "%s:%s\n", n, m.ToolHashes[n])
	}
	m.ManifestHash = hex.EncodeToString(h.Sum(nil))

	return m
}

// DiffManifests compares baseline against current and returns which tool names
// were added, removed, or had their schema mutated. All three slices are empty
// when no drift is detected (T10 clear).
func DiffManifests(baseline, current *SignedToolManifest) (added, removed, changed []string) {
	for name, hash := range current.ToolHashes {
		if bHash, ok := baseline.ToolHashes[name]; !ok {
			added = append(added, name)
		} else if bHash != hash {
			changed = append(changed, name)
		}
	}
	for name := range baseline.ToolHashes {
		if _, ok := current.ToolHashes[name]; !ok {
			removed = append(removed, name)
		}
	}
	return
}
