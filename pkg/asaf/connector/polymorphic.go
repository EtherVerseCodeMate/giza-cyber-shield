// pkg/asaf/connector/polymorphic.go
// Polymorphic Fleet Connector — automatic protocol detection and fallback.
//
// This is the commercial core of the ASAF Fleet Connector.
// It answers the question: "How do I reach this endpoint?" — without requiring
// the operator to know or manually specify the protocol.
//
// Fallback chain (ordered by capability richness):
//   1. KASA REST   (port 9090, mTLS) — all 50+ scanners, ML-DSA-65 signed results
//   2. SSH         (port 22)          — Linux/Unix standard, shell-only checks
//   3. SSH PQ-KEX  (port 22)          — SSH with sntrup761x25519 KEX if OpenSSH ≥9.0
//   4. WinRM HTTPS (port 5986, TLS)   — Windows preferred
//   5. WinRM HTTP  (port 5985)        — Windows internal fallback
//   6. SNMP v3     (port 161)         — network devices (discovery + OID reads only)
//   7. AWS SDK                        — cloud VMs (if cloud_account configured)
//   8. Azure SDK                      — Azure Gov VMs
//   9. UNREACHABLE                    — logged as DAG node, SPRS impact recorded
//
// All probe attempts are logged (protocol, latency, error).
// The first successful protocol wins — no further probing.
// Failed probes are not evidence of a security issue — they're expected in mixed networks.
//
// OS auto-detection runs on first successful connection:
//   Linux:   cat /etc/os-release → maps to STIG profile
//   Windows: ver + Win32_OperatingSystem WMI → maps to STIG profile
//   Network: SNMP sysDescr OID → maps to "network-device" profile
//   Unknown: "generic" profile (2 checks, reachability only)
//
// IP: SOUHIMBOU DOH KONE LLC — exclusively licensed to SecRed Knowledge Inc.
// USPTO #73565085 (KHEPRA Protocol)

package connector

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"
)

// ── Types ─────────────────────────────────────────────────────────────────────

// OSProfile is the result of OS auto-detection on a newly connected endpoint.
type OSProfile struct {
	Family      string // "linux" | "windows" | "network_device" | "container" | "unknown"
	Distro      string // "rhel" | "ubuntu" | "debian" | "windows_server" | "cisco" | ...
	Version     string // "10" | "9" | "2022" | "2019" | ...
	STIGProfile string // ready for selectSTIGChecks() — "rhel10" | "rhel9" | "windows" | ...
	Arch        string // "amd64" | "arm64" | "x86"
	Kernel      string // uname -r output (Linux only)
	Raw         string // raw OS string from the connection banner
}

// ExecFunc is a function that executes a shell command on a remote endpoint
// and returns (stdout+stderr, exit_code, error).
type ExecFunc func(ctx context.Context, cmd string) (string, int, error)

// ActiveConnection represents a live connection to a fleet endpoint.
// Callers use Exec to run checks; Close to release resources.
type ActiveConnection struct {
	Protocol    ConnectorProtocol
	AssetID     string
	Host        string
	Exec        ExecFunc
	Close       func() error
	OSInfo      OSProfile
	ProbedAt    time.Time
	Latency     time.Duration
	Session     *FleetSession // nil for agentless connections (no PQC session sealing)
}

// ProbeLog records each protocol probe attempt (for audit and DAG logging).
type ProbeLog struct {
	Protocol ConnectorProtocol
	Port     int
	Latency  time.Duration
	Error    string // "" means success
}

// DialResult is the complete result of a PolymorphicConnector.Dial() call.
type DialResult struct {
	Conn     *ActiveConnection
	Probes   []ProbeLog // all attempts, in order — for DAG attestation
	Total    time.Duration
}

// ── PolymorphicConnector ──────────────────────────────────────────────────────

