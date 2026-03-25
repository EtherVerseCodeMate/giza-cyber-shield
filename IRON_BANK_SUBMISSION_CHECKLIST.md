# Iron Bank Submission Checklist for KHEPRA Protocol

**Version:** 1.0
**Date:** 2026-01-05
**Status:** Pre-Submission

---

## 📋 Required Files

### Core Requirements
- [x] `hardening_manifest.yaml` - Main configuration file
- [x] `Dockerfile.ironbank` - Hardened multi-stage build
- [ ] `README.md` - Project documentation
- [ ] `LICENSE` - Software license file
- [ ] `CHANGELOG.md` - Version history
- [ ] `scripts/functional-test.sh` - Functional testing
- [ ] `scripts/fips-test.sh` - FIPS mode testing

### Source Code
- [ ] All source code vendored (no external downloads during build)
- [ ] `go.mod` and `go.sum` present
- [ ] `vendor/` directory populated with all dependencies
- [ ] SHA256 hashes calculated for all resources

### Documentation
- [ ] `docs/IRON_BANK_INTEGRATION_PLAN.md` - Integration strategy
- [ ] Security contact specified
- [ ] Hardening notes documented

---

## ✅ Pre-Submission Checklist

### Step 1: Vendor Dependencies
```bash
cd "c:\Users\intel\blackbox\khepra protocol"
go mod vendor
go mod verify
```

**Verify:**
- [ ] `vendor/` directory contains all Go modules
- [ ] No external network calls during build

### Step 2: Calculate SHA256 Hashes

For each resource in `hardening_manifest.yaml`:
```bash
# Windows PowerShell
Get-FileHash -Algorithm SHA256 khepra-source-v1.0.0.tar.gz

# Linux/macOS
sha256sum khepra-source-v1.0.0.tar.gz
```

**Update:** Replace all `REPLACE_WITH_ACTUAL_SHA256` in `hardening_manifest.yaml`

### Step 3: Test Dockerfile Locally

```bash
# Build multi-stage
docker build -f Dockerfile.ironbank -t khepra:test .

# Run functional tests
docker run --rm khepra:test /scripts/functional-test.sh

# Verify non-root user
docker run --rm khepra:test id
# Expected: uid=1001(khepra) gid=0(root)

# Check for setuid binaries (should be none)
docker run --rm khepra:test find / -perm /6000 -type f
```

### Step 4: Create README.md

Must include:
- [ ] Project description
- [ ] Features and capabilities
- [ ] Deployment instructions
- [ ] Configuration examples
- [ ] License information
- [ ] Security contact

### Step 5: Create LICENSE File

- [ ] Specify license type (Proprietary for KHEPRA)
- [ ] Include copyright notice
- [ ] Terms of use

### Step 6: Create CHANGELOG.md

Format:
```markdown
# Changelog

## [1.0.0] - 2026-01-05

### Added
- Initial release
- Post-quantum cryptography (Dilithium3, Kyber1024)
- License enforcement with gatekeeper
- CMMC compliance features
- Air-gapped deployment support

### Security
- RHEL-09-STIG-V1R3 compliance
- Non-root runtime (UID 1001)
- Static binary compilation
- No setuid/setgid binaries
```

---

## 🔐 Security Hardening Verification

### Binary Checks
```bash
# Verify static compilation
ldd /usr/local/bin/khepra
# Expected: "not a dynamic executable" or "statically linked"

# Check permissions
stat -c '%a' /usr/local/bin/khepra
# Expected: 755 or 750

# Verify no setuid/setgid
find /usr/local/bin -perm /6000 -type f
# Expected: (no output)
```

### Runtime Checks
```bash
# Verify non-root execution
docker run --rm khepra:test whoami
# Expected: khepra (not root)

# Check writable directories
docker run --rm khepra:test ls -ld /var/lib/khepra /var/log/khepra
# Expected: drwxrwxr-x (group writable for OpenShift compatibility)
```

### STIG Compliance
- [ ] No world-writable files
- [ ] No setuid/setgid binaries
- [ ] Non-root runtime user
- [ ] Minimal package installation
- [ ] No unnecessary services

---

## 📦 GitLab Repository Setup

### Create Repository on repo1.dso.mil

1. Navigate to https://repo1.dso.mil
2. Create new project: `dsop/nouchix/khepra`
3. Set visibility: Private (initially)
4. Enable CI/CD

### Configure GitLab Variables

**Navigate to:** Settings → CI/CD → Variables

**Add these variables:**
```
ENABLE_REPORT_FEDRAMP: true
ENABLE_REPORT_CIS: true
ENABLE_REPORT_NIST: true
ENABLE_RF: true
ENABLE_TIDELIFT: true
BUILD_ARM64: true
```

### Push Code

```bash
git remote add ironbank git@repo1.dso.mil:dsop/nouchix/khepra.git
git push ironbank main
```

---

## 🧪 Pipeline Testing

### Initial Pipeline Run

After pushing code, Iron Bank pipeline will automatically run:

