# Stage 1: Build Khepra Core (Go)
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git make

# Copy Go module files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the Khepra (Sonar) binary
# Using CGO_ENABLED=0 for static binary
RUN CGO_ENABLED=0 go build -o /usr/local/bin/khepra ./cmd/sonar/main.go

# Stage 2: Runtime Environment (Python + Khepra)
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
# curl: for healthcheck
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements
COPY services/ml_anomaly/requirements.txt /app/requirements.txt

# Install CPU-only PyTorch (optimized for size)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install additional dependencies
RUN pip install --no-cache-dir \
    reportlab \
    websockets \
    pydantic-settings

# Create necessary directories
RUN mkdir -p /app/data/cyber_brain /app/models /app/top_secret_intel

# Copy Khepra binary from builder
COPY --from=builder /usr/local/bin/khepra /usr/local/bin/khepra

# Create non-root user for security (Iron Bank requirement)
RUN useradd -m -u 1000 khepra
RUN chown -R khepra:khepra /app

# Copy application code
COPY services/ml_anomaly /app/services/ml_anomaly
# Create dummy model directory if not exists to prevent copy errors
RUN mkdir -p models && touch models/.keep
COPY models /app/models
# Create dummy intel directory
RUN mkdir -p top_secret_intel && touch top_secret_intel/.keep
COPY top_secret_intel /app/top_secret_intel

# Switch to non-root user
USER khepra

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

# Run the application
CMD ["uvicorn", "services.ml_anomaly.api:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
