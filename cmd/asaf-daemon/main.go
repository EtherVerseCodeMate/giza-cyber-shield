// cmd/asaf-daemon/main.go — ASAF System Daemon
//
// Privileged compliance execution layer for AdinKhepra ASAF.
// Runs as a systemd service with CAP_SYS_ADMIN + CAP_NET_ADMIN + CAP_AUDIT_WRITE.
//
// Security invariants (non-configurable):
//   1. Every ChangeRequest must carry a valid ML-DSA-65 signature over the
//      canonical request bytes — unsigned requests are silently dropped + logged.
//   2. Kernel-level operations (sysctl, SELinux, PAM, GRUB, modprobe) require
//      Symbol == "Eban". Requests carrying any other symbol are rejected.
//   3. Staging (mirror container) MUST succeed before production execution.
//   4. Production execution requires Approved == true (human-in-the-loop).
//   5. Every executed command produces a ML-DSA-65-signed DAG node — the audit
//      trail is tamper-evident and quantum-resistant.
//
// Transport: Unix domain socket (air-gap) or mTLS HTTPS (remote management).
// The socket path and key material are injected via flags — never env vars.
//
// Usage (systemd ExecStart):
//
//	/usr/local/bin/asaf-daemon \
//	  --socket /var/run/asaf/asaf.sock \
//	  --dag-path /var/lib/asaf/dag \
//	  --key-path /etc/asaf/daemon.key \
//	  --log-level info

package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/asaf/daemon"
)

func main() {
	// ── Flags ─────────────────────────────────────────────────────────────────
	socketPath := flag.String("socket", "/var/run/asaf/asaf.sock",
		"Unix domain socket path for ChangeRequest ingestion")
	dagPath := flag.String("dag-path", "/var/lib/asaf/dag",
		"Persistent DAG storage directory (tamper-evident audit trail)")
	keyPath := flag.String("key-path", "/etc/asaf/daemon.key",
		"Path to ML-DSA-65 agent private key (PEM, mode 0400, root-only)")
	agentPubKeyPath := flag.String("agent-pubkey", "/etc/asaf/agent.pub",
		"Path to authorized agent ML-DSA-65 public key for signature verification")
	logLevel := flag.String("log-level", "info", "Log verbosity: debug | info | warn")
	enableMTLS := flag.Bool("mtls", false, "Enable mTLS HTTPS listener in addition to Unix socket")
	mtlsAddr := flag.String("mtls-addr", ":8444", "mTLS listener address (remote management)")
	mtlsCert := flag.String("mtls-cert", "", "TLS certificate file for mTLS listener")
	mtlsKey := flag.String("mtls-key", "", "TLS key file for mTLS listener")
	mtlsCA := flag.String("mtls-ca", "", "CA certificate for mTLS client verification")
	flag.Parse()

	logger := log.New(os.Stderr, "[asaf-daemon] ", log.LstdFlags|log.Lmicroseconds)

	// ── Startup banner ────────────────────────────────────────────────────────
	logger.Printf("━━━ ASAF SYSTEM DAEMON ━━━")
	logger.Printf("  socket:     %s", *socketPath)
	logger.Printf("  dag_path:   %s", *dagPath)
	logger.Printf("  log_level:  %s", *logLevel)
	if *enableMTLS {
		logger.Printf("  mtls:       ENABLED → %s", *mtlsAddr)
	} else {
		logger.Printf("  mtls:       DISABLED (Unix socket only — air-gap mode)")
	}
	logger.Printf("  pid:        %d", os.Getpid())

	// ── Load key material ─────────────────────────────────────────────────────
	// The agent public key is what we verify incoming ChangeRequest signatures
	// against. The daemon private key is used to sign DAG attestation nodes.
	agentPubKey, err := daemon.LoadPublicKey(*agentPubKeyPath)
	if err != nil {
		logger.Fatalf("FATAL: cannot load agent public key from %s: %v", *agentPubKeyPath, err)
	}
	logger.Printf("  agent_pubkey: %s (loaded, %d bytes)", *agentPubKeyPath, len(agentPubKey))

	daemonPrivKey, err := daemon.LoadPrivateKey(*keyPath)
	if err != nil {
		logger.Fatalf("FATAL: cannot load daemon private key from %s: %v", *keyPath, err)
	}
	logger.Printf("  daemon_key:   %s (loaded)", *keyPath)

	// ── Build daemon ──────────────────────────────────────────────────────────
	d, err := daemon.New(daemon.Config{
		SocketPath:    *socketPath,
		DAGPath:       *dagPath,
		AgentPubKey:   agentPubKey,
		DaemonPrivKey: daemonPrivKey,
		Logger:        logger,
		EnableMTLS:    *enableMTLS,
		MTLSAddr:      *mtlsAddr,
		MTLSCertFile:  *mtlsCert,
		MTLSKeyFile:   *mtlsKey,
		MTLSCAFile:    *mtlsCA,
	})
	if err != nil {
		logger.Fatalf("FATAL: daemon construction failed: %v", err)
	}

	// ── Signal handling ───────────────────────────────────────────────────────
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	logger.Printf("⚡ ASAF SYSTEM DAEMON LIVE — LISTENING FOR SIGNED INSTRUCTIONS")

	if err := d.Run(ctx); err != nil {
		logger.Printf("daemon exited: %v", err)
	}

	// Key material zeroing on shutdown
	daemon.ZeroBytes(daemonPrivKey)
	fmt.Fprintln(os.Stderr, "[asaf-daemon] PQC private key material destroyed — shutdown complete")
}
