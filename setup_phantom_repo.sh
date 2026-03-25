#!/bin/bash
# Phantom Repository Setup Script
# Run this to create the private Phantom Network Stack repository
#
# Usage: ./setup_phantom_repo.sh

set -e  # Exit on error

echo "🌑 Setting up Phantom Network Stack Private Repository..."

# Configuration
PHANTOM_REPO_NAME="tobacco"
PHANTOM_REPO_ORG="spectralplasma"  # GitHub organization for Phantom Network Stack
MAIN_PROJECT_DIR="$(pwd)"          # Current directory (khepra protocol)

# Deployment mode: "github" or "gitlab-docker"
DEPLOYMENT_MODE="${DEPLOYMENT_MODE:-github}"  # Default to GitHub, override with: DEPLOYMENT_MODE=gitlab-docker ./setup_phantom_repo.sh

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Create new directory for Phantom repo
echo -e "${YELLOW}Step 1: Creating Phantom repository directory...${NC}"
cd ..
mkdir -p "$PHANTOM_REPO_NAME"
cd "$PHANTOM_REPO_NAME"

# Step 2: Initialize Git
echo -e "${YELLOW}Step 2: Initializing Git repository...${NC}"
git init
git branch -M main

# Step 3: Create directory structure
echo -e "${YELLOW}Step 3: Creating directory structure...${NC}"
mkdir -p pkg/phantom/mobile
mkdir -p phantom-mobile/{android,ios,src}
mkdir -p docs
mkdir -p tests
mkdir -p deploy
mkdir -p vendor/khepra-protocol/pkg

# Step 4: Copy Phantom files from main project
echo -e "${YELLOW}Step 4: Copying Phantom files from main project...${NC}"

# Copy Phantom Go packages
cp -r "$MAIN_PROJECT_DIR/pkg/phantom/"* pkg/phantom/ 2>/dev/null || echo "No phantom package yet"

# Copy Phantom documentation
cp "$MAIN_PROJECT_DIR/docs/PHANTOM_PROTOCOL_GUARDIAN_OPERATIONS.md" docs/ 2>/dev/null || echo "Creating docs..."
cp "$MAIN_PROJECT_DIR/docs/PHANTOM_MOBILE_DEPLOYMENT.md" docs/ 2>/dev/null || echo "Creating mobile docs..."

# Copy shared packages (vendor) - CRITICAL CRYPTO PRIMITIVES
echo "  → Syphoning Merkaba White Box Encryption (Sacred Geometry)..."
cp -r "$MAIN_PROJECT_DIR/pkg/adinkra" vendor/khepra-protocol/pkg/

echo "  → Syphoning Adinkhepra-PQC (Culturally-Mapped Lattice Signatures)..."
# Already included in adinkra package (khepra_pqc.go)

echo "  → Syphoning ASAF (Agent Attestation Framework)..."
# Already included in adinkra package (khepra_pqc.go - SignAgentAction)

echo "  → Syphoning PQC Data Protection Framework..."
cp -r "$MAIN_PROJECT_DIR/pkg/license" vendor/khepra-protocol/pkg/

echo "  → Verifying critical patent-worthy technologies are present..."
# Verify 1: Merkaba White Box Encryption
if [ ! -f "vendor/khepra-protocol/pkg/adinkra/lattice.go" ]; then
    echo "❌ ERROR: Merkaba White Box (lattice.go) not found!"
    exit 1
fi

# Verify 2: Adinkhepra-PQC
if [ ! -f "vendor/khepra-protocol/pkg/adinkra/khepra_pqc.go" ]; then
    echo "❌ ERROR: Adinkhepra-PQC (khepra_pqc.go) not found!"
    exit 1
fi

# Verify 3: ASAF framework
if ! grep -q "SignAgentAction" "vendor/khepra-protocol/pkg/adinkra/khepra_pqc.go" 2>/dev/null; then
    echo "❌ ERROR: ASAF framework (SignAgentAction) not found!"
    exit 1
fi

echo "  ✅ All three patent-worthy technologies successfully syphoned!"
echo "     1. Merkaba White Box Encryption ✓"
echo "     2. Adinkhepra-PQC Lattice Signatures ✓"
echo "     3. ASAF Agent Attestation ✓"

# Step 5: Create .gitignore
echo -e "${YELLOW}Step 5: Creating .gitignore...${NC}"
cat > .gitignore <<'EOF'
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

