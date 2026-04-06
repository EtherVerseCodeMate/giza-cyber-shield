// cmd/serve-nlp/main.go — ASAF Natural Language Security Platform server
//
// Usage:
//   asaf serve-nlp               # starts on :7777, api on :45444
//   asaf serve-nlp --port 8080   # custom port
//   asaf serve-nlp --no-open     # don't auto-open browser
//
// Embeds asaf-nlp.html via embed.FS.
// Spawns apiserver as a supervised child process.
// Shuts down cleanly on SIGINT/SIGTERM.

package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"
	"time"
)

//go:embed ../../docs/asaf-nlp.html
var nlpHTML embed.FS

func main() {
	port    := flag.Int("port", 7777, "Port for NLP console")
	apiPort := flag.Int("api-port", 45444, "Port for ASAF API server")
	noOpen  := flag.Bool("no-open", false, "Don't auto-open browser")
	apiPath := flag.String("api-bin", "", "Path to asaf-apiserver binary (auto-detected if empty)")
	flag.Parse()

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// ── Detect API server binary ─────────────────────────────────────────────
	apiBin := *apiPath
	if apiBin == "" {
		apiBin = detectAPIBinary()
	}

	// ── Start API server as child ────────────────────────────────────────────
	var apiCmd *exec.Cmd
	if apiBin != "" {
		log.Printf("[serve-nlp] Starting API server: %s", apiBin)
		apiCmd = exec.CommandContext(ctx, apiBin)
		apiCmd.Env = append(os.Environ(),
			fmt.Sprintf("ADINKHEPRA_AGENT_PORT=%d", *apiPort),
		)
		apiCmd.Stdout = os.Stdout
		apiCmd.Stderr = os.Stderr
		if err := apiCmd.Start(); err != nil {
			log.Printf("[serve-nlp] WARNING: Could not start API server: %v", err)
			log.Printf("[serve-nlp] NLP UI will still work — connect manually at http://localhost:%d", *apiPort)
		} else {
			log.Printf("[serve-nlp] API server PID %d on :%d", apiCmd.Process.Pid, *apiPort)
			// Wait for API to be ready (up to 5s)
			waitForPort(*apiPort, 5*time.Second)
		}
	} else {
		log.Printf("[serve-nlp] No API binary found — NLP UI will prompt for API URL")
	}

	// ── Serve asaf-nlp.html ──────────────────────────────────────────────────
	sub, err := fs.Sub(nlpHTML, "docs")
	if err != nil {
		log.Fatalf("[serve-nlp] embed.FS error: %v", err)
	}

	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.FS(sub)))

	// Inject runtime config into a small JS endpoint
	mux.HandleFunc("/asaf-config.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript")
		fmt.Fprintf(w, `
window.ASAF_CONFIG = {
  apiURL: "http://localhost:%d",
  ollamaURL: "http://localhost:11434",
  lmstudioURL: "http://localhost:1234",
  version: "%s"
};
`, *apiPort, version())
	})

	addr := fmt.Sprintf("127.0.0.1:%d", *port)
	srv := &http.Server{Addr: addr, Handler: mux}

	go func() {
		<-ctx.Done()
		log.Println("[serve-nlp] Shutting down...")
		shutCtx, shutCancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer shutCancel()
		srv.Shutdown(shutCtx) //nolint:errcheck
	}()

	consoleURL := fmt.Sprintf("http://localhost:%d/asaf-nlp.html", *port)
	log.Printf("[serve-nlp] NLP console: %s", consoleURL)
	log.Printf("[serve-nlp] API server:  http://localhost:%d", *apiPort)
	log.Printf("[serve-nlp] Press Ctrl+C to stop")

	if !*noOpen {
		time.AfterFunc(500*time.Millisecond, func() { openBrowser(consoleURL) })
	}

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("[serve-nlp] HTTP server error: %v", err)
	}

	if apiCmd != nil && apiCmd.Process != nil {
		apiCmd.Process.Signal(syscall.SIGTERM) //nolint:errcheck
	}
	log.Println("[serve-nlp] Stopped.")
}

func detectAPIBinary() string {
	candidates := []string{
		"./bin/asaf-apiserver-linux-amd64",
		"./bin/asaf-apiserver-darwin-amd64",
		"./bin/asaf-apiserver-darwin-arm64",
		"asaf-apiserver",
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
		if path, err := exec.LookPath(c); err == nil {
			return path
		}
	}
	return ""
}

func waitForPort(port int, timeout time.Duration) {
	deadline := time.Now().Add(timeout)
	addr := fmt.Sprintf("localhost:%d", port)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", addr, 200*time.Millisecond)
		if err == nil {
			conn.Close()
			return
		}
		time.Sleep(300 * time.Millisecond)
	}
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "linux":   cmd = exec.Command("xdg-open", url)
	case "darwin":  cmd = exec.Command("open", url)
	case "windows": cmd = exec.Command("cmd", "/c", "start", url)
	}
	if cmd != nil {
		cmd.Start() //nolint:errcheck
	}
}

func version() string {
	if v := os.Getenv("ASAF_VERSION"); v != "" {
		return v
	}
	return "dev"
}
