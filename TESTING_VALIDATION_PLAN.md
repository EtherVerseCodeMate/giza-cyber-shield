# ADINKHEPRA Iron Bank - Testing & Validation Plan

**Status**: Private Repository - Pre-Publication Testing Phase
**Repository**: `nouchix/adinkhepra-asaf-ironbank` (PRIVATE)
**Last Updated**: 2026-01-09

---

## 🎯 Testing Strategy

**Goal**: Validate repository is production-ready before making public and submitting to Iron Bank.

**Phases**:
1. **Intel Brief Review** - Verify alignment with strategic objectives
2. **Debug Testing** - Functional correctness of all components
3. **Validation Testing** - STIG compliance, security hardening, Iron Bank requirements
4. **Final Sign-Off** - Make repository public, submit to Iron Bank

---

## Phase 1: Intel Brief - Repository Parameter Review

### Strategic Objectives Verification

**Option C Implementation** ✅
- [ ] Verify public CSVs included (CCI_to_NIST53.csv, NIST53_to_171.csv)
- [ ] Verify proprietary STIG_CCI_Map.csv excluded (28,639 rows protected)
- [ ] Verify no pkg/agi/, pkg/llm/, pkg/license/ in repository
- [ ] Verify clear Community vs Enterprise messaging

**Dark Crypto Database Strategy** ✅
- [ ] Verify telemetry architecture is public (transparent)
- [ ] Verify telemetry keys are excluded (build-time injection only)
- [ ] Verify opt-in model documented (privacy-compliant)
- [ ] Verify Dilithium3 PQC signatures prevent metric spoofing

**Competitive Moat Protection** ✅
- [ ] Verify .dockerignore uses generic exclusions (no "HIGH VALUE" comments)
- [ ] Verify no Intel Brief strategy documents in repository
- [ ] Verify no dollar valuations mentioned ($45M, $150M, etc.)
- [ ] Verify enterprise offering hinted, not detailed

**Revenue Model Alignment** ✅
- [ ] Verify DoD/IC free tier documented (non-production)
- [ ] Verify production license required (contact sales@nouchix.com)
- [ ] Verify clear upgrade path to Enterprise Edition
- [ ] Verify DFARS compliance (RESTRICTED RIGHTS LEGEND)

---

## Phase 2: Debug Testing

### 2.1 Docker Build Testing

**Test 1: Build Iron Bank Container (Main Repo)**
```bash
cd "c:/Users/intel/blackbox/khepra protocol"

# Load telemetry key
source telemetry-keys/.env

# Build with telemetry key
docker build \
  --build-arg TELEMETRY_PRIVATE_KEY="$TELEMETRY_PRIVATE_KEY" \
  --build-arg VERSION=1.0.0 \
  --build-arg BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  -f Dockerfile.ironbank \
  -t adinkhepra:ironbank-debug .
```

**Expected Result**:
- ✅ Build succeeds (no errors)
- ✅ Image size < 100MB
- ✅ Non-root user (UID 1001)
- ✅ Binaries: /usr/local/bin/sonar, /usr/local/bin/adinkhepra

**Test 2: Verify Proprietary Code Exclusions**
```bash
# Check that proprietary code is NOT in container
docker run --rm adinkhepra:ironbank-debug find /build -name "license" -type d
# Expected: Empty (no pkg/license/)

docker run --rm adinkhepra:ironbank-debug find /build -name "agi" -type d
# Expected: Empty (no pkg/agi/)

docker run --rm adinkhepra:ironbank-debug ls /app/docs/STIG_CCI_Map.csv
# Expected: "No such file or directory"

# Check that public CSVs ARE included
docker run --rm adinkhepra:ironbank-debug ls /app/docs/CCI_to_NIST53.csv
# Expected: File exists

docker run --rm adinkhepra:ironbank-debug ls /app/docs/NIST53_to_171.csv
# Expected: File exists
```

### 2.2 Telemetry Testing

**Test 3: Telemetry Disabled (Default - Community Mode)**
```bash
# Run scanner WITHOUT telemetry opt-in
docker run --rm -v /etc:/data adinkhepra:ironbank-debug sonar --dir /data
```

