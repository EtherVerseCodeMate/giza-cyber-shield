# Iron Bank Repository Synchronization Guide
**Date:** January 13, 2026
**Main Repo:** https://github.com/EtherVerseCodeMate/giza-cyber-shield
**Iron Bank Repo:** https://github.com/nouchix/adinkhepra-asaf-ironbank
**Status:** CRITICAL - Missing Package Structure

---

## 🚨 Critical Issue Identified

**Problem:** The Iron Bank repo references packages in `cmd/sonar/main.go` that are missing from `pkg/`:
- ❌ `pkg/adinkra` - Missing
- ❌ `pkg/stigs` - Missing
- ❌ `pkg/scanners` - Missing

**Root Cause:** Package structure from main repo has not been synchronized to Iron Bank repo.

**Impact:** Build will fail in Iron Bank pipeline until resolved.

---

## 📋 Solution: Selective Package Synchronization

### Phase 1: Core Package Transfer (Required)

These packages from `giza-cyber-shield` MUST be copied to `adinkhepra-asaf-ironbank`:

#### **1. Cryptographic Core (pkg/adinkra/)**
**Location:** `giza-cyber-shield/pkg/adinkra/`
**Size:** 3,370+ LOC
**Reason:** Core KHEPRA Protocol implementation

**Files to copy:**
```bash
pkg/adinkra/
├── khepra_pqc.go          # Proprietary lattice-based PQC
├── dilithium.go           # NIST Dilithium3 wrapper
├── kyber.go               # NIST Kyber-1024 wrapper
├── ecdsa.go               # P-384 classical fallback
├── lattice.go             # Merkaba/Sephirot/Sacred Runes
├── memory.go              # Secure memory zeroization
└── *_test.go              # Unit tests
```

**Decision Point:**
- ✅ **Option A (Recommended):** Copy all files (full functionality)
- ⚠️ **Option B:** Copy only NIST wrappers (minimal, but loses Khepra-PQC defense-in-depth)

---

#### **2. STIG Compliance Engine (pkg/stig/ or pkg/stigs/)**
**Location:** `giza-cyber-shield/pkg/stig/` (note: singular in main repo)
**Reason:** Required for `sonar` scanner

**Files to copy:**
```bash
pkg/stig/
├── rhel09_stig.go         # RHEL-09-STIG-V1R3 implementation
├── pqc_controls.go        # 13 custom PQC STIG controls
├── ckl.go                 # CKL (checklist) generation
├── scanner.go             # STIG scanning engine
└── *_test.go              # Unit tests
```

**Rename for Iron Bank:** `pkg/stigs/` (plural, to match imports)

---

#### **3. Security Scanners (pkg/scanners/ or pkg/scanner/)**
**Location:** `giza-cyber-shield/pkg/crypto/discovery.go` (integrated into crypto package)
**Reason:** Required for `sonar` vulnerability scanning

**Decision:** Create `pkg/scanners/` in Iron Bank repo with subset of functionality:

**Files to create/copy:**
```bash
pkg/scanners/
├── crypto_scanner.go      # From pkg/crypto/discovery.go
├── cve_scanner.go         # From pkg/scanner/cve/ (if exists)
├── compliance_scanner.go  # From pkg/compliance/
└── *_test.go              # Unit tests
```

---

### Phase 2: Supporting Packages (Recommended)

#### **4. Compliance Engine (pkg/compliance/)**
**Location:** `giza-cyber-shield/pkg/compliance/`
**Reason:** NIST 800-53, CMMC mappings

**Files to copy:**
```bash
pkg/compliance/
├── nist80053.go           # NIST 800-53 control mappings
├── nist800171.go          # NIST 800-171 mappings
├── cmmc.go                # CMMC Level 3 mappings
├── cci.go                 # CCI database integration
└── mapper.go              # Cross-framework translation
```

---

#### **5. Cryptographic Discovery (pkg/crypto/)**
**Location:** `giza-cyber-shield/pkg/crypto/`
**Reason:** Crypto asset scanning, CBOM generation

**Files to copy:**
```bash
pkg/crypto/
├── discovery.go           # Crypto asset scanner
├── cbom.go                # CBOM generation (CycloneDX)
├── fips.go                # FIPS 140-3 validation
├── fips_boring.go         # BoringCrypto integration
└── rotation.go            # Key rotation (future)
```

---

#### **6. DAG Forensics (pkg/dag/)**
**Location:** `giza-cyber-shield/pkg/dag/`
**Reason:** Immutable audit trails

