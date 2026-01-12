# KHEPRA Protocol - Iron Bank Integration Plan

**Date:** 2026-01-05
**Status:** Ready for Submission
**Timeline:** 6-12 months to full approval

---

## Executive Summary

This document outlines the complete strategy for integrating KHEPRA Protocol into DoD's Iron Bank registry, leveraging the Security Automation Framework for Enterprise (SAFE) to accelerate DoD procurement and ensure CMMC compliance.

**Expected Benefits:**
- 40% faster DoD procurement velocity
- Automatic CMMC evidence generation
- Supply chain security built-in
- Air-gapped deployment model validated
- Multi-classification level support

---

## Phase 1: Iron Bank Submission (Weeks 1-4)

### 1.1 Create Hardening Manifest

**File:** `hardening_manifest.yaml`

**Required Fields:**
```yaml
name: adinkhepra
version: 1.0.0
maintainers:
  - name: Souhimbou D. Kone
    email: souhimbou.d.kone.mil@army.mil
base_image: registry1.dso.mil/ironbank/redhat/ubi/ubi9-minimal
stigs_applied:
  - RHEL-09-STIG-V1R3
enable_compliance_scans:
  fedramp: true
  cis: true
  nist: true
```

**All resources must include SHA256 hashes:**
- Source code tarball
- Go dependencies (vendored)
- PQC libraries

### 1.2 Build Hardened Dockerfile

**Requirements:**
- Multi-stage build (builder + runtime)
- Non-root user (UID 1001)
- Minimal attack surface (no setuid binaries)
- Static binary with `-trimpath` and `-ldflags="-s -w"`
- Security labels for OpenShift/Kubernetes

**Critical:**
```dockerfile
USER 1001
HEALTHCHECK CMD ["/usr/local/bin/khepra", "health"]
```

### 1.3 Functional Testing Scripts

**Files:**
- `scripts/functional-test.sh` - Verify core functionality
- `scripts/fips-test.sh` - FIPS mode validation

**Tests:**
- Binary execution
- License enforcement
- Gatekeeper module availability
- PQC crypto (Dilithium3, Kyber1024)

### 1.4 Repository Structure

```
khepra/
├── hardening_manifest.yaml          ✅ REQUIRED
├── Dockerfile                        ✅ REQUIRED
├── Dockerfile.arm64                  ✅ OPTIONAL (multi-arch)
├── README.md                         ✅ REQUIRED
├── LICENSE                           ✅ REQUIRED
├── CHANGELOG.md                      ✅ RECOMMENDED
├── scripts/
│   ├── functional-test.sh
│   └── fips-test.sh
├── vendor/                          ✅ Go dependencies
└── justifications/                  ✅ VAT findings
```

---

## Phase 2: PQC License Integration (Weeks 5-8)

### 2.1 Enhanced License Format

**File:** JSON-based license with PQC + cosign dual signatures

**Key Features:**
- CRYSTALS-Dilithium3 signature (post-quantum)
- Cosign bundle (SAFE compatibility)
- in-toto attestation predicate
- VAT integration fields
- Image digest binding

**Critical Fields:**
```json
{
  "supply_chain_security": {
    "container_image": {
      "registry": "registry1.dso.mil/ironbank/nouchix/khepra",
      "digest": "sha256:...",
      "cosign_verified": true,
      "vat_attestation_verified": true
    }
  },
  "vat_integration": {
    "max_critical_cves": 0,
    "max_high_cves": 5,
    "abc_status_required": "PASS"
  }
}
```

### 2.2 License Validation Logic

**Components:**
1. Verify PQC signature (Dilithium3)
2. Verify image digest matches deployed container
3. Fetch VAT attestation from Harbor
4. Check ABC/ORA compliance
5. Enforce node count via coordinator

**Implementation:**
```go
// pkg/license/vat_validator.go
func (v *VATValidator) ValidateWithVAT() error {
    // 1. Verify PQC license signature
    // 2. Verify deployed image matches licensed image
    // 3. Verify VAT attestation exists and is valid
    // 4. Check ABC/ORA compliance from VAT
    // 5. Check critical findings
}
```

---

## Phase 3: Pipeline Integration (Weeks 9-12)

### 3.1 GitLab CI/CD Variables

