# =============================================================================
# Khepra Protocol — Dummy Linux Target (E2E Test Fixture)
# =============================================================================
#
# PURPOSE: Intentionally misconfigured Alpine container used as a real scan
#          target for E2E tests. This is NOT a production image.
#
# Security posture (deliberately BAD for STIG finding generation):
#   - Root SSH login PERMITTED (STIG V-220700 failure)
#   - Empty password SSH PERMITTED (STIG V-220701 failure)
#   - Telnet server running (STIG V-220699 failure)
#   - HTTP server on port 80 (STIG V-220701 failure)
#   - World-writable /tmp (STIG V-220702 failure)
#   - No firewall / iptables rules
#   - Legacy SSH ciphers enabled (3DES, RC4 — PQC failure)
#
# Exposed ports:
#   22  → SSH (for scanning / remote STIG validation)
#   23  → Telnet (intentional STIG failure)
#   80  → HTTP (intentional STIG failure)
#   8080→ Secondary HTTP (intentional STIG failure)
#
# Build: docker build -t khepra-dummy-linux:latest -f tests/e2e/fixtures/dummy-linux/Dockerfile .
# Run:   docker run -d -p 2222:22 -p 2323:23 -p 8080:80 khepra-dummy-linux:latest
# =============================================================================

FROM alpine:3.21

# Install intentionally weak services
RUN apk add --no-cache \
    openssh-server \
    busybox-extras \
    bash \
    curl \
    python3

# ── Intentional STIG Failures ─────────────────────────────────────────────────

# STIG V-220700: PermitRootLogin yes (should be no)
# STIG V-220701: PermitEmptyPasswords yes (should be no)
# STIG V-220703: PasswordAuthentication yes (MFA not enforced)
# PQC-FAIL: Legacy ciphers 3des-cbc, arcfour (RC4 equivalent) enabled
COPY tests/e2e/fixtures/dummy-linux/sshd_config /etc/ssh/sshd_config

# Generate SSH host keys (weak RSA-2048, not ML-KEM ready)
RUN ssh-keygen -A

# Create root password (intentional: password-based root login)
RUN echo "root:DummyTarget2026!" | chpasswd

# STIG V-220702: World-writable directory
RUN mkdir -p /var/dummy-writable && chmod 777 /var/dummy-writable

# Create a fake /etc/banner for SSH (missing DoD warning banner = STIG fail)
RUN echo "Welcome to DummyTarget" > /etc/ssh/banner

# Create a test user with no sudo restriction (excessive privilege)
RUN adduser -D -s /bin/bash testuser && \
    echo "testuser:test123" | chpasswd

# Drop a fake "vulnerable" config file (world-readable secrets)
RUN mkdir -p /etc/dummy-app && \
    echo "DB_PASSWORD=admin123\nAPI_KEY=sk-INSECURE\nSECRET_KEY=hardcoded" \
    > /etc/dummy-app/config.env && \
    chmod 644 /etc/dummy-app/config.env

# Fake /etc/os-release for RHEL9 STIG check simulation
RUN echo 'NAME="DummyLinux"' > /etc/os-release && \
    echo 'VERSION="9.0 (Dummy)"' >> /etc/os-release && \
    echo 'ID=rhel' >> /etc/os-release && \
    echo 'VERSION_ID="9.0"' >> /etc/os-release

COPY tests/e2e/fixtures/dummy-linux/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose intentionally bad ports
EXPOSE 22 23 80 8080

# Health check — just verify SSH is responding
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=5 \
    CMD nc -z 127.0.0.1 22 || exit 1

ENTRYPOINT ["/entrypoint.sh"]