**Files to copy:**
```bash
pkg/dag/
├── dag.go                 # Directed acyclic graph
├── node.go                # DAG node structure
├── storage.go             # Persistent storage
└── visualizer.go          # D3.js integration (optional)
```

---

#### **7. Telemetry (pkg/telemetry/)**
**Location:** `giza-cyber-shield/pkg/telemetry/`
**Reason:** Privacy-safe beacons

**Files to copy:**
```bash
pkg/telemetry/
├── beacon.go              # Telemetry beacon
├── metrics.go             # Metrics collection
└── client.go              # Cloudflare Worker client
```

**Iron Bank Note:** Telemetry is optional (air-gapped mode). Include but ensure it's dormant by default.

---

#### **8. Audit Logging (pkg/audit/)**
**Location:** `giza-cyber-shield/pkg/audit/`
**Reason:** PQC-signed audit snapshots

**Files to copy:**
```bash
pkg/audit/
├── audit.go               # Audit trail generation
├── snapshot.go            # PQC-signed snapshots
└── storage.go             # Persistent audit storage
```

---

#### **9. File Integrity Monitoring (pkg/fim/)**
**Location:** `giza-cyber-shield/pkg/fim/`
**Reason:** Continuous file monitoring

**Files to copy:**
```bash
pkg/fim/
├── monitor.go             # fsnotify-based monitoring
├── baseline.go            # SHA-256 baseline tracking
└── violation.go           # Violation detection
```

---

#### **10. Configuration (pkg/config/)**
**Location:** `giza-cyber-shield/pkg/config/`
**Reason:** Centralized configuration

**Files to copy:**
```bash
pkg/config/
├── config.go              # Configuration loader
├── defaults.go            # Default settings
└── validator.go           # Configuration validation
```

---

#### **11. License Enforcement (pkg/license/)**
**Location:** `giza-cyber-shield/pkg/license/`
**Reason:** Hardware-bound licensing, anti-spoofing

**Files to copy:**
```bash
pkg/license/
├── license.go             # License validation
├── fingerprint.go         # Device fingerprinting (TPM, MAC, CPU)
├── gatekeeper.go          # License enforcement
└── validator.go           # Dilithium3 signature verification
```

**Iron Bank Note:** License enforcement may be excluded for DoD (Government Purpose Rights). Consult legal.

---

#### **12. Networking (pkg/net/tailnet/)**
**Location:** `giza-cyber-shield/pkg/net/tailnet/`
**Reason:** Optional Tailscale mesh (dormant by default)

**Files to copy:**
```bash
pkg/net/tailnet/
├── client.go              # Tailscale client
└── config.go              # Mesh configuration
```

**Iron Bank Note:** Must be dormant by default (no TAILSCALE_AUTH_KEY = offline mode).

---

#### **13. Intel Fusion (pkg/intel/)**
**Location:** `giza-cyber-shield/pkg/intel/`
**Reason:** CISA KEV, MITRE ATT&CK integration

**Files to copy:**
```bash
pkg/intel/
├── kev.go                 # CISA KEV database
├── mitre.go               # MITRE ATT&CK mapping
└── cve.go                 # CVE database integration
```

---

#### **14. Version Info (pkg/version/)**
**Location:** `giza-cyber-shield/pkg/version/`
**Reason:** Version management

**Files to copy:**
```bash
pkg/version/
└── version.go             # Version string (update to 1.0.0)
```

---

### Phase 3: Data Files

#### **15. Compliance Databases**
**Location:** `giza-cyber-shield/docs/`
**Reason:** 36,195+ row compliance mapping database

**Files to copy:**
```bash
data/compliance/
├── CCI_to_NIST53.csv              # 7,433 rows
├── STIG_CCI_Map.csv               # 28,639 rows
├── NIST53_to_171.csv              # 123 rows
└── STIG_to_NIST171_Mapping.xlsx   # Comprehensive mapping
```

**Iron Bank Location:** `/var/lib/adinkhepra/data/compliance/`

---

#### **16. CVE Database**
**Location:** `giza-cyber-shield/data/cve-database/`
**Reason:** Air-gapped CVE scanning

**Files to copy:**
```bash
data/cve-database/
├── nvd-cves-*.json        # NVD feeds
└── cisa-kev.json          # CISA KEV catalog
```

**Iron Bank Location:** `/var/lib/adinkhepra/data/cve-database/`

---

## 🔧 Synchronization Commands

### Step 1: Clone Iron Bank Repo (Local Development)

```bash
cd /home/user
git clone https://github.com/nouchix/adinkhepra-asaf-ironbank.git
cd adinkhepra-asaf-ironbank
```

---

### Step 2: Copy Core Packages

