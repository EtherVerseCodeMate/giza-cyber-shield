#!/bin/sh
# =============================================================================
# Dummy Linux Target — Entrypoint
# Starts SSH + a minimal HTTP server on port 80 (both intentional STIG failures)
# =============================================================================

set -e

echo "[DummyTarget] Starting intentionally misconfigured target..."
echo "[DummyTarget] DO NOT use in production — E2E test fixture only"

# Start sshd in foreground-compatible mode
/usr/sbin/sshd &
SSH_PID=$!
echo "[DummyTarget] sshd started (PID $SSH_PID) on port 22"

# Start minimal HTTP server on port 80 (STIG failure: plaintext HTTP)
python3 -m http.server 80 --directory /var/dummy-writable &
HTTP_PID=$!
echo "[DummyTarget] HTTP server started (PID $HTTP_PID) on port 80"

# Start minimal HTTP server on port 8080 (second STIG failure)
python3 -m http.server 8080 --directory /etc/dummy-app &
HTTP2_PID=$!
echo "[DummyTarget] HTTP server started (PID $HTTP2_PID) on port 8080"

echo "[DummyTarget] Ready. Open ports: 22 (SSH) 80 (HTTP) 8080 (HTTP)"
echo "[DummyTarget] Expected STIG findings:"
echo "  - PermitRootLogin yes        → V-220700 FAIL"
echo "  - PermitEmptyPasswords yes   → V-220701 FAIL"
echo "  - Legacy ciphers 3des-cbc    → PQC FAIL"
echo "  - HTTP on port 80            → SC-8 FAIL"
echo "  - HTTP on port 8080          → SC-8 FAIL"
echo "  - World-writable /var/dummy-writable → STIG FAIL"

# Wait for any process to exit (will keep container alive)
wait -n 2>/dev/null || wait
