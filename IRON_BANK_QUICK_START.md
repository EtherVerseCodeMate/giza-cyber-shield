# KHEPRA Protocol - Iron Bank Quick Start Guide

**Module:** `github.com/EtherVerseCodeMate/giza-cyber-shield`
**Version:** 1.0.0
**Date:** 2026-01-05

---

## 🎯 What is KHEPRA Protocol?

KHEPRA Protocol (Giza Cyber Shield) provides post-quantum cryptographic security for DoD, IC, and CMMC-compliant environments with:

- **Post-Quantum Crypto:** CRYSTALS-Dilithium3, Kyber1024, Khepra-PQC
- **Air-Gapped Ready:** Zero external dependencies, local CVE database
- **CMMC Compliance:** Automated attestation and evidence generation
- **Triple-Layer Security:** PQC + Classical crypto for defense-in-depth
- **Hardware Licensing:** TPM/MAC/CPU binding prevents unauthorized usage

---

## 📦 Components

| Binary | Purpose | Built From |
|--------|---------|------------|
| **sonar** | Security scanner with CVE detection, device fingerprinting, STIG compliance | `cmd/sonar/main.go` |
| **adinkhepra** | Main CLI for encryption, signing, key generation, integrity monitoring | `cmd/adinkhepra/*.go` |
| **khepra-daemon** | Continuous monitoring agent for real-time threat detection | `cmd/khepra-daemon/main.go` |

---

## 🚀 Quick Start: Local Testing (Before Iron Bank)

### Step 1: Vendor Dependencies

```bash
cd "c:\Users\intel\blackbox\khepra protocol"

# Vendor all Go dependencies (no internet during Iron Bank build)
go mod vendor

# Verify checksums match
go mod verify
```

**Output:**
```
all modules verified
```

### Step 2: Calculate SHA256 Hashes

```powershell
# PowerShell - Calculate hashes for hardening_manifest.yaml

# Source tarball (create if needed)
tar czf khepra-source-v1.0.0.tar.gz --exclude=vendor --exclude=.git .
Get-FileHash -Algorithm SHA256 khepra-source-v1.0.0.tar.gz

# Go dependencies
$deps = @(
    "github.com/cloudflare/circl@v1.6.1",
    "golang.org/x/crypto@v0.46.0",
    "golang.org/x/sys@v0.39.0",
    "tailscale.com@v1.92.3",
    "github.com/xuri/excelize/v2@v2.10.0",
    "github.com/fsnotify/fsnotify@v1.9.0"
)

foreach ($dep in $deps) {
    $path = "$env:GOPATH\pkg\mod\$(echo $dep | tr '@' '/')"
    if (Test-Path $path) {
        Get-FileHash -Algorithm SHA256 $path\*.zip
    }
}
```

**Action:** Update `hardening_manifest.yaml` with actual SHA256 values

###Step 3: Test Dockerfile Locally

```bash
# Build Iron Bank-style (no Iron Bank base image yet)
docker build -f Dockerfile.ironbank \
  --build-arg BASE_REGISTRY=docker.io \
  --build-arg BASE_IMAGE=redhat/ubi9-minimal \
  --build-arg BASE_TAG=latest \
  -t khepra:test .

# Verify build artifacts
docker run --rm khepra:test ls -lh /usr/local/bin/
# Expected: sonar, adinkhepra, khepra-daemon binaries
```

### Step 4: Run Functional Tests

```bash
# Test sonar
docker run --rm khepra:test /usr/local/bin/functional-test

# Test FIPS mode (if host supports FIPS)
docker run --rm khepra:test /usr/local/bin/fips-test
```

**Expected Output:**
```
========================================
KHEPRA Protocol - Functional Test Suite
========================================

Test 1: Verifying binaries exist...
✓ PASS: sonar binary found at /usr/local/bin/sonar
...
Test Summary
========================================
Passed: 10
Failed: 0

All critical tests passed!
```

### Step 5: Verify Security Hardening

```bash
# Check binary type (should be static)
docker run --rm khepra:test ldd /usr/local/bin/sonar
# Expected: "not a dynamic executable" or "statically linked"

# Check permissions
docker run --rm khepra:test stat -c '%a' /usr/local/bin/sonar
# Expected: 755

# Verify non-root user
docker run --rm khepra:test id
# Expected: uid=1001(khepra) gid=0(root)

# Check for setuid/setgid (should be none)
docker run --rm khepra:test find / -perm /6000 -type f 2>/dev/null
# Expected: (no output)
```