```bash
# Navigate to main repo
cd /home/user/giza-cyber-shield

# Copy pkg/adinkra/ (Core PQC)
cp -r pkg/adinkra /home/user/adinkhepra-asaf-ironbank/pkg/

# Copy pkg/stig/ → pkg/stigs/ (Rename to match imports)
cp -r pkg/stig /home/user/adinkhepra-asaf-ironbank/pkg/stigs

# Create pkg/scanners/ (Aggregate from multiple sources)
mkdir -p /home/user/adinkhepra-asaf-ironbank/pkg/scanners
cp pkg/crypto/discovery.go /home/user/adinkhepra-asaf-ironbank/pkg/scanners/crypto_scanner.go
# (Adjust imports and package name to 'scanners')

# Copy supporting packages
for pkg in compliance crypto dag telemetry audit fim config license; do
  cp -r pkg/$pkg /home/user/adinkhepra-asaf-ironbank/pkg/
done

# Copy data files
mkdir -p /home/user/adinkhepra-asaf-ironbank/data/compliance
cp docs/*.csv /home/user/adinkhepra-asaf-ironbank/data/compliance/

mkdir -p /home/user/adinkhepra-asaf-ironbank/data/cve-database
cp -r data/cve-database/* /home/user/adinkhepra-asaf-ironbank/data/cve-database/
```

---

### Step 3: Update go.mod in Iron Bank Repo

```bash
cd /home/user/adinkhepra-asaf-ironbank

# Update module name (if different)
# Edit go.mod: module github.com/nouchix/adinkhepra-asaf-ironbank

# Add dependencies
go mod tidy

# Vendor dependencies (required for Iron Bank)
go mod vendor

# Verify vendoring
go mod verify
```

---

### Step 4: Fix Import Paths

**Problem:** `cmd/sonar/main.go` imports from main repo path:
```go
import "github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
```

**Solution:** Update to Iron Bank repo path:
```go
import "github.com/nouchix/adinkhepra-asaf-ironbank/pkg/adinkra"
```

**Automated Fix:**
```bash
cd /home/user/adinkhepra-asaf-ironbank

# Replace all import paths
find . -type f -name "*.go" -not -path "./vendor/*" -exec sed -i \
  's|github.com/EtherVerseCodeMate/giza-cyber-shield|github.com/nouchix/adinkhepra-asaf-ironbank|g' {} \;
```

---

### Step 5: Verify Build

```bash
cd /home/user/adinkhepra-asaf-ironbank

# Build all binaries
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -v -o bin/sonar cmd/sonar/main.go
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -v -o bin/adinkhepra cmd/adinkhepra/main.go
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -v -o bin/khepra-daemon cmd/khepra-daemon/main.go

# Check binaries
ls -lah bin/
# Expected: sonar, adinkhepra, khepra-daemon (all ~50MB each)

# Test execution
./bin/sonar --help
./bin/adinkhepra --help
./bin/khepra-daemon --help
```

---

### Step 6: Test Dockerfile Build

```bash
cd /home/user/adinkhepra-asaf-ironbank

# Build Docker image
docker build -f Dockerfile.ironbank \
  --build-arg BASE_REGISTRY=docker.io \
  --build-arg BASE_IMAGE=redhat/ubi9-minimal \
  -t adinkhepra:test .

# Verify non-root
docker run --rm adinkhepra:test id
# Expected: uid=1001(khepra) gid=0(root)

# Test scanner
docker run --rm adinkhepra:test /usr/local/bin/sonar --help
```

---

## 📊 Package Dependency Matrix