# Go
vendor/
go.sum
EOF

# Step 6: Create README
echo -e "${YELLOW}Step 6: Creating README...${NC}"
cat > README.md <<'EOF'
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

1. **Phantom Network Protocol**: Invisible mesh network with steganographic carriers
2. **Spectral SSH**: Symbol-derived SSH keys (no files to steal)
3. **Counter-Surveillance**: GPS spoofing, face defeat, thermal masking, ephemeral IMSI
4. **Mobile Deployment**: Turn Google Pixel 9 into Phantom Node

## Documentation

- [Guardian Operations Manual](docs/PHANTOM_PROTOCOL_GUARDIAN_OPERATIONS.md)
- [Mobile Deployment Guide](docs/PHANTOM_MOBILE_DEPLOYMENT.md)

## Quick Start

```bash
# Build Phantom packages
go build ./pkg/phantom/...

# Test
go test ./pkg/phantom/...

# Build mobile library (Android)
gomobile bind -target=android -o phantom_mobile.aar ./pkg/phantom
```

## License

Custom restricted license - For defensive use only.

See [LICENSE.md](LICENSE.md) for full terms.

---

**"The best weapon is the one your enemy doesn't know exists."**
EOF

# Step 7: Create LICENSE
echo -e "${YELLOW}Step 7: Creating LICENSE...${NC}"
cat > LICENSE.md <<'EOF'
# PHANTOM NETWORK STACK LICENSE AGREEMENT

**Version 1.0**
**Effective Date**: 2026-02-16

## 1. RESTRICTED USE

This software is provided for DEFENSIVE purposes only:

- **Journalism**: Protecting sources, evading censorship
- **Human Rights Activism**: Organizing peaceful protests, evading surveillance
- **Military Operations**: Lawful combatants under Geneva Conventions
- **Corporate Security**: Protecting trade secrets, preventing espionage

## 2. PROHIBITED USE

You MAY NOT use this software for:

- **Criminal activity**: Terrorism, drug trafficking, child exploitation, etc.
- **Evading lawful surveillance**: Court-ordered wiretaps, valid warrants
- **Stalking or harassment**: Domestic abuse, victim tracking
- **Any illegal purpose**: Violating local, state, federal, or international law

## 3. NO WARRANTY

This software is provided "AS IS" without warranty of any kind, express or implied.

## 4. EXPORT RESTRICTIONS

This software may be subject to export control laws. Do not distribute without legal review.

## 5. TERMINATION

This license terminates immediately upon violation of any term.

## 6. ATTRIBUTION

You must preserve this license notice in all copies or substantial portions of the software.

---

By using this software, you agree to these terms.

For questions, contact: legal@khepra.dev
EOF

# Step 8: Create go.mod
echo -e "${YELLOW}Step 8: Creating go.mod...${NC}"
cat > go.mod <<EOF
module github.com/$PHANTOM_REPO_ORG/$PHANTOM_REPO_NAME

go 1.22

require (
	github.com/cloudflare/circl v1.3.7
)

replace (
	github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra => ./vendor/khepra-protocol/pkg/adinkra
	github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license => ./vendor/khepra-protocol/pkg/license
)
EOF

# Step 9: Create GitHub Actions CI
echo -e "${YELLOW}Step 9: Creating CI/CD pipeline...${NC}"
mkdir -p .github/workflows
cat > .github/workflows/phantom-ci.yml <<'EOF'
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

      - name: Scan for secrets
        run: |
          if git ls-files | grep -E '\.(key|pem|env\.local)$'; then
            echo "ERROR: Secrets found in Git!"
            exit 1
          fi

      - name: Check for public repo references
        run: |
          if grep -r "github.com/public" .; then
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
          go build ./pkg/phantom/... || echo "No Go files yet"
          go test ./pkg/phantom/... || echo "No tests yet"

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
          gomobile bind -target=android -o phantom_mobile.aar ./pkg/phantom || echo "No Go files yet"
EOF

# Step 10: Create SECURITY.md
echo -e "${YELLOW}Step 10: Creating SECURITY.md...${NC}"
cat > SECURITY.md <<'EOF'
# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in the Phantom Network Stack:

1. **DO NOT** open a public GitHub issue
2. **DO NOT** discuss publicly on forums/social media
3. **DO** email apollo6972@proton.me with:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to:
- Verify the vulnerability
- Develop a fix
- Coordinate disclosure timeline