**Set in Iron Bank GitLab project:**
```yaml
ENABLE_REPORT_FEDRAMP: "true"
ENABLE_REPORT_CIS: "true"
ENABLE_REPORT_NIST: "true"
ENABLE_RF: "true"              # RapidFort RBOM
ENABLE_TIDELIFT: "true"        # SBOM analysis
BUILD_ARM64: "true"            # Multi-arch
```

### 3.2 Pipeline Stages (Auto-Generated)

1. **setup** - Clone repo, validate manifest
2. **pre-build** - Download resources, verify checksums
3. **build** - Multi-stage Docker build (AMD64 + ARM64)
4. **scan** - Anchore, ClamAV, OpenSCAP, Twistlock
5. **findings** - Generate SBOM, compliance reports
6. **publish** - Push to Registry1, sign with cosign
7. **post-publish** - VAT upload, documentation

### 3.3 Expected Artifacts

- **SBOM:** SPDX, CycloneDX, Syft JSON
- **Compliance:** FedRAMP, CIS, NIST 800-53/800-190
- **Signatures:** Cosign attestations
- **Documentation:** CSV findings, justifications

---

## Phase 4: Air-Gapped Update Distribution (Weeks 13-16)

### 4.1 Offline Update Bundle

**Tools:**
- `oras` - OCI registry artifact storage
- `skopeo` - OCI image copy (no Docker daemon)

**Bundle Contents:**
```
khepra-update-v1.1.0.tar.gz
├── images/
│   └── khepra:v1.1.0 (OCI format)
├── metadata/
│   ├── sbom.spdx.json
│   ├── in-toto-metadata/*.link
│   └── vat-attestation.json
├── tools/
│   ├── verify-signature
│   ├── license-validator
│   └── license-renew
└── manifest.json (signed with Dilithium3)
```

### 4.2 Customer Transfer Process

1. **NIPR (Internet)** → Generate update bundle, sign with PQC
2. **CDS Transfer** → Encrypted USB via secure courier
3. **SIPR (Air-Gapped)** → Load into Harbor, verify signatures
4. **Deployment** → Kubernetes pulls from local Harbor

**Security:**
- Bundle signed with Dilithium3
- USB encrypted with AES-256-GCM
- Phone verification before delivery

---

## Phase 5: CMMC Evidence Automation (Weeks 17-20)

### 5.1 Grafeas Integration

**Purpose:** Store all security metadata (SBOM, CVEs, licenses, access logs)

**Schema:**
```yaml
# grafeas-config.yaml
sbom-tracking:
  - timestamp: 2026-01-05T10:00:00Z
    image: khepra:v1.0.0
    sbom_url: harbor.local/sbom/khepra-v1.0.0.spdx.json
    vulnerabilities: 0_critical, 2_high, 5_medium

license-tracking:
  - timestamp: 2026-01-05T10:05:00Z
    node: khepra-node-23
    license_id: LIC-2026-001234
    validation: PASSED

access-control:
  - timestamp: 2026-01-05T11:00:00Z
    user: admin@53signal.mil
    action: attest_create
    result: ALLOWED
```

### 5.2 Auto-Generated CMMC Reports

**Supported Controls:**
- **AC.3.018** - Audit record generation
- **SC.3.177** - Cryptographic protection (PQC signatures)
- **SI.3.216** - Monitor communications at boundaries

**Export Command:**
```bash
khepra compliance export \
  --controls AC.3.018,SC.3.177,SI.3.216 \
  --format pdf \
  --output cmmc-evidence-$(date +%Y%m%d).pdf \
  --sign-with /etc/khepra/compliance-signing.key
```

---

## Phase 6: Multi-Classification Support (Weeks 21-24)

### 6.1 Federated License Coordinator

**Architecture:**
```
NIPR (Unclass)
  └─ License Coordinator (tracks all issued licenses)
      ↓ (One-way CDS guard)
SIPR (Secret)
  └─ KHEPRA Fleet (250 nodes) + Local Coordinator
      ↓ (One-way CDS guard)
JWICS (Top Secret)
  └─ KHEPRA Critical Systems (50 nodes) + Local Coordinator
```

**Key Features:**
- Each classification level has independent license
- Local coordinators enforce node count
- Status reports flow upward via CDS (one-way)
- License renewal bundles flow downward

### 6.2 License Binding Methods

**Option 1: Coordinator Pool** (Recommended)
- All nodes register with local coordinator
- Coordinator enforces max_nodes from license
- Hardware fingerprinting prevents cloning

