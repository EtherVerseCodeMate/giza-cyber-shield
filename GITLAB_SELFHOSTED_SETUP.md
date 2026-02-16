# 🐳 GitLab Self-Hosted Setup for Phantom Network Stack

**Purpose**: Run a private GitLab instance on your own hardware for maximum control
**Deployment**: Docker container (GitLab CE - Community Edition)
**Security**: Air-gapped option available (no internet required)

---

## Why Self-Hosted GitLab?

### Advantages vs GitHub (spectralplasma org)

| Feature | GitHub Private Org | GitLab Self-Hosted |
|---------|-------------------|-------------------|
| **Control** | Microsoft owns the data | You own everything |
| **Security** | Subject to US jurisdiction | Completely private |
| **Cost** | $4/user/month | Free (hardware cost only) |
| **Air-gap** | Impossible | Fully supported |
| **Subpoena risk** | High (US CLOUD Act) | Zero (not on internet) |
| **Uptime** | 99.9% SLA | You control it |

### Recommendation

**Use BOTH**:
- **GitHub (spectralplasma)**: Backup/collaboration (still private)
- **GitLab Self-Hosted**: Primary development (air-gapped)

This gives you redundancy + maximum security.

---

## Quick Start (5 Minutes)

### Step 1: Run GitLab Docker Container

```bash
# Create directories for GitLab data
mkdir -p ~/gitlab/{config,logs,data}

# Run GitLab CE container
docker run -d \
  --hostname gitlab.khepra.internal \
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

# GitLab takes ~5 minutes to fully start
# Monitor with: docker logs -f gitlab
```

### Step 2: Access GitLab UI

```bash
# Wait for GitLab to finish starting
docker logs gitlab 2>&1 | grep "gitlab Reconfigured"

# Get initial root password
docker exec -it gitlab grep 'Password:' /etc/gitlab/initial_root_password.txt

# Access GitLab
# Open browser: http://localhost
# Login: root / <password from above>
```

### Step 3: Change Root Password

```
1. Login as root
2. Go to User Settings → Password
3. Change to a strong password (20+ characters)
4. Save and re-login
```

### Step 4: Create Phantom Project

```
1. Click "Create a project"
2. Select "Create blank project"
3. Project name: tobacco
4. Namespace: Create new group "phantom"
5. Visibility: Private ⚠️
6. Initialize: Don't check "Initialize repository with a README"
7. Click "Create project"
```

```markdown
### Step 5: Add SSH Key

```bash
# Generate deterministic SSH key using Spectral Fingerprint
# This uses the project identity to create a reproducible key pair
./spectral fingerprint generate --identity "phantom-gitlab" --output ~/.ssh/gitlab_phantom

# Copy public key
cat ~/.ssh/gitlab_phantom.pub

# In GitLab UI:
# User Settings → SSH Keys → Paste key → Add key
```
```
```

### Step 6: Push Phantom Repo

```bash
# In your phantom repo directory
cd ../tobacco  # Created by setup_phantom_repo.sh

# Add GitLab remote
git remote add origin git@localhost:phantom/tobacco.git

# Push
git push -u origin main

# If using custom SSH port, configure:
# ~/.ssh/config:
#   Host gitlab.khepra.internal
#     HostName localhost
#     Port 22
#     User git
#     IdentityFile ~/.ssh/gitlab_phantom
```

---

## Production Configuration

### Enable HTTPS (Self-Signed Certificate)

```bash
# Stop GitLab container
docker stop gitlab

# Create directory for SSL certs
mkdir -p ~/gitlab/config/ssl

# Generate self-signed certificate
openssl req -x509 -nodes -days 3650 -newkey rsa:4096 \
  -keyout ~/gitlab/config/ssl/gitlab.khepra.internal.key \
  -out ~/gitlab/config/ssl/gitlab.khepra.internal.crt \
  -subj "/C=US/ST=State/L=City/O=Khepra/CN=gitlab.khepra.internal"

