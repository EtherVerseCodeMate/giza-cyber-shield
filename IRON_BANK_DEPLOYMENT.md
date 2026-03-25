# Iron Bank Deployment Guide - AdinKhepra Protocol

## Mission Objective
Achieve **Certificate to Field (CtF)** by hardening the AdinKhepra binary into the DoD Iron Bank repository.

**Target Repository:** `registry1.dso.mil` (Iron Bank)
**Classification:** UNCLASSIFIED (initially), capable of SIPR/JWICS deployment via "Low-to-High" transfer

---

## Overview

AdinKhepra uses the **Binary Ingestion** pattern for Iron Bank. As a commercial vendor, you can ingest pre-compiled, signed binaries without uploading proprietary source code to Repo One.

---

## Phase 1: Registration & Access

### 1.1 Register at Repo One
- Create account at **[repo1.dso.mil](https://repo1.dso.mil)**
- This is the DoD's GitLab instance

### 1.2 Request Vendor Subgroup
Open an "Onboarding" issue in the **ironbank/dccscr** project:
- **Vendor Name:** NouchiX SecRed Knowledge Inc.
- **Product Name:** AdinKhepra SONAR
- **Contact:** cyber@nouchix.com

### 1.3 Repository Structure
Once approved, your repository will be:
```
adinkhepra/
├── Dockerfile                # Build instructions
├── hardening_manifest.yaml   # External artifact definitions
├── LICENSE                   # Your EULA
├── README.md                 # Product documentation
└── scripts/                  # Bootstrap scripts (if needed)
```

---

## Phase 2: Building the Container

### 2.1 Local Build (Development)
```bash
# Build the Go binaries
make build

# Build the Iron Bank container (simulated locally)
docker build -t adinkhepra:local .

# Test the container
docker run --rm adinkhepra:local --help
```

### 2.2 Iron Bank Build (Production)
Iron Bank will:
1. Fetch binaries from `hardening_manifest.yaml` resources
2. Verify SHA256 checksums
3. Build container using UBI9-minimal base
4. Scan with Twistlock and Anchore
5. Generate SBOM

### 2.3 Binary Release Preparation
Before submitting to Iron Bank:

```bash
# Build release binaries
./build-release.sh

# Generate SHA256 hashes
sha256sum bin/khepra bin/khepra-agent bin/sonar > checksums.txt

# Create release tarball
tar -czf adinkhepra-linux-amd64.tar.gz bin/ data/ LICENSE README.md

# Calculate tarball hash (update hardening_manifest.yaml)
sha256sum adinkhepra-linux-amd64.tar.gz
```

---

## Phase 3: Vulnerability Assessment

### 3.1 Scanning Process
Once code is pushed to repo1, the pipeline runs:
- **Twistlock** - Container security scanning
- **Anchore** - Vulnerability analysis
- **VAT** (Vulnerability Assessment Tracker) - Finding management

### 3.2 Vulnerability Assessment Tracker (VAT)
Access findings at **[vat.dso.mil](https://vat.dso.mil)**

#### Common Findings & Justifications:

**Base Image CVEs:**
- **Status:** Inherited from UBI9
- **Justification:** "Inherited from Approved Base Image (registry1.dso.mil/redhat/ubi/ubi9-minimal)"
- **Action:** Bulk-justify as "Approved Base"

**Go Runtime CVEs:**
- **Example:** CVE-2023-XXXXX in `net/http`
- **Options:**
  1. Recompile with patched Go version
  2. Justify if not applicable (e.g., "HTTP/2 disabled in air-gapped mode")

**Custom Binary Findings:**
- Most will be **false positives** (Go binaries often misidentified)
- Justify with: "Static analysis false positive - binary is compiled Go, not scripted language"

### 3.3 24-Hour Rule
- **Critical CVEs** require acknowledgment within 24 hours
- Set up automated monitoring of VAT dashboard

---

## Phase 4: Continuous Monitoring

### 4.1 Daily Scans
Iron Bank scans your image nightly for new CVEs

### 4.2 Update Process
When a new vulnerability is discovered:
1. Assess impact on AdinKhepra
2. Create patch/update if needed
3. Upload new binary version
4. Update `hardening_manifest.yaml` with new SHA256
5. Trigger rebuild in Repo One

### 4.3 Automation Hook
```bash
# Future integration: Auto-check VAT APIs
khepra audit vat-sync --token $VAT_API_TOKEN
```

---

## Phase 5: Deployment to Air-Gapped Environments

### 5.1 OCI Bundle Export
```bash
# Pull approved image from Iron Bank
docker pull registry1.dso.mil/nouchix/adinkhepra:v2.0.0

# Export as OCI tarball
docker save registry1.dso.mil/nouchix/adinkhepra:v2.0.0 -o adinkhepra-ironbank.tar

# Transfer to air-gapped network via sneakernet
# (USB drive, DVD, classified courier)
```

### 5.2 Import on SIPR/JWICS
```bash
# On air-gapped system
docker load -i adinkhepra-ironbank.tar

# Run security scan
docker run --rm -v /target:/scan adinkhepra:v2.0.0 \
    sonar --dir /scan --compliance stig --out /scan/results.json
```

---

## Security Hardening Checklist

### ✅ Completed
- [x] Non-root execution (UID 1001)
- [x] Minimal base image (UBI9-minimal)
- [x] Health check endpoint
- [x] No hardcoded secrets
- [x] FIPS 140-2 compatible base
- [x] Post-quantum cryptography (Dilithium3, Kyber-1024)
- [x] Zero external dependencies
- [x] Air-gap capability

### 🔄 In Progress
- [ ] Complete VAT justifications
- [ ] Automated CVE monitoring
- [ ] SBOM auto-generation integration

### 📋 Future Enhancements
- [ ] Multi-arch support (ARM64)
- [ ] Attestation signing with Sigstore
- [ ] Runtime STIG compliance verification

---

## Resources

- **Repo One (GitLab):** https://repo1.dso.mil/
- **Iron Bank Documentation:** https://docs-ironbank.dso.mil/
- **VAT Dashboard:** https://vat.dso.mil/
- **Platform One Community:** https://p1.dso.mil/
- **Container Hardening Guide:** Available in Repo One docs

---

## Support

**Vendor:** NouchiX SecRed Knowledge Inc.
**Contact:** cyber@nouchix.com
**Technical Lead:** SGT Souhimbou Kone
**Clearance:** Secret (Active)

---

## Classification

**DISTRIBUTION STATEMENT A:** Approved for public release. Distribution is unlimited.

---

## Notes

This deployment strategy ensures you sell a **product** (the binary), not your **IP** (the source code), while meeting the DoD's strictest "Zero Trust" supply chain requirements.

The binary ingestion model protects proprietary algorithms (Khepra-PQC lattice construction) while providing full transparency for security validation.
