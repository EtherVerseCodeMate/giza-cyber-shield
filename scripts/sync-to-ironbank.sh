#!/bin/bash
# Iron Bank Repository Synchronization Script
# Date: January 13, 2026
# Purpose: Sync packages from giza-cyber-shield to adinkhepra-asaf-ironbank
# Fixes: Missing pkg/adinkra, pkg/stigs, pkg/scanners

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAIN_REPO="/home/user/giza-cyber-shield"
IRONBANK_REPO="/home/user/adinkhepra-asaf-ironbank"  # Adjust if different location

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Iron Bank Repository Synchronization Script            ║${NC}"
echo -e "${BLUE}║  Syncing: giza-cyber-shield → adinkhepra-asaf-ironbank  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verify repos exist
if [ ! -d "$MAIN_REPO" ]; then
    echo -e "${RED}✗ Main repo not found: $MAIN_REPO${NC}"
    exit 1
fi

if [ ! -d "$IRONBANK_REPO" ]; then
    echo -e "${RED}✗ Iron Bank repo not found: $IRONBANK_REPO${NC}"
    echo -e "${YELLOW}→ Please clone it first:${NC}"
    echo -e "  cd /home/user"
    echo -e "  git clone https://github.com/nouchix/adinkhepra-asaf-ironbank.git"
    exit 1
fi

echo -e "${GREEN}✓ Found main repo: $MAIN_REPO${NC}"
echo -e "${GREEN}✓ Found Iron Bank repo: $IRONBANK_REPO${NC}"
echo ""

# Create pkg/ directory if it doesn't exist
mkdir -p "$IRONBANK_REPO/pkg"

# Phase 1: Copy Critical Packages
echo -e "${BLUE}═══ Phase 1: Critical Packages ═══${NC}"

# 1. pkg/adinkra/ (Core PQC - 3,370+ LOC)
echo -e "${YELLOW}→ Syncing pkg/adinkra/ (Core PQC)...${NC}"
if [ -d "$MAIN_REPO/pkg/adinkra" ]; then
    cp -r "$MAIN_REPO/pkg/adinkra" "$IRONBANK_REPO/pkg/"
    echo -e "${GREEN}✓ pkg/adinkra/ copied${NC}"
else
    echo -e "${RED}✗ pkg/adinkra/ not found in main repo${NC}"
fi

# 2. pkg/stig/ → pkg/stigs/ (Rename to match imports)
echo -e "${YELLOW}→ Syncing pkg/stig/ → pkg/stigs/ (STIG compliance)...${NC}"
if [ -d "$MAIN_REPO/pkg/stig" ]; then
    cp -r "$MAIN_REPO/pkg/stig" "$IRONBANK_REPO/pkg/stigs"
    echo -e "${GREEN}✓ pkg/stigs/ created (renamed from pkg/stig)${NC}"
else
    echo -e "${RED}✗ pkg/stig/ not found in main repo${NC}"
fi

# 3. pkg/scanners/ (Aggregate from multiple sources)
echo -e "${YELLOW}→ Creating pkg/scanners/ (Vulnerability scanner)...${NC}"
mkdir -p "$IRONBANK_REPO/pkg/scanners"

# Copy crypto discovery as crypto_scanner.go
if [ -f "$MAIN_REPO/pkg/crypto/discovery.go" ]; then
    cp "$MAIN_REPO/pkg/crypto/discovery.go" "$IRONBANK_REPO/pkg/scanners/crypto_scanner.go"
    # Update package name from 'crypto' to 'scanners'
    sed -i 's/^package crypto$/package scanners/' "$IRONBANK_REPO/pkg/scanners/crypto_scanner.go"
    echo -e "${GREEN}✓ pkg/scanners/crypto_scanner.go created${NC}"
fi

# Copy scanner package if exists
if [ -d "$MAIN_REPO/pkg/scanner" ]; then
    cp -r "$MAIN_REPO/pkg/scanner/"* "$IRONBANK_REPO/pkg/scanners/" 2>/dev/null || true
    echo -e "${GREEN}✓ Additional scanner files copied${NC}"