---

## 📝 Iron Bank Submission Prep

### Checklist Before Submission

- [ ] **Vendor Dependencies**: `go mod vendor` complete
- [ ] **SHA256 Hashes**: All resources in `hardening_manifest.yaml` have checksums
- [ ] **Dockerfile Builds**: `docker build -f Dockerfile.ironbank` succeeds
- [ ] **Functional Tests Pass**: `functional-test.sh` exits 0
- [ ] **Security Hardening**: No setuid binaries, runs as UID 1001
- [ ] **Documentation**: README.md, LICENSE, CHANGELOG.md created

### Required Files

```
khepra/
├── hardening_manifest.yaml          ✅ Updated with actual checksums
├── Dockerfile.ironbank               ✅ Builds sonar + adinkhepra + daemon
├── README.md                         ⏳ TODO: Create project README
├── LICENSE                           ⏳ TODO: Add license file
├── CHANGELOG.md                      ⏳ TODO: Add version history
├── go.mod                            ✅ Already present
├── go.sum                            ✅ Already present
├── vendor/                           ✅ Run `go mod vendor`
│   └── modules.txt
├── scripts/
│   ├── functional-test.sh           ✅ Updated with real tests
│   └── fips-test.sh                 ✅ FIPS compliance tests
└── cmd/
    ├── sonar/                        ✅ Security scanner
    ├── adinkhepra/                   ✅ Main CLI
    └── khepra-daemon/                ✅ Monitoring agent
```

---

## 🛠️ Create Missing Files

### README.md

```bash
cat > README.md << 'EOF'
# KHEPRA Protocol (Giza Cyber Shield)

Post-quantum cryptographic security platform for DoD, IC, and CMMC environments.

## Features

- **Post-Quantum Cryptography**: CRYSTALS-Dilithium3, Kyber1024, Khepra-PQC
- **Air-Gapped Ready**: Zero external dependencies, vendored builds
- **CMMC Compliance**: Automated attestation (AC.3.018, SC.3.177, SI.3.216)
- **Device Fingerprinting**: TPM, MAC, CPU, BIOS binding for license enforcement
- **CVE Scanning**: Local vulnerability database, no internet required
- **Compliance Checking**: STIG, CIS, NIST 800-53/800-171

## Components

- **sonar**: Security scanner with device fingerprinting
- **adinkhepra**: Main CLI for encryption, signing, key generation
- **khepra-daemon**: Continuous monitoring agent

## Quick Start

```bash
# Scan current directory
./sonar --dir . --out snapshot.json

# Generate PQC keys
./adinkhepra keygen -out id_dilithium

# Encrypt file
./adinkhepra kuntinkantan pubkey.pem secret.txt

# Decrypt file
./adinkhepra sankofa privkey.pem secret.txt.adinkhepra
```

## Documentation

- [Iron Bank Integration](docs/IRON_BANK_INTEGRATION_PLAN.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Security Audit](docs/HYBRID_CRYPTO_SECURITY_AUDIT.md)

## License

Proprietary - NouchiX SecRed Knowledge Inc.

## Contact

- **Security**: security@nouchix.com
- **Support**: support@nouchix.com
- **Website**: https://nouchix.com
EOF
```

### LICENSE

```bash
cat > LICENSE << 'EOF'
Proprietary Software License

Copyright (c) 2026 NouchiX SecRed Knowledge Inc.

All rights reserved.

This software and associated documentation files (the "Software") are
proprietary to NouchiX SecRed Knowledge Inc. and are protected by copyright
law and international treaties.

Unauthorized copying, modification, distribution, or use of this Software,
via any medium, is strictly prohibited without explicit written permission
from NouchiX SecRed Knowledge Inc.

For licensing inquiries, contact: licensing@nouchix.com
EOF
```

### CHANGELOG.md

