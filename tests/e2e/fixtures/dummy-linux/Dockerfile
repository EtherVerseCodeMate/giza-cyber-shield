# tests/e2e/fixtures/dummy-linux/Dockerfile
#
# Intentionally misconfigured Alpine Linux target for E2E testing.
# Every misconfiguration maps to a specific STIG/CMMC control finding.
# adinkhepra is injected at test time via: docker cp bin/asaf-linux-amd64 <ctr>:/usr/local/bin/adinkhepra
#
# Expected findings (non-exhaustive):
#   RHEL-09-255040  — SSH PermitRootLogin enabled
#   RHEL-09-255025  — SSH PasswordAuthentication enabled
#   RHEL-09-255060  — SSH Protocol includes SSHv1
#   RHEL-09-255050  — SSH X11Forwarding enabled
#   RHEL-09-671010  — FIPS mode not enabled (NIST 800-171 03.13.10)
#   RHEL-09-232230  — World-writable files present
#   RHEL-09-654010  — No auditd configured
#   CMMC AC.L2-3.1.6  — No least-privilege enforcement (root login allowed)
#   CMMC IA.L2-3.5.10 — Weak credential storage
#   CMMC SC.L2-3.13.10 — Non-FIPS cryptographic module (RSA-1024 key)

FROM alpine:3.18

RUN apk add --no-cache \
    openssh \
    openssl \
    bash \
    sudo \
    net-tools \
    procps \
    shadow

# RHEL-09-255040 / CMMC AC.L2-3.1.6: PermitRootLogin must be "no"
# RHEL-09-255025: PasswordAuthentication must be disabled
# RHEL-09-255060: SSHv1 is cryptographically broken (MD5 HMAC)
# RHEL-09-255050: X11Forwarding creates privilege escalation surface
RUN mkdir -p /etc/ssh && \
    ssh-keygen -A && \
    printf '%s\n' \
        'PermitRootLogin yes' \
        'PasswordAuthentication yes' \
        'Protocol 2,1' \
        'X11Forwarding yes' \
        'UseDNS no' \
        'LogLevel QUIET' \
    >> /etc/ssh/sshd_config

# RHEL-09-232230: World-writable directories/files are a privilege escalation vector
RUN mkdir -p /opt/insecure && chmod 0777 /opt/insecure && \
    touch /opt/insecure/config.txt && chmod 0666 /opt/insecure/config.txt

# RHEL-09-611010 / CMMC IA.L2-3.5.10: Weak root credential for test fixture reproducibility
RUN echo 'root:Password1!' | chpasswd

# CMMC SC.L2-3.13.10 / NIST 800-171 03.13.10: FIPS requires RSA >= 2048-bit.
# RSA-1024 key deliberately triggers quantum-vulnerable and non-FIPS findings.
RUN openssl genrsa -out /etc/ssl/private/host.key 1024 2>/dev/null && \
    openssl req -new -x509 \
        -key /etc/ssl/private/host.key \
        -out /etc/ssl/certs/host.crt \
        -days 3650 \
        -subj "/C=US/ST=Test/O=KhepraE2E/CN=dummy-linux" 2>/dev/null && \
    chmod 600 /etc/ssl/private/host.key

# RHEL-09-654010: No auditd — audit trail absent (auditd unavailable on Alpine by design)

# Test user with passwordless sudo and weak credential
RUN adduser -D -s /bin/sh e2euser && \
    echo 'e2euser:password' | chpasswd && \
    echo 'e2euser ALL=(ALL) NOPASSWD: ALL' >> /etc/sudoers

# Injection point — E2E tests copy the binary here:
# docker cp bin/asaf-linux-amd64 <container>:/usr/local/bin/adinkhepra
RUN mkdir -p /usr/local/bin

LABEL khepra.target.type="e2e-dummy-linux"
LABEL khepra.findings.expected.min="10"
LABEL khepra.stig.framework="RHEL-09"
LABEL khepra.cmmc.level="L2"
LABEL khepra.crypto.key.bits="1024"
LABEL khepra.fips.enabled="false"

CMD ["/bin/sh", "-c", "while true; do sleep 86400; done"]
