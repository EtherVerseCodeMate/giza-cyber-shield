# 🐳 Phantom Network Stack - GitLab Self-Hosted Deployment

**Complete privacy. Zero subpoena risk. Air-gap capable.**

---

## Why GitLab Self-Hosted?

### Advantages vs GitHub

| Feature | GitHub Private Org | GitLab Self-Hosted |
|---------|-------------------|-------------------|
| **Control** | Microsoft owns the data | **You own everything** ✅ |
| **Security** | Subject to US jurisdiction | **Completely private** ✅ |
| **Cost** | $4/user/month | **Free (hardware cost only)** ✅ |
| **Air-gap** | Impossible | **Fully supported** ✅ |
| **Subpoena risk** | High (US CLOUD Act) | **Zero (not on internet)** ✅ |
| **Uptime** | 99.9% SLA | **You control it** ✅ |

---

## Quick Start (10 Minutes)

### Step 1: Start GitLab Docker Container

```bash
# Create directories for GitLab data
mkdir -p ~/gitlab/{config,logs,data}

# Run GitLab CE container
docker run -d \
  --hostname gitlab.phantom.local \
  --publish 443:443 \
  --publish 80:80 \
  --publish 22:22 \
  --name gitlab \
  --restart always \
  --volume ~/gitlab/config:/etc/gitlab \
  --volume ~/gitlab/logs:/var/log/gitlab \
  --volume ~/gitlab/data:/var/opt/gitlab \
  --shm-size 256m \
  gitlab/gitlab-ce:latest

# Monitor startup (takes ~5 minutes)
docker logs -f gitlab
# Wait for: "gitlab Reconfigured!"
```

**System Requirements:**
- **RAM**: 4GB minimum (8GB recommended)
- **Disk**: 10GB+ free space
- **Ports**: 80, 443, 22 must be available

---

### Step 2: Get Root Password

```bash
# Wait for GitLab to fully start
docker logs gitlab 2>&1 | grep "gitlab Reconfigured"

# Get initial root password
docker exec -it gitlab grep 'Password:' /etc/gitlab/initial_root_password.txt

# Output example:
# Password: 5iveL!fe+GG8pdR7EIhfecodNXB4lEn8r

# Access GitLab
# Open browser: http://localhost
# Login: root / <password from above>
```

---

### Step 3: Change Root Password

```
1. Login as root with initial password
2. Click on profile icon (top right) → Preferences
3. Go to Password section
4. Change to a strong password (20+ characters)
5. Save changes and re-login
```

**Recommended password format:**
- Use Spectral Fingerprint-derived passphrase
- Example: `Eban-Fawohodie-Nkyinkyim-2026-Phantom`
- Or use a password manager (KeePass, 1Password)

---

### Step 4: Enable 2FA (Two-Factor Authentication)

```
1. Profile → Preferences → Account
2. Enable Two-factor Authentication
3. Scan QR code with authenticator app (Authy, Google Authenticator)
4. Save recovery codes in secure location
5. Verify with a test code
```

---

### Step 5: Create Phantom Project

```
1. Click "Create a project" (top right)
2. Select "Create blank project"
3. Configure:
   - Project name: tobacco
   - Namespace: Create new group → "phantom"
   - Visibility: Private ⚠️ (CRITICAL)
   - Initialize: UNCHECK "Initialize repository with a README"
4. Click "Create project"
```

**Project URL will be:**
```
http://localhost/phantom/tobacco
```

---

### Step 6: Add SSH Key (Spectral Fingerprint-Based)

```bash
# Generate SSH key using YOUR spectral fingerprint
# (Replace "Eban" with your actual symbol)
./spectral fingerprint generate \
  --identity "phantom-gitlab-$(hostname)" \
  --symbol "Eban" \
  --output ~/.ssh/gitlab_phantom

# If spectral tool not available yet, use standard SSH key:
ssh-keygen -t ed25519 -C "apollo6972@proton.me" -f ~/.ssh/gitlab_phantom

# Copy public key
cat ~/.ssh/gitlab_phantom.pub

# In GitLab UI:
# 1. Profile → Preferences → SSH Keys
# 2. Paste public key
# 3. Title: "phantom-node-$(hostname)"
# 4. Click "Add key"
```

