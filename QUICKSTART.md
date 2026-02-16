# 🚀 Phantom Network Stack - Quick Start Guide

**Deploy your private Phantom Network in 10 minutes**

---

## Prerequisites

- **Docker** installed and running
- **Docker Compose** v2.0+ installed
- **Git** configured with SSH keys
- **GitHub access** to spectralplasma organization

---

## Step 1: Create Phantom Repository

Run the setup script to create the `tobacco` repository with all Phantom components:

```bash
# From khepra-protocol root directory
./setup_phantom_repo.sh

# This creates: ../tobacco/
# With all phantom code + docker-compose infrastructure
```

**What it does:**
- ✅ Creates clean Git repository structure
- ✅ Syphons core technologies (Merkaba, Adinkhepra-PQC, ASAF)
- ✅ Copies phantom packages (network, SSH, counter-surveillance)
- ✅ Adds docker-compose.yml, Dockerfiles, PostgreSQL schema
- ✅ Verifies all critical files are present

---

## Step 2: Push to GitHub (spectralplasma/tobacco)

```bash
cd ../tobacco

# Add GitHub remote (already created: github.com/spectralplasma/tobacco)
git remote add origin git@github.com:spectralplasma/tobacco.git

# Push all branches
git push -u origin main

# Verify
git remote -v
# Should show: origin  git@github.com:spectralplasma/tobacco.git
```

---

## Step 3: Deploy with Docker Compose

```bash
# Still in tobacco/ directory

# Start all services (phantom-node, postgres, prometheus, grafana)
docker-compose up -d

# Monitor startup logs
docker-compose logs -f phantom-node

# Wait for "✅ Phantom Node started successfully" message
```

**Services Started:**
- `phantom-node` (port 8080) - Phantom Network API
- `postgres` (port 5432) - Encrypted database
- `prometheus` (port 9091) - Metrics collection
- `grafana` (port 3001) - Monitoring dashboard
- `mobile-builder` - Android/iOS build environment (on-demand)

---

## Step 4: Test Phantom Node

```bash
# Health check
curl http://localhost:8080/health
# Expected: {"status":"healthy","symbol":"Eban","mode":"stealth"}

# Get phantom address (rotates every 5 minutes)
curl http://localhost:8080/api/v1/address
# Expected: {"ipv6":"fc00::a41f:4ab8:3c2d:9f1e","expires_at":"2026-02-16T12:05:00Z"}

# List discovered peers
curl http://localhost:8080/api/v1/peers
# Expected: {"peers":[]} (empty initially, populates as other nodes join)
```

---

## Step 5: Send Encrypted Message (JPEG Steganography)

```bash
# Create test message
cat > /tmp/message.json <<EOF
{
  "from_symbol": "Eban",
  "to_symbol": "Fawohodie",
  "payload": "Guardian protocol activated. Rendezvous at 03:00 UTC.",
  "carrier": "JPEG"
}
EOF

# Send message (embeds in JPEG image via steganography)
curl -X POST http://localhost:8080/api/v1/send \
  -H "Content-Type: application/json" \
  -d @/tmp/message.json

# Expected:
# {
#   "message_id": "550e8400-e29b-41d4-a716-446655440000",
#   "carrier_url": "http://localhost:8080/carriers/550e8400.jpg",
#   "status": "sent"
# }

# Download carrier image (looks like normal JPEG, contains encrypted message)
curl -O http://localhost:8080/carriers/550e8400.jpg

# Receiving node decrypts automatically on download
```

---

## Step 6: Monitor with Grafana

```bash
# Open Grafana dashboard
open http://localhost:3001

# Login: admin / phantomadmin

# Pre-configured dashboards:
# - Phantom Network Overview (peer count, message throughput)
# - Steganographic Carriers (JPEG/HTTP/DNS/WebRTC usage)
# - Counter-Surveillance Metrics (GPS spoofing, face defeat, IMSI rotation)
```

---

## Step 7: Build Mobile App (Google Pixel 9)

```bash
# Enter mobile builder container
docker-compose run --rm mobile-builder bash

# Inside container:
cd /app

# Build Android library (.aar)
gomobile bind -target=android -o phantom_mobile.aar ./pkg/phantom/...

# Build iOS framework
gomobile bind -target=ios -o PhantomMobile.framework ./pkg/phantom/...

# Exit container
exit

# Artifacts saved to: ./mobile-output/
ls mobile-output/
# phantom_mobile.aar  (Android)
# PhantomMobile.framework/  (iOS)
```

---

## Optional: Enable GitLab Self-Hosted (Air-Gapped)

If you want to run a private GitLab instance instead of GitHub:

