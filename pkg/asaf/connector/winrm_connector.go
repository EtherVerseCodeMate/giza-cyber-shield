// Package connector — WinRMConnector: Mode D (Windows) via WinRM 5985/5986.
//
// Dials WinRM (HTTP on 5985, HTTPS on 5986), authenticates with NTLM or
// Basic auth, runs `Get-ComputerInfo` via PowerShell to identify the OS,
// and maps it to a STIG profile.
//
// Copyright: SOUHIMBOU DOH KONE LLC — exclusively licensed to SecRed Knowledge Inc.
// Patent Pending: USPTO #73565085
package connector

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/masterzen/winrm"
)

// WinRMConnector implements Connector for Windows endpoints via WinRM (Mode D).
type WinRMConnector struct {
	cfg  ConnectorConfig
	cred *Credential
}

// NewWinRMConnector constructs a WinRMConnector from a saved config and decrypted credential.
func NewWinRMConnector(cfg ConnectorConfig, cred *Credential) *WinRMConnector {
	return &WinRMConnector{cfg: cfg, cred: cred}
}

func (w *WinRMConnector) Protocol() ConnectorProtocol { return ProtoWinRM }

// Test dials the WinRM endpoint, authenticates, and returns OS + STIG profile.
func (w *WinRMConnector) Test(ctx context.Context) (*TestResult, error) {
	port := w.cfg.Port
	if port == 0 {
		port = DefaultPort(ProtoWinRM)
	}
	https := port == 5986
	username, password := w.credentials()

	endpoint := winrm.NewEndpoint(w.cfg.Host, port, https, true, nil, nil, nil, 15*time.Second)

	client, err := winrm.NewClientWithParameters(
		endpoint,
		username, password,
		winrm.DefaultParameters,
	)
	if err != nil {
		return &TestResult{
			Success: false,
			Message: fmt.Sprintf("WinRM client init failed: %v", err),
		}, nil
	}

	start := time.Now()

	// Cancel-aware: run command in goroutine, select on ctx.Done
	type runResult struct {
		stdout string
		err    error
	}
	done := make(chan runResult, 1)
	go func() {
		stdout, _, _, err := client.RunWithContext(ctx, "Get-ComputerInfo -Property OsName,OsVersion | ConvertTo-Json", &strings.Builder{}, &strings.Builder{})
		_ = stdout
		// Run a simpler command that definitely works:
		var sb, sbErr strings.Builder
		exitCode, err2 := client.RunWithContext(ctx,
			"powershell -Command \"(Get-WmiObject Win32_OperatingSystem).Caption\"",
			&sb, &sbErr,
		)
		_ = exitCode
		if err2 != nil && err != nil {
			done <- runResult{"", fmt.Errorf("WinRM exec: %v", err2)}
			return
		}
		done <- runResult{sb.String(), nil}
	}()

	latency := time.Since(start)

	var remoteOS string
	select {
	case <-ctx.Done():
		return &TestResult{
			Success: false,
			Latency: latency,
			Message: "WinRM test cancelled",
		}, nil
	case res := <-done:
		latency = time.Since(start)
		if res.err != nil {
			return &TestResult{
				Success: false,
				Latency: latency,
				Message: res.err.Error(),
			}, nil
		}
		remoteOS = strings.TrimSpace(res.stdout)
	}

	if remoteOS == "" {
		remoteOS = "Windows"
	}
	stigProfile := AutoDetectSTIGProfile(remoteOS)

	return &TestResult{
		Success:     true,
		Latency:     latency,
		RemoteOS:    remoteOS,
		STIGProfile: stigProfile,
		Message:     fmt.Sprintf("WinRM OK (%dms) — %s", latency.Milliseconds(), remoteOS),
	}, nil
}

// Discover returns the single host as a channel (WinRM is a single-host connector).
func (w *WinRMConnector) Discover(ctx context.Context) (<-chan DiscoveredHost, error) {
	ch := make(chan DiscoveredHost, 1)
	go func() {
		defer close(ch)
		result, err := w.Test(ctx)
		if err != nil || !result.Success {
			return
		}
		port := w.cfg.Port
		if port == 0 {
			port = DefaultPort(ProtoWinRM)
		}
		select {
		case ch <- DiscoveredHost{
			IP:          w.cfg.Host,
			OS:          result.RemoteOS,
			STIGProfile: result.STIGProfile,
			OpenPorts:   []int{port},
			Services:    []string{"winrm"},
			Reachable:   true,
			RiskScore:   30, // WinRM open is always notable
		}:
		case <-ctx.Done():
		}
	}()
	return ch, nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func (w *WinRMConnector) credentials() (username, password string) {
	if w.cred != nil {
		return w.cred.Username, w.cred.Secret
	}
	return w.cfg.Username, ""
}