**Expected Stages:**
1. ✅ **setup** - Clone repo, validate manifest
2. ✅ **pre-build** - Download resources, verify SHA256
3. ✅ **build** - Multi-stage Docker build
4. ⚠️ **scan** - Anchore, ClamAV, OpenSCAP, Twistlock
5. ⚠️ **findings** - Generate SBOM, compliance reports
6. ⏸️ **publish** - Blocked until approved
7. ⏸️ **post-publish** - VAT upload

### Handle Findings

**Anchore Scan:**
- Review CVE findings in VAT
- Create justifications for accepted risks
- Update `justifications/` directory

**OpenSCAP STIG Scan:**
- Fix any RHEL-09-STIG violations
- Document exceptions in hardening notes

**Twistlock/Prisma Scan:**
- Address compliance violations
- Verify no critical findings

---

## 📝 VAT (Vulnerability Assessment Tracker)

### Access VAT

1. Navigate to https://vat.dso.mil
2. Find your project: `khepra`
3. Review findings from pipeline scans

### Justify Findings

For each HIGH or CRITICAL CVE:

**Create justification file:**
```markdown
# CVE-2024-XXXXX

**Component:** github.com/example/package
**CVSS:** 8.5
**Status:** ACCEPTED
**Justification:**
This CVE affects functionality not used by KHEPRA. The vulnerable code path is not reachable in our deployment configuration.

**Evidence:**
- Code analysis shows function `vulnerableFunc()` is never called
- Static analysis confirms no import of affected module

**Mitigation Plan:**
Upgrade to patched version in next release (2026-02-01)

**Risk Assessment:**
LOW - Unexploitable in KHEPRA's use case
```

Upload to VAT and mark as "JUSTIFIED"

---

## 🚀 Approval Process

### Iron Bank Review

**Timeline:** 6-12 months

**Stages:**
1. **Initial Review** (Week 1-2)
   - Hardening manifest validation
   - Dockerfile review
   - STIG compliance check

2. **Security Scan Review** (Week 3-6)
   - VAT findings assessment
   - Justification review
   - ABC/ORA scoring

3. **Functional Testing** (Week 7-10)
   - Pipeline functional tests
   - FIPS mode tests
   - Integration testing

4. **Final Approval** (Week 11-24)
   - DISA approval
   - Publication to Registry1
   - Documentation upload

### Accelerate Approval

**Best Practices:**
- Respond to feedback within 24-48 hours
- Keep findings justified promptly
- Maintain clean CI/CD pipeline (all green)
- Engage with Iron Bank team on Mattermost

---

## 📊 Success Metrics

### Pipeline Health
- [ ] All stages passing (green)
- [ ] Zero critical CVEs unjustified
- [ ] ABC status: PASS
- [ ] ORA score: <50 (lower is better)

### Compliance
- [ ] RHEL-09-STIG: 100% compliant
- [ ] FedRAMP report: No HIGH findings
- [ ] CIS Benchmark: Level 1 passed
- [ ] NIST 800-53: All controls addressed

### Documentation
- [ ] README published to ironbank.dso.mil
- [ ] SBOM available in Registry1
- [ ] Attestations signed with cosign

---

## 🆘 Troubleshooting

### Common Issues

**Problem:** "Resource SHA256 mismatch"
**Solution:** Recalculate hash, update `hardening_manifest.yaml`

**Problem:** "Dockerfile uses external network"
**Solution:** All dependencies must be in `hardening_manifest.yaml` or vendored

**Problem:** "OpenSCAP STIG failures"
**Solution:** Review failed checks, apply RHEL-09-STIG hardening

**Problem:** "Image runs as root"
**Solution:** Ensure `USER 1001` in Dockerfile runtime stage

**Problem:** "Setuid binaries found"
**Solution:** Add cleanup step to remove setuid bits

### Get Help

- **Iron Bank Support:** ironbank@dso.mil
- **Mattermost:** https://chat.il2.dso.mil/login
- **Documentation:** https://docs-ironbank.dso.mil
- **VAT Help:** https://vat.dso.mil/docs

---

## 📅 Timeline Estimate

| Milestone | Duration | Cumulative |
|-----------|----------|------------|
| Prepare submission files | 1-2 weeks | 2 weeks |
| Initial pipeline run | 1 day | 2 weeks |
| Fix findings, create justifications | 2-4 weeks | 6 weeks |
| Iron Bank initial review | 2-4 weeks | 10 weeks |
| Security review iterations | 4-8 weeks | 18 weeks |
| DISA final approval | 4-12 weeks | 30 weeks |

**Total:** 6-8 months to full approval (typical)

---

## ✅ Final Pre-Submission Checklist

Before clicking "Submit for Review":

- [ ] All SHA256 hashes calculated and verified
- [ ] Dockerfile builds successfully locally
- [ ] Functional tests pass
- [ ] FIPS tests pass (if applicable)
- [ ] No setuid/setgid binaries
- [ ] Non-root runtime user (UID 1001)
- [ ] README.md complete
- [ ] LICENSE file present
- [ ] CHANGELOG.md created
- [ ] Security contact specified
- [ ] GitLab repository created
- [ ] Pipeline runs successfully
- [ ] All findings justified in VAT
- [ ] Team ready to respond to feedback

---

**Ready to submit?** Contact Iron Bank team: ironbank@dso.mil

**Questions?** Review documentation: https://docs-ironbank.dso.mil

**Last Updated:** 2026-01-05