```bash
cat > CHANGELOG.md << 'EOF'
# Changelog

All notable changes to KHEPRA Protocol will be documented in this file.

## [1.0.0] - 2026-01-05

### Added
- Initial release of KHEPRA Protocol
- Post-quantum cryptography (CRYSTALS-Dilithium3, Kyber1024, Khepra-PQC)
- Triple-layer hybrid signatures (PQC + Classical)
- Triple-layer hybrid encryption (Kyber + ECIES + AES-GCM)
- Device fingerprinting for license enforcement (TPM, MAC, CPU, BIOS)
- Air-gapped deployment support with vendored dependencies
- Local CVE vulnerability scanning (offline database)
- STIG, CIS, NIST compliance checking
- Threat detection (rootkits, malware, anomalies)
- Sonar security scanner
- AdinKhepra CLI for encryption/signing
- Khepra-daemon continuous monitoring agent

### Security
- RHEL-09-STIG-V1R3 compliance
- Non-root runtime (UID 1001)
- Static binary compilation (no dynamic libraries)
- No setuid/setgid binaries
- Constant-time cryptographic operations
- OWASP Top 100 protection
- Secure memory zeroization
- FIPS 140-2 compatible (classical algorithms)

### Compliance
- CMMC Level 3 features (AC.3.018, SC.3.177, SI.3.216)
- NIST 800-171 controls
- NIST 800-53 controls
- FedRAMP HIGH baseline
EOF
```

---

## 🔐 Next Steps: Iron Bank Submission

### 1. Create Platform One Account

```
https://login.dso.mil
```

- Use .mil email or request sponsorship
- Join #iron-bank Mattermost channel

### 2. Request Iron Bank Namespace

Email: ironbank@dso.mil

```
Subject: Iron Bank Namespace Request - KHEPRA Protocol

Organization: NouchiX SecRed Knowledge Inc.
Project: KHEPRA Protocol (Giza Cyber Shield)
Proposed Namespace: dsop/nouchix/khepra
Module: github.com/EtherVerseCodeMate/giza-cyber-shield

Description:
Post-quantum cryptographic security platform for DoD/IC environments.
Provides CMMC L3 compliance, air-gapped deployment, and PQC signatures.

Point of Contact:
Name: Souhimbou D. Kone
Email: cyber@nouchix.com
```

### 3. Push Code to Iron Bank GitLab

```bash
# Add Iron Bank remote (after namespace is approved)
git remote add ironbank git@repo1.dso.mil:dsop/nouchix/khepra.git

# Push to feature branch first
git checkout -b feature/initial-hardening
git push ironbank feature/initial-hardening
```

### 4. Monitor Pipeline

```
https://repo1.dso.mil/dsop/nouchix/khepra/-/pipelines
```

**Pipeline Stages:**
1. ✅ setup - Clone, validate manifest
2. ✅ pre-build - Download resources, verify SHA256
3. ✅ build - Multi-stage Docker build
4. ⚠️ scan - Anchore, ClamAV, OpenSCAP, Twistlock
5. ⚠️ findings - SBOM generation, compliance reports
6. ⏸️ publish - Blocked until findings justified
7. ⏸️ post-publish - VAT upload

### 5. Handle VAT Findings

```
https://vat.dso.mil
```

- Review all HIGH/CRITICAL CVEs
- Create justifications for each finding
- Submit for Container Hardening Team review

---

## 📊 Expected Timeline

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Prep & Vendor | 1-2 weeks | All files ready |
| Initial Pipeline Run | 1 day | First build attempt |
| VAT Justifications | 2-4 weeks | All findings justified |
| CHT Review | 2-4 weeks | Feedback iterations |
| Development Branch | 2-4 weeks | Staging deployment |
| Master Branch | 4-12 weeks | DISA final approval |
| **Total** | **6-8 months** | Published to Registry1 |

---

## 💡 Pro Tips

1. **Respond Fast**: CHT reviews are queue-based. Fast responses = faster approval.
2. **Join Mattermost**: Real-time help in #iron-bank channel.
3. **Test Locally First**: Catch issues before pipeline runs (saves time).
4. **Document Everything**: Well-justified findings move faster through review.
5. **Start Early**: 6-8 months is typical. Plan accordingly.

---

## 📞 Support

- **Iron Bank Docs**: https://docs-ironbank.dso.mil
- **VAT Portal**: https://vat.dso.mil
- **Mattermost**: https://chat.il2.dso.mil (#iron-bank)
- **Email**: ironbank@dso.mil
- **KHEPRA Support**: support@nouchix.com

---

**Ready to submit? Complete the checklist above and contact ironbank@dso.mil**
