# 🔒 Phantom Network Stack - Private Repository Setup

**Classification**: PRIVATE - Do NOT merge into public repos
**Location**: Separate Git repository (not a branch of main project)
**Access**: Need-to-know basis only

---

## Repository Strategy

### Current Structure

```
Main Repository (Public)
├── pkg/adinkra/              ✅ PUBLIC (core crypto primitives)
├── pkg/license/              ✅ PUBLIC (PQC licensing framework)
├── pkg/security/             ✅ PUBLIC (secure Supabase, key manager)
├── pkg/agi/                  ✅ PUBLIC (KASA agent - non-phantom features)
└── cmd/                      ✅ PUBLIC (CLI tools)

Iron Bank Repository (Private - DoD)
├── pkg/stigs/                ✅ IRON BANK (STIG connector)
├── pkg/compliance/           ✅ IRON BANK (CMMC auditing)
└── deploy/govcloud/          ✅ IRON BANK (GovCloud deployment)

Phantom Repository (PRIVATE - Guardian Ops)
├── pkg/phantom/              ❌ PHANTOM ONLY (network protocol)
│   ├── phantom_network.go    ❌ Invisible mesh network
│   ├── phantom_ssh.go        ❌ Symbol-derived SSH keys
│   ├── counter_surveillance.go ❌ GPS/Face/Thermal/IMSI
│   └── mobile/               ❌ Mobile deployment
│       ├── gps_android.go
│       ├── vpn_service.go
│       └── camera_hook.go
├── phantom-mobile/           ❌ PHANTOM ONLY (React Native app)
│   ├── android/
│   ├── ios/
│   └── src/
└── docs/                     ❌ PHANTOM ONLY (guardian ops manual)
    ├── PHANTOM_PROTOCOL_GUARDIAN_OPERATIONS.md
    └── PHANTOM_MOBILE_DEPLOYMENT.md
```

### Why Separate Repository?

1. **Legal Isolation**:
   - Main repo: Open source (MIT/Apache 2.0)
   - Phantom repo: Restricted distribution (custom license)
   - Avoids contaminating public repo with export-controlled tech

2. **Access Control**:
   - Main repo: Public GitHub
   - Phantom repo: Private GitHub (organization-only) OR self-hosted GitLab
   - Need-to-know access (journalists, military, trusted partners)

3. **Deniability**:
   - If Phantom capabilities are discovered: "Not part of public project"
   - Main project stays clean (commercial/enterprise sales)
   - Phantom distributed separately (activist networks)

---

## Setup Instructions

### Step 1: Create Private GitHub Repository

```bash
# Option A: GitHub Private Repo (if you have Pro account)
gh repo create khepra-phantom-protocol \
  --private \
  --description "Phantom Network Stack - RESTRICTED ACCESS" \
  --gitignore Go

# Option B: Self-Hosted GitLab (recommended for max security)
# Install GitLab on your own server
docker run -d \
  --hostname gitlab.khepra.internal \
  --publish 443:443 \
  --name gitlab \
  --restart always \
  --volume /srv/gitlab/config:/etc/gitlab \
  --volume /srv/gitlab/logs:/var/log/gitlab \
  --volume /srv/gitlab/data:/var/opt/gitlab \
  gitlab/gitlab-ce:latest
```

### Step 2: Initialize Phantom Repository

```bash
# Create new repository directory
mkdir khepra-phantom-protocol
cd khepra-phantom-protocol

# Initialize Git
git init
git remote add origin https://github.com/YOUR_ORG/khepra-phantom-protocol.git

# Copy phantom files from main project
cp -r ../khepra-protocol/pkg/phantom pkg/
cp -r ../khepra-protocol/phantom-mobile phantom-mobile/
cp -r ../khepra-protocol/docs/PHANTOM_* docs/

# Create directory structure
mkdir -p pkg/phantom/mobile
mkdir -p phantom-mobile/{android,ios,src}
mkdir -p docs
mkdir -p tests
mkdir -p deploy

# Add .gitignore
cat > .gitignore <<EOF
# Phantom-specific ignores

# Compiled binaries
*.aar
*.framework
*.so
*.dylib
*.dll

# Mobile build artifacts
phantom-mobile/android/app/build/
phantom-mobile/ios/Pods/
phantom-mobile/ios/build/
phantom-mobile/node_modules/

# Secrets (CRITICAL - NEVER COMMIT)
**/keys/
**/secrets/
**/*.pem
**/*.key
**/.env.local
**/phantom_config.json

# Test data
tests/fixtures/real_*.json
tests/logs/

# macOS
.DS_Store

# IDEs
.vscode/
.idea/
*.swp
*.swo

# Temporary files
*.tmp
*.log
EOF

# Create README with access warning
cat > README.md <<EOF
# 🌑 Phantom Network Stack

**⚠️ CLASSIFICATION: RESTRICTED**

This repository contains the Phantom Network Stack - counter-surveillance capabilities using Spectral Fingerprint technology.

## Access Control

- **Distribution**: Need-to-know basis only
- **Export Control**: May be subject to export restrictions (check local laws)
- **Legal**: For defensive use only (journalism, activism, military)

## DO NOT:

- ❌ Merge into public repositories
- ❌ Share with unauthorized parties
- ❌ Use for criminal purposes
- ❌ Commit secrets/keys to Git

## Capabilities

1. Phantom Network Protocol (invisible mesh network)
2. Spectral SSH (symbol-derived keys)
3. Counter-Surveillance (GPS/Face/Thermal/IMSI)
4. Mobile Deployment (Android/iOS)

## Documentation

- [Guardian Operations Manual](docs/PHANTOM_PROTOCOL_GUARDIAN_OPERATIONS.md)
- [Mobile Deployment Guide](docs/PHANTOM_MOBILE_DEPLOYMENT.md)

## License

Custom restricted license - contact legal@khepra.dev

---

**"The best weapon is the one your enemy doesn't know exists."**
EOF

# Initial commit
git add .
git commit -m "Initial commit: Phantom Network Stack"
git push -u origin main
```