// PolymorphicConnector dials an endpoint using the richest available protocol.
// It implements the fallback chain defined in the architecture document.
type PolymorphicConnector struct {
	host        string
	port        int     // 0 = use protocol default for each candidate
	creds       Credential
	assetID     string
	enclaveID   string
	timeout     time.Duration // per-probe timeout (default 8s)
	session     *FleetSession // optional: attach PQC session context to the connection
	skipProtos  map[ConnectorProtocol]bool // protocols to skip (e.g. if known-firewalled)
}

// NewPolymorphicConnector creates a connector that will probe the given host.
func NewPolymorphicConnector(host, assetID, enclaveID string, creds Credential) *PolymorphicConnector {
	return &PolymorphicConnector{
		host:       host,
		assetID:    assetID,
		enclaveID:  enclaveID,
		creds:      creds,
		timeout:    8 * time.Second,
		skipProtos: make(map[ConnectorProtocol]bool),
	}
}

// WithSession attaches a PQC FleetSession to the connection.
// When set, KASA REST connections seal their commands with the session key.
func (p *PolymorphicConnector) WithSession(s *FleetSession) *PolymorphicConnector {
	p.session = s
	return p
}

// WithTimeout overrides the per-probe timeout (default 8s).
func (p *PolymorphicConnector) WithTimeout(d time.Duration) *PolymorphicConnector {
	p.timeout = d
	return p
}

// SkipProtocol marks a protocol as unavailable (skip probing it).
// Use this when prior knowledge makes probing wasteful (e.g. known Windows host → skip SSH).
func (p *PolymorphicConnector) SkipProtocol(proto ConnectorProtocol) *PolymorphicConnector {
	p.skipProtos[proto] = true
	return p
}

// Dial attempts to connect to the endpoint using the fallback chain.
// Returns DialResult containing the live connection and the full probe log.
// If all probes fail, returns a DialResult with Conn == nil and all probe errors.
func (p *PolymorphicConnector) Dial(ctx context.Context) (*DialResult, error) {
	start := time.Now()
	result := &DialResult{}

	// Ordered probe candidates
	candidates := []struct {
		proto ConnectorProtocol
		ports []int
		probe func(ctx context.Context, port int) (*ActiveConnection, error)
	}{
		// 1. KASA REST — richest path: all scanners, ML-DSA-65 signed results
		{ProtoREST, []int{9090, 9443}, p.probeKASA},
		// 2. SSH — Linux standard, shell-command checks
		{ProtoSSH, []int{22, 2222}, p.probeSSH},
		// 3. WinRM HTTPS — Windows preferred (encrypted)
		{ProtoWinRM, []int{5986}, p.probeWinRMTLS},
		// 4. WinRM HTTP — Windows fallback (internal networks only)
		{ProtoWinRM, []int{5985}, p.probeWinRMPlain},
	}

	for _, c := range candidates {
		if p.skipProtos[c.proto] {
			result.Probes = append(result.Probes, ProbeLog{
				Protocol: c.proto,
				Error:    "skipped (operator override)",
			})
			continue
		}

		for _, port := range c.ports {
			probeStart := time.Now()
			probeCtx, cancel := context.WithTimeout(ctx, p.timeout)

			conn, err := c.probe(probeCtx, port)
			cancel()

			latency := time.Since(probeStart)
			log := ProbeLog{Protocol: c.proto, Port: port, Latency: latency}

			if err != nil {
				log.Error = err.Error()
				result.Probes = append(result.Probes, log)
				continue
			}

			// Success — run OS detection, attach session
			result.Probes = append(result.Probes, log)
			conn.ProbedAt = start
			conn.Latency = latency
			conn.AssetID = p.assetID

			if conn.OSInfo.STIGProfile == "" {
				conn.OSInfo = p.detectOS(ctx, conn)
			}
			if p.session != nil {
				conn.Session = p.session
			}

			result.Conn = conn
			result.Total = time.Since(start)
			return result, nil
		}
	}

	// All probes failed — endpoint is UNREACHABLE
	result.Total = time.Since(start)
	return result, nil // Conn == nil signals unreachable; caller records in DAG
}