**Configure SSH for localhost:**
```bash
# Add to ~/.ssh/config
cat >> ~/.ssh/config <<EOF

Host gitlab.phantom.local localhost
  HostName localhost
  Port 22
  User git
  IdentityFile ~/.ssh/gitlab_phantom
  StrictHostKeyChecking no
  UserKnownHostsFile=/dev/null
EOF
```

---

### Step 7: Create Phantom Repository

```bash
# Run setup script in GitLab mode
cd "c:\Users\intel\blackbox\khepra protocol"

# Set deployment mode to GitLab
DEPLOYMENT_MODE=gitlab-docker ./setup_phantom_repo.sh

# This creates: ../tobacco/
# With all phantom code + docker-compose infrastructure
```

**What it does:**
- ✅ Creates tobacco repository structure
- ✅ Syphons core technologies (Merkaba, Adinkhepra-PQC, ASAF)
- ✅ Copies phantom packages (network, SSH, counter-surveillance)
- ✅ Adds docker-compose.yml with GitLab integration
- ✅ Configures GitLab CI/CD pipeline
- ✅ Verifies all critical files

---

### Step 8: Push to GitLab

```bash
cd ../tobacco

# Add GitLab remote
git remote add origin git@localhost:phantom/tobacco.git

# Test SSH connection
ssh -T git@localhost
# Should see: "Welcome to GitLab, @root!"

# Push repository
git push -u origin main

# Verify in GitLab UI
# Open: http://localhost/phantom/tobacco
# Should see all files pushed
```

---

### Step 9: Deploy Phantom Network Stack

```bash
# Still in tobacco/ directory

# Start all services
docker-compose up -d

# Monitor startup
docker-compose logs -f phantom-node

# Verify services
docker-compose ps
# Should show: phantom-node, postgres, prometheus, grafana all "Up"
```

**Services running:**
- `gitlab` (port 80/443) - Private Git hosting
- `phantom-node` (port 8080) - Phantom Network API
- `postgres` (port 5432) - Encrypted database
- `prometheus` (port 9091) - Metrics
- `grafana` (port 3001) - Monitoring dashboard

---

### Step 10: Test Phantom Node

```bash
# Health check
curl http://localhost:8080/health
# Expected: {"status":"healthy","symbol":"Eban","mode":"stealth"}

# Get phantom address (rotates every 5 minutes)
curl http://localhost:8080/api/v1/address
# Expected: {"ipv6":"fc00::a41f:4ab8:3c2d:9f1e","expires_at":"..."}

# List peers
curl http://localhost:8080/api/v1/peers
# Expected: {"peers":[]} (empty initially)
```

---

## Air-Gapped Configuration (Maximum Security)

For deployments with **NO internet access**:

### Offline GitLab Installation

```bash
# On internet-connected machine:
# Download GitLab Docker image
docker pull gitlab/gitlab-ce:latest

# Save to USB drive
docker save gitlab/gitlab-ce:latest -o gitlab-ce.tar
cp gitlab-ce.tar /media/usb/

# === On air-gapped machine ===

# Load image from USB
docker load -i /media/usb/gitlab-ce.tar

# Run GitLab (same command as before)
docker run -d \
  --hostname gitlab.phantom.local \
  --publish 443:443 \
  --publish 80:80 \
  --publish 22:22 \
  --name gitlab \
  --restart always \
  --volume ~/gitlab/config:/etc/gitlab \
  --volume ~/gitlab/logs:/var/log/gitlab \
  --volume ~/gitlab/data:/var/opt/gitlab \
  --shm-size 256m \
  gitlab/gitlab-ce:latest
```

### Offline Phantom Stack Installation