### Step 3: Set Up Access Controls (GitHub)

```bash
# Add authorized users (GitHub)
gh api repos/YOUR_ORG/khepra-phantom-protocol/collaborators/ced@khepra.dev \
  -X PUT \
  -f permission=push

# Create access teams
gh api orgs/YOUR_ORG/teams -f name="phantom-core-team" -f privacy=secret
gh api orgs/YOUR_ORG/teams -f name="phantom-field-operators" -f privacy=secret

# Grant team access
gh api repos/YOUR_ORG/khepra-phantom-protocol/teams/phantom-core-team \
  -X PUT \
  -f permission=admin

gh api repos/YOUR_ORG/khepra-phantom-protocol/teams/phantom-field-operators \
  -X PUT \
  -f permission=pull  # Read-only for field operators
```

### Step 4: Branch Protection Rules

```bash
# Require Souhimbou approval for merges (how to do this using my device id/fingerprint I already have setup ?)
gh api repos/YOUR_ORG/khepra-phantom-protocol/branches/main/protection \
  -X PUT \
  --field 'required_pull_request_reviews[required_approving_review_count]=2' \
  --field 'required_pull_request_reviews[dismiss_stale_reviews]=true' \
  --field 'enforce_admins=true'

# Block force pushes
gh api repos/YOUR_ORG/khepra-phantom-protocol/branches/main/protection \
  -X PUT \
  --field 'restrictions[users][]=souhimbou' \
  --field 'restrictions[teams][]=phantom-core-team'
```

### Step 5: Set Up CI/CD (GitHub Actions)

```yaml
# .github/workflows/phantom-ci.yml
name: Phantom CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Check for committed secrets
      - name: Scan for secrets
        run: |
          # Fail if any .key, .pem, or sensitive files found
          if git ls-files | grep -E '\.(key|pem|env\.local)$'; then
            echo "ERROR: Secrets found in Git!"
            exit 1
          fi

      # Check for phantom references in public repos
      - name: Check for leaks
        run: |
          # Ensure no references to public repos
          if grep -r "github.com/public-org" .; then
            echo "ERROR: Reference to public repo found!"
            exit 1
          fi

  build-go:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Build Phantom packages
        run: |
          go build ./pkg/phantom/...
          go test ./pkg/phantom/...

  build-mobile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up gomobile
        run: |
          go install golang.org/x/mobile/cmd/gomobile@latest
          gomobile init

      - name: Build Android library
        run: |
          gomobile bind -target=android \
            -o phantom_mobile.aar \
            ./pkg/phantom

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: phantom-mobile-android
          path: phantom_mobile.aar
```

---

## Dependency Management

### Linking to Main Project (Shared Packages)

**Problem**: Phantom repo needs `pkg/adinkra` and `pkg/license` from main project

**Solution**: Git submodules OR vendoring

#### Option A: Git Submodules (Recommended)

```bash
# In phantom repo
cd khepra-phantom-protocol

# Add main project as submodule (only public packages)
git submodule add https://github.com/YOUR_ORG/khepra-protocol.git vendor/khepra-protocol

# Update import paths in phantom code
# Old: github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra
# New: ../vendor/khepra-protocol/pkg/adinkra

# Update go.mod
cat >> go.mod <<EOF
replace (
    github.com/EtherVerseCodeMate/giza-cyber-shield => ./vendor/khepra-protocol
)
EOF
```

#### Option B: Vendoring (Better for airgapped systems)

```bash
# Copy only needed packages
mkdir -p vendor/khepra-protocol/pkg
cp -r ../khepra-protocol/pkg/adinkra vendor/khepra-protocol/pkg/
cp -r ../khepra-protocol/pkg/license vendor/khepra-protocol/pkg/

# Update go.mod
cat >> go.mod <<EOF
replace (
    github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra => ./vendor/khepra-protocol/pkg/adinkra
    github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license => ./vendor/khepra-protocol/pkg/license
)
EOF

# Vendor dependencies
go mod vendor
```