| Package | Required? | Size | Dependencies | Impact if Missing |
|---------|-----------|------|--------------|-------------------|
| **pkg/adinkra/** | ✅ Critical | 3,370 LOC | circl, crypto/rand | Build fails - core crypto |
| **pkg/stigs/** | ✅ Critical | ~500 LOC | encoding/xml | Build fails - STIG scanner |
| **pkg/scanners/** | ✅ Critical | ~800 LOC | pkg/crypto, pkg/intel | Build fails - vulnerability scanner |
| **pkg/compliance/** | ⚠️ High | ~600 LOC | encoding/csv | Features disabled - no NIST mapping |
| **pkg/crypto/** | ⚠️ High | ~1,200 LOC | circl, crypto/* | Features disabled - no CBOM |
| **pkg/dag/** | 🟡 Medium | ~400 LOC | crypto/sha256 | Features disabled - no forensics |
| **pkg/telemetry/** | 🟢 Low | ~200 LOC | net/http | Optional - air-gapped mode works |
| **pkg/license/** | ⚠️ Consult Legal | ~300 LOC | pkg/adinkra | GPR may exclude licensing |

**Legend:**
- ✅ Critical: Build fails without
- ⚠️ High: Key features disabled
- 🟡 Medium: Nice-to-have features
- 🟢 Low: Optional features

---

## 🎯 Recommended Synchronization Strategy

### Option A: Full Sync (Recommended for Feature Parity)

**What:** Copy all packages from main repo to Iron Bank repo

**Pros:**
- Complete feature parity
- All tests pass
- No surprises for end users

**Cons:**
- Larger binary size (~70MB vs ~50MB)
- More code to review (hardener effort)

**Timeline:** 1-2 days of effort

---

### Option B: Minimal Sync (Fastest to Iron Bank Approval)

**What:** Copy only critical packages (adinkra, stigs, scanners)

**Pros:**
- Minimal attack surface
- Faster hardener review
- Smaller binary size

**Cons:**
- Missing advanced features (DAG forensics, CBOM, telemetry)
- Need to document feature gaps

**Timeline:** 4-8 hours of effort

---

### Option C: Phased Sync (Balanced Approach)

**Phase 1 (Submit to Iron Bank):**
- ✅ pkg/adinkra/
- ✅ pkg/stigs/
- ✅ pkg/scanners/
- ✅ pkg/compliance/ (for NIST mapping)

**Phase 2 (After Initial Approval):**
- ⏳ pkg/crypto/ (CBOM generation)
- ⏳ pkg/dag/ (forensics)
- ⏳ pkg/telemetry/ (optional reporting)

**Phase 3 (Future Enhancement):**
- 📅 pkg/license/ (if applicable)
- 📅 pkg/net/tailnet/ (mesh networking)

**Timeline:** Phase 1 in 1 day, Phase 2-3 in quarterly updates

---

## 🔐 IP Protection Strategy

### What to Include in Iron Bank Repo

**Option 1: Full Source Code (Open Source Model)**
```
✅ All packages from main repo
✅ Full feature parity
⚠️ Exposes proprietary algorithms (Khepra-PQC, Merkaba)
⚠️ Exposes 36,195-row compliance database
```

**License:** Apache 2.0 with patent grant (per alignment guide)

---

**Option 2: Binary Ingestion (IP Protection Model) ⭐ RECOMMENDED**
```
❌ NO source code in Repo One
✅ Pre-compiled, signed binaries only
✅ Protects proprietary algorithms
✅ Protects compliance database
```

**License:** Government Purpose Rights (DFARS 252.227-7013)

**Implementation:**
1. Build binaries in main repo (giza-cyber-shield)
2. Sign with GPG
3. Upload to release server (https://releases.nouchix.com)
4. Reference in hardening_manifest.yaml (checksums)
5. Dockerfile.ironbank downloads and verifies binaries

**See:** `REPOSITORY_ALIGNMENT_GUIDE.md` Section 4 for detailed binary ingestion pattern

---

## 🚨 Critical Decisions Required

### Decision 1: Source Code vs Binary Ingestion

**Question:** Will you include full source code in the Iron Bank repo?

**Option A: Full Source (Open Source)**
- ✅ Easier hardener review (eyes on code)
- ✅ Standard Iron Bank process
- ❌ Exposes $45M R&D investment

**Option B: Binary Ingestion (IP Protection)**
- ✅ Protects proprietary algorithms
- ✅ Protects compliance database
- ❌ Slower hardener review (binary validation)
- ❌ Requires release infrastructure

**Recommendation:** **Option B (Binary Ingestion)** - protects strategic assets

---

### Decision 2: License for Iron Bank

**Question:** What license will the Iron Bank version use?

**Option A: Apache 2.0 (Open Source)**
- DoD can use freely
- Anyone can fork and redistribute
- Patent grant to all users

**Option B: Government Purpose Rights (Proprietary)**
- DoD can use freely
- No redistribution outside DoD
- Commercial use requires separate license

**Recommendation:** **Option B (GPR)** - aligns with business model

---

### Decision 3: Khepra-PQC Inclusion

**Question:** Include proprietary Khepra-PQC algorithm in Iron Bank submission?

**Option A: Include (Defense-in-Depth)**
- Full 3-layer PQC (Khepra + Dilithium + ECDSA)
- Requires justification for reviewers
- Documents as research/defense-in-depth

**Option B: Exclude (NIST-Only)**
- 2-layer PQC (Dilithium + ECDSA)
- Faster approval (no proprietary crypto questions)
- Still quantum-safe (NIST approved)

**Recommendation:** **Option A (Include)** - document as additive, not replacement

---

### Decision 4: Telemetry/Licensing Features

**Question:** Include telemetry and license enforcement in Iron Bank version?

**Option A: Include (Full Features)**
- Hardware fingerprinting
- License validation
- Optional telemetry beacons
- Requires GPR documentation

**Option B: Exclude (Simplified)**
- No licensing restrictions for DoD
- Purely air-gapped operation
- Simpler hardener review

**Recommendation:** **Option A (Include)** - dormant by default, document air-gapped mode

---

## 📋 Action Plan (Step-by-Step)

### Today (January 13, 2026):

- [ ] **Clone Iron Bank repo locally**
  ```bash
  cd /home/user
  git clone https://github.com/nouchix/adinkhepra-asaf-ironbank.git
  ```

- [ ] **Copy critical packages** (adinkra, stigs, scanners)
  ```bash
  # Use commands from Step 2 above
  ```

- [ ] **Fix import paths**
  ```bash
  # Use automated sed command from Step 4 above
  ```

- [ ] **Test build locally**
  ```bash
  # Use commands from Step 5 above
  ```

---

### This Week (January 13-17, 2026):

- [ ] **Copy supporting packages** (compliance, crypto, dag, etc.)

- [ ] **Update go.mod and vendor dependencies**
  ```bash
  go mod tidy && go mod vendor
  ```

- [ ] **Test Dockerfile build**
  ```bash
  # Use commands from Step 6 above
  ```

- [ ] **Run functional tests**
  ```bash
  docker run --rm adinkhepra:test /scripts/functional-test.sh
  ```

- [ ] **Update hardening_manifest.yaml** with correct file paths and checksums

---

### Next Week (January 20-24, 2026):

- [ ] **Choose IP protection strategy** (Source vs Binary Ingestion)

- [ ] **If Binary Ingestion:**
  - [ ] Build release binaries
  - [ ] GPG sign binaries
  - [ ] Upload to release server
  - [ ] Update hardening_manifest.yaml with URLs

- [ ] **If Full Source:**
  - [ ] Ensure all packages are copied
  - [ ] Update LICENSE to Apache 2.0 (or GPR)
  - [ ] Ensure all tests pass

- [ ] **Commit and push to Iron Bank repo**
  ```bash
  git add .
  git commit -m "feat: sync packages from main repo, fix build errors"
  git push origin main
  ```

---

### Iron Bank Submission (January 27-31, 2026):

- [ ] **Final testing**
- [ ] **Update README.md, LICENSE, CHANGELOG.md**
- [ ] **Submit onboarding request** (if not already done)
- [ ] **Push to Repo One** (after vendor approval)

---

## 🔍 Verification Checklist

Before pushing to Repo One, verify:

### Build Verification
- [ ] All binaries compile without errors
- [ ] No missing package imports
- [ ] All unit tests pass (`go test ./...`)
- [ ] Dockerfile builds successfully
- [ ] Container runs as non-root (UID 1001)
- [ ] Health check passes

### Security Verification
- [ ] No setuid/setgid binaries
- [ ] No world-writable files
- [ ] Static compilation (no dynamic linking)
- [ ] Vendored dependencies (`go mod verify`)
- [ ] No external network calls during build

### Compliance Verification
- [ ] STIG validation works (`sonar --compliance stig`)
- [ ] CBOM generation works (`sonar --generate-cbom`)
- [ ] CVE scanning works (air-gapped mode)
- [ ] PQC signatures verify (Dilithium3)

### Documentation Verification
- [ ] README.md complete
- [ ] LICENSE appropriate (GPR or Apache 2.0)
- [ ] CHANGELOG.md has v1.0.0 entry
- [ ] hardening_manifest.yaml has correct checksums

---

## 📞 Support

### Technical Questions
- **Lead Developer:** SGT Souhimbou Koh Kone (skone@alumni.albany.edu)
- **Technical Support:** cyber@nouchix.com

### Iron Bank Questions
- **Onboarding:** Jeff Goluba (jeffrey.goluba.1.ctr@us.af.mil)
- **General:** ironbank@dso.mil

---

**Last Updated:** January 13, 2026
**Owner:** NouchiX SecRed Knowledge Inc.
**Classification:** UNCLASSIFIED
**Distribution:** Internal use only

---

## 🎯 Success Criteria

**You'll know synchronization is complete when:**
- ✅ All binaries build without errors
- ✅ Docker image builds successfully
- ✅ Functional tests pass
- ✅ No critical CVE findings in local scans
- ✅ Ready to push to Repo One

**Timeline Estimate:** 1-3 days depending on chosen strategy

---

**Next Step:** Clone Iron Bank repo and begin package synchronization! 🚀
