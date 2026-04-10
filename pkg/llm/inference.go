// pkg/llm/inference.go — unified LLM backend detection for ASAF
//
// Detection order (corrected per security review):
//   1. Probe running services first (Ollama :11434, LM Studio :1234)
//   2. Only if none found: detect llamafile adjacent to binary → start on free port
//   3. Caller can then fall back to OpenRouter via API key
//
// This prevents the "address already in use" error from blindly starting
// a llamafile on :8080 when a dev service already occupies that port.

package llm

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"
)

// Backend represents a detected or started LLM inference endpoint.
// Compatible with OpenAI /v1/chat/completions API (Ollama, LM Studio, llamafile).
type Backend struct {
	BaseURL string
	Name    string
	cmd     *exec.Cmd // non-nil if we started this process
}

// Stop terminates a backend process we started. No-op if externally managed.
func (b *Backend) Stop() {
	if b != nil && b.cmd != nil && b.cmd.Process != nil {
		b.cmd.Process.Kill() //nolint:errcheck
	}
}

// Detect probes available LLM backends in priority order and returns the
// first usable one. If a llamafile exists adjacent to the binary and no
// running service is found, it starts the llamafile on a free OS-assigned port.
// Final fallback: if OPENROUTER_API_KEY is set, returns an OpenRouter cloud backend.
//
// Returns an error only if all backends (local + cloud) are unavailable.
func Detect(ctx context.Context) (*Backend, error) {
	// ── Step 1: probe already-running services ───────────────────────────────
	running := []struct{ url, name string }{
		{"http://localhost:11434", "Ollama"},
		{"http://localhost:1234", "LM Studio"},
	}
	for _, c := range running {
		if probe(c.url+"/v1/models", 2*time.Second) {
			return &Backend{BaseURL: c.url, Name: c.name}, nil
		}
		// Ollama uses /api/tags not /v1/models — check both
		if c.name == "Ollama" && probe(c.url+"/api/tags", 2*time.Second) {
			return &Backend{BaseURL: c.url, Name: c.name}, nil
		}
	}

	// ── Step 2: detect llamafile next to our binary ──────────────────────────
	lf := detectLlamafilePath()
	if lf != "" {
		// Get a free port from the OS — avoids :8080 conflicts
		port, err := findFreePort()
		if err == nil {
			if b, err := startLlamafile(ctx, lf, port); err == nil {
				return b, nil
			}
		}
	}

	// ── Step 3: OpenRouter cloud fallback ────────────────────────────────────
	if key := os.Getenv("OPENROUTER_API_KEY"); key != "" {
		return &Backend{
			BaseURL: "https://openrouter.ai/api/v1",
			Name:    "OpenRouter",
		}, nil
	}

	return nil, fmt.Errorf(
		"no LLM backend available\n" +
			"  → Local: install Ollama (ollama.com) or run 'asaf llm install'\n" +
			"  → Cloud: set OPENROUTER_API_KEY for instant access to Claude/GPT-4/Mistral",
	)
}

// detectLlamafilePath returns the path of the first llamafile found adjacent
// to the running binary, or empty string if none found.
func detectLlamafilePath() string {
	exeDir := "."
	if exe, err := os.Executable(); err == nil {
		if resolved, err := filepath.EvalSymlinks(exe); err == nil {
			exeDir = filepath.Dir(resolved)
		} else {
			exeDir = filepath.Dir(exe)
		}
	}

	// Preference order: specific ASAF-shipped names first, then generic
	candidates := []string{
		filepath.Join(exeDir, "asaf-phi3-mini.llamafile"),
		filepath.Join(exeDir, "asaf-mistral-7b.llamafile"),
		filepath.Join(exeDir, "asaf-llama3.llamafile"),
		filepath.Join(exeDir, "phi3-mini.llamafile"),
		filepath.Join(exeDir, "mistral-7b-instruct.llamafile"),
	}

	// Also glob for any .llamafile in exeDir (user may have placed their own)
	if matches, err := filepath.Glob(filepath.Join(exeDir, "*.llamafile")); err == nil {
		candidates = append(candidates, matches...)
	}

	for _, c := range candidates {
		info, err := os.Stat(c)
		if err != nil || info.IsDir() {
			continue
		}
		// On Linux/macOS require executable bit; on Windows .llamafile runs directly
		if runtime.GOOS != "windows" && info.Mode()&0111 == 0 {
			continue
		}
		return c
	}
	return ""
}

// startLlamafile starts the llamafile binary as a subprocess serving the
// OpenAI-compatible API on the given port. Waits up to 8 seconds for it
// to become ready, kills it and returns an error if it doesn't start.
func startLlamafile(ctx context.Context, path string, port int) (*Backend, error) {
	portStr := fmt.Sprintf("%d", port)
	cmd := exec.CommandContext(ctx, path,
		"--server",
		"--host", "127.0.0.1",
		"--port", portStr,
		"--nobrowser",
	)
	// Suppress llamafile's own log noise; callers can redirect if needed
	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("exec llamafile %s: %w", filepath.Base(path), err)
	}

	baseURL := fmt.Sprintf("http://localhost:%d", port)
	deadline := time.Now().Add(8 * time.Second)

	for time.Now().Before(deadline) {
		if probe(baseURL+"/v1/models", 500*time.Millisecond) {
			return &Backend{
				BaseURL: baseURL,
				Name:    filepath.Base(path),
				cmd:     cmd,
			}, nil
		}
		// Check if process crashed already
		if cmd.ProcessState != nil && cmd.ProcessState.Exited() {
			return nil, fmt.Errorf("llamafile %s exited early", filepath.Base(path))
		}
		time.Sleep(500 * time.Millisecond)
	}

	cmd.Process.Kill() //nolint:errcheck
	return nil, fmt.Errorf("llamafile failed to become ready in 8s on port %d", port)
}

// findFreePort asks the OS for an available TCP port.
// Using ":0" lets the kernel assign a free ephemeral port.
func findFreePort() (int, error) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port, nil
}

// probe performs a single HTTP GET to url with a short timeout.
// Returns true if the server responds with any non-5xx status.
func probe(url string, timeout time.Duration) bool {
	c := &http.Client{Timeout: timeout}
	resp, err := c.Get(url)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode < 500
}
