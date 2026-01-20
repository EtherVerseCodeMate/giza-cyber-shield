# Dockerfile for Fly.io deployment
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements
COPY services/ml_anomaly/requirements.txt /app/requirements.txt

# Install CPU-only PyTorch first (much smaller than full torch)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install Python dependencies (torch already installed, skip it)
RUN pip install --no-cache-dir -r requirements.txt

# Install additional dependencies for PDF export, WebSocket, and settings
RUN pip install --no-cache-dir \
    reportlab \
    websockets \
    pydantic-settings

# Create necessary directories first
RUN mkdir -p /app/data/cyber_brain /app/models /app/top_secret_intel

# Copy application code
COPY services/ml_anomaly /app/services/ml_anomaly
COPY models /app/models

# Copy optional directories (may not exist)
COPY top_secret_intel /app/top_secret_intel

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

# Run the application
CMD ["uvicorn", "services.ml_anomaly.api:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
