// Package client is the unprivileged-side counterpart to pkg/asaf/daemon —
// it submits signed ChangeRequests to asaf-daemon over its Unix socket and
// polls staging job status. This is what makes the daemon's own header
// comment real: "click Remediate in the UI → ChangeRequest arrives here."
//
// Lives in adinkhepra serve (unprivileged), never in asaf-daemon itself —
// see the daemon/serve privilege-separation decision in
// project_product_a_architecture memory. The daemon is the trust boundary;
// this package is just an authenticated caller of it, with no privileges
// of its own.
package client

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/daemon"
)

// Client submits ChangeRequests to asaf-daemon over a Unix socket.
type Client struct {
	socketPath string
	agentID    string
	privKey    []byte // ML-DSA-65 private key — signs every request
	dialTimeout time.Duration
}

// Config configures a new Client.
type Config struct {
	SocketPath string
	AgentID    string
	PrivKey    []byte // ML-DSA-65 private key, matching the daemon's --agent-pubkey
}

// New constructs a Client. Does not dial — connection happens per-request,
// matching the daemon's one-request-per-connection protocol.
func New(cfg Config) (*Client, error) {
	if cfg.SocketPath == "" {
		return nil, fmt.Errorf("client: SocketPath is required")
	}
	if len(cfg.PrivKey) == 0 {
		return nil, fmt.Errorf("client: PrivKey is required — see ProvisionAgentKeys")
	}
	return &Client{
		socketPath:  cfg.SocketPath,
		agentID:     cfg.AgentID,
		privKey:     cfg.PrivKey,
		dialTimeout: 5 * time.Second,
	}, nil
}

// Submit signs and sends a privileged ChangeRequest, returning the daemon's
// result. For staging=true, the result is an immediate ack carrying a
// StagingID — call Poll with that ID to retrieve the eventual outcome.
func (c *Client) Submit(ctx context.Context, controlID, symbol string, command []string, dagParent string, staging, approved bool) (*daemon.ChangeResult, error) {
	req := &daemon.ChangeRequest{
		AgentID:   c.agentID,
		Symbol:    symbol,
		ControlID: controlID,
		DAGParent: dagParent,
		Command:   command,
		Staging:   staging,
		Approved:  approved,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
	return c.send(ctx, req)
}

// Poll returns the current state of a previously-submitted staging job.
// Still a fully signed, authenticated request — see daemon.go's pollStaging.
func (c *Client) Poll(ctx context.Context, jobID string) (*daemon.ChangeResult, error) {
	req := &daemon.ChangeRequest{
		AgentID:   c.agentID,
		Poll:      jobID,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
	return c.send(ctx, req)
}

// send signs req, dials the daemon's Unix socket, writes the request, and
// decodes the response. One connection per request, matching daemon.go's
// handleConn (it reads exactly one JSON object per accepted connection).
func (c *Client) send(ctx context.Context, req *daemon.ChangeRequest) (*daemon.ChangeResult, error) {
	if err := c.sign(req); err != nil {
		return nil, fmt.Errorf("client: sign request: %w", err)
	}

	dialer := net.Dialer{Timeout: c.dialTimeout}
	conn, err := dialer.DialContext(ctx, "unix", c.socketPath)
	if err != nil {
		return nil, fmt.Errorf("client: dial %s: %w", c.socketPath, err)
	}
	defer conn.Close()

	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	} else {
		_ = conn.SetDeadline(time.Now().Add(30 * time.Second))
	}

	if err := json.NewEncoder(conn).Encode(req); err != nil {
		return nil, fmt.Errorf("client: write request: %w", err)
	}

	var result daemon.ChangeResult
	if err := json.NewDecoder(conn).Decode(&result); err != nil {
		return nil, fmt.Errorf("client: read response: %w", err)
	}
	return &result, nil
}

// sign computes the canonical bytes (same algorithm as daemon.go's
// canonicalBytes — Signature zeroed before marshaling) and signs them.
// Duplicated rather than imported because daemon.go's canonicalBytes is
// unexported by design: signing logic for the privileged side and the
// calling side are kept visibly separate, even though the byte-construction
// happens to be identical today.
func (c *Client) sign(req *daemon.ChangeRequest) error {
	canonical := *req
	canonical.Signature = nil
	bytesToSign, err := json.Marshal(canonical)
	if err != nil {
		return fmt.Errorf("canonicalize: %w", err)
	}
	sig, err := adinkra.Sign(c.privKey, bytesToSign)
	if err != nil {
		return fmt.Errorf("sign: %w", err)
	}
	req.Signature = sig
	return nil
}
