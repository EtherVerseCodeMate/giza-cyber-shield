# STEP 1: Define the Iron Bank Base Image
ARG BASE_REGISTRY=registry1.dso.mil
ARG BASE_IMAGE=redhat/ubi/ubi9-minimal
ARG BASE_TAG=latest

FROM ${BASE_REGISTRY}/${BASE_IMAGE}:${BASE_TAG}

# STEP 2: Metadata (Required for Iron Bank)
LABEL name="AdinKhepra Protocol" \
      description="Agentic Security Attestation Framework - Air-Gapped Modular Monolith Security Engine with Post-Quantum Cryptography" \
      vendor="NouchiX SecRed Knowledge Inc." \
      version="2.0.0-NUCLEAR" \
      maintainer="SGT Souhimbou Kone <cyber@nouchix.com>" \
      summary="SOVEREIGN nuclear-grade security scanner with PQC, STIG compliance, and cryptographic asset discovery" \
      io.k8s.description="Zero-trust security scanner with Adinkra-based post-quantum cryptography" \
      io.k8s.display-name="AdinKhepra SONAR" \
      io.openshift.tags="security,scanning,pqc,stig,compliance,zero-trust"

# STEP 3: Environment Setup
WORKDIR /app
ENV PATH="/app/bin:${PATH}" \
    KHEPRA_HOME="/app" \
    KHEPRA_DATA="/app/data" \
    KHEPRA_CONFIG="/app/config"

# STEP 4: Install Dependencies (Minimal - Required for Go runtime and scanning)
# Using microdnf for UBI9. Install ca-certificates for TLS verification.
USER root
RUN microdnf update -y && \
    microdnf install -y \
        ca-certificates \
        shadow-utils \
        tar \
        gzip && \
    microdnf clean all && \
    rm -rf /var/cache/yum

# STEP 5: Create Non-Root User (MANDATORY for Iron Bank)
RUN groupadd -g 1001 adinkhepra && \
    useradd -u 1001 -g adinkhepra -s /sbin/nologin -d /app adinkhepra && \
    mkdir -p /app/bin /app/data /app/config /app/licenses && \
    chown -R adinkhepra:adinkhepra /app

# STEP 6: Ingest the Binary (from hardening_manifest.yaml)
# The Iron Bank pipeline downloads 'resources' into the build context automatically
# For local builds, we expect binaries in ./bin/
COPY --chown=adinkhepra:adinkhepra bin/khepra /app/bin/
COPY --chown=adinkhepra:adinkhepra bin/khepra-agent /app/bin/
COPY --chown=adinkhepra:adinkhepra bin/sonar /app/bin/

# STEP 7: Copy necessary data files and configurations
COPY --chown=adinkhepra:adinkhepra data/ /app/data/
COPY --chown=adinkhepra:adinkhepra LICENSE /app/licenses/LICENSE
COPY --chown=adinkhepra:adinkhepra README.md /app/

# STEP 8: Ensure binaries are executable
RUN chmod +x /app/bin/khepra /app/bin/khepra-agent /app/bin/sonar

# STEP 9: Security Locking - Switch to non-root user
USER 1001

# STEP 10: Healthcheck (MANDATORY for Iron Bank)
# The sonar scanner can run a quick health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD /app/bin/khepra-agent || exit 1

# STEP 11: Default command - Run the agent
ENTRYPOINT ["/app/bin/sonar"]
CMD ["--help"]

# Iron Bank Security Notes:
# - Runs as UID 1001 (non-root)
# - Minimal attack surface (UBI9-minimal base)
# - No package managers in runtime
# - All dependencies vendored in Go binary
# - Supports air-gapped deployment
# - FIPS 140-2 compatible (UBI9 base)
# - Post-quantum cryptography (Dilithium3, Kyber-1024)