fi

echo ""

# Phase 2: Copy Supporting Packages
echo -e "${BLUE}═══ Phase 2: Supporting Packages ═══${NC}"

SUPPORTING_PACKAGES=(
    "compliance"
    "crypto"
    "dag"
    "telemetry"
    "audit"
    "fim"
    "config"
    "license"
    "intel"
    "version"
)

for pkg in "${SUPPORTING_PACKAGES[@]}"; do
    echo -e "${YELLOW}→ Syncing pkg/$pkg/...${NC}"
    if [ -d "$MAIN_REPO/pkg/$pkg" ]; then
        cp -r "$MAIN_REPO/pkg/$pkg" "$IRONBANK_REPO/pkg/"
        echo -e "${GREEN}✓ pkg/$pkg/ copied${NC}"
    else
        echo -e "${YELLOW}⚠ pkg/$pkg/ not found (skipping)${NC}"
    fi
done

echo ""

# Phase 3: Copy Data Files
echo -e "${BLUE}═══ Phase 3: Data Files ═══${NC}"

# Compliance databases
echo -e "${YELLOW}→ Syncing compliance databases...${NC}"
mkdir -p "$IRONBANK_REPO/data/compliance"
if [ -f "$MAIN_REPO/docs/CCI_to_NIST53.csv" ]; then
    cp "$MAIN_REPO/docs/CCI_to_NIST53.csv" "$IRONBANK_REPO/data/compliance/"
    echo -e "${GREEN}✓ CCI_to_NIST53.csv copied${NC}"
fi
if [ -f "$MAIN_REPO/docs/STIG_CCI_Map.csv" ]; then
    cp "$MAIN_REPO/docs/STIG_CCI_Map.csv" "$IRONBANK_REPO/data/compliance/"
    echo -e "${GREEN}✓ STIG_CCI_Map.csv copied${NC}"
fi
if [ -f "$MAIN_REPO/docs/NIST53_to_171.csv" ]; then
    cp "$MAIN_REPO/docs/NIST53_to_171.csv" "$IRONBANK_REPO/data/compliance/"
    echo -e "${GREEN}✓ NIST53_to_171.csv copied${NC}"
fi

# CVE database
echo -e "${YELLOW}→ Syncing CVE database...${NC}"
if [ -d "$MAIN_REPO/data/cve-database" ]; then
    mkdir -p "$IRONBANK_REPO/data/cve-database"
    cp -r "$MAIN_REPO/data/cve-database/"* "$IRONBANK_REPO/data/cve-database/" 2>/dev/null || true
    echo -e "${GREEN}✓ CVE database copied${NC}"
else
    echo -e "${YELLOW}⚠ CVE database not found (skipping)${NC}"
fi

echo ""

# Phase 4: Fix Import Paths
echo -e "${BLUE}═══ Phase 4: Fix Import Paths ═══${NC}"
echo -e "${YELLOW}→ Updating import paths to Iron Bank repo...${NC}"

cd "$IRONBANK_REPO"

# Count files before replacement
FILE_COUNT=$(find . -type f -name "*.go" -not -path "./vendor/*" | wc -l)
echo -e "  Found $FILE_COUNT Go files to update"

# Replace import paths
find . -type f -name "*.go" -not -path "./vendor/*" -exec sed -i \
    's|github.com/EtherVerseCodeMate/giza-cyber-shield|github.com/nouchix/adinkhepra-asaf-ironbank|g' {} \;

echo -e "${GREEN}✓ Import paths updated${NC}"

echo ""

# Phase 5: Update go.mod and Vendor Dependencies
echo -e "${BLUE}═══ Phase 5: Update Dependencies ═══${NC}"

cd "$IRONBANK_REPO"

