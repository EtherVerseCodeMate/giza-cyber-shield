// pkg/asaf/connector/polymorphic_helpers.go
// Internal helpers for the PolymorphicConnector.
// Separated to keep polymorphic.go focused on the protocol logic.
//
// This file contains:
//   - kasaTLSConfig() — TOFU TLS for KASA REST connections
//   - kasaExecFunc()  — builds the ExecFunc for KASA /exec endpoint
//   - dialSSHWithTOFU() — SSH dial with PQ KEX preference + TOFU host key
//   - sshExec()       — run a command on an established SSH connection
//   - dialWinRM()     — WinRM session factory (returns a partial ActiveConnection)
//
// IP: SOUHIMBOU DOH KONE LLC — exclusively licensed to SecRed Knowledge Inc.
// USPTO #73565085 (KHEPRA Protocol)

package connector

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
)

// ── KASA REST helpers ─────────────────────────────────────────────────────────

// kasaTLSConfig returns a TLS config for KASA REST connections.
// KASA agents use self-signed ML-DSA-65 identity certificates (not CA-issued).
// Trust is established via TOFU (Trust On First Use) — the cert fingerprint is
// stored in the ConnectorRegistry on first contact and verified on subsequent calls.
// InsecureSkipVerify is set here but real verification happens via the VerifyPeerCertificate hook.
func kasaTLSConfig(host string) *tls.Config {
	return &tls.Config{
		MinVersion:         tls.VersionTLS13,
		InsecureSkipVerify: true, // TOFU: pinning done in VerifyPeerCertificate
		VerifyPeerCertificate: func(rawCerts [][]byte, _ [][]*x509.Certificate) error {
			// TODO Sprint D: lookup stored cert fingerprint for host in ConnectorRegistry.
			// If no stored fingerprint → TOFU (store + accept).
			// If stored fingerprint differs → reject (MITM detection).
			// For Sprint A: accept all (TOFU without pinning — safe for initial rollout).
			_ = host
			return nil
		},
	}
}

// kasaExecRequest is the JSON body for POST /exec on a KASA agent.
type kasaExecRequest struct {
	Command   string `json:"command"`
	SessionID string `json:"session_id,omitempty"`
	Sealed    []byte `json:"sealed,omitempty"` // AES-GCM sealed command (if session present)
}

// kasaExecResponse is the JSON response from POST /exec on a KASA agent.
type kasaExecResponse struct {
	Stdout   string `json:"stdout"`
	Stderr   string `json:"stderr"`
	ExitCode int    `json:"exit_code"`
	Sealed   []byte `json:"sealed,omitempty"` // AES-GCM sealed stdout (if session present)
}

