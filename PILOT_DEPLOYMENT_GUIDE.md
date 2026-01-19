# KHEPRA Protocol - Pilot Deployment Guide

**Version**: 1.0.0
**Date**: 2026-01-20
**Classification**: UNCLASSIFIED // FOUO

---

## Quick Start (5 Minutes)

### Option A: Direct Binary Deployment (Fastest)

```powershell
# Download pre-built binaries
# Windows
Invoke-WebRequest -Uri "https://releases.khepra.io/v1.0.0/sonar-windows-amd64.exe" -OutFile "sonar.exe"

# Run first scan
./sonar.exe --dir C:\path\to\scan --output scan-results.json

# Generate compliance report
./sonar.exe --dir C:\path\to\scan --stig --output stig-report.json
```

### Option B: Docker Deployment (Recommended for Production)

```bash
# Pull container
docker pull ghcr.io/nouchix/khepra:1.0.0

# Run security scan
docker run --rm -v /path/to/scan:/data ghcr.io/nouchix/khepra:1.0.0 \
  sonar --dir /data --stig --output /data/report.json
```

### Option C: Full Platform (Dashboard + API + Scanner)

```bash
# Clone repository
git clone https://github.com/nouchix/khepra-protocol.git
cd khepra-protocol

# Start all services
docker-compose up -d

# Access dashboard
open http://localhost:3000
```

---

## Component Overview

| Component | Description | Port | Status |
|-----------|-------------|------|--------|
| **Sonar** | Security scanner CLI | N/A | Ready |
| **SouHimBou AI** | ML anomaly detection API | 8080 | Ready |
| **Dashboard** | Next.js web interface | 3000 | Ready |
| **Gateway** | Go API server | 8443 | Ready |

---

## Deployment Options

### 1. Air-Gapped (SCIF/Classified)

For environments without internet access:

```bash
# Build all binaries locally
make build-all

# Package for transfer
tar -czvf khepra-airgap-v1.0.0.tar.gz \
  bin/ \
  models/ \
  docs/CCI_to_NIST53.csv \
  docs/NIST53_to_171.csv

# Transfer via secure media and extract on target
tar -xzvf khepra-airgap-v1.0.0.tar.gz
```

### 2. Cloud Deployment (Fly.io)

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy SouHimBou AI
fly launch --name your-org-khepra
fly secrets set SUPABASE_URL=https://xxx.supabase.co
fly secrets set SUPABASE_KEY=eyJxxx
fly deploy

# Verify deployment
fly status
fly logs
```

### 3. Kubernetes (Platform One / Big Bang)

```yaml
# k8s/khepra-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: khepra-scanner
  namespace: security
spec:
  replicas: 1
  selector:
    matchLabels:
      app: khepra
  template:
    metadata:
      labels:
        app: khepra
    spec:
      securityContext:
        runAsUser: 1001
        runAsGroup: 0
        fsGroup: 0
      containers:
      - name: khepra
        image: ghcr.io/nouchix/khepra:1.0.0
        command: ["/usr/local/bin/sonar"]
        args: ["--dir", "/data", "--stig"]
        volumeMounts:
        - name: scan-data
          mountPath: /data
        resources:
          limits:
            memory: 512Mi
            cpu: 500m
      volumes:
      - name: scan-data
        persistentVolumeClaim:
          claimName: khepra-data
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KHEPRA_MODE` | `community` or `enterprise` | `community` |
| `KHEPRA_TELEMETRY` | Enable anonymous telemetry | `false` |
| `SUPABASE_URL` | Database URL | Required |
| `SUPABASE_KEY` | Database key | Required |

### Scanning Options

```bash
# Basic scan
sonar --dir /path/to/scan

# STIG compliance scan
sonar --dir /path/to/scan --stig

# CVE vulnerability scan
sonar --dir /path/to/scan --cve

# Full scan with all checks
sonar --dir /path/to/scan --stig --cve --secrets

# Output formats
sonar --dir /path --output report.json        # JSON
sonar --dir /path --output report.csv         # CSV
sonar --dir /path --output report.ckl         # STIG Viewer
```

---

## Pilot Onboarding Checklist

### Week 1: Setup
- [ ] Choose deployment option (binary/Docker/cloud)
- [ ] Install KHEPRA scanner
- [ ] Run first scan on test environment
- [ ] Review scan results

### Week 2: Integration
- [ ] Configure STIG compliance scanning
- [ ] Set up scheduled scans (cron/Task Scheduler)
- [ ] Integrate with existing SIEM (if applicable)
- [ ] Enable dashboard access for team

### Week 3: Production
- [ ] Scan production systems
- [ ] Generate compliance reports
- [ ] Export to STIGViewer (.ckl format)
- [ ] Review with compliance team

### Week 4: Feedback
- [ ] Document issues/feature requests
- [ ] Schedule feedback call with NouchiX
- [ ] Provide testimonial (optional)

---

## Support

### Technical Support
- **Email**: support@nouchix.com
- **Phone**: Schedule via Calendly
- **Slack**: #khepra-pilots (invite required)

### Documentation
- **Full Docs**: https://docs.khepra.io
- **API Reference**: https://api.khepra.io/docs
- **Video Tutorials**: https://youtube.com/@nouchix

### Emergency Contact
- **24/7 Security Issues**: security@nouchix.com
- **On-Call Engineer**: +1 (518) XXX-XXXX

---

## License

This pilot program is governed by the KHEPRA Pilot Agreement.

**Pilot Duration**: 30 days
**Data Retention**: Scan results stored locally only
**Telemetry**: Opt-in only, no PII collected

---

**Maintained by**: NouchiX SecRed Knowledge Inc.
**Last Updated**: 2026-01-20