```bash
# On internet-connected machine:
# Download all required Docker images
docker pull golang:1.22-alpine
docker pull alpine:latest
docker pull postgres:15-alpine
docker pull prom/prometheus:latest
docker pull grafana/grafana:latest

# Save all images
docker save golang:1.22-alpine alpine:latest postgres:15-alpine \
  prom/prometheus:latest grafana/grafana:latest -o phantom-images.tar

# Copy to USB
cp phantom-images.tar /media/usb/

# === On air-gapped machine ===

# Load images
docker load -i /media/usb/phantom-images.tar

# Deploy normally
cd tobacco
docker-compose up -d
```

**Advantages:**
- ✅ Zero remote access risk (not connected to internet)
- ✅ No supply chain attacks (verified images once)
- ✅ No subpoenas (government can't demand access)
- ✅ No network-based attacks

---

## Security Hardening

### 1. Firewall Configuration

```bash
# Only allow access from local network
sudo ufw allow from 192.168.1.0/24 to any port 443
sudo ufw allow from 192.168.1.0/24 to any port 80
sudo ufw allow from 192.168.1.0/24 to any port 22

# Block everything else
sudo ufw default deny incoming
sudo ufw enable
```

### 2. Enable HTTPS (Self-Signed Certificate)

```bash
# Generate certificate
mkdir -p ~/gitlab/config/ssl
openssl req -x509 -nodes -days 3650 -newkey rsa:4096 \
  -keyout ~/gitlab/config/ssl/gitlab.phantom.local.key \
  -out ~/gitlab/config/ssl/gitlab.phantom.local.crt \
  -subj "/C=US/ST=State/L=City/O=Phantom/CN=gitlab.phantom.local"

# Configure GitLab
docker exec -it gitlab bash

# Edit: /etc/gitlab/gitlab.rb
# Add these lines:
external_url 'https://gitlab.phantom.local'
nginx['redirect_http_to_https'] = true
nginx['ssl_certificate'] = "/etc/gitlab/ssl/gitlab.phantom.local.crt"
nginx['ssl_certificate_key'] = "/etc/gitlab/ssl/gitlab.phantom.local.key"

# Save and reconfigure
gitlab-ctl reconfigure
exit

# Restart GitLab
docker restart gitlab
```

### 3. Automated Backups

```bash
# Create backup script
cat > ~/gitlab-backup.sh <<'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)

# Backup GitLab
docker exec -t gitlab gitlab-backup create

# Backup Phantom database
docker exec -t tobacco_postgres_1 pg_dump -U phantom phantom_network > \
  ~/backups/phantom_${DATE}.sql

# Encrypt backups
gpg --symmetric --cipher-algo AES256 ~/gitlab/data/backups/*.tar
gpg --symmetric --cipher-algo AES256 ~/backups/phantom_${DATE}.sql

# Copy to external drive
cp ~/gitlab/data/backups/*.tar.gpg /mnt/external/gitlab-backups/
cp ~/backups/phantom_${DATE}.sql.gpg /mnt/external/phantom-backups/

# Keep only last 7 backups
find ~/gitlab/data/backups/ -name "*.tar" -mtime +7 -delete
find ~/backups/ -name "*.sql" -mtime +7 -delete
EOF

chmod +x ~/gitlab-backup.sh

# Run daily at 2 AM
crontab -e
# Add: 0 2 * * * ~/gitlab-backup.sh
```

### 4. SSH Key Rotation

```bash
# Rotate SSH keys every 90 days
# Generate new spectral key
./spectral fingerprint generate \
  --identity "phantom-gitlab-$(hostname)-$(date +%Y%m)" \
  --symbol "Eban" \
  --output ~/.ssh/gitlab_phantom_new

# Add new key to GitLab UI
cat ~/.ssh/gitlab_phantom_new.pub
# Add via: Profile → SSH Keys

# Test new key
ssh -i ~/.ssh/gitlab_phantom_new -T git@localhost

# Replace old key
mv ~/.ssh/gitlab_phantom ~/.ssh/gitlab_phantom.old
mv ~/.ssh/gitlab_phantom_new ~/.ssh/gitlab_phantom

# Delete old key from GitLab UI
```

---

## GitLab CI/CD Integration

### Enable GitLab Runner

```bash
# Install GitLab Runner
docker run -d \
  --name gitlab-runner \
  --restart always \
  --volume /var/run/docker.sock:/var/run/docker.sock \
  --volume ~/gitlab-runner/config:/etc/gitlab-runner \
  gitlab/gitlab-runner:latest

# Get registration token
# GitLab UI: Settings → CI/CD → Runners → Expand
# Copy registration token

# Register runner
docker exec -it gitlab-runner gitlab-runner register \
  --url http://gitlab \
  --registration-token <your-token> \
  --executor docker \
  --docker-image alpine:latest \
  --description "Phantom CI/CD Runner" \
  --docker-privileged
```

### CI/CD Pipeline (Auto-created by setup script)

`.gitlab-ci.yml` in tobacco repository:

```yaml
stages:
  - security
  - build
  - test
  - deploy

# Security scan (no hardcoded keys)
security-scan:
  stage: security
  script:
    - echo "Scanning for hardcoded secrets..."
    - if git ls-files | xargs grep -E "(password|api_key|secret)" --ignore-case; then exit 1; fi
    - if git ls-files | grep -E '\.(key|pem)$'; then exit 1; fi
  only:
    - merge_requests
    - main

# Build phantom node
build-phantom:
  stage: build
  image: golang:1.22-alpine
  script:
    - apk add --no-cache git gcc musl-dev
    - go build -o phantom-node ./cmd/phantom-node/main.go
  artifacts:
    paths:
      - phantom-node
    expire_in: 1 hour

# Build mobile libraries
build-mobile:
  stage: build
  image: golang:1.22
  script:
    - go install golang.org/x/mobile/cmd/gomobile@latest
    - gomobile init
    - gomobile bind -target=android -o phantom_mobile.aar ./pkg/phantom/...
  artifacts:
    paths:
      - phantom_mobile.aar
    expire_in: 1 week

# Run Go tests
test-go:
  stage: test
  image: golang:1.22-alpine
  script:
    - go test ./pkg/phantom/... -v -cover

# Deploy to production (manual trigger)
deploy-production:
  stage: deploy
  script:
    - docker-compose down
    - docker-compose build
    - docker-compose up -d
  when: manual
  only:
    - main
```

---

## Multi-User Setup

### Create User Accounts

```
1. Admin Area (wrench icon) → Users
2. New User
3. Fill in details:
   - Username: Use codenames (not real names)
   - Email: Use protonmail or other secure email
   - Access level: Regular
4. Set temporary password
5. Uncheck "Send password to user" (give in person)
6. Click "Create user"
```

### Assign to Phantom Group

```
1. Go to phantom group
2. Members → Invite members
3. Select user
4. Role: Developer (or Maintainer for core team)
5. Expiration: None (or 90 days for contractors)
6. Click "Invite"
```

### Access Levels

| Role | Permissions |
|------|-------------|
| **Guest** | View issues, comment |
| **Reporter** | Clone repo, download code |
| **Developer** | Push code, create merge requests |
| **Maintainer** | Merge requests, manage members |
| **Owner** | Delete project, change visibility |

**Recommendation:**
- Core team: Maintainer
- Field operators: Reporter (read-only)
- External contractors: Developer with 90-day expiration

---

## Monitoring and Maintenance

### Check GitLab Health

```bash
# Container status
docker ps | grep gitlab

# GitLab services
docker exec -it gitlab gitlab-ctl status

# Check logs
docker logs gitlab --tail 100

# Resource usage
docker stats gitlab
```

### Update GitLab

```bash
# Pull latest image
docker pull gitlab/gitlab-ce:latest

# Stop and remove old container
docker stop gitlab
docker rm gitlab

# Start new container (same command as initial setup)
# Data is preserved in volumes
docker run -d \
  --hostname gitlab.phantom.local \
  --publish 443:443 \
  --publish 80:80 \
  --publish 22:22 \
  --name gitlab \
  --restart always \
  --volume ~/gitlab/config:/etc/gitlab \
  --volume ~/gitlab/logs:/var/log/gitlab \
  --volume ~/gitlab/data:/var/opt/gitlab \
  --shm-size 256m \
  gitlab/gitlab-ce:latest
```

### Disk Space Management

```bash
# Check GitLab disk usage
du -sh ~/gitlab/*

# Clean old logs
find ~/gitlab/logs -name "*.log" -mtime +30 -delete

# Clean old CI artifacts
docker exec -it gitlab gitlab-rake gitlab:cleanup:project_uploads
```

---

## Troubleshooting

### GitLab Won't Start

```bash
# Check logs
docker logs gitlab --tail 200

# Common issues:
# 1. Insufficient memory (need 4GB+)
#    Solution: Increase Docker memory limit

# 2. Port conflict
#    Solution: Change ports in docker run command
#    --publish 8081:80 --publish 4443:443

# 3. Disk space
df -h
#    Solution: Free up space (need 10GB+)
```

### Can't Push to GitLab

```bash
# Test SSH
ssh -T git@localhost
# Should see: "Welcome to GitLab, @root!"

# Check SSH key
cat ~/.ssh/gitlab_phantom.pub
# Add to: GitLab → Profile → SSH Keys

# Check remote URL
cd tobacco
git remote -v
# Should show: git@localhost:phantom/tobacco.git

# Try with verbose SSH
GIT_SSH_COMMAND="ssh -v" git push origin main
```

### CI/CD Pipeline Fails

```bash
# Check runner status
docker exec -it gitlab-runner gitlab-runner verify

# Restart runner
docker restart gitlab-runner

# Check runner logs
docker logs gitlab-runner --tail 100

# Re-register runner
# Get new token from: GitLab → Settings → CI/CD → Runners
docker exec -it gitlab-runner gitlab-runner register
```

---

## Next Steps

### 1. Run Setup Script

```bash
cd "c:\Users\intel\blackbox\khepra protocol"
DEPLOYMENT_MODE=gitlab-docker ./setup_phantom_repo.sh
```

### 2. Push to GitLab

```bash
cd ../tobacco
git remote add origin git@localhost:phantom/tobacco.git
git push -u origin main
```

### 3. Deploy Phantom Stack

```bash
docker-compose up -d
```

### 4. Enable Counter-Surveillance

```bash
# Edit docker-compose.yml
# Add environment variables:
#   GPS_SPOOF_ENABLED=true
#   GPS_SPOOF_TARGET_CITY=Switzerland

docker-compose restart phantom-node
```

---

## Cost Analysis

### GitLab Self-Hosted

**Hardware:** ~$500-1000 one-time (Intel NUC, Raspberry Pi 4, or old laptop)
**Electricity:** ~$5-10/month
**Total Year 1:** ~$560-1120
**Total Year 2+:** ~$60-120/year

### GitHub Private Org

**Cost:** $4/user/month = $48/year (1 user)
**10 users:** $480/year
**Total control:** ❌ None (Microsoft owns data)
**Air-gap capable:** ❌ No
**Subpoena risk:** ⚠️ High

**Verdict:** GitLab self-hosted pays for itself in 1-2 years and gives you complete control.

---

## Conclusion

**GitLab self-hosted setup complete!**

You now have:
- ✅ Private GitLab instance (not on internet)
- ✅ Full control over data (no Microsoft, no government subpoenas)
- ✅ CI/CD pipelines (automated testing, security scans)
- ✅ Air-gap capable (can run offline)
- ✅ Zero monthly costs (only electricity)
- ✅ Phantom Network Stack deployed (invisible mesh network)

**Security posture:**
- 🔒 Data sovereignty: You own everything
- 🔒 Jurisdiction: Not subject to US CLOUD Act
- 🔒 Subpoena risk: Zero (not on public internet)
- 🔒 Supply chain: Verified Docker images
- 🔒 Access control: 2FA, SSH key authentication
- 🔒 Encrypted backups: GPG-encrypted, offline storage

**Contact:** apollo6972@proton.me (PGP required)

---

🐳 *"Own your infrastructure, own your freedom."*
🌑 *"Invisible by design. Guardian by purpose."*
