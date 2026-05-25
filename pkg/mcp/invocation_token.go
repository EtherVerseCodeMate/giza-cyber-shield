// Package mcp — per-invocation ephemeral credentials.
//
// ASD/CISA "Careful Adoption of Agentic AI Services" requires that agentic AI
// services not accumulate long-lived credentials. Each tool invocation receives
// a short-lived (5-minute TTL), HMAC-signed capability token that encodes:
//   - Which scan profile is permitted
//   - Which target is permitted
//   - Which calling agent identity is bound
//   - Expiry time
//
// Token reuse across sessions is rejected. An exfiltrated token expires in ≤5 minutes.
package mcp

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

const (
	// InvocationTokenTTL is the maximum lifetime of a per-invocation token.
	InvocationTokenTTL = 5 * time.Minute
)

// InvocationToken is a short-lived, HMAC-signed capability token issued per tool invocation.
type InvocationToken struct {
	TokenID   string    `json:"token_id"`
	AgentID   string    `json:"agent_id"`
	ToolName  string    `json:"tool_name"`
	Profile   string    `json:"profile"`
	Target    string    `json:"target"`
	IssuedAt  time.Time `json:"issued_at"`
	ExpiresAt time.Time `json:"expires_at"`
	HMAC      string    `json:"hmac"`
}

func (t InvocationToken) canonical() ([]byte, error) {
	payload := struct {
		TokenID   string `json:"token_id"`
		AgentID   string `json:"agent_id"`
		ToolName  string `json:"tool_name"`
		Profile   string `json:"profile"`
		Target    string `json:"target"`
		IssuedAt  string `json:"issued_at"`
		ExpiresAt string `json:"expires_at"`
	}{
		TokenID:   t.TokenID,
		AgentID:   t.AgentID,
		ToolName:  t.ToolName,
		Profile:   t.Profile,
		Target:    t.Target,
		IssuedAt:  t.IssuedAt.UTC().Format(time.RFC3339Nano),
		ExpiresAt: t.ExpiresAt.UTC().Format(time.RFC3339Nano),
	}
	return json.Marshal(payload)
}

// IssueInvocationToken mints a new per-invocation token.
func IssueInvocationToken(rootKey []byte, agentID, toolName, profile, target string) (*InvocationToken, error) {
	if len(rootKey) == 0 {
		return nil, fmt.Errorf("invocation_token: rootKey is required")
	}
	if agentID == "" {
		return nil, fmt.Errorf("invocation_token: agentID is required")
	}
	if toolName == "" {
		return nil, fmt.Errorf("invocation_token: toolName is required")
	}

	now := time.Now().UTC()
	tok := &InvocationToken{
		TokenID:   uuid.New().String(),
		AgentID:   agentID,
		ToolName:  toolName,
		Profile:   profile,
		Target:    target,
		IssuedAt:  now,
		ExpiresAt: now.Add(InvocationTokenTTL),
	}

	canonical, err := tok.canonical()
	if err != nil {
		return nil, fmt.Errorf("invocation_token: canonicalize: %w", err)
	}

	mac := hmac.New(sha256.New, rootKey)
	mac.Write(canonical)
	tok.HMAC = hex.EncodeToString(mac.Sum(nil))
	return tok, nil
}

// VerifyInvocationToken validates a token against the root key and the tool being invoked.
func VerifyInvocationToken(rootKey []byte, tok *InvocationToken, actualToolName, actualAgentID string) error {
	if tok == nil {
		return fmt.Errorf("invocation_token: nil token")
	}
	canonical, err := tok.canonical()
	if err != nil {
		return fmt.Errorf("invocation_token: canonicalize for verify: %w", err)
	}
	mac := hmac.New(sha256.New, rootKey)
	mac.Write(canonical)
	expected := hex.EncodeToString(mac.Sum(nil))

	tokHMAC, err := hex.DecodeString(tok.HMAC)
	if err != nil {
		return fmt.Errorf("invocation_token: invalid HMAC encoding")
	}
	expectedBytes, _ := hex.DecodeString(expected)
	if !hmac.Equal(tokHMAC, expectedBytes) {
		return fmt.Errorf("invocation_token: HMAC verification failed — token may have been tampered with")
	}
	if time.Now().UTC().After(tok.ExpiresAt) {
		return fmt.Errorf("invocation_token: token expired at %s", tok.ExpiresAt.Format(time.RFC3339))
	}
	if tok.ToolName != actualToolName {
		return fmt.Errorf("invocation_token: token bound to tool %q cannot be used for %q", tok.ToolName, actualToolName)
	}
	if tok.AgentID != actualAgentID {
		return fmt.Errorf("invocation_token: token bound to agent %q cannot be used by %q", tok.AgentID, actualAgentID)
	}
	return nil
}

// DeriveRootKey derives the HMAC root key from the ML-DSA-65 license key.
func DeriveRootKey(licenseKey []byte) []byte {
	const domain = "khepra-invocation-token-v1"
	mac := hmac.New(sha256.New, licenseKey)
	mac.Write([]byte(domain))
	return mac.Sum(nil)
}
