package remote

import (
	"context"
	"fmt"
	"time"

	"golang.org/x/crypto/ssh"
)

// SSHExecutor implements remote execution over SSH
type SSHExecutor struct {
	profile *ConnectionProfile
	client  *ssh.Client
}

// NewSSHExecutor creates a new SSH executor
func NewSSHExecutor(profile *ConnectionProfile) (*SSHExecutor, error) {
	if profile.Port == 0 {
		profile.Port = 22
	}
	return &SSHExecutor{profile: profile}, nil
}

// Connect establishes an SSH connection
func (e *SSHExecutor) Connect(ctx context.Context) error {
	var authMethods []ssh.AuthMethod

	switch e.profile.AuthMethod {
	case "password":
		authMethods = append(authMethods, ssh.Password(e.profile.Credential))
	case "key":
		// Read private key from file
		// For now, placeholder - would need to read from Credential path
		return fmt.Errorf("key-based auth not yet implemented")
	default:
		return fmt.Errorf("unsupported auth method: %s", e.profile.AuthMethod)
	}

	config := &ssh.ClientConfig{
		User:            e.profile.Username,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // TODO: Implement proper host key verification
		Timeout:         time.Duration(e.profile.Timeout) * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", e.profile.Host, e.profile.Port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return fmt.Errorf("ssh dial failed: %w", err)
	}

	e.client = client
	return nil
}

// Execute runs a command over SSH
func (e *SSHExecutor) Execute(ctx context.Context, command string) (*CommandResult, error) {
	if e.client == nil {
		return nil, fmt.Errorf("not connected")
	}

	session, err := e.client.NewSession()
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}
	defer session.Close()

	start := time.Now()

	// Capture stdout and stderr
	output, err := session.CombinedOutput(command)
	duration := time.Since(start)

	result := &CommandResult{
		Stdout:     string(output),
		Duration:   duration,
		ExecutedAt: start,
	}

	if err != nil {
		if exitErr, ok := err.(*ssh.ExitError); ok {
			result.ExitCode = exitErr.ExitStatus()
		} else {
			return result, err
		}
	}

	return result, nil
}

// Close terminates the SSH connection
func (e *SSHExecutor) Close() error {
	if e.client != nil {
		return e.client.Close()
	}
	return nil
}

// Type returns the executor type
func (e *SSHExecutor) Type() string {
	return "ssh"
}
