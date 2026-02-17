#!/bin/bash
# Khepra Secure Gateway & SouHimBou AI Entrypoint

# Start the Go Khepra Secure Gateway in the background
echo "Starting Khepra Secure Gateway on port 8443..."
/usr/local/bin/khepra-gateway -addr :8443 &

# Wait for gateway to be ready
sleep 2

# Start the SouHimBou AI Python API
echo "Starting SouHimBou AI API on port 8080..."
exec uvicorn services.ml_anomaly.api:app --host 0.0.0.0 --port 8080 --workers 2