**Option 2: Per-Node Licenses**
- Each node has unique license
- Bound to TPM/hardware ID
- More tedious but strongest enforcement

---

## Critical Success Factors

### ✅ Must-Have Before Submission

1. **Hardening Manifest Complete**
   - All resources listed with SHA256 hashes
   - STIG compliance documented
   - Security contact specified

2. **Functional Tests Pass**
   - `functional-test.sh` succeeds
   - `fips-test.sh` succeeds (if applicable)
   - License enforcement verified

3. **Documentation Complete**
   - README.md with deployment instructions
   - CHANGELOG.md with version history
   - Justifications for any pre-existing CVEs

4. **Vendor Dependencies Locked**
   - All Go modules vendored
   - No dynamic downloads during build
   - Reproducible builds verified

### ⚠️ Common Pitfalls to Avoid

1. **Missing SHA256 Hashes** - Pipeline will fail in pre-build
2. **Root User in Runtime** - OpenSCAP STIG scan will fail
3. **Setuid Binaries** - Security scan will flag as critical
4. **External Network Calls** - Build must be 100% offline
5. **Unjustified Findings** - VAT will block publish stage

---

## ROI Analysis

| Investment | Benefit | Timeline |
|------------|---------|----------|
| Iron Bank submission (80 hrs) | +40% DoD procurement velocity | 6-12 months |
| in-toto pipeline (40 hrs) | CMMC SC.3.177 compliance auto | 1 month |
| Grafeas integration (60 hrs) | Auto-generate audit reports | 2 months |
| CDS pattern (120 hrs) | Enable multi-classification sales | 3-6 months |
| Harbor deployment guide (20 hrs) | -50% customer onboarding time | 1 month |

**Total Investment:** 320 hours (~$50K at billable rate)
**Expected Return:** 3-5x revenue multiplier via DoD channels

---

## Immediate Action Items

### This Week:
- [ ] Review hardening_manifest.yaml template
- [ ] Vendor all Go dependencies (`go mod vendor`)
- [ ] Create functional test scripts (reference: TC 25-ADINKHEPRA-001, Section 3-5)
- [ ] Draft Iron Bank README.md (based on TC 25-ADINKHEPRA-001 Chapter 1-3)

### Next Week:
- [ ] Build hardened Dockerfile
- [ ] Test multi-stage build locally
- [ ] Generate SHA256 hashes for all resources
- [ ] Set up GitLab project on repo1.dso.mil

### Month 1:
- [ ] Submit to Iron Bank (start 6-month approval clock)
- [ ] Implement Dilithium3 license signing/verification
- [ ] Create offline update bundle tooling
- [ ] Draft VAT justifications template

### Month 2:
- [ ] Integrate in-toto attestations
- [ ] Deploy Grafeas for metadata storage
- [ ] Create CMMC evidence export tool
- [ ] Build coordinator node enforcement

### Month 3:
- [ ] Implement federated coordinator pattern
- [ ] Build CDS transfer workflows
- [ ] Create Platform One deployment guides
- [ ] Train sales team on SAFE value prop

---

## Support Resources

### Internal Documentation
- **TC 25-ADINKHEPRA-001** (Training Circular): Army-standard operator manual with complete installation, operation, and troubleshooting procedures
  - Chapter 1: System Overview & Architecture
  - Chapter 2: Technical Implementation (PQC, Database, Deployment Models)
  - Chapter 3: Installation Procedures (Container + Binary methods)
  - Chapter 4: Operator Procedures (STIG scanning, encryption, Genesis backups)
  - Chapter 5: Troubleshooting & Support
  - Appendices: Database schema, compliance mappings, example reports

### Iron Bank Documentation
- Pipeline: https://docs-ironbank.dso.mil/quickstart/pipeline/
- Hardening Guide: https://repo1.dso.mil/dsop/dccscr
- VAT User Guide: https://vat.dso.mil/docs

### Platform One
- Main Site: https://p1.dso.mil
- GitLab: https://repo1.dso.mil
- Harbor Registry: https://registry1.dso.mil
- Mattermost Support: https://chat.il2.dso.mil

### Contact
- **Iron Bank Support:** ironbank@dso.mil
- **Platform One Support:** https://p1.dso.mil/support
- **NouchiX Technical:** cyber@nouchix.com

---

**Last Updated:** 2026-01-05
**Owner:** Souhimbou D. Kone
**Status:** Ready for Implementation