```bash
# Edit GitLab config
docker exec -it gitlab vi /etc/gitlab/gitlab.rb

# Add or update these lines:
external_url 'https://gitlab.khepra.internal'
nginx['redirect_http_to_https'] = true
nginx['ssl_certificate'] = "/etc/gitlab/ssl/gitlab.khepra.internal.crt"
nginx['ssl_certificate_key'] = "/etc/gitlab/ssl/gitlab.khepra.internal.key"
```

# Reconfigure GitLab
docker exec -it gitlab gitlab-ctl reconfigure

# Restart
docker restart gitlab
```

### Enable 2FA (Two-Factor Authentication)

```
1. User Settings → Account
2. Enable Two-factor Authentication
3. Scan QR code with authenticator app (Authy, Google Authenticator)
4. Save recovery codes in secure location (KeePass, 1Password)
```

### Backup Configuration

```bash
# Create backup script
cat > ~/gitlab/backup.sh <<'EOF'
#!/bin/bash
# GitLab backup script - run daily via cron

# Create backup
docker exec -t gitlab gitlab-backup create

# Copy backup to external drive
cp ~/gitlab/data/backups/*.tar /mnt/external/gitlab-backups/

# Keep only last 7 backups
find ~/gitlab/data/backups/ -name "*.tar" -mtime +7 -delete
EOF

chmod +x ~/gitlab/backup.sh

# Add to crontab (run daily at 2 AM)
crontab -e
# Add line: 0 2 * * * ~/gitlab/backup.sh
```

---

## Air-Gapped Configuration (Maximum Security)

### Scenario

You want GitLab to run on a machine with **NO internet access** (air-gapped).

### Setup

```bash
# On internet-connected machine:
# Download GitLab Docker image
docker pull gitlab/gitlab-ce:latest

# Save image to tar file
docker save gitlab/gitlab-ce:latest -o gitlab-ce.tar

# Copy to USB drive
cp gitlab-ce.tar /media/usb/

# === On air-gapped machine ===

# Load image from USB
docker load -i /media/usb/gitlab-ce.tar

# Run GitLab (same as before)
docker run -d \
  --hostname gitlab.airgap.local \
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

# GitLab will run without internet access
# Email notifications won't work (but you don't need them)
```

### Advantages

- **Zero remote access risk**: Not connected to internet
- **No supply chain attacks**: Downloaded image once, verified hash
- **No subpoenas**: Government can't demand access (not online)
- **No hackers**: Can't hack what's not connected

### Disadvantages

- **Updates**: Must manually download and load new images
- **Backups**: Must use physical media (USB drives)
- **Collaboration**: Only accessible on local network

---

## Multi-User Setup

### Create User Accounts

```
1. Admin Area (wrench icon) → Users
2. New User
3. Fill in details (use codenames, not real names)
4. Set temporary password
5. Uncheck "Send password to user" (give it to them in person)
6. Click "Create user"
```

### Assign to Phantom Group

```
1. Go to phantom group
2. Members → Invite members
3. Select user, role: Developer (or Maintainer for core team)
4. Expiration: None (or set 90 days for contractors)
```

### Access Levels

| Role | Can Do |
|------|--------|
| **Guest** | View issues, leave comments |
| **Reporter** | Clone repo, download code |
| **Developer** | Push code, create merge requests |
| **Maintainer** | Merge requests, manage members |
| **Owner** | Delete project, change visibility |

**Recommendation**: Core team = Maintainer, Field operators = Reporter

---

## CI/CD Integration

### Enable GitLab CI/CD

```yaml
# .gitlab-ci.yml (already created by setup script)
# But you need to enable GitLab Runner

# Install GitLab Runner (on same machine)
docker run -d \
  --name gitlab-runner \
  --restart always \
  --volume /var/run/docker.sock:/var/run/docker.sock \
  --volume ~/gitlab-runner/config:/etc/gitlab-runner \
  gitlab/gitlab-runner:latest

# Register runner with GitLab
docker exec -it gitlab-runner gitlab-runner register \
  --url http://localhost \
  --registration-token <token-from-gitlab-ui> \
  --executor docker \
  --docker-image alpine:latest \
  --description "Phantom CI/CD Runner"

# Get registration token from:
# GitLab → phantom group → Settings → CI/CD → Runners
```

### Pipeline Example

```yaml
# .gitlab-ci.yml
stages:
  - security
  - build
  - test

security-scan:
  stage: security
  script:
    - if git ls-files | grep -E '\.(key|pem)$'; then exit 1; fi
  only:
    - merge_requests
    - main

build-go:
  stage: build
  image: golang:1.22
  script:
    - go build ./pkg/phantom/...
  artifacts:
    paths:
      - phantom_mobile.aar

test-go:
  stage: test
  image: golang:1.22
  script:
    - go test ./pkg/phantom/...
```

---

## Monitoring and Maintenance

### Check GitLab Health

```bash
# Container status
docker ps | grep gitlab

# GitLab service status
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

# Stop old container
docker stop gitlab

# Remove old container (data is in volumes, safe to remove)
docker rm gitlab

# Run new container (same command as initial setup)
docker run -d \
  --hostname gitlab.khepra.internal \
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

# Wait for startup
docker logs -f gitlab
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

## Security Best Practices

### 1. Firewall Rules

```bash
# Only allow access from local network
sudo ufw allow from 192.168.1.0/24 to any port 443
sudo ufw allow from 192.168.1.0/24 to any port 80
sudo ufw allow from 192.168.1.0/24 to any port 22

# Block everything else
sudo ufw default deny incoming
sudo ufw enable
```

### 2. Regular Backups

```bash
# Automated backup script (run via cron)
#!/bin/bash
BACKUP_DATE=$(date +%Y%m%d)
docker exec -t gitlab gitlab-backup create BACKUP=$BACKUP_DATE

# Encrypt backup
gpg --symmetric --cipher-algo AES256 \
  ~/gitlab/data/backups/${BACKUP_DATE}_*_gitlab_backup.tar

# Copy to external drive
cp ~/gitlab/data/backups/${BACKUP_DATE}_*.tar.gpg /mnt/external/
```

### 3. SSH Key Rotation

```
1. Generate new SSH key every 90 days
2. Add new key to GitLab
3. Test with new key
4. Delete old key from GitLab
```

### 4. Audit Logs

```bash
# View GitLab audit events
# GitLab UI: Admin Area → Monitoring → Audit Events

# Or via CLI
docker exec -it gitlab gitlab-rails runner "
  puts AuditEvent.last(100).map(&:details)
"
```

---

## Troubleshooting

### GitLab Won't Start

```bash
# Check container logs
docker logs gitlab --tail 200

# Common issue: Insufficient memory
# Solution: Increase Docker memory limit (Docker Desktop → Settings → Resources)
# GitLab needs minimum 4GB RAM

# Check disk space
df -h
# Solution: Free up space, GitLab needs ~10GB minimum
```

### Can't Push to GitLab

```bash
# Test SSH connection
ssh -T git@localhost

# Should see: "Welcome to GitLab, @username!"

# If fails, check SSH key
cat ~/.ssh/gitlab_phantom.pub
# Add to GitLab: User Settings → SSH Keys

# Check SSH port
docker exec -it gitlab grep "gitlab_shell_ssh_port" /etc/gitlab/gitlab.rb
```

### CI/CD Pipeline Fails

```bash
# Check runner status
docker exec -it gitlab-runner gitlab-runner verify

# Restart runner
docker restart gitlab-runner

# Check runner logs
docker logs gitlab-runner --tail 100
```

---

## Conclusion

**GitLab self-hosted setup complete!**

You now have:
- ✅ Private GitLab instance (not on internet)
- ✅ Full control over data
- ✅ CI/CD pipelines
- ✅ Air-gap capable
- ✅ Zero subpoena risk

**Cost**: ~$0/month (only electricity for server)

**Next steps**:
1. Run `DEPLOYMENT_MODE=gitlab-docker ./setup_phantom_repo.sh`
2. Push tobacco repo to GitLab
3. Set up automated backups
4. Invite core team (need-to-know only)

🐳 *"Own your infrastructure, own your freedom."*