---

## Distribution Strategy

### For Journalists/Activists

**Method**: Private GitHub invitations + VPN requirement

```bash
# Require VPN for Git access
# Add to GitHub repo settings:
# Settings → Security → IP allow list
# Add:
#   - Tor exit nodes
#   - Trusted VPN IPs (ProtonVPN, Mullvad)
```

### For Military/Government

**Method**: Air-gapped transfer via encrypted USB

```bash
# Create encrypted archive
git archive --format=tar HEAD | \
  gpg --symmetric --cipher-algo AES256 --armor \
  > phantom-stack.tar.asc

# Transfer to USB drive
cp phantom-stack.tar.asc /media/usb/

# On air-gapped system:
gpg --decrypt phantom-stack.tar.asc | tar -x
```

### For Trusted Partners

**Method**: GitLab deploy keys (read-only)

```bash
# Generate deploy key
ssh-keygen -t ed25519 -C "partner-deploy-key" -f deploy_key

# Add to GitLab:
# Settings → Repository → Deploy keys
# Paste public key, set "Read repository" permission

# Partner clones with deploy key
git clone git@gitlab.khepra.internal:phantom/phantom-stack.git
```

---

## Compliance and Legal

### Export Control Classification

**ECCN**: 5A002 / 5D002 (depending on jurisdiction)
- Category 5: Information Security
- Part 2: "Information Security Systems"
- Includes: Strong encryption, steganography, anti-forensics

**Actions**:
1. File with BIS (Bureau of Industry and Security) - USA
2. Comply with Wassenaar Arrangement - International
3. Restrict distribution to approved countries only

### License (Custom Restricted)

```text
PHANTOM NETWORK STACK LICENSE AGREEMENT

1. RESTRICTED USE
   This software is provided for DEFENSIVE purposes only:
   - Journalism (protecting sources)
   - Human rights activism (evading censorship)
   - Military operations (lawful combatants)
   - Corporate security (trade secret protection)

2. PROHIBITED USE
   You MAY NOT use this software for:
   - Criminal activity (terrorism, drug trafficking, etc.)
   - Evading lawful surveillance (court-ordered wiretaps)
   - Stalking or harassment
   - Any illegal purpose

3. NO WARRANTY
   Provided "AS IS" without warranty of any kind.

4. EXPORT RESTRICTIONS
   Subject to export control laws. Do not distribute without legal review.

5. TERMINATION
   License terminates immediately upon violation.

By using this software, you agree to these terms.
```

---

## Security Checklist

Before pushing to Phantom repo:

- [ ] **No secrets committed** (run `git-secrets` scan)
- [ ] **No public repo references** (grep for github.com/public)
- [ ] **No real GPS coordinates** (all examples use fake data)
- [ ] **No real phone IMEIs** (all examples use mock devices)
- [ ] **No identifiable metadata** (strip EXIF from images)
- [ ] **Code review completed** (2 approvals minimum)
- [ ] **Security audit passed** (external pen test)
- [ ] **Legal review completed** (export control lawyer)

---

## Incident Response Plan

### If Phantom Repo is Compromised

1. **Immediate Actions** (within 1 hour):
   - Delete GitHub repo (if hosted on GitHub)
   - Revoke all access tokens
   - Rotate all API keys
   - Alert all authorized users

2. **Containment** (within 24 hours):
   - Identify leak source (audit Git history)
   - Remove leaked copies (DMCA takedowns if public)
   - Assess damage (who has access now?)

3. **Recovery** (within 1 week):
   - Create new private repo (new org, new name)
   - Re-invite trusted users only
   - Implement stronger access controls
   - Update all documentation

4. **Post-Incident** (within 1 month):
   - Forensic analysis (how was it leaked?)
   - Legal action if intentional (criminal referral)
   - Update security procedures
   - Training for all users

---

## Deployment Workflow

```bash
# Developer workflow
git clone git@github.com:YOUR_ORG/khepra-phantom-protocol.git
cd khepra-phantom-protocol

# Create feature branch
git checkout -b feature/enhanced-stealth

# Make changes
# ... edit code ...

# Test locally
go test ./...
gomobile bind -target=android ./pkg/phantom

# Commit (secrets scan runs pre-commit hook)
git add .
git commit -m "Add enhanced thermal camouflage"

# Push (requires 2FA)
git push origin feature/enhanced-stealth

# Create PR (requires 2 approvals)
gh pr create --title "Enhanced thermal camouflage" --body "..."

# After approval, merge
gh pr merge --squash
```

---

## Conclusion

The Phantom Network Stack is now **isolated** from public repos:

- ✅ **Separate repository** (not a branch)
- ✅ **Access controlled** (need-to-know basis)
- ✅ **Export compliant** (legal review required)
- ✅ **Incident response ready** (delete if compromised)

**This protects both the technology and the users.**

🔒 *"Operational security is not optional."*
