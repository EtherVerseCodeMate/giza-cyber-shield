# STEP 1: Define the Iron Bank Base Image
ARG BASE_REGISTRY=registry1.dso.mil
ARG BASE_IMAGE=redhat/ubi/ubi9-minimal
ARG BASE_TAG=latest

FROM ${BASE_REGISTRY}/${BASE_IMAGE}:${BASE_TAG}

# STEP 2: Metadata
LABEL name="AdinKhepra Protocol" \
    description="Air-Gapped Modular Monolith Security Engine" \
    vendor="AdinKhepra"

# STEP 3: Environment Setup
WORKDIR /app
ENV PATH="/app:${PATH}"

# STEP 4: Install Dependencies (Minimal)
# Using microdnf for UBI9. We need ca-certificates for PQC verification if needed.
USER root
RUN microdnf update -y && \
    microdnf install -y ca-certificates shadow-utils && \
    microdnf clean all && \
    rm -rf /var/cache/yum

# STEP 5: Create Non-Root User (MANDATORY)
RUN groupadd -g 1001 adinkhepra && \
    useradd -u 1001 -g adinkhepra -s /sbin/nologin adinkhepra

# STEP 6: Ingest the Binary
# The pipeline downloads 'resources' from hardening_manifest.yaml into the build context automatically
# We expect the structure to be flat after download or we need to untar it.
COPY adinkhepra.tar.gz /app/
RUN tar -xzf adinkhepra.tar.gz && \
    rm adinkhepra.tar.gz && \
    chmod +x /app/adinkhepra && \
    chown -R adinkhepra:adinkhepra /app

# STEP 7: Security Locking
USER 1001

# STEP 8: Healthcheck (MANDATORY)
# Since we are an agent, we can check if the process is alive or hit a localhost health endpoint
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD /app/adinkhepra health || exit 1

ENTRYPOINT ["/app/adinkhepra"]
CMD ["run"]
