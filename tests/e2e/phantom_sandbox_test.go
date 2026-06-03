//go:build e2e

// Package e2e — Phantom Sandbox container lifecycle helpers.
//
// # Phantom Sandbox Architecture
//
// The "Phantom Sandbox" is the Docker-based scan infrastructure that has already been
// built into the repo (Dockerfile.phantom, docker-compose.yml phantom-node service).
// These helpers spin up:
//
//   - DummyLinuxTarget: intentionally misconfigured Alpine container (the scan target)
//   - PhantomScanner: runs adinkhepra CLI subprocesses against the target
//
// Usage in tests:
//
//	func TestE2E_Linux_Something(t *testing.T) {
//	    target := StartDummyLinuxTarget(t)   // returns "127.0.0.1:2222"
//	    out := RunAdinkhepra(t, "discover", "--target", target.IP)
//	    assert output...
//	}
//
// Containers are automatically cleaned up via t.Cleanup().
// Tests are skipped automatically when Docker is not available.
package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const (
	dummyLinuxImage = "khepra-dummy-linux:e2e"
	dummyLinuxSSH   = 22
	dummyLinuxHTTP  = 80
	dummyLinuxHTTP2 = 8080

	// Container startup grace period
	containerStartTimeout = 30 * time.Second

	// Port polling interval
	portPollInterval = 500 * time.Millisecond
)

// ─────────────────────────────────────────────────────────────────────────────
// DummyTarget represents a running dummy scan target container
// ─────────────────────────────────────────────────────────────────────────────

// DummyTarget holds the details of a running dummy target container.
type DummyTarget struct {
	ContainerID string // Docker container ID
	IP          string // Host IP (127.0.0.1)
	SSHPort     string // Mapped SSH port (e.g. "2222")
	HTTPPort    string // Mapped HTTP port (e.g. "8080")
	HTTP2Port   string // Mapped secondary HTTP port (e.g. "8081")
}

// Addr returns "IP:SSHPort" for use in scan commands.
func (d *DummyTarget) Addr() string {
	return d.IP + ":" + d.SSHPort
}

// ─────────────────────────────────────────────────────────────────────────────
// Docker availability check
// ─────────────────────────────────────────────────────────────────────────────