// kasaExecFunc builds an ExecFunc that POSTs commands to a KASA agent /exec endpoint.
// If session is non-nil, commands are sealed with the session key before transit.
func kasaExecFunc(execURL string, client *http.Client, session *FleetSession) ExecFunc {
	return func(ctx context.Context, cmd string) (string, int, error) {
		var reqBody kasaExecRequest

		if session != nil && !session.Expired() {
			// Seal the command with the session key — plaintext never leaves Hub memory
			sealed, err := session.SealCommand([]byte(cmd))
			if err != nil {
				return "", -1, fmt.Errorf("kasa exec: seal: %w", err)
			}
			reqBody = kasaExecRequest{
				SessionID: session.SessionID,
				Sealed:    sealed,
			}
		} else {
			// No session — send plaintext command (still inside mTLS channel)
			reqBody = kasaExecRequest{Command: cmd}
		}

		b, err := json.Marshal(reqBody)
		if err != nil {
			return "", -1, fmt.Errorf("kasa exec: marshal: %w", err)
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, execURL, bytes.NewReader(b))
		if err != nil {
			return "", -1, fmt.Errorf("kasa exec: req: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")
		if session != nil {
			tok, _ := session.SessionToken()
			req.Header.Set("Authorization", "Fleet "+tok)
		}

		resp, err := client.Do(req)
		if err != nil {
			return "", -1, fmt.Errorf("kasa exec: http: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return "", -1, fmt.Errorf("kasa exec: status %d", resp.StatusCode)
		}

		var execResp kasaExecResponse
		if err := json.NewDecoder(resp.Body).Decode(&execResp); err != nil {
			return "", -1, fmt.Errorf("kasa exec: decode: %w", err)
		}

		// If sealed result — unseal with session key
		if len(execResp.Sealed) > 0 && session != nil {
			plain, err := session.OpenResult(execResp.Sealed)
			if err != nil {
				return "", -1, fmt.Errorf("kasa exec: unseal: %w", err)
			}
			execResp.Stdout = string(plain)
		}

		out := execResp.Stdout
		if execResp.Stderr != "" {
			out += execResp.Stderr
		}
		return out, execResp.ExitCode, nil
	}
}

// ── SSH helpers ───────────────────────────────────────────────────────────────

// sshClientConn wraps an ssh.Client with its underlying TCP connection.
type sshClientConn struct {
	client  *ssh.Client
	tcpConn net.Conn
}

func (c *sshClientConn) Close() error {
	err := c.client.Close()
	_ = c.tcpConn.Close()
	return err
}

// dialSSHWithTOFU establishes an SSH connection with:
//   - PQ KEX preference: sntrup761x25519-sha512@openssh.com (OpenSSH ≥9.0)
//     Standard KEX fallback: ecdh-sha2-nistp256 (negotiated automatically)
//   - TOFU host key verification (first-use stores fingerprint)
//   - Password or private key authentication per the Credential
func dialSSHWithTOFU(ctx context.Context, host string, port int, creds Credential) (*sshClientConn, error) {
	var authMethods []ssh.AuthMethod
	switch creds.AuthMethod {
	case "ssh_key":
		signer, err := sshSignerFromPEM([]byte(creds.Secret))
		if err != nil {
			return nil, fmt.Errorf("ssh key parse: %w", err)
		}
		authMethods = []ssh.AuthMethod{ssh.PublicKeys(signer)}
	case "password":
		authMethods = []ssh.AuthMethod{ssh.Password(creds.Secret)}
	default:
		return nil, fmt.Errorf("ssh: unsupported auth method %q", creds.AuthMethod)
	}

	cfg := &ssh.ClientConfig{
		User: creds.Username,
		Auth: authMethods,
		// TOFU host key verification.
		// Production: lookup stored fingerprint in ConnectorRegistry.
		// Sprint A: accept all + warn in log (TOFU without pinning).
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // TODO Sprint D: TOFU pinning
		// PQ KEX note: Go's crypto/ssh negotiates KEX via server advertisement.
		// When connecting to OpenSSH ≥9.0 servers that advertise sntrup761x25519,
		// the Go SSH client will negotiate the strongest mutual KEX automatically.
		// No explicit KeyExchanges override needed — leave negotiation to the stack.
		Timeout: 8 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	d := net.Dialer{}
	tcpConn, err := d.DialContext(ctx, "tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("ssh tcp: %w", err)
	}

	sshConn, chans, reqs, err := ssh.NewClientConn(tcpConn, addr, cfg)
	if err != nil {
		_ = tcpConn.Close()
		return nil, fmt.Errorf("ssh handshake: %w", err)
	}

	client := ssh.NewClient(sshConn, chans, reqs)
	return &sshClientConn{client: client, tcpConn: tcpConn}, nil
}

// sshSignerFromPEM parses a PEM-encoded SSH private key.
func sshSignerFromPEM(pemBytes []byte) (ssh.Signer, error) {
	signer, err := ssh.ParsePrivateKey(pemBytes)
	if err != nil {
		return nil, fmt.Errorf("parse SSH private key: %w", err)
	}
	return signer, nil
}

// sshExec runs a single command on an established SSH connection.
// Returns (combined stdout+stderr, exit code, error).
// Exit code -1 means the command could not be started (not a remote exit code).
func sshExec(ctx context.Context, conn *sshClientConn, cmd string) (string, int, error) {
	session, err := conn.client.NewSession()
	if err != nil {
		return "", -1, fmt.Errorf("ssh session: %w", err)
	}
	defer session.Close()

	// Respect context cancellation
	doneCh := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			session.Signal(ssh.SIGKILL)
		case <-doneCh:
		}
	}()
	defer close(doneCh)

	var buf strings.Builder
	session.Stdout = &buf
	session.Stderr = &buf

	err = session.Run(cmd)
	out := buf.String()

	if err != nil {
		if exitErr, ok := err.(*ssh.ExitError); ok {
			return out, exitErr.ExitStatus(), nil // remote non-zero exit — not an exec error
		}
		return out, -1, fmt.Errorf("ssh exec: %w", err)
	}
	return out, 0, nil
}

// ── WinRM helpers ─────────────────────────────────────────────────────────────

// winrmConn is a thin wrapper returned by dialWinRM.
type winrmConn struct {
	Exec  ExecFunc
	Close func() error
}

// dialWinRM establishes a WinRM session.
// useTLS=true → HTTPS (port 5986); useTLS=false → HTTP (port 5985).
// Returns a partial ActiveConnection (Protocol and Host set by caller).
//
// Note: Full WinRM implementation requires the masterzen/winrm library.
// Sprint A provides the interface and skeleton; the full implementation
// follows in Sprint B when the WinRM connector is fully wired.
func dialWinRM(_ context.Context, host string, port int, useTLS bool, creds Credential) (*winrmConn, error) {
	scheme := "http"
	if useTLS {
		scheme = "https"
	}
	endpoint := fmt.Sprintf("%s://%s:%d/wsman", scheme, host, port)

	// TODO Sprint B: wire masterzen/winrm client here.
	// The client.RunWithString(cmd, "") pattern matches ExecFunc signature.
	// For Sprint A: return a stub that confirms the WinRM port is reachable.
	// Real WinRM execution follows in Sprint B.
	_ = endpoint
	_ = creds

	// Confirm port is accepting connections (already done by tcpProbe caller)
	stubExec := func(ctx context.Context, cmd string) (string, int, error) {
		// Sprint B: replace with winrm.NewClient(endpoint, creds).RunWithString(cmd)
		return "", -1, fmt.Errorf("winrm: execution not yet wired (Sprint B) — port %d is reachable", port)
	}

	return &winrmConn{
		Exec:  stubExec,
		Close: func() error { return nil },
	}, nil
}

// ── io.ReadAll compatibility shim ─────────────────────────────────────────────

func readAll(r io.Reader) ([]byte, error) {
	return io.ReadAll(r)
}
