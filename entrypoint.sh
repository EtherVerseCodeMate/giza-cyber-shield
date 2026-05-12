#!/bin/bash
# Khepra SEKHEM Gateway — Fly.io container entrypoint
#
# Architecture: SEKHEM (Go, port 8080) is the primary API gateway.
# Python ML anomaly service runs on internal port 8081 as a sidecar.
# Fly.io routes external HTTPS traffic to internal port 8080.
# TLS termination is handled by Fly.io — SEKHEM runs plain HTTP inside the container.

set -e

# Start Python ML anomaly service on internal port 8081 (background sidecar).
# Failures here must NOT abort the script — SEKHEM is the primary service.
uvicorn services.ml_anomaly.api:app \
    --host 127.0.0.1 \
    --port 8081 \
    --workers 2 \
    --log-level warning &
ML_PID=$!
echo "SouHimBou ML sidecar started (pid ${ML_PID})"

# Start SEKHEM gateway as the primary service on port 8080
# PORT and TLS_ENABLED are injected by Fly.io via [env] in fly.toml.
echo "Starting SEKHEM gateway on port ${PORT:-8080}..."
exec /usr/local/bin/nouchix-motherboard