// RequireDocker skips the test if Docker is not available on the host.
func RequireDocker(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("docker"); err != nil {
		t.Skip("docker not in PATH — skipping container-based E2E test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "docker", "info", "--format", "{{.ServerVersion}}")
	if err := cmd.Run(); err != nil {
		t.Skipf("docker daemon not reachable (%v) — skipping container-based E2E test", err)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Build dummy Linux image
// ─────────────────────────────────────────────────────────────────────────────

// BuildDummyLinuxImage builds the dummy Linux target Docker image.
// Idempotent — skips the build if the image already exists with the same tag.
func BuildDummyLinuxImage(t *testing.T) {
	t.Helper()

	// Check if image already exists
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	check := exec.CommandContext(ctx, "docker", "image", "inspect", dummyLinuxImage)
	if check.Run() == nil {
		t.Logf("[phantom-sandbox] Image %s already exists — skipping build", dummyLinuxImage)
		return
	}

	t.Logf("[phantom-sandbox] Building dummy Linux target image: %s", dummyLinuxImage)

	// Find the repo root (go up from this file's location)
	repoRoot := findRepoRoot(t)

	ctx2, cancel2 := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel2()

	dockerfilePath := filepath.Join("tests", "e2e", "fixtures", "dummy-linux", "Dockerfile")
	cmd := exec.CommandContext(ctx2, "docker", "build",
		"-t", dummyLinuxImage,
		"-f", dockerfilePath,
		".",
	)
	cmd.Dir = repoRoot

	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	cmd.Stdout = os.Stdout

	if err := cmd.Run(); err != nil {
		t.Fatalf("[phantom-sandbox] docker build failed: %v\n%s", err, stderr.String())
	}
	t.Logf("[phantom-sandbox] Image built: %s", dummyLinuxImage)
}

// ─────────────────────────────────────────────────────────────────────────────
// Start / Stop dummy Linux target
// ─────────────────────────────────────────────────────────────────────────────

// StartDummyLinuxTarget starts the dummy Linux target container and waits for
// its SSH port to be reachable. Registers t.Cleanup() to stop the container.
func StartDummyLinuxTarget(t *testing.T) *DummyTarget {
	t.Helper()
	RequireDocker(t)
	BuildDummyLinuxImage(t)

	// Pick random free host ports to avoid conflicts across parallel tests
	sshPort := freePort(t)
	httpPort := freePort(t)
	http2Port := freePort(t)

	t.Logf("[phantom-sandbox] Starting dummy Linux target (SSH:%s HTTP:%s HTTP2:%s)...",
		sshPort, httpPort, http2Port)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	name := fmt.Sprintf("khepra-e2e-dummy-%d", time.Now().UnixNano())
	cmd := exec.CommandContext(ctx, "docker", "run",
		"--rm",
		"--detach",
		"--name", name,
		"-p", sshPort+":22",
		"-p", httpPort+":80",
		"-p", http2Port+":8080",
		dummyLinuxImage,
	)
	var out, stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		t.Fatalf("[phantom-sandbox] docker run failed: %v\n%s", err, stderr.String())
	}

	containerID := strings.TrimSpace(out.String())
	target := &DummyTarget{
		ContainerID: containerID,
		IP:          "127.0.0.1",
		SSHPort:     sshPort,
		HTTPPort:    httpPort,
		HTTP2Port:   http2Port,
	}

	t.Cleanup(func() {
		StopContainer(t, containerID)
	})

	// Wait for SSH to be reachable
	waitForPort(t, "127.0.0.1:"+sshPort, containerStartTimeout)
	t.Logf("[phantom-sandbox] Dummy Linux target ready: SSH=127.0.0.1:%s HTTP=127.0.0.1:%s",
		sshPort, httpPort)

	return target
}

// StopContainer stops and removes a Docker container by ID.
func StopContainer(t *testing.T, containerID string) {
	t.Helper()
	t.Logf("[phantom-sandbox] Stopping container %s...", containerID[:12])
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "docker", "stop", containerID)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	_ = cmd.Run() // best effort
}

// ─────────────────────────────────────────────────────────────────────────────
// Run adinkhepra CLI
// ─────────────────────────────────────────────────────────────────────────────

// AdinkhepraResult holds the output of a CLI run.
type AdinkhepraResult struct {
	Stdout   string
	Stderr   string
	ExitCode int
	Duration time.Duration
}

// RunAdinkhepra runs the adinkhepra CLI binary with the given args in a given
// working directory, returning stdout, stderr, and exit code. Does NOT fail the
// test on non-zero exit (callers assert themselves).
//
// workdir: the directory to run the CLI in (output files land here by default)
func RunAdinkhepraIn(t *testing.T, workdir string, timeout time.Duration, args ...string) AdinkhepraResult {
	t.Helper()

	binary := findAdinkhepra(t)

	t.Logf("[phantom-sandbox] Running: %s %s", filepath.Base(binary), strings.Join(args, " "))

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, binary, args...)
	cmd.Dir = workdir

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	start := time.Now()
	err := cmd.Run()
	dur := time.Since(start)

	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = -1
		}
	}

	result := AdinkhepraResult{
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
		ExitCode: exitCode,
		Duration: dur,
	}

	t.Logf("[phantom-sandbox] Exit %d in %s", exitCode, dur.Round(time.Millisecond))
	if result.Stderr != "" {
		t.Logf("[phantom-sandbox] stderr: %s", result.Stderr)
	}

	return result
}

// RunAdinkhepra runs the adinkhepra CLI in a fresh temp directory.
func RunAdinkhepra(t *testing.T, timeout time.Duration, args ...string) AdinkhepraResult {
	t.Helper()
	workdir := t.TempDir()
	return RunAdinkhepraIn(t, workdir, timeout, args...)
}

// RunAdinkhepraOK is like RunAdinkhepraIn but fails the test on non-zero exit.
func RunAdinkhepraOK(t *testing.T, timeout time.Duration, args ...string) AdinkhepraResult {
	t.Helper()
	workdir := t.TempDir()
	return RunAdinkhepraInOK(t, workdir, timeout, args...)
}