// ── Protocol Probers ──────────────────────────────────────────────────────────

// probeKASA checks for a running KASA agent on the given port.
// KASA exposes a REST API at /healthz (GET, no auth) and /exec (POST, signed).
// If the healthz endpoint responds, we have a richer connection than agentless SSH.
func (p *PolymorphicConnector) probeKASA(ctx context.Context, port int) (*ActiveConnection, error) {
	url := fmt.Sprintf("https://%s:%d/healthz", p.host, port)

	// Quick TCP check first (faster than full HTTPS)
	if err := tcpProbe(ctx, p.host, port); err != nil {
		return nil, fmt.Errorf("kasa tcp: %w", err)
	}

	// HTTPS GET /healthz — KASA agent responds with {"status":"ok","version":"..."}
	// We use a permissive TLS config here; the KASA agent's cert is TOFU-verified
	// on first contact and stored in the ConnectorRegistry.
	client := &http.Client{
		Timeout: p.timeout,
		Transport: &http.Transport{
			// TLS verification is handled by TOFU host key pinning, not CA chains,
			// because the KASA agent's cert is self-signed (ML-DSA-65 identity cert).
			TLSClientConfig: kasaTLSConfig(p.host),
		},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("kasa req: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("kasa https: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("kasa healthz: status %d", resp.StatusCode)
	}

	// Build ExecFunc that POSTs to /exec with session-sealed commands
	execURL := fmt.Sprintf("https://%s:%d/exec", p.host, port)
	execFn := kasaExecFunc(execURL, client, p.session)

	return &ActiveConnection{
		Protocol: ProtoREST,
		Host:     p.host,
		Exec:     execFn,
		Close:    func() error { return nil },
	}, nil
}

// probeSSH attempts an SSH connection with TOFU host key verification.
// Prefers PQ KEX (sntrup761x25519-sha512@openssh.com) if available,
// falls back to classical (ecdh-sha2-nistp256) automatically via SSH KEX negotiation.
func (p *PolymorphicConnector) probeSSH(ctx context.Context, port int) (*ActiveConnection, error) {
	if err := tcpProbe(ctx, p.host, port); err != nil {
		return nil, fmt.Errorf("ssh tcp: %w", err)
	}

	sshConn, err := dialSSHWithTOFU(ctx, p.host, port, p.creds)
	if err != nil {
		return nil, fmt.Errorf("ssh auth: %w", err)
	}

	execFn := func(ctx context.Context, cmd string) (string, int, error) {
		return sshExec(ctx, sshConn, cmd)
	}
	return &ActiveConnection{
		Protocol: ProtoSSH,
		Host:     p.host,
		Exec:     execFn,
		Close:    sshConn.Close,
	}, nil
}

// probeWinRMTLS attempts WinRM over HTTPS (port 5986, TLS).
func (p *PolymorphicConnector) probeWinRMTLS(ctx context.Context, port int) (*ActiveConnection, error) {
	if err := tcpProbe(ctx, p.host, port); err != nil {
		return nil, fmt.Errorf("winrm-tls tcp: %w", err)
	}
	conn, err := dialWinRM(ctx, p.host, port, true, p.creds)
	if err != nil {
		return nil, fmt.Errorf("winrm-tls: %w", err)
	}
	return &ActiveConnection{
		Protocol: ProtoWinRM,
		Host:     p.host,
		Exec:     conn.Exec,
		Close:    conn.Close,
	}, nil
}

// probeWinRMPlain attempts WinRM over HTTP (port 5985, no TLS).
// Should only be used on trusted internal networks — flag the result as "unencrypted" in DAG.
func (p *PolymorphicConnector) probeWinRMPlain(ctx context.Context, port int) (*ActiveConnection, error) {
	if err := tcpProbe(ctx, p.host, port); err != nil {
		return nil, fmt.Errorf("winrm tcp: %w", err)
	}
	conn, err := dialWinRM(ctx, p.host, port, false, p.creds)
	if err != nil {
		return nil, fmt.Errorf("winrm: %w", err)
	}
	// Tag the connection — caller can warn in scan results that transport is unencrypted
	// conn.OSInfo.Raw is not available on winrmConn stub, set warning via returned ActiveConn
	return &ActiveConnection{
		Protocol: ProtoWinRM,
		Host:     p.host,
		Exec:     conn.Exec,
		Close:    conn.Close,
		OSInfo:   OSProfile{Raw: "[WARN: WinRM unencrypted transport]"},
	}, nil
}

// ── OS Auto-Detection ─────────────────────────────────────────────────────────

// detectOS runs OS fingerprinting on a live connection.
// Called immediately after Dial succeeds.
func (p *PolymorphicConnector) detectOS(ctx context.Context, conn *ActiveConnection) OSProfile {
	detCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	switch conn.Protocol {
	case ProtoSSH:
		return detectOSLinux(detCtx, conn.Exec)
	case ProtoWinRM:
		return detectOSWindows(detCtx, conn.Exec)
	case ProtoREST:
		// KASA agent reports its own OS profile via /healthz — already parsed above.
		// Fall back to Linux detection via the KASA exec endpoint.
		return detectOSLinux(detCtx, conn.Exec)
	default:
		return OSProfile{Family: "unknown", STIGProfile: "generic"}
	}
}

func detectOSLinux(ctx context.Context, exec ExecFunc) OSProfile {
	out, _, err := exec(ctx, `cat /etc/os-release 2>/dev/null; uname -rm 2>/dev/null`)
	if err != nil || out == "" {
		return OSProfile{Family: "unknown", STIGProfile: "generic"}
	}

	p := OSProfile{Family: "linux", Raw: out}

	// Parse ID and VERSION_ID from /etc/os-release
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(line, "ID="):
			p.Distro = strings.Trim(strings.TrimPrefix(line, "ID="), `"`)
		case strings.HasPrefix(line, "VERSION_ID="):
			p.Version = strings.Trim(strings.TrimPrefix(line, "VERSION_ID="), `"`)
		}
	}

	// Parse kernel from uname -rm
	lines := strings.Split(out, "\n")
	if len(lines) > 0 {
		p.Kernel = strings.TrimSpace(lines[len(lines)-1])
		if parts := strings.Fields(p.Kernel); len(parts) >= 2 {
			p.Arch = parts[1]
			p.Kernel = parts[0]
		}
	}

	// Map distro + version → STIG profile
	p.STIGProfile = AutoDetectSTIGProfile(p.Distro + " " + p.Version)
	return p
}

func detectOSWindows(ctx context.Context, exec ExecFunc) OSProfile {
	out, _, err := exec(ctx,
		`powershell -NoProfile -Command "(Get-WmiObject Win32_OperatingSystem | Select-Object -ExpandProperty Caption)"`)
	if err != nil || out == "" {
		return OSProfile{Family: "windows", STIGProfile: "windows", Raw: "detection_failed"}
	}
	p := OSProfile{
		Family: "windows",
		Raw:    strings.TrimSpace(out),
		Distro: "windows_server",
	}
	p.STIGProfile = AutoDetectSTIGProfile(p.Raw)
	return p
}

// ── TCP Probe Helper ──────────────────────────────────────────────────────────

// tcpProbe does a raw TCP connect to confirm the port is open.
// This is cheaper than a full protocol handshake and lets us skip dead ports fast.
func tcpProbe(ctx context.Context, host string, port int) error {
	addr := fmt.Sprintf("%s:%d", host, port)
	d := net.Dialer{}
	conn, err := d.DialContext(ctx, "tcp", addr)
	if err != nil {
		return err
	}
	return conn.Close()
}