**Expected Output**:
```
Anonymous telemetry disabled (set KHEPRA_TELEMETRY=true to help improve KHEPRA)
Learn more: https://khepra.io/privacy
```

**Test 4: Telemetry Enabled (Opt-In)**
```bash
# Run scanner WITH telemetry opt-in
docker run --rm -e KHEPRA_TELEMETRY=true -v /etc:/data adinkhepra:ironbank-debug sonar --dir /data
```

**Expected Output**:
```
Anonymous usage data sent (thank you for helping build the Dark Crypto Database!)
```

**Note**: If telemetry server is not running, expect connection error (acceptable for debug testing)

### 2.3 Scanner Functionality Testing

**Test 5: Basic Scan**
```bash
# Create test directory
mkdir -p /tmp/adinkhepra-test
echo "test file" > /tmp/adinkhepra-test/test.txt

# Run scan
docker run --rm -v /tmp/adinkhepra-test:/data adinkhepra:ironbank-debug sonar --dir /data
```

**Expected Output**:
- ✅ Scan completes without errors
- ✅ System enumeration runs
- ✅ Compliance checks execute
- ✅ Snapshot generated

**Test 6: STIG Scan**
```bash
# Run STIG compliance scan
docker run --rm -v /etc:/data adinkhepra:ironbank-debug sonar --dir /data --stig
```

**Expected Output**:
- ✅ STIG checks execute
- ✅ Compliance findings reported
- ✅ CCI mappings applied

**Test 7: JSON Output**
```bash
# Generate JSON report
docker run --rm -v /tmp/adinkhepra-test:/data adinkhepra:ironbank-debug \
  sonar --dir /data --output /data/report.json

# Verify JSON output
cat /tmp/adinkhepra-test/report.json | jq .
```

**Expected Result**:
- ✅ Valid JSON output
- ✅ Contains: system_info, compliance, findings

---

## Phase 3: Validation Testing

### 3.1 STIG Compliance Validation

**Test 8: Container STIG Checks**
```bash
# Check non-root user
docker run --rm adinkhepra:ironbank-debug id
# Expected: uid=1001(khepra) gid=0(root)

# Check for setuid/setgid binaries
docker run --rm adinkhepra:ironbank-debug find / -perm /6000 -type f 2>/dev/null
# Expected: Empty (no setuid/setgid binaries)

# Check for world-writable files
docker run --rm adinkhepra:ironbank-debug find / -perm -002 -type f 2>/dev/null | grep -v "/proc"
# Expected: Empty or minimal

# Verify static binaries
docker run --rm adinkhepra:ironbank-debug ldd /usr/local/bin/sonar
# Expected: "not a dynamic executable" or minimal dependencies
```

**Test 9: FIPS Mode Test**
```bash
# Run FIPS test script (if available)
bash scripts/fips-test.sh
```

### 3.2 Security Validation

**Test 10: Secret Scanning**
```bash
# Run secret scanner on repository
docker run --rm -v "$(pwd)":/data adinkhepra:ironbank-debug sonar --dir /data
```

**Expected Result**:
- ✅ No telemetry keys detected
- ✅ No API keys detected
- ✅ No hardcoded passwords

**Test 11: CVE Scanning (Anchore)**
```bash
# Run Anchore scan (if available)
anchore-cli image add adinkhepra:ironbank-debug
anchore-cli image vuln adinkhepra:ironbank-debug all
```

**Expected Result**:
- ✅ No critical CVEs
- ✅ High-severity CVEs addressed or documented

### 3.3 Iron Bank Requirements

**Test 12: Hardening Manifest Validation**
```bash
# Verify hardening_manifest.yaml is valid YAML
cat hardening_manifest.yaml | yq eval . -
```

**Expected Result**:
- ✅ Valid YAML syntax
- ✅ All required fields present
- ✅ SHA256 hashes match binaries

**Test 13: Build Reproducibility**
```bash
# Build twice with same inputs
docker build -f Dockerfile.ironbank -t adinkhepra:test1 .
docker build -f Dockerfile.ironbank -t adinkhepra:test2 .

# Compare image IDs
docker images adinkhepra:test1 adinkhepra:test2
```