// RunAdinkhepraInOK is like RunAdinkhepraIn but fails the test on non-zero exit.
func RunAdinkhepraInOK(t *testing.T, workdir string, timeout time.Duration, args ...string) AdinkhepraResult {
	t.Helper()
	r := RunAdinkhepraIn(t, workdir, timeout, args...)
	if r.ExitCode != 0 {
		t.Fatalf("[phantom-sandbox] adinkhepra %s: exit %d\nstdout: %s\nstderr: %s",
			strings.Join(args, " "), r.ExitCode, r.Stdout, r.Stderr)
	}
	return r
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// findAdinkhepra locates the adinkhepra binary. Prefers:
//  1. ADINKHEPRA_BIN env var (CI override)
//  2. ./bin/adinkhepra[.exe] (built by make build)
//  3. adinkhepra[.exe] in PATH
//  4. ./adinkhepra[.exe] in repo root (pre-built release binary)
func findAdinkhepra(t *testing.T) string {
	t.Helper()

	if env := os.Getenv("ADINKHEPRA_BIN"); env != "" {
		return env
	}

	repoRoot := findRepoRoot(t)
	ext := ""
	if runtime.GOOS == "windows" {
		ext = ".exe"
	}

	candidates := []string{
		filepath.Join(repoRoot, "bin", "adinkhepra"+ext),
		filepath.Join(repoRoot, "adinkhepra"+ext),
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			t.Logf("[phantom-sandbox] Using binary: %s", c)
			return c
		}
	}

	if path, err := exec.LookPath("adinkhepra" + ext); err == nil {
		return path
	}

	t.Fatalf("[phantom-sandbox] adinkhepra binary not found — run 'make build' first or set ADINKHEPRA_BIN")
	return ""
}

// findRepoRoot walks up from this file's directory until it finds go.mod.
func findRepoRoot(t *testing.T) string {
	t.Helper()
	// Use go env GOMOD to find the module root reliably
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "go", "env", "GOMOD").Output()
	if err == nil {
		gomod := strings.TrimSpace(string(out))
		if gomod != "" && gomod != os.DevNull {
			return filepath.Dir(gomod)
		}
	}
	// Fallback: walk up
	dir, _ := os.Getwd()
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatalf("[phantom-sandbox] could not find repo root (go.mod not found)")
		}
		dir = parent
	}
}

// freePort finds a free TCP port on localhost.
func freePort(t *testing.T) string {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("freePort: %v", err)
	}
	port := fmt.Sprintf("%d", l.Addr().(*net.TCPAddr).Port)
	l.Close()
	return port
}

// waitForPort polls addr until it is reachable or timeout expires.
func waitForPort(t *testing.T, addr string, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
		if err == nil {
			conn.Close()
			return
		}
		time.Sleep(portPollInterval)
	}
	t.Fatalf("[phantom-sandbox] timeout waiting for %s to be reachable (after %s)", addr, timeout)
}

// ReadJSONFile reads and unmarshals a JSON file from path into v.
func ReadJSONFile(t *testing.T, path string, v any) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadJSONFile %s: %v", path, err)
	}
	if err := json.Unmarshal(data, v); err != nil {
		t.Fatalf("ReadJSONFile unmarshal %s: %v\ncontent: %s", path, err, string(data))
	}
}

// AssertPDF checks that the file at path starts with the PDF magic bytes.
func AssertPDF(t *testing.T, path string) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("AssertPDF: cannot open %s: %v", path, err)
	}
	if len(data) < 5 || !bytes.HasPrefix(data, []byte("%PDF-")) {
		t.Fatalf("AssertPDF: %s is not a valid PDF (got %q)", path, string(data[:min(16, len(data))]))
	}
	t.Logf("[assert] ✓ %s is a valid PDF (%d bytes)", filepath.Base(path), len(data))
}

// AssertFileExists checks that path exists and is non-empty.
func AssertFileExists(t *testing.T, path string) {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("AssertFileExists: %s: %v", path, err)
	}
	if info.Size() == 0 {
		t.Fatalf("AssertFileExists: %s exists but is empty", path)
	}
	t.Logf("[assert] ✓ %s exists (%d bytes)", filepath.Base(path), info.Size())
}

// AssertContains checks that s contains substr, failing with a helpful message.
func AssertContains(t *testing.T, s, substr, context string) {
	t.Helper()
	if !strings.Contains(s, substr) {
		t.Fatalf("[assert] %s: expected output to contain %q\nActual:\n%s", context, substr, s)
	}
	t.Logf("[assert] ✓ %s contains %q", context, substr)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
