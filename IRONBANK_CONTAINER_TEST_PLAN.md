# Iron Bank Container Deployment - Testing Plan

**Date**: 2026-01-05
**Objective**: Validate container readiness for Iron Bank submission
**Target**: 100% pass rate on all critical tests

---

## Test Execution Phases

### Phase 1: Local Build Verification (30 minutes)
- Build Dockerfile.ironbank locally
- Verify binary presence and execution
- Check file permissions and ownership
- Validate health check endpoint

### Phase 2: Security Hardening Validation (45 minutes)
- Non-root user verification (UID 1001)
- No setuid/setgid binaries
- Minimal attack surface (no shell, no package manager)
- Static linking verification (no CGO dependencies)

### Phase 3: Functional Testing (1 hour)
- Run all 15 functional tests from scripts/functional-test.sh
- Test PQC key generation
- Test STIG .CKL generation
- Test compliance translation engine

### Phase 4: Integration Testing (1 hour)
- Test with sample STIG data
- Validate .CKL output format
- Verify compliance mapping accuracy
- Test air-gap mode (no network calls)

### Phase 5: Iron Bank Pipeline Simulation (30 minutes)
- Simulate Iron Bank build stages
- Check for pipeline blockers
- Validate healthcheck passes

---

## Test Suite 1: Container Build

### Test 1.1: Build from Dockerfile.ironbank

```bash
# Navigate to project root
cd "c:\Users\intel\blackbox\khepra protocol"

# Build Iron Bank container
docker build -f Dockerfile.ironbank -t khepra:ironbank-test .

# Expected: Build succeeds with no errors
# Success criteria: Exit code 0
```

### Test 1.2: Inspect Container Layers

```bash
# Inspect image
docker inspect khepra:ironbank-test

# Verify:
# - User: 1001:0
# - Healthcheck present
# - No secrets in environment variables
# - No unnecessary ports exposed
```

### Test 1.3: Container Size Check

```bash
# Check image size
docker images khepra:ironbank-test

# Expected: <500MB (minimal base + static binaries)
# Iron Bank prefers smaller images (attack surface reduction)
```

---

## Test Suite 2: Binary Verification

### Test 2.1: Binary Presence

```bash
# Run container and check binaries
docker run --rm khepra:ironbank-test ls -la /usr/local/bin/

# Expected output:
# -rwxr-xr-x 1 1001 0 [size] sonar
# -rwxr-xr-x 1 1001 0 [size] adinkhepra
# -rwxr-xr-x 1 1001 0 [size] khepra-daemon
```

### Test 2.2: Binary Execution

```bash
# Test each binary
docker run --rm khepra:ironbank-test sonar --help
docker run --rm khepra:ironbank-test adinkhepra --help
docker run --rm khepra:ironbank-test khepra-daemon --help

# Expected: Help text displays, exit code 0
```

### Test 2.3: Static Linking Verification

```bash
# Check for dynamic library dependencies
docker run --rm khepra:ironbank-test ldd /usr/local/bin/sonar || echo "Static binary (good)"
docker run --rm khepra:ironbank-test ldd /usr/local/bin/adinkhepra || echo "Static binary (good)"

# Expected: "not a dynamic executable" or "statically linked"
# Iron Bank requirement: Minimize external dependencies
```

---

## Test Suite 3: Security Hardening

### Test 3.1: Non-Root User Verification

```bash
# Check running user
docker run --rm khepra:ironbank-test id

# Expected output:
# uid=1001 gid=0(root)
# Note: GID=0 is OpenShift-compatible (required for Iron Bank)
```

### Test 3.2: No Setuid/Setgid Binaries

```bash
# Find setuid/setgid binaries (should be none)
docker run --rm khepra:ironbank-test find / -perm /6000 -type f 2>/dev/null

# Expected output: (empty)
# Iron Bank blocker: Any setuid/setgid binary is a critical finding
```

### Test 3.3: Minimal Attack Surface

```bash
# Verify no shell
docker run --rm khepra:ironbank-test which bash || echo "No bash (good)"
docker run --rm khepra:ironbank-test which sh || echo "No sh (good)"

# Verify no package manager
docker run --rm khepra:ironbank-test which yum || echo "No yum (good)"
docker run --rm khepra:ironbank-test which dnf || echo "No dnf (good)"

# Expected: All commands fail (binaries not present)
```

### Test 3.4: Secrets Scanning

```bash
# Check for hardcoded secrets
docker run --rm khepra:ironbank-test env

# Expected: No API keys, passwords, or tokens in environment
# Should only see: PATH, HOME, USER
```

---

## Test Suite 4: Functional Testing

### Test 4.1: Health Check Endpoint