```bash
# Uncomment GitLab service in docker-compose.yml
# Lines 10-26 (remove # comments)

# Restart
docker-compose down
docker-compose up -d

# Wait 5 minutes for GitLab to start
docker logs -f gitlab

# Access: http://localhost:8081
# Get root password:
docker exec -it gitlab grep 'Password:' /etc/gitlab/initial_root_password.txt

# Follow GITLAB_SELFHOSTED_SETUP.md for full configuration
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Phantom Network Stack                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Phantom Node │───→│  PostgreSQL  │───→│  Prometheus  │  │
│  │  (Eban)      │    │  (Encrypted) │    │  (Metrics)   │  │
│  │  Port 8080   │    │  Port 5432   │    │  Port 9091   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                                         │          │
│         │                                         ↓          │
│         │                                  ┌──────────────┐  │
│         └─────────────────────────────────→│   Grafana    │  │
│                                            │  (Dashboard) │  │
│                                            │  Port 3001   │  │
│                                            └──────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │         Mobile Builder (gomobile)                        ││
│  │  Android SDK + NDK + iOS toolchain                       ││
│  │  Output: phantom_mobile.aar, PhantomMobile.framework    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
└─────────────────────────────────────────────────────────────┘

         Steganographic Carriers (Invisible Transport)
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         📷 JPEG LSB    🌐 HTTP Headers    🔍 DNS TXT
         📹 Video I-frames    🎤 WebRTC    ₿ Bitcoin OP_RETURN
```

---

## File Structure (tobacco repository)

```
tobacco/
├── cmd/
│   └── phantom-node/
│       └── main.go              # Phantom Node binary (TODO: implement)
├── pkg/
│   ├── adinkra/                 # Merkaba + Adinkhepra-PQC (syphoned)
│   ├── license/                 # ASAF (syphoned)
│   └── phantom/
│       ├── phantom_network.go   # Invisible mesh network protocol
│       ├── phantom_ssh.go       # Spectral SSH keys (no files)
│       └── counter_surveillance.go  # GPS/Face/Thermal/IMSI/EM
├── vendor/
│   └── khepra-protocol/         # Vendored dependencies
├── docker-compose.yml           # Multi-service orchestration
├── Dockerfile.phantom           # Phantom Node container
├── Dockerfile.mobile            # gomobile build environment
├── init-db.sql                  # PostgreSQL schema
├── prometheus.yml               # Metrics configuration
├── docs/
│   ├── PHANTOM_PROTOCOL_GUARDIAN_OPERATIONS.md
│   ├── PHANTOM_MOBILE_DEPLOYMENT.md
│   ├── PHANTOM_CORE_TECHNOLOGIES.md
│   └── GITLAB_SELFHOSTED_SETUP.md
└── README.md                    # Phantom Network overview
```

---

## Environment Variables

Configure in `docker-compose.yml` or `.env` file:

```bash
# Phantom Node Configuration
PHANTOM_SYMBOL=Eban                    # Your Adinkra symbol identity
PHANTOM_NETWORK_MODE=stealth           # stealth | active | passive
PHANTOM_CARRIER=JPEG                   # JPEG | HTTP | DNS | WebRTC | VIDEO | BITCOIN
PHANTOM_ADDRESS_ROTATION=300           # Seconds (5 minutes default)

# Database Configuration
POSTGRES_USER=phantom
POSTGRES_PASSWORD=<generate-strong-password>
POSTGRES_DB=phantom_network

# Security
PHANTOM_ENCRYPTION_KEY=<32-byte-hex>   # AES-256 key for database encryption
PHANTOM_KYBER_SEED=<32-byte-hex>       # Kyber-1024 seed (optional, auto-generated)

# Counter-Surveillance
GPS_SPOOF_ENABLED=true
GPS_SPOOF_TARGET_CITY=Switzerland      # Fake GPS location
FACE_DEFEAT_ENABLED=true
THERMAL_MASKING_ENABLED=true
IMSI_ROTATION_ENABLED=true
EM_SPREAD_SPECTRUM_ENABLED=true
```

---

## Security Considerations

### 🔒 Encryption at Rest
- PostgreSQL data encrypted with AES-256-GCM (via `encrypted_payload` columns)
- Private keys encrypted with Merkaba White Box Encryption
- Audit logs PQC-encrypted with Adinkhepra signatures

### 🔒 Encryption in Transit
- All peer communication uses Kyber-1024 key encapsulation
- Steganographic carriers look benign (JPEG images, HTTP traffic)
- No TLS required (encryption happens at application layer)

### 🔒 Key Management
- SSH keys derived from Spectral Fingerprints (no files to steal)
- Kyber/Dilithium keys rotate every 90 days automatically
- Symbol-based identity (no usernames, no emails in protocol)

### 🔒 Operational Security
- Docker containers run as non-root users
- Minimal attack surface (Alpine Linux base)
- Air-gap capable (no internet required for operation)
- Zero logging of plaintext (only encrypted audit events)

