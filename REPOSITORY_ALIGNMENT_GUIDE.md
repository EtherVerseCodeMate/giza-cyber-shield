# Repository Alignment Guide
## Giza Cyber Shield ↔ Adinkhepra ASAF Iron Bank Submission

**Version:** 1.0 (Customized for Actual Implementation)
**Date:** January 13, 2026
**Classification:** UNCLASSIFIED
**Distribution:** Approved for public release. Distribution is unlimited.

---

## Executive Summary

This document establishes the architectural and operational alignment between:

- **Main Project:** [Giza Cyber Shield](https://github.com/EtherVerseCodeMate/giza-cyber-shield)
  *Complete post-quantum attestation platform with KHEPRA Protocol*

- **Iron Bank Submission:** [Adinkhepra ASAF](https://github.com/nouchix/adinkhepra-asaf-ironbank)
  *DoD-compliant containerized security components for Platform One / Iron Bank*

### Key Relationship

```
┌─────────────────────────────────────────┐
│      Giza Cyber Shield (Main)          │
│  Full Security Attestation Platform    │
│  • KHEPRA Protocol Core (3,370+ LOC)   │
│  • React/Next.js Web UI                 │
│  • DAG Visualization                    │
│  • Complete Documentation (100+ docs)  │
│  • Research & Development               │
│  • Proprietary Algorithms               │
└──────────────┬──────────────────────────┘
               │
               │ Binary Extraction & Hardening
               │ (Protects IP, meets DoD compliance)
               ▼
┌─────────────────────────────────────────┐
│   Adinkhepra ASAF Iron Bank Submission  │
│  DoD-Hardened Container Repository      │
│  • Pre-compiled binaries (signed)       │
│  • UBI9-minimal base image              │
│  • Hardened Dockerfile                  │
│  • Security Scans (Anchore, Twistlock)  │
│  • DISA STIG Compliance                 │
│  • Accreditation Documentation          │
└─────────────────────────────────────────┘
```

---

## 1. Component Mapping (Actual Implementation)

### 1.1 Core Component Alignment

| Main Project Component | Location | Iron Bank Equivalent | Deployment Pattern |
|------------------------|----------|---------------------|-------------------|
| **KHEPRA Protocol Engine** | `pkg/adinkra/` (3,370+ LOC) | Binary: `sonar` | Pre-compiled static binary |
| **STIG Validation** | `pkg/stig/` | Binary: `sonar --compliance stig` | Embedded in main binary |
| **Crypto Discovery** | `pkg/crypto/` | Binary: `sonar --scan-crypto` | Embedded in main binary |
| **DAG Forensics** | `pkg/dag/` | Binary: `adinkhepra dag` | Embedded in main binary |
| **Compliance Engine** | `pkg/compliance/` | Binary: `sonar --compliance` | Embedded in main binary |
| **Web UI** | `src/` (Next.js/React) | ❌ Not included | IL2 has separate UIs |
| **Telemetry Server** | `adinkhepra-telemetry-server/` | ❌ Not included | Platform One has monitoring |
| **SpiderFoot Integration** | `tools/spiderfoot/` | ❌ Not included | Third-party tool excluded |

**Key Design Decision:** All functionality is consolidated into **2-3 binaries** (`sonar`, `adinkhepra`, `khepra-daemon`) rather than microservices. This simplifies air-gapped deployment and reduces attack surface.

### 1.2 Technology Stack Correspondence

#### Main Project (Giza Cyber Shield)

```
Backend (Production):
├── Go 1.25.3 (25,414+ LOC in pkg/)
├── Vendored dependencies (17,305 lines in modules.txt)
├── FIPS 140-3 (BoringCrypto when enabled)
└── Static compilation (CGO_ENABLED=0)

Frontend (Development/Demo):
├── Next.js 16.1.1 + React 18.3.1
├── TypeScript 5.7.3
├── Tailwind CSS 3.4.11
├── D3.js 7.9.0 (DAG visualization)
└── Supabase (database integration)

Cryptography:
├── NIST ML-DSA (Dilithium3) - FIPS 204
├── NIST ML-KEM (Kyber-1024) - FIPS 203
├── ECDSA P-384 - FIPS 186-4
├── AES-256-GCM - FIPS 197
├── SHA-3 - FIPS 202
└── Proprietary Khepra-PQC (defense-in-depth)

Infrastructure (Development):
├── Docker + Docker Compose
├── Kubernetes StatefulSet (deployed via Helm)
└── Systemd service files (bare metal)
```

#### Iron Bank Submission (Adinkhepra ASAF)

```
Container Image:
├── Base: registry1.dso.mil/ironbank/redhat/ubi/ubi9-minimal
├── Multi-stage build (builder + runtime)
├── Static Go binaries (CGO_ENABLED=0)
├── Non-root user (UID 1001, GID 0)
├── No setuid/setgid binaries
└── Health check command

Binary Ingestion Pattern:
├── Pre-compiled, signed binaries
├── SHA256 checksums in hardening_manifest.yaml
├── GPG-signed tarball
├── No source code in Repo One (IP protection)
└── Offline build validation

Security Compliance:
├── Twistlock scanning (Platform One)
├── Anchore scanning (Platform One)
├── VAT findings management
├── RHEL-09-STIG-V1R3 compliance
├── OpenSCAP validation
└── Daily CVE monitoring

Platform Integration:
├── Kubernetes StatefulSet (PVC for DAG database)
├── RBAC ClusterRole (least privilege)
├── NetworkPolicy (zero-trust segmentation)
├── Pod Security Standards (restricted)
└── Service mesh integration (Istio compatible)
```

---

## 2. KHEPRA Protocol Implementation Details

### 2.1 Full Implementation (Main Project)

**Location:** `pkg/adinkra/` (3,370+ lines of cryptographic code)

#### Core Cryptographic Layers

```
Layer 3 (Identity Layer - NIST Approved):
├── Dilithium3 (ML-DSA) - FIPS 204
│   └── Use: Signing attestation packages, DAG nodes, audit trails
├── Kyber-1024 (ML-KEM) - FIPS 203
│   └── Use: Key encapsulation for secure channel establishment
└── ECDSA P-384
    └── Use: Classical fallback for legacy system interoperability

Layer 2 (Adinkra Layer - Proprietary):
├── Khepra-PQC (Lattice-based signatures)
│   └── Ring: Z[x]/(x^512+1), modulus q=8380417, rank k=8
├── Merkaba Encryption (White-box cryptography)
│   └── Star tetrahedron geometry with observer-effect entanglement
├── Sephirot Key Derivation (Tree of Life paths)
│   └── 10 archetypal nodes for hierarchical key derivation
└── Sacred Runes (16-symbol alphabet)
    └── Egyptian/Phoenician/Hebrew/Arabic heritage symbols

Layer 1 (Transport Layer - FIPS Validated):
├── BoringCrypto (FIPS 140-3 validated)
├── TLS 1.3
├── AES-256-GCM
└── SHA-3
```

#### Adinkra Mathematics Components

**Sacred Geometry Primitives:**
```go
// pkg/adinkra/lattice.go

// Merkaba (Star Tetrahedron) - Dual-stream encryption
type Merkaba struct {
    SunTetrahedron  [4]Vector3D  // Upward-pointing (masculine)
    EarthTetrahedron [4]Vector3D  // Downward-pointing (feminine)
    RotationAxis    Vector3D     // Central axis
}

// Sephirot (Tree of Life) - Key derivation paths
type Sephirot struct {
    Keter      []byte // Crown - Master key
    Chokmah    []byte // Wisdom - Signing key
    Binah      []byte // Understanding - Encryption key
    Chesed     []byte // Mercy - Session key
    Gevurah    []byte // Strength - Authentication key
    Tiferet    []byte // Beauty - Root certificate
    Netzach    []byte // Victory - Forward secrecy
    Hod        []byte // Splendor - Ephemeral key
    Yesod      []byte // Foundation - Anchor key
    Malkuth    []byte // Kingdom - Derived secret
}

// Hypercube (4D Tesseract) - 16-vertex lattice operations
type Hypercube struct {
    Vertices [16]Point4D
    Edges    [32]Edge4D
    Faces    [24]Face4D
}

// Sacred Runes (Encoding alphabet)
var SacredRunes = [16]string{
    "𓆄", // Khepra (beetle) - transformation
    "𓁹", // Eye of Horus - protection
    "𓋹", // Ankh - life
    // ... 13 more symbols
}
```

**Cryptographic Functions with Adinkra Naming:**
```go
// pkg/adinkra/khepra_pqc.go

// Kuntinkantan ("Do not be arrogant") - Encryption
func Kuntinkantan(plaintext []byte, publicKey *PublicKey) (ciphertext []byte, err error)

// Sankofa ("Go back and get it") - Decryption
func Sankofa(ciphertext []byte, privateKey *PrivateKey) (plaintext []byte, err error)

// Aya (Fern) - Key generation (resilience)
func Aya() (*PublicKey, *PrivateKey, error)

// Dwennimmen (Ram's horns) - Signature verification (strength and humility)
func Dwennimmen(message, signature []byte, publicKey *PublicKey) bool
```

### 2.2 Iron Bank Subset

**What's Included:**
- ✅ NIST PQC layer (Dilithium3, Kyber-1024) - **100% included**
- ✅ FIPS layer (BoringCrypto, TLS 1.3) - **100% included**
- ⚠️ Khepra-PQC layer - **Included as defense-in-depth, not security-critical**
- ❌ Merkaba/Sephirot visualization tools - **Excluded (demo/research only)**

**Rationale:** Iron Bank submission focuses on **operational cryptography** (NIST + FIPS), with Khepra-PQC as a **research layer** that enhances security but isn't required for certification.

### 2.3 Feature Parity Matrix

| Feature | Main Project | Iron Bank | Rationale |
|---------|-------------|-----------|-----------|
| **NIST PQC (Dilithium/Kyber)** | ✅ Full | ✅ Full | Mission-critical, FIPS-approved |
| **FIPS 140-3 Crypto** | ✅ Full | ✅ Full | DoD requirement |
| **Khepra-PQC** | ✅ Full | ✅ Full | Defense-in-depth (documented as research) |
| **STIG Validation** | ✅ Full | ✅ Full | Core compliance feature |
| **CBOM Generation** | ✅ Full | ✅ Full | EO 14028 requirement |
| **DAG Forensics** | ✅ Full | ✅ Full | Immutable audit trails |
| **Web Dashboard** | ✅ Full | ❌ None | Platform One has separate UIs |
| **React Visualization** | ✅ Full | ❌ None | Not needed for IL2 deployment |
| **Telemetry Server** | ✅ Cloudflare Workers | ❌ None | Platform One has monitoring |
| **SpiderFoot OSINT** | ✅ Optional | ❌ None | Third-party tool, not essential |
| **Tailscale Mesh** | ✅ Optional | ❌ None | Air-gapped mode is primary |

---

## 3. Deployment Architecture Comparison

### 3.1 Main Project (Development/Commercial)

```
┌────────────────────────────────────────┐
│   Cloud Provider (AWS/Azure/GCP)       │
│  ┌──────────────────────────────────┐  │
│  │  Kubernetes (EKS/AKS/GKE)        │  │
│  │  ┌────────────────────────────┐  │  │
│  │  │ Namespace: giza-prod       │  │  │
│  │  │  ┌──────────┐ ┌──────────┐ │  │  │
│  │  │  │  sonar   │ │khepra-   │ │  │  │
│  │  │  │  binary  │ │ daemon   │ │  │  │
│  │  │  └──────────┘ └──────────┘ │  │  │
│  │  │  ┌──────────┐              │  │  │
│  │  │  │ Web UI   │ (Next.js)    │  │  │
│  │  │  └──────────┘              │  │  │
│  │  └────────────────────────────┘  │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │  PostgreSQL (for web app state) │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

**Characteristics:**
- Multi-tier architecture (web UI separate from backend)
- Managed database services
- Auto-scaling
- Public internet access (with authentication)

### 3.2 Iron Bank Deployment (Platform One)

```
┌─────────────────────────────────────────┐
│   Platform One (IL2/IL4/IL5/IL6)        │
│  ┌───────────────────────────────────┐  │
│  │  CNCF Kubernetes                  │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ Namespace: mission-app-dev  │  │  │
│  │  │  ┌─────────┐ ┌────────────┐ │  │  │
│  │  │  │ sonar   │ │ Istio      │ │  │  │
│  │  │  │ Pod     │ │ Envoy      │ │  │  │
│  │  │  │ (main)  │ │ (sidecar)  │ │  │  │
│  │  │  └────┬────┘ └──────┬─────┘ │  │  │
│  │  │       │             │        │  │  │
│  │  │       └─────────────┘        │  │  │
│  │  │       mTLS tunnel            │  │  │
│  │  │                              │  │  │
│  │  │  ┌────────────────────────┐ │  │  │
│  │  │  │ PersistentVolumeClaim  │ │  │  │
│  │  │  │ (DAG database storage) │ │  │  │
│  │  │  └────────────────────────┘ │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Service Mesh (Istio)             │  │
│  │  • mTLS between all pods          │  │
│  │  • Zero-trust networking          │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  DoD Monitoring (centralized)     │  │
│  │  • Logs → DoD SIEM                │  │
│  │  • Metrics → Platform One         │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Characteristics:**
- Single-container deployment (no separate web UI)
- StatefulSet (for persistent DAG database)
- Service mesh integration (automatic mTLS)
- CAC authentication (via Platform One gateway)
- Air-gapped operation (no external network calls)

---

## 4. Binary Ingestion Pattern (IP Protection Strategy)

### 4.1 Why Binary Ingestion?

**Problem:** Traditional Iron Bank submission requires uploading **full source code** to Repo One (DoD GitLab).

**Risk:**
- Exposes proprietary algorithms (Khepra-PQC lattice construction)
- Reveals 36,195+ row compliance mapping database
- Compromises $45M R&D investment
- Loses competitive advantage

**Solution:** Binary Ingestion Pattern

```
┌─────────────────────────────────────────┐
│  Main Project (Private)                 │
│  • Full source code                     │
│  • Proprietary algorithms               │
│  • Trade secrets                        │
└──────────────┬──────────────────────────┘
               │
               │ Build & Sign
               ▼
┌─────────────────────────────────────────┐
│  Release Artifacts (Public)             │
│  • Pre-compiled binaries                │
│  • GPG signatures                       │
│  • SHA256 checksums                     │
│  • SBOM (dependencies only)             │
└──────────────┬──────────────────────────┘
               │
               │ Upload to Repo One
               ▼
┌─────────────────────────────────────────┐
│  Iron Bank Repository                   │
│  • Dockerfile (FROM UBI9)               │
│  • hardening_manifest.yaml (checksums)  │
│  • README.md (documentation)            │
│  • NO SOURCE CODE                       │
└─────────────────────────────────────────┘
```

### 4.2 Hardening Manifest Example

```yaml
# hardening_manifest.yaml
resources:
  - filename: adinkhepra-linux-amd64-v1.0.0.tar.gz
    url: https://releases.nouchix.com/adinkhepra/v1.0.0/adinkhepra-linux-amd64-v1.0.0.tar.gz
    validation:
      type: sha256
      value: a3f5c8b2e7d9f1a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2f4a6c8e0b2d4f6a8c0e2
  - filename: adinkhepra-linux-amd64-v1.0.0.tar.gz.sig
    url: https://releases.nouchix.com/adinkhepra/v1.0.0/adinkhepra-linux-amd64-v1.0.0.tar.gz.sig
    validation:
      type: gpg
      value: |
        -----BEGIN PGP SIGNATURE-----
        ...
        -----END PGP SIGNATURE-----
```

### 4.3 Dockerfile (Binary Ingestion)

```dockerfile
# Dockerfile (in Iron Bank repo)
ARG BASE_REGISTRY=registry1.dso.mil
ARG BASE_IMAGE=ironbank/redhat/ubi/ubi9-minimal
ARG BASE_TAG=9.5

FROM ${BASE_REGISTRY}/${BASE_IMAGE}:${BASE_TAG}

USER root

# Install minimal runtime dependencies (if any)
RUN microdnf update -y && \
    microdnf install -y ca-certificates tzdata && \
    microdnf clean all && \
    rm -rf /var/cache/yum

# Download and verify binary artifact
COPY checksums.txt /tmp/
ADD https://releases.nouchix.com/adinkhepra/v1.0.0/adinkhepra-linux-amd64-v1.0.0.tar.gz /tmp/

RUN cd /tmp && \
    sha256sum -c checksums.txt && \
    tar -xzf adinkhepra-linux-amd64-v1.0.0.tar.gz -C /usr/local/bin/ && \
    chmod +x /usr/local/bin/sonar /usr/local/bin/adinkhepra /usr/local/bin/khepra-daemon && \
    rm -rf /tmp/*

# Security hardening
RUN useradd -r -u 1001 -g 0 -s /sbin/nologin khepra && \
    find / -xdev -perm /6000 -type f -exec chmod a-s {} \; && \
    find / -xdev -type f -perm -0002 -exec chmod o-w {} \;

USER 1001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD ["/usr/local/bin/sonar", "--help"] || exit 1

ENTRYPOINT ["/usr/local/bin/sonar"]
CMD ["--help"]
```

**Key Points:**
- No `go build` command (binaries are pre-compiled)
- No source code copying (only binaries)
- Checksum verification enforced
- GPG signature validation (if required)

---

## 5. Compliance & Accreditation Alignment

### 5.1 STIG Implementation (Main Project)

**Location:** `pkg/stig/rhel09_stig.go`

**Implementation:**
- ✅ **RHEL-09-STIG-V1R3** baseline controls (248 controls)
- ✅ **13 custom PQC-specific controls** (CAT I/II/III)

**Custom PQC STIG Controls:**

| STIG ID | Category | Title | Implementation |
|---------|----------|-------|----------------|
| **RHEL-09-PQC-010101** | CAT I | RSA key length validation | `pkg/crypto/discovery.go:validateRSAKeyLength()` |
| **RHEL-09-PQC-010102** | CAT I | ECC curve validation | `pkg/crypto/discovery.go:validateECCCurve()` |
| **RHEL-09-PQC-010103** | CAT I | Hardcoded key detection | `pkg/crypto/discovery.go:scanSourceCode()` |
| **RHEL-09-PQC-010201** | CAT I | CBOM requirement | `pkg/crypto/cbom.go:GenerateCBOM()` |
| **RHEL-09-PQC-010301** | CAT I | Hybrid TLS enforcement | `pkg/crypto/fips.go:EnforceHybridTLS()` |
| **RHEL-09-PQC-020101** | CAT II | Crypto library versioning | `pkg/crypto/discovery.go:LibraryScanner` |
| **RHEL-09-PQC-020102** | CAT II | Credential prevention | `.gitignore` + pre-commit hooks |
| **RHEL-09-PQC-020201** | CAT II | Key rotation policies | `pkg/crypto/rotation.go` (future) |
| **RHEL-09-PQC-020301** | CAT II | PQC staging testing | `pkg/adinkra/khepra_pqc_test.go` |
| **RHEL-09-PQC-020401** | CAT II | Legacy crypto sunset | `pkg/crypto/deprecation.go` (future) |
| **RHEL-09-PQC-030101** | CAT III | Audit logging | `pkg/audit/audit.go` |
| **RHEL-09-PQC-030201** | CAT III | Centralized config | `pkg/config/config.go` |
| **RHEL-09-PQC-030301** | CAT III | Migration rollback | `pkg/crypto/rollback.go` (future) |

**CKL Generation:** Automated checklist generation via `sonar --compliance stig --export-ckl`

### 5.2 NIST 800-53 Mappings

**Location:** `pkg/compliance/nist80053.go`

**Implemented Controls:**

| Control Family | Controls | Implementation |
|----------------|----------|----------------|
| **SC (System & Communications Protection)** | SC-12, SC-13 | Cryptographic key management, PQC protection |
| **SR (Supply Chain Risk Management)** | SR-3, SR-4, SR-11 | SBOM/CBOM generation, supplier assessment |
| **SA (System & Services Acquisition)** | SA-4, SA-8, SA-15 | Acquisition process, security engineering |
| **AU (Audit & Accountability)** | AU-2, AU-6, AU-9 | DAG-based immutable audit trails |
| **IA (Identification & Authentication)** | IA-5, IA-7 | PQC-based authentication |

**CCI Mapping Database:** 36,195 rows in `docs/CCI_to_NIST53.csv`

### 5.3 Iron Bank Accreditation Documents

**Required Documents (Main Project → Iron Bank):**

| Document | Main Project Location | Iron Bank Location | Notes |
|----------|----------------------|-------------------|-------|
| **README.md** | Project root | Repo One root | Product overview |
| **LICENSE** | Project root | Repo One root | Proprietary license |
| **CHANGELOG.md** | Project root | Repo One root | Version history |
| **System Security Plan (SSP)** | `docs/accreditation/SSP.md` | `accreditation/SSP-IronBank.pdf` | Tailored for IL2 |
| **Risk Assessment Report (RAR)** | `docs/risk/assessment.md` | `accreditation/RAR.pdf` | Threat modeling |
| **Security Assessment Report (SAR)** | N/A (generated by Platform One) | `compliance/SAR-Platform-One.pdf` | Post-scanning |
| **Plan of Action & Milestones (POA&M)** | `docs/risk/poam.xlsx` | `accreditation/POAM.xlsx` | CVE remediation plan |
| **STIG Compliance Matrix** | `pkg/stig/rhel09_stig.go` | `compliance/stig-checklist.xlsx` | Automated CKL export |
| **CBOM** | Generated at runtime | `compliance/cbom-adinkhepra-v1.0.0.json` | CycloneDX 1.5 |
| **Container Scan Results** | N/A (local Trivy/Grype) | `compliance/twistlock-results.html` | Platform One scans |

---

## 6. Development Workflow Alignment

### 6.1 Main Project CI/CD (GitHub Actions)

```yaml
# .github/workflows/build.yml
name: Build and Test

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.25.3'

      - name: Vendor dependencies
        run: go mod vendor && go mod verify

      - name: Run tests
        run: make ci-test

      - name: Build binaries
        run: make secure-build

      - name: Scan with Trivy
        run: trivy fs --security-checks vuln,config .

      - name: Build Docker image
        run: docker build -f Dockerfile.ironbank -t adinkhepra:test .

      - name: Run functional tests
        run: docker run --rm adinkhepra:test /scripts/functional-test.sh
```

**Cadence:** Continuous integration (every commit)

### 6.2 Iron Bank Pipeline (Repo One GitLab)

```
┌──────────────┐
│ Git Push     │ (Hardening manifest updated)
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Hardener Review ("Eyes on Code")        │
│ • Manually review Dockerfile            │
│ • Verify checksums in manifest          │
│ • Check for security anti-patterns      │
└──────┬───────────────────────────────────┘
       │ [Approve]
       ▼
┌──────────────────────────────────────────┐
│ Automated Build (Offline)                │
│ • Download binaries from manifest URLs  │
│ • Verify SHA256 checksums                │
│ • Build container (no network access)   │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Dual Scanner (Required)                  │
│ • Twistlock (compliance rules)           │
│ • Anchore (CVE database)                 │
│ • MUST pass BOTH scanners                │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Compliance Validation                    │
│ • OpenSCAP (STIG profiles)               │
│ • Chef InSpec (custom controls)          │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ CVE Approver Review (VAT)                │
│ • Review findings                        │
│ • Validate justifications                │
│ • Accept/Reject mitigations              │
└──────┬───────────────────────────────────┘
       │ [24-hour SLA for Critical CVEs]
       ▼
┌──────────────────────────────────────────┐
│ Authorizing Official (AO) Approval       │
│ • Review risk assessment                 │
│ • Sign POA&M                             │
│ • Grant Authority to Operate (ATO)       │
└──────┬───────────────────────────────────┘
       │ [Approve]
       ▼
┌──────────────────────────────────────────┐
│ Publish to Iron Bank                     │
│ • GPG sign container                     │
│ • Push to registry1.dso.mil              │
│ • Update public Iron Bank catalog        │
└──────────────────────────────────────────┘
```

**Cadence:** Quarterly releases (or urgent CVE response)

**Timeline Estimates:**
- Hardener review: 1-2 weeks
- Automated build: 1 hour
- Dual scanner: 2-4 hours
- CVE justifications: 1-2 weeks
- AO approval: 2-4 weeks
- **Total: 6-8 weeks per release**

---

## 7. Licensing & Intellectual Property

### 7.1 Main Project Licensing

**Current Model:** Trade Secret + Proprietary

**Protection Mechanisms:**
- **18 U.S.C. § 1831-1839 (Economic Espionage Act)** - Federal trade secret protection
- **DMCA § 1201** - Anti-circumvention protection
- **DFARS 252.227-7013 & 7015** - Rights in technical data (DoD contracts)
- **Patent Application Pending** (USPTO) - Khepra-PQC lattice construction

**R&D Investment:** $45,000,000 USD (documented in business plan)

**IP Components:**
- ✅ Khepra-PQC algorithm (lattice-based signature scheme)
- ✅ Merkaba white-box cryptography
- ✅ 36,195+ row compliance mapping database
- ✅ Automated STIG↔CCI↔NIST translation engine
- ✅ DAG forensic visualization

### 7.2 Iron Bank Licensing

**Requirement:** Open source license OR government MOU

**Options:**

**Option A: Dual License (Recommended)**
```
Main Repository (giza-cyber-shield):
├── Proprietary License (default)
└── DoD-specific exception in LICENSE file:
    "Government entities may use this software under
     the terms of the DoD Master License Agreement (MLA)
     dated [DATE] between NouchiX and DISA."
```

**Option B: Apache 2.0 with Patent Grant**
```
Iron Bank Repository (adinkhepra-asaf-ironbank):
├── Apache 2.0 License (open source)
└── NOTICE file (patent grant to DoD):
    "Patent Application [NUMBER] is licensed to the
     United States Government at no cost for use in
     DoD operations."
```

**Option C: Government Purpose Rights (GPR)**
```
DFARS 252.227-7013:
├── DoD has unlimited rights to use, modify, reproduce
├── DoD cannot transfer to non-government entities
└── Commercial use requires separate license
```

**Recommended:** **Option C (GPR)** - Protects commercial IP while allowing DoD use

### 7.3 License Text for Iron Bank (Draft)

```
# LICENSE (for Iron Bank repository)

Copyright (c) 2026 NouchiX SecRed Knowledge Inc.

Government Purpose Rights (GPR)

This software is provided to the United States Government with
Government Purpose Rights as defined in DFARS 252.227-7013.

The Government shall have the right to:
(1) Use, modify, reproduce, release, perform, display, or disclose
    the software within the Government without restriction.
(2) Release or disclose the software outside the Government and
    authorize persons to whom release or disclosure has been made
    to use, modify, reproduce, release, perform, display, or
    disclose the software for United States government purposes.

Restrictions:
• This software may not be used for commercial purposes without
  a separate commercial license from NouchiX SecRed Knowledge Inc.
• Derivative works must maintain this license notice.

For commercial licensing inquiries, contact: business@nouchix.com

DISTRIBUTION STATEMENT A: Approved for public release. Distribution is unlimited.
```

---

## 8. Version Management & Release Cadence

### 8.1 Semantic Versioning (Both Repositories)

**Format:** `MAJOR.MINOR.PATCH` (SemVer 2.0.0)

**Main Project Versioning:**
```
v0.9.x   - Beta (internal testing)
v1.0.0   - Initial production release ✅ CURRENT
v1.1.0   - Quarterly feature update (April 2026)
v1.2.0   - Quarterly feature update (July 2026)
v2.0.0   - Major version with breaking changes (2027)
```

**Iron Bank Versioning:**
```
v1.0.0   - Initial Iron Bank submission ⏳ PREPARING
v1.0.1   - CVE patch (if critical vulnerability found)
v1.1.0   - Aligned with main project v1.1.0 (July 2026)
v2.0.0   - Major version (requires re-accreditation)
```

### 8.2 Version Synchronization Strategy

| Main Project | Iron Bank | Lag Time | Status | Notes |
|--------------|-----------|----------|--------|-------|
| v1.0.0 | v1.0.0 | 0 days | ⏳ Preparing | Initial submission |
| v1.0.1 (hotfix) | v1.0.1 | 1-2 weeks | - | Only if critical CVE |
| v1.1.0 (Q2 2026) | v1.1.0 | 1-2 months | - | Hardening cycle required |
| v1.2.0 (Q3 2026) | v1.1.1 | 3 months | - | Bundled minor changes |
| v2.0.0 (2027) | v2.0.0 | 3-6 months | - | Re-accreditation required |

**Policy:** Iron Bank lags main project by 1-3 months to allow for hardening and accreditation.

### 8.3 Release Checklist

**Main Project Release:**
```bash
# 1. Update version in code
sed -i 's/v1.0.0/v1.1.0/g' pkg/version/version.go

# 2. Update CHANGELOG.md
echo "## [1.1.0] - $(date +%Y-%m-%d)" >> CHANGELOG.md

# 3. Build release binaries
make secure-build

# 4. Calculate checksums
sha256sum bin/* > checksums.txt

# 5. Create release tarball
tar -czf adinkhepra-linux-amd64-v1.1.0.tar.gz bin/ data/ LICENSE README.md

# 6. GPG sign tarball
gpg --detach-sign --armor adinkhepra-linux-amd64-v1.1.0.tar.gz

# 7. Upload to release server
aws s3 cp adinkhepra-linux-amd64-v1.1.0.tar.gz s3://releases.nouchix.com/adinkhepra/v1.1.0/

# 8. Tag in Git
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0
```

**Iron Bank Release:**
```bash
# 1. Update hardening_manifest.yaml with new checksums
vim hardening_manifest.yaml

# 2. Update README.md with new version
sed -i 's/v1.0.0/v1.1.0/g' README.md

# 3. Update CHANGELOG.md
vim CHANGELOG.md

# 4. Commit to Repo One
git add hardening_manifest.yaml README.md CHANGELOG.md
git commit -m "Update to v1.1.0"
git push origin main

# 5. Notify hardener in GitLab issue
# (Hardener will trigger pipeline)

# 6. Monitor VAT for new findings
# (Justify any new CVEs)

# 7. Wait for AO approval
# (Timeline: 2-4 weeks)
```

---

## 9. Operational Considerations

### 9.1 Monitoring & Observability

**Main Project:**
```
Monitoring Stack (Development/Commercial):
├── Prometheus (metrics)
├── Grafana (visualization)
├── Loki (log aggregation)
├── Jaeger (distributed tracing)
└── Alertmanager (notifications)

Custom Telemetry:
├── Cloudflare Workers (telemetry server)
├── Supabase (telemetry database)
└── License validation (hourly heartbeat)
```

**Iron Bank:**
```
Platform One Monitoring (Inherited):
├── Prometheus (centralized)
├── Grafana (centralized dashboards)
├── EFK Stack (Elasticsearch/Fluentd/Kibana)
├── Istio/Kiali (service mesh visualization)
└── DoD SIEM (Splunk/ArcSight) - logs forwarded

ADINKHEPRA-Specific:
├── DAG database metrics (node count, hash power)
├── STIG validation results (compliance percentage)
├── CBOM generation events (new assets discovered)
└── PQC usage telemetry (Dilithium/Kyber signatures)
```

**Key Difference:** Main project has **custom telemetry server**; Iron Bank uses **Platform One infrastructure**.

### 9.2 Incident Response

| Phase | Main Project | Iron Bank |
|-------|-------------|-----------|
| **Detection** | Prometheus alerts | Platform One SIEM + SCSS runtime defense |
| **Triage** | On-call engineer (PagerDuty) | CSSP Tier 2 (DoD cyber operations) |
| **Investigation** | Internal security team | CSSP Tier 3 + NouchiX support |
| **Remediation** | Hot-patch + rolling update | Container rebuild + re-scan + AO approval |
| **Post-Incident** | Internal post-mortem | After-Action Report (AAR) to AO |

**CVE Response SLA:**
- **Critical (CVSS 9.0+):** 24-hour acknowledgment, 72-hour patch
- **High (CVSS 7.0-8.9):** 48-hour acknowledgment, 1-week patch
- **Medium (CVSS 4.0-6.9):** 1-week acknowledgment, quarterly patch

### 9.3 Backup & Disaster Recovery

**Main Project:**
```
Backup Strategy (Development/Commercial):
├── Database: Automated snapshots (daily)
├── DAG database: S3 export (hourly)
├── Container images: Multi-registry push (GHCR + DockerHub)
└── RTO/RPO: 4 hours / 1 hour
```

**Iron Bank:**
```
Backup Strategy (Platform One):
├── Container images: Immutable, stored in Iron Bank (no backup needed)
├── DAG database: PersistentVolume (backed up per mission owner)
├── Configuration: GitOps (declarative YAML in Repo One)
└── RTO/RPO: Inherits from Platform One SLA (mission-dependent)
```

---

## 10. Key Takeaways & Best Practices

### 10.1 Critical Success Factors

1. **Binary Ingestion Protects IP**
   - Main project keeps proprietary source code private
   - Iron Bank gets hardened binaries (transparency without IP loss)

2. **Comprehensive Testing Before Submission**
   - Local Trivy/Grype scans before Repo One submission
   - Functional tests validate actual binary capabilities
   - Air-gapped mode testing ensures offline operation

3. **Proactive CVE Management**
   - Daily monitoring of VAT dashboard
   - Pre-written justifications for common false positives
   - Automated CVE database updates (CISA KEV, NVD)

4. **Document Everything**
   - README.md: User-facing product documentation
   - Accreditation docs: Risk assessment, STIG compliance, POA&M
   - Justifications: CVE false positives with technical rationale

5. **Engage Early with Hardeners**
   - Join Platform One Mattermost community
   - Ask questions before submission (not after rejection)
   - Build relationships with Iron Bank team

### 10.2 Common Pitfalls to Avoid

| Pitfall | Impact | Mitigation |
|---------|--------|-----------|
| **Submitting untested binaries** | Rejected PR | Always test with `docker build -f Dockerfile.ironbank` locally |
| **Missing SHA256 checksums** | Pipeline failure | Automate checksum calculation: `sha256sum bin/* > checksums.txt` |
| **Not documenting air-gapped mode** | Concerns from reviewers | Add `--no-external` flag documentation in README.md |
| **Using non-STIG base images** | Immediate rejection | Always start with `registry1.dso.mil/ironbank/redhat/ubi/ubi9-minimal` |
| **Ignoring VAT findings** | Conditional ATO (with time limit) | Respond to all findings within 24 hours (even if "investigating") |
| **Bundling third-party tools** | Additional review burden | Exclude SpiderFoot, Tailscale (if unused) via `.dockerignore` |

### 10.3 Decision Tree: Feature Inclusion

```
Is this feature needed for core mission?
├── Yes → Is it DoD-compliant?
│   ├── Yes → Include in Iron Bank
│   └── No → Document as future enhancement
│
└── No (nice-to-have) → Is it a security risk?
    ├── Yes → Exclude from Iron Bank
    └── No → Include but mark as optional
```

**Example Applications:**
- **Web UI:** Not core mission → Exclude
- **STIG validation:** Core mission → Include
- **Tailscale mesh:** Nice-to-have, potential security concern → Exclude
- **CBOM generation:** Core mission, DoD requirement → Include

---

## 11. Timeline & Milestones

### 11.1 Main Project Roadmap (2026)

**Q1 2026 (January-March):**
- ✅ KHEPRA Protocol v1.0 release (completed)
- ✅ DAG visualization ("Living Trust Constellation") operational
- ⏳ Iron Bank submission preparation (in progress)
- ⏳ Complete STIG compliance documentation
- 📅 Target: Iron Bank submission by January 31, 2026

**Q2 2026 (April-June):**
- Iron Bank hardening cycle (awaiting AO approval)
- Partnership discussions with STIG Viewer API (MoxyWolf)
- NIST PQC webinar series (community engagement)
- Version 1.1.0 feature release (enhanced DAG analytics)

**Q3 2026 (July-September):**
- Iron Bank v1.1.0 release (synchronized with main project)
- CMMC Level 3 assessment preparation
- Federal civilian agency pilot programs
- Research paper publication (PQC migration strategies)

**Q4 2026 (October-December):**
- Patent approval (expected)
- ISO 27001 certification
- Defense contractor pilot deployments
- Annual re-accreditation planning

### 11.2 Iron Bank Submission Timeline

**Week 1-2 (Preparation):**
- ✅ Finalize README.md, LICENSE, CHANGELOG.md
- ✅ Calculate SHA256 checksums for all binaries
- ✅ Create hardening_manifest.yaml
- ✅ Test Dockerfile build locally
- ✅ Prepare accreditation documents (SSP, RAR, STIG matrix)

**Week 3-4 (Submission):**
- Submit onboarding request to Iron Bank
- Request vendor subgroup in Repo One
- Upload hardening artifacts
- Notify hardener team

**Week 5-6 (Hardener Review):**
- Hardener "eyes on code" review
- Address feedback (if any)
- Dockerfile approval

**Week 7-8 (Automated Pipeline):**
- Offline build validation
- Twistlock + Anchore dual scan
- OpenSCAP STIG validation
- Initial VAT findings generated

**Week 9-12 (CVE Justifications):**
- Review VAT findings
- Document false positives
- Submit justifications
- CVE approver review

**Week 13-16 (AO Approval):**
- Risk assessment review
- POA&M negotiation
- Authority to Operate (ATO) decision
- Conditional ATO (if findings remain)

**Week 17-24 (Continuous Monitoring):**
- Daily CVE scans
- Monthly re-validation
- Quarterly feature updates
- Annual re-accreditation

**Total Timeline:** **6-8 months** for initial approval (typical for complex systems)

### 11.3 Synchronization Checkpoints

| Milestone | Main Project | Iron Bank | Dependencies |
|-----------|-------------|-----------|--------------|
| **v1.0.0 GA** | ✅ Completed | ⏳ Submission pending | None |
| **Iron Bank Approval** | N/A | 📅 Target: Q2 2026 | Hardener review, AO approval |
| **v1.1.0 Feature Release** | 📅 April 2026 | 📅 July 2026 | Iron Bank v1.0.0 approved |
| **CMMC Level 3** | 📅 Q3 2026 | 📅 Q4 2026 | Iron Bank operational |
| **Patent Approval** | 📅 Q4 2026 | Immediate | Update LICENSE file |
| **v2.0.0 Major Release** | 📅 Q1 2027 | 📅 Q3 2027 | Re-accreditation required |

---

## 12. Appendices

### Appendix A: Acronym Glossary

| Acronym | Definition |
|---------|-----------|
| **ASAF** | Agentic Security Attestation Framework |
| **CBOM** | Cryptographic Bill of Materials |
| **CSSP** | Cyber Security Service Provider |
| **DAG** | Directed Acyclic Graph |
| **DCCSCR** | DoD Centralized Container Source Code Repository |
| **DISA** | Defense Information Systems Agency |
| **FIPS** | Federal Information Processing Standards |
| **IL** | Impact Level (2, 4, 5, 6) |
| **JWICS** | Joint Worldwide Intelligence Communications System |
| **ML-DSA** | Module-Lattice-Based Digital Signature Algorithm (Dilithium) |
| **ML-KEM** | Module-Lattice-Based Key Encapsulation Mechanism (Kyber) |
| **NIPR** | Non-Classified Internet Protocol Router Network |
| **PQC** | Post-Quantum Cryptography |
| **SBOM** | Software Bill of Materials |
| **SIPR** | Secret Internet Protocol Router Network |
| **STIG** | Security Technical Implementation Guide |
| **UBI** | Universal Base Image (Red Hat) |
| **VAT** | Vulnerability Assessment Tracker |

### Appendix B: Reference Documentation

1. **DoD Enterprise DevSecOps Reference Design: CNCF Kubernetes v2.1** (September 2021)
2. **Iron Bank Container Hardening Process Guide V1R2** (August 2022)
3. **NIST IR 8547: Transition to Post-Quantum Cryptography Standards** (December 2024)
4. **NIST FIPS 203/204/205: ML-KEM, ML-DSA, SLH-DSA** (August 2024)
5. **RHEL-09-STIG-V1R3: Red Hat Enterprise Linux 9 Security Technical Implementation Guide**
6. **DFARS 252.227-7013: Rights in Technical Data - Non-Commercial Software**
7. **EO 14028: Improving the Nation's Cybersecurity** (May 2021)
8. **Platform One Documentation:** https://p1.dso.mil

### Appendix C: Contact Information

**Main Project (Giza Cyber Shield):**
- **Repository:** https://github.com/EtherVerseCodeMate/giza-cyber-shield
- **Company:** NouchiX SecRed Knowledge Inc.
- **Lead Developer:** SGT Souhimbou Doh Kone
- **Email:** skone@alumni.albany.edu
- **Business:** business@nouchix.com
- **Support:** cyber@nouchix.com

**Iron Bank Submission (Adinkhepra ASAF):**
- **Repository:** https://github.com/nouchix/adinkhepra-asaf-ironbank (to be created)
- **Repo One:** https://repo1.dso.mil/dsop/nouchix/adinkhepra (pending approval)
- **Iron Bank:** https://ironbank.dso.mil (after approval)
- **VAT:** https://vat.dso.mil
- **Platform One Contact:** ironbank@dso.mil

**DoD Points of Contact:**
- **Iron Bank Onboarding:** Jeff Goluba (jeffrey.goluba.1.ctr@us.af.mil)
- **Platform One Community:** https://chat.p1.dso.mil (Mattermost)

---

**Document Control:**
- **Version:** 1.0 (Customized)
- **Author:** SGT Souhimbou Doh Kone, NouchiX SecRed Knowledge Inc.
- **Reviewed By:** Claude Sonnet 4.5 (AI-assisted documentation)
- **Date:** January 13, 2026
- **Next Review Date:** April 13, 2026 (quarterly)
- **Classification:** UNCLASSIFIED
- **Distribution:** Approved for public release. Distribution is unlimited.

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-13 | S. Kone | Initial customized version based on actual implementation |

---

**End of Document**