```bash
# Start container with healthcheck
docker run -d --name khepra-test khepra:ironbank-test

# Wait for healthcheck
sleep 10

# Check health status
docker inspect --format='{{.State.Health.Status}}' khepra-test

# Expected: "healthy"
# Iron Bank requirement: Healthcheck must pass within 30 seconds

# Cleanup
docker rm -f khepra-test
```

### Test 4.2: Sonar Fingerprinting

```bash
# Test device fingerprinting
docker run --rm -v "$(pwd):/scan" khepra:ironbank-test \
    sonar fingerprint --output /scan/fingerprint-test.json

# Expected: fingerprint-test.json created with device data
# Check file exists
ls -lh fingerprint-test.json
```

### Test 4.3: PQC Key Generation

```bash
# Test Dilithium3 key generation
docker run --rm -v "$(pwd):/keys" khepra:ironbank-test \
    adinkhepra keygen --identity "ironbank-test" --output /keys/test-keys

# Expected: Public and private keys generated
# Check files exist
ls -lh test-keys/
```

### Test 4.4: STIG Checklist Generation

```bash
# Test .CKL generation
docker run --rm -v "$(pwd):/scan" khepra:ironbank-test \
    adinkhepra stig generate --input /scan/sample-findings.json --output /scan/test-stig.ckl

# Expected: test-stig.ckl created in valid DISA format
# Validate XML structure
cat test-stig.ckl | grep "<CHECKLIST>" || echo "ERROR: Invalid .CKL format"
```

---

## Test Suite 5: Compliance Mapping

### Test 5.1: Verify CSV Files Present

```bash
# Check compliance mapping library
docker run --rm khepra:ironbank-test ls -lh /app/docs/

# Expected files:
# - CCI_to_NIST53.csv
# - STIG_CCI_Map.csv
# - NIST53_to_171.csv
# - STIG_to_CMMC_Complete_Map.csv
# - STIG_to_NIST171_Mapping_Ultimate.csv
```

### Test 5.2: Test Compliance Translation

```bash
# Test cross-framework mapping
docker run --rm khepra:ironbank-test \
    adinkhepra translate --stig-id V-260001 --output json

# Expected: JSON output with CCI, NIST 800-53, NIST 800-171, CMMC mappings
```

---

## Test Suite 6: Air-Gap Mode

### Test 6.1: No Network Calls (Default)

```bash
# Run container with no network
docker run --rm --network none khepra:ironbank-test \
    adinkhepra scan --target /etc --offline

# Expected: Scan completes successfully without network
# Iron Bank requirement: Must work in disconnected environments
```

### Test 6.2: Tailscale Dormant Verification

```bash
# Verify Tailscale does not activate
docker run --rm --network none khepra:ironbank-test \
    timeout 30 tcpdump -i any -n 'host controlplane.tailscale.com' 2>/dev/null || echo "No network activity (good)"

# Expected: No packets to controlplane.tailscale.com
# Proves runtime gate works (no TAILSCALE_AUTH_KEY = no network)
```

---

## Test Suite 7: Iron Bank Pipeline Simulation

### Test 7.1: Setup Stage

```bash
# Simulate Iron Bank setup
docker build --target builder -f Dockerfile.ironbank -t khepra:builder .

# Expected: Builder stage completes with vendored dependencies
```

### Test 7.2: Build Stage

```bash
# Verify build artifacts
docker run --rm khepra:builder ls -lh /build/

# Expected:
# - sonar binary
# - adinkhepra binary
# - khepra-daemon binary
```

### Test 7.3: Scan Stage (Simulated)

```bash
# Iron Bank runs Anchore/Grype/Trivy scans
# Simulate with local Trivy

docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    aquasec/trivy image --severity HIGH,CRITICAL khepra:ironbank-test

# Expected: Zero HIGH or CRITICAL vulnerabilities
# Note: Iron Bank will block on any critical CVEs
```

---

## Test Suite 8: Performance Validation

### Test 8.1: Startup Time

```bash
# Measure container startup time
time docker run --rm khepra:ironbank-test sonar --version

# Expected: <5 seconds
# Iron Bank prefers fast startup (reduces attack window)
```

### Test 8.2: Memory Footprint

```bash
# Run container and check memory usage
docker stats --no-stream khepra-test

# Expected: <512MB memory usage
# Iron Bank requirement: Document resource limits
```

---

## Test Suite 9: Compliance Evidence Generation

### Test 9.1: Generate Complete Compliance Report

```bash
# Full compliance scan
docker run --rm -v "$(pwd):/scan" khepra:ironbank-test \
    adinkhepra scan --target /etc --compliance pqc stig nist800-53 cmmc --output /scan/full-compliance-report.json

# Expected: JSON with findings mapped to all frameworks
```

### Test 9.2: Export CMMC Evidence