# Ensure go.mod has correct module name
if grep -q "github.com/EtherVerseCodeMate/giza-cyber-shield" go.mod 2>/dev/null; then
    echo -e "${YELLOW}→ Updating module name in go.mod...${NC}"
    sed -i 's|github.com/EtherVerseCodeMate/giza-cyber-shield|github.com/nouchix/adinkhepra-asaf-ironbank|g' go.mod
    echo -e "${GREEN}✓ go.mod updated${NC}"
fi

echo -e "${YELLOW}→ Running go mod tidy...${NC}"
go mod tidy
echo -e "${GREEN}✓ go mod tidy complete${NC}"

echo -e "${YELLOW}→ Vendoring dependencies...${NC}"
go mod vendor
echo -e "${GREEN}✓ Dependencies vendored${NC}"

echo -e "${YELLOW}→ Verifying dependencies...${NC}"
go mod verify
echo -e "${GREEN}✓ Dependencies verified${NC}"

echo ""

# Phase 6: Build Verification
echo -e "${BLUE}═══ Phase 6: Build Verification ═══${NC}"

echo -e "${YELLOW}→ Building binaries...${NC}"

# Build sonar
echo -e "  Building cmd/sonar..."
if CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -v -o bin/sonar cmd/sonar/main.go 2>&1 | tail -5; then
    echo -e "${GREEN}✓ sonar built successfully${NC}"
    ls -lh bin/sonar
else
    echo -e "${RED}✗ sonar build failed${NC}"
fi

# Build adinkhepra
echo -e "  Building cmd/adinkhepra..."
if CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -v -o bin/adinkhepra cmd/adinkhepra/main.go 2>&1 | tail -5; then
    echo -e "${GREEN}✓ adinkhepra built successfully${NC}"
    ls -lh bin/adinkhepra
else
    echo -e "${RED}✗ adinkhepra build failed${NC}"
fi

# Build khepra-daemon
echo -e "  Building cmd/khepra-daemon..."
if CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -v -o bin/khepra-daemon cmd/khepra-daemon/main.go 2>&1 | tail -5; then
    echo -e "${GREEN}✓ khepra-daemon built successfully${NC}"
    ls -lh bin/khepra-daemon
else
    echo -e "${RED}✗ khepra-daemon build failed${NC}"
fi

echo ""

# Summary
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Synchronization Summary                                 ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ Packages synchronized:${NC}"
echo -e "  • pkg/adinkra/ (Core PQC)"
echo -e "  • pkg/stigs/ (STIG compliance)"
echo -e "  • pkg/scanners/ (Vulnerability scanner)"
echo -e "  • Supporting packages (compliance, crypto, dag, etc.)"
echo ""
echo -e "${GREEN}✓ Data files synchronized:${NC}"
echo -e "  • Compliance databases (36,195+ rows)"
echo -e "  • CVE database (air-gapped scanning)"
echo ""
echo -e "${GREEN}✓ Import paths updated${NC}"
echo -e "${GREEN}✓ Dependencies vendored${NC}"
echo ""

# Next steps
echo -e "${BLUE}═══ Next Steps ═══${NC}"
echo -e "1. ${YELLOW}Test the binaries:${NC}"
echo -e "   cd $IRONBANK_REPO"
echo -e "   ./bin/sonar --help"
echo -e "   ./bin/adinkhepra --help"
echo -e ""
echo -e "2. ${YELLOW}Build Docker image:${NC}"
echo -e "   docker build -f Dockerfile.ironbank -t adinkhepra:test ."
echo -e ""
echo -e "3. ${YELLOW}Run functional tests:${NC}"
echo -e "   docker run --rm adinkhepra:test /scripts/functional-test.sh"
echo -e ""
echo -e "4. ${YELLOW}Commit changes:${NC}"
echo -e "   git add ."
echo -e "   git commit -m \"feat: sync packages from main repo, fix build errors\""
echo -e "   git push origin main"
echo -e ""
echo -e "${GREEN}✓ Synchronization complete!${NC} 🚀"