---

## Troubleshooting

### Phantom Node Won't Start

```bash
# Check logs
docker-compose logs phantom-node

# Common issue: Port conflict
# Solution: Change ports in docker-compose.yml
#   phantom-node:
#     ports:
#       - "8081:8080"  # Change 8080 → 8081

# Restart
docker-compose restart phantom-node
```

### Database Connection Failed

```bash
# Check PostgreSQL status
docker-compose ps postgres

# Restart database
docker-compose restart postgres

# View database logs
docker-compose logs postgres
```

### Mobile Build Fails

```bash
# Enter mobile builder with debug
docker-compose run --rm mobile-builder bash

# Manually build
gomobile bind -v -x -target=android -o test.aar ./pkg/phantom/...

# Check Go module issues
go mod tidy
go mod verify
```

### Grafana Dashboard Blank

```bash
# Wait 2 minutes for Prometheus to scrape metrics
# Check Prometheus targets
open http://localhost:9091/targets

# Should show phantom-node:9090 as UP
# If DOWN, check phantom-node health:
curl http://localhost:8080/health
```

---

## Next Steps

### 1. Deploy Second Phantom Node
```bash
# Edit docker-compose.yml, add another phantom-node service:
#   phantom-node-2:
#     build: .
#     environment:
#       - PHANTOM_SYMBOL=Fawohodie  # Different symbol
#     ports:
#       - "8082:8080"

docker-compose up -d phantom-node-2
```

### 2. Test Peer Discovery
```bash
# Nodes automatically discover each other via symbol broadcasting
curl http://localhost:8080/api/v1/peers
curl http://localhost:8082/api/v1/peers

# Should see each other in peer lists
```

### 3. Deploy to Google Pixel 9
```bash
# Follow: docs/PHANTOM_MOBILE_DEPLOYMENT.md
# Requires: Android Studio + Google Pixel 9 with Developer Mode

# Build APK
docker-compose run --rm mobile-builder bash -c \
  "gomobile bind -target=android -o phantom_mobile.aar ./pkg/phantom/..."

# Install via ADB
adb install phantom-mobile.apk
```

### 4. Enable Counter-Surveillance
```bash
# Edit docker-compose.yml, add environment variables:
#   GPS_SPOOF_ENABLED=true
#   GPS_SPOOF_TARGET_CITY=Switzerland

# Restart
docker-compose restart phantom-node

# Test GPS spoofing
curl http://localhost:8080/api/v1/location
# Should return Switzerland coordinates (not your real location)
```

---

## Production Deployment

For production use (not development):

### 1. Change Default Passwords
```bash
# Edit docker-compose.yml:
#   POSTGRES_PASSWORD: <strong-random-password>
#   GF_SECURITY_ADMIN_PASSWORD: <strong-random-password>

# Restart services
docker-compose down
docker-compose up -d
```

### 2. Enable TLS (Optional)
```bash
# Add nginx reverse proxy with Let's Encrypt
# (Only needed if exposing to internet - not recommended for phantom network)
```

### 3. Set Up Automated Backups
```bash
# Create backup script
cat > backup-phantom.sh <<'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec -t tobacco_postgres_1 pg_dump -U phantom phantom_network | \
  gpg --symmetric --cipher-algo AES256 > \
  /mnt/backups/phantom_${DATE}.sql.gpg
EOF

chmod +x backup-phantom.sh

# Add to crontab (daily at 3 AM)
crontab -e
# Add: 0 3 * * * /path/to/backup-phantom.sh
```

### 4. Enable Monitoring Alerts
```bash
# Configure Grafana alerts (docs/MONITORING_SETUP.md)
# Alert on:
#   - Peer count drops to 0 (network partition)
#   - Message send failures >5% (carrier detection)
#   - GPS spoof detection (anti-surveillance compromise)
```

---

## Support and Documentation

- **Operations Manual**: [docs/PHANTOM_PROTOCOL_GUARDIAN_OPERATIONS.md](docs/PHANTOM_PROTOCOL_GUARDIAN_OPERATIONS.md)
- **Mobile Deployment**: [docs/PHANTOM_MOBILE_DEPLOYMENT.md](docs/PHANTOM_MOBILE_DEPLOYMENT.md)
- **Core Technologies**: [docs/PHANTOM_CORE_TECHNOLOGIES.md](docs/PHANTOM_CORE_TECHNOLOGIES.md)
- **GitLab Setup**: [docs/GITLAB_SELFHOSTED_SETUP.md](docs/GITLAB_SELFHOSTED_SETUP.md)

**Security Contact**: apollo6972@proton.me (PGP key required)

---

🌑 *"Invisible by design. Guardian by purpose."*