```bash
# Generate CMMC Level 3 report
docker run --rm -v "$(pwd):/scan" khepra:ironbank-test \
    adinkhepra cmmc export --input /scan/full-compliance-report.json --level 3 --output /scan/cmmc-level3.pdf

# Expected: PDF report for CMMC assessor
```

---

## Critical Success Criteria

### ✅ **MUST PASS** (Iron Bank Blockers)

| Test | Status | Priority | Blocker? |
|------|--------|----------|----------|
| Container builds successfully | ⏳ | P0 | ✅ YES |
| Runs as non-root (UID 1001) | ⏳ | P0 | ✅ YES |
| No setuid/setgid binaries | ⏳ | P0 | ✅ YES |
| Static binaries (no CGO) | ⏳ | P0 | ✅ YES |
| Healthcheck passes | ⏳ | P0 | ✅ YES |
| Zero critical CVEs | ⏳ | P0 | ✅ YES |
| Air-gap mode works | ⏳ | P0 | ✅ YES |
| No hardcoded secrets | ⏳ | P0 | ✅ YES |

### ⚠️ **SHOULD PASS** (Iron Bank Warnings)

| Test | Status | Priority | Blocker? |
|------|--------|----------|----------|
| Image size <500MB | ⏳ | P1 | ❌ NO |
| Startup time <5s | ⏳ | P1 | ❌ NO |
| Memory <512MB | ⏳ | P1 | ❌ NO |
| Functional tests pass (15/15) | ⏳ | P1 | ❌ NO |

---

## Execution Plan

### Step 1: Build Container (Now)

```bash
cd "c:\Users\intel\blackbox\khepra protocol"
docker build -f Dockerfile.ironbank -t khepra:ironbank-test .
```

### Step 2: Run Critical Tests (Next)

```bash
# Test 1: Non-root user
docker run --rm khepra:ironbank-test id

# Test 2: Binary execution
docker run --rm khepra:ironbank-test sonar --help

# Test 3: No setuid binaries
docker run --rm khepra:ironbank-test find / -perm /6000 -type f 2>/dev/null

# Test 4: Healthcheck
docker run -d --name khepra-test khepra:ironbank-test
sleep 30
docker inspect --format='{{.State.Health.Status}}' khepra-test
docker rm -f khepra-test
```

### Step 3: Functional Tests

```bash
# Run functional test suite
docker run --rm -v "$(pwd):/test" khepra:ironbank-test \
    bash /test/scripts/functional-test.sh
```

### Step 4: Generate Test Report

```bash
# Create test evidence for Iron Bank submission
echo "Iron Bank Container Test Report" > test-report.md
echo "Date: $(date)" >> test-report.md
echo "" >> test-report.md
echo "## Test Results" >> test-report.md
# ... (results from above tests)
```

---

## Known Issues & Mitigations

### Issue 1: Windows Docker Build

**Problem**: Dockerfile uses Linux base (UBI9-minimal), may have issues on Windows Docker

**Mitigation**: Use WSL2 backend for Docker Desktop

**Command**:
```powershell
# Verify WSL2 backend
docker info | findstr "Operating System"

# Should show: Operating System: Docker Desktop (WSL2)
```

### Issue 2: Volume Mount Permissions

**Problem**: Windows paths may not mount correctly in Linux container

**Mitigation**: Use `/c/Users/intel/...` format or WSL paths

**Example**:
```bash
# Bad (Windows path)
docker run -v "C:\Users\intel\scan:/scan" khepra:ironbank-test

# Good (WSL path)
docker run -v "/c/Users/intel/blackbox/khepra protocol:/scan" khepra:ironbank-test
```

---

## Test Evidence Collection

For Iron Bank submission, we need to provide:

1. **Build Logs**: Full Docker build output
2. **Test Results**: All test pass/fail status
3. **Security Scan**: Trivy/Grype/Anchore output (zero criticals)
4. **Functional Evidence**: Screenshots of working features
5. **Healthcheck Logs**: Proof healthcheck passes

**Storage**: Create `ironbank-test-evidence/` directory with all artifacts

---

## Next Steps

**Immediate**:
1. Run `docker build -f Dockerfile.ironbank -t khepra:ironbank-test .`
2. Execute critical tests (Suite 1-3)
3. Document any failures

**Short-term** (if tests pass):
1. Run full functional suite
2. Generate compliance reports
3. Create test evidence package

**Medium-term** (if tests fail):
1. Fix blockers
2. Re-test
3. Update Dockerfile.ironbank as needed

---

**Ready to start testing?** Let me know if you want to begin with the Docker build or if you need me to adjust any tests for Windows environment.

---

**Document Status**: ✅ Complete
**Priority**: 🔴 **CRITICAL** - Required for Iron Bank submission
**Owner**: SGT Souhimbou Kone
**Last Updated**: 2026-01-05