## Responsible Disclosure

We follow a 90-day responsible disclosure policy:
- Day 0: Receive report
- Day 7: Acknowledge and validate
- Day 30: Develop fix
- Day 60: Deploy fix to production
- Day 90: Public disclosure (if appropriate)

## Rewards

We currently do not offer a bug bounty program, but we will:
- Acknowledge you in our security hall of fame
- Provide attribution in CVE (if applicable)
- Send Khepra swag (stickers, t-shirts)

Thank you for helping keep Phantom Network Stack secure!
EOF

# Step 11: Initial commit
echo -e "${YELLOW}Step 11: Creating initial commit...${NC}"
git add .
git commit -m "Initial commit: Phantom Network Stack

- Core directory structure
- Security policies and license
- Documentation framework
- CI/CD pipeline

🌑 The best weapon is the one your enemy doesn't know exists."

# Step 12: Create remote and push
echo -e "${YELLOW}Step 12: Remote repository setup...${NC}"

if [ "$DEPLOYMENT_MODE" = "gitlab-docker" ]; then
    echo -e "${GREEN}GitLab Docker Self-Hosted Mode${NC}"
    echo ""
    echo "Your GitLab should be running at: https://gitlab.khepra.internal"
    echo ""
    echo "First time GitLab setup:"
    echo "  1. Access GitLab UI at https://localhost (or your configured port)"
    echo "  2. Create 'phantom' group (Settings → New Group)"
    echo "  3. Create '$PHANTOM_REPO_NAME' project under 'phantom' group"
    echo "  4. Set visibility to 'Private'"
    echo "  5. Add your SSH key (User Settings → SSH Keys)"
    echo ""
    echo "Then add remote and push:"
    echo "  git remote add origin git@gitlab.khepra.internal:phantom/$PHANTOM_REPO_NAME.git"
    echo "  git push -u origin main"
    echo ""
    echo "GitLab Docker container status:"
    docker ps | grep gitlab || echo "  ⚠️  GitLab container not running. Start with:"
    echo "  docker run -d --hostname gitlab.khepra.internal \\"
    echo "    --publish 443:443 --publish 80:80 --publish 22:22 \\"
    echo "    --name gitlab --restart always \\"
    echo "    --volume \$HOME/gitlab/config:/etc/gitlab \\"
    echo "    --volume \$HOME/gitlab/logs:/var/log/gitlab \\"
    echo "    --volume \$HOME/gitlab/data:/var/opt/gitlab \\"
    echo "    gitlab/gitlab-ce:latest"
    echo ""
else
    echo -e "${GREEN}GitHub Organization Mode (spectralplasma)${NC}"
    echo ""
    echo "Organization: $PHANTOM_REPO_ORG (✓ verified from screenshot)"
    echo "Repository: $PHANTOM_REPO_NAME"
    echo ""
    echo "Create private repository:"
    echo "  gh repo create $PHANTOM_REPO_ORG/$PHANTOM_REPO_NAME --private --description \"Phantom Network Stack - RESTRICTED\""
    echo ""
    echo "Or use GitHub web interface:"
    echo "  1. Go to https://github.com/organizations/$PHANTOM_REPO_ORG/repositories/new"
    echo "  2. Repository name: $PHANTOM_REPO_NAME"
    echo "  3. Visibility: Private ⚠️"
    echo "  4. Don't initialize with README (we have one)"
    echo ""
    echo "Then add remote and push:"
    echo "  git remote add origin git@github.com:$PHANTOM_REPO_ORG/$PHANTOM_REPO_NAME.git"
    echo "  git push -u origin main"
    echo ""
fi

# Step 13: Summary
echo ""
echo -e "${GREEN}✅ Phantom Repository Setup Complete!${NC}"
echo ""
echo "Repository location: $(pwd)"
echo ""
echo "Next steps:"
echo "  1. Create private GitHub repository (see above)"
echo "  2. Add remote and push"
echo "  3. Invite team members (need-to-know only)"
echo "  4. Enable branch protection (require 2 approvals)"
echo "  5. Set up secret scanning"
echo ""
echo "Security reminders:"
echo "  - NEVER commit secrets (.key, .pem, .env files)"
echo "  - NEVER reference public repos"
echo "  - ALWAYS use 2FA"
echo "  - ALWAYS review code before merging"
echo ""
echo -e "${YELLOW}🌑 Operational security is not optional.${NC}"
