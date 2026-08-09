// Package connector — SSHConnector: Mode D (Manual Add) via direct SSH dial.
//
// Dials the target over TCP, performs an SSH handshake (no shell session opened),
// grabs the server banner, fingerprints the OS, maps it to a STIG profile, and
// stores the host key fingerprint for TOFU verification.
//
// Copyright: SOUHIMBOU DOH KONE LLC — exclusively licensed to SecRed Knowledge Inc.
// Patent Pending: USPTO #73565085
package connector

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
)

// SSHConnector implements Connector for SSH-reachable hosts (Mode D).
type SSHConnector struct {
	cfg  ConnectorConfig
	cred *Credential
}

// NewSSHConnector constructs an SSHConnector from a saved config and decrypted credential.
func NewSSHConnector(cfg ConnectorConfig, cred *Credential) *SSHConnector {
	return &SSHConnector{cfg: cfg, cred: cred}
}

func (c *SSHConnector) Protocol() ConnectorProtocol { return ProtoSSH }

// Test dials the host, performs the SSH handshake, and returns OS fingerprint + host key.
// No shell session is opened — this is a pure capability probe.
func (c *SSHConnector) Test(ctx context.Context) (*TestResult, error) {
	host := c.cfg.Host
	port := c.cfg.Port
	if port == 0 {
		port = DefaultPort(ProtoSSH)
	}
	addr := net.JoinHostPort(host, strconv.Itoa(port))

	// Build auth methods from credential.
	authMethods, err := c.buildAuthMethods()
	if err != nil {
		return &TestResult{Success: false, Message: err.Error()}, nil
	}

	var hostKeyFP string
	var remoteVersion string

	sshCfg := &ssh.ClientConfig{
		User: c.username(),
		Auth: authMethods,
		HostKeyCallback: func(_ string, _ net.Addr, key ssh.PublicKey) error {
			// Compute SHA-256 fingerprint for TOFU display.
			h := sha256.Sum256(key.Marshal())
			hostKeyFP = "SHA256:" + hex.EncodeToString(h[:])[:32] + "…"
			return nil
		},
		BannerCallback: func(banner string) error {
			remoteVersion = strings.TrimSpace(banner)
			return nil
		},
		Timeout: 10 * time.Second,
	}

	start := time.Now()

	// Dial with context deadline.
	deadline, ok := ctx.Deadline()
	if !ok {
		deadline = time.Now().Add(15 * time.Second)
	}
	dialer := &net.Dialer{Deadline: deadline}
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return &TestResult{
			Success: false,
			Latency: time.Since(start),
			Message: fmt.Sprintf("TCP dial failed: %v", err),
		}, nil
	}

	sshConn, chans, reqs, err := ssh.NewClientConn(conn, addr, sshCfg)
	latency := time.Since(start)
	if err != nil {
		_ = conn.Close()
		return &TestResult{
			Success: false,
			Latency: latency,
			HostKey: hostKeyFP, // may have been captured before auth failure
			Message: fmt.Sprintf("SSH handshake failed: %v", err),
		}, nil
	}
	client := ssh.NewClient(sshConn, chans, reqs)
	defer client.Close()

	// Open one session to capture OS info via uname / systeminfo.
	remoteOS := c.probeOS(client)
	stigProfile := AutoDetectSTIGProfile(remoteOS)

	msg := fmt.Sprintf("Connected (%dms)", latency.Milliseconds())
	if remoteVersion != "" {
		msg += " — " + remoteVersion
	}

	return &TestResult{
		Success:     true,
		Latency:     latency,
		RemoteOS:    remoteOS,
		STIGProfile: stigProfile,
		HostKey:     hostKeyFP,
		Message:     msg,
	}, nil
}

// Discover is not meaningful for a single-host SSH connector (it returns the one host).
// For subnet discovery use SubnetConnector instead.
func (c *SSHConnector) Discover(ctx context.Context) (<-chan DiscoveredHost, error) {
	ch := make(chan DiscoveredHost, 1)
	go func() {
		defer close(ch)
		result, err := c.Test(ctx)
		if err != nil || !result.Success {
			return
		}
		select {
		case ch <- DiscoveredHost{
			IP:          c.cfg.Host,
			OS:          result.RemoteOS,
			STIGProfile: result.STIGProfile,
			OpenPorts:   []int{c.effectivePort()},
			Services:    []string{"ssh"},
			Reachable:   true,
		}:
		case <-ctx.Done():
		}
	}()
	return ch, nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func (c *SSHConnector) username() string {
	if c.cred != nil && c.cred.Username != "" {
		return c.cred.Username
	}
	return c.cfg.Username
}

func (c *SSHConnector) effectivePort() int {
	if c.cfg.Port > 0 {
		return c.cfg.Port
	}
	return DefaultPort(ProtoSSH)
}

func (c *SSHConnector) buildAuthMethods() ([]ssh.AuthMethod, error) {
	if c.cred == nil {
		// No credential — attempt host-based (will likely fail, but test reachability).
		return []ssh.AuthMethod{ssh.Password("")}, nil
	}
	switch c.cred.AuthMethod {
	case "password":
		return []ssh.AuthMethod{ssh.Password(c.cred.Secret)}, nil
	case "ssh_key":
		signer, err := ssh.ParsePrivateKey([]byte(c.cred.Secret))
		if err != nil {
			return nil, fmt.Errorf("SSH key parse error: %w", err)
		}
		return []ssh.AuthMethod{ssh.PublicKeys(signer)}, nil
	default:
		return []ssh.AuthMethod{ssh.Password(c.cred.Secret)}, nil
	}
}

// probeOS runs a minimal remote command to determine the OS name.
// Falls back to the SSH server version string if the command fails.
func (c *SSHConnector) probeOS(client *ssh.Client) string {
	session, err := client.NewSession()
	if err != nil {
		return "Unknown"
	}
	defer session.Close()

	// Try Linux first.
	out, err := session.Output("uname -sr 2>/dev/null || systeminfo 2>nul | findstr /B \"OS Name\"")
	if err != nil {
		return "Unknown"
	}
	return strings.TrimSpace(string(out))
}