**Expected Result**:
- ✅ Builds are deterministic (same inputs = same outputs)
- ✅ No timestamps or random data in binaries

---

## Phase 4: Final Sign-Off

### Pre-Publication Checklist

**Repository Verification**:
- [ ] All tests passed (Debug + Validation)
- [ ] No sensitive data in repository (keys, secrets, proprietary code)
- [ ] Documentation complete (README, CHANGELOG, LICENSE)
- [ ] DFARS compliance documented
- [ ] ECCN 5D992 declared

**Strategic Alignment**:
- [ ] Option C implementation verified (public CSVs, proprietary excluded)
- [ ] Dark Crypto Database telemetry architecture validated
- [ ] Competitive moat protected (no explicit proprietary listings)
- [ ] Revenue model clear (free DoD/IC tier, paid production)

**Iron Bank Readiness**:
- [ ] RHEL-09-STIG-V1R3 compliance verified
- [ ] hardening_manifest.yaml complete
- [ ] All CVEs addressed or documented
- [ ] Build reproducibility confirmed

### Make Repository Public

Once all tests pass and strategic alignment is confirmed:

1. **GitHub**: Change repository visibility to Public
   - Go to: https://github.com/nouchix/adinkhepra-asaf-ironbank/settings
   - Scroll to "Danger Zone" → "Change visibility" → "Make public"
   - Confirm with repository name

2. **Create Iron Bank GitLab Project**:
   - Go to: https://repo1.dso.mil/projects/new
   - Project name: `adinkhepra`
   - Namespace: `dsop/nouchix`
   - Visibility: Private (initially)

3. **Mirror to Iron Bank**:
   ```bash
   cd "C:\Users\intel\blackbox\adinkhepra-ironbank"
   git remote add ironbank git@repo1.dso.mil:dsop/nouchix/adinkhepra.git
   git push ironbank master
   ```

4. **Submit Iron Bank Merge Request**:
   - Create merge request on repo1.dso.mil
   - Attach hardening_manifest.yaml
   - Reference STIG scan results
   - Link to GitHub public repository

---

## Test Tracking

| Phase | Test | Status | Notes |
|-------|------|--------|-------|
| Intel Brief | Strategic alignment | ⏳ Pending | Review Option C, Dark Crypto DB, Revenue Model |
| Debug | Docker build | ⏳ Pending | Build in main repo with telemetry key |
| Debug | Proprietary exclusions | ⏳ Pending | Verify no pkg/agi, pkg/llm, STIG_CCI_Map.csv |
| Debug | Telemetry disabled | ⏳ Pending | Default opt-out behavior |
| Debug | Telemetry enabled | ⏳ Pending | Opt-in transmission with PQC signature |
| Debug | Basic scan | ⏳ Pending | Scanner functionality |
| Debug | STIG scan | ⏳ Pending | Compliance checks |
| Debug | JSON output | ⏳ Pending | Report generation |
| Validation | Container STIG | ⏳ Pending | Non-root, no setuid, static binaries |
| Validation | FIPS mode | ⏳ Pending | FIPS-compliant cryptography |
| Validation | Secret scanning | ⏳ Pending | No keys or secrets in container |
| Validation | CVE scanning | ⏳ Pending | Anchore/Clair scan |
| Validation | Hardening manifest | ⏳ Pending | YAML valid, SHA256 hashes match |
| Validation | Build reproducibility | ⏳ Pending | Deterministic builds |
| Sign-Off | Make public | ⏳ Pending | After all tests pass |

---

## Next Steps

1. **Fix SSH Key**: Configure GitHub SSH authentication
2. **Push to Private GitHub**: Upload repository for team review
3. **Run Intel Brief**: Verify strategic alignment
4. **Execute Debug Tests**: Functional correctness
5. **Execute Validation Tests**: Security & compliance
6. **Make Public**: After successful validation
7. **Submit to Iron Bank**: GitLab merge request

---

**Status**: Ready to begin testing once pushed to private GitHub
**Blocker**: SSH authentication (configure GitHub SSH key)
**Next Action**: Push to private repository, then start Intel Brief review
