# Bug Bounty Playbook - Giza Cyber Shield Arsenal

> **Professional Pentesting Workflow for HackerOne, Bugcrowd, and Private Programs**

## Quick Start (TL;DR)

```bash
# 1. Build the tools
make build

# 2. Generate your PQC keys (one-time setup)
./bin/adinkhepra keygen -out keys/hunter

# 3. Run full reconnaissance on target
./bin/sonar -dir /path/to/target-app -verbose -sign -out recon.json

# 4. Generate risk attestation
./bin/adinkhepra attest recon.json

# 5. Review findings and write report
cat recon.json.attestation.json
```

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Reconnaissance](#phase-1-reconnaissance)
3. [Phase 2: Vulnerability Scanning](#phase-2-vulnerability-scanning)
4. [Phase 3: Secret Detection](#phase-3-secret-detection)
5. [Phase 4: Web Application Testing](#phase-4-web-application-testing)
6. [Phase 5: API & Network Analysis](#phase-5-api--network-analysis)
7. [Phase 6: Report Generation](#phase-6-report-generation)
8. [Command Reference](#command-reference)
9. [Integration with External Tools](#integration-with-external-tools)
10. [Writing Winning Reports](#writing-winning-reports)

---

## Prerequisites

### Required Setup

```bash
# Clone and build
cd giza-cyber-shield
make build

# Verify installation
./bin/adinkhepra validate
./bin/sonar --help
```

### Generate Your Hunter Keys

```bash
# Generate PQC keypair for signing evidence
./bin/adinkhepra keygen -out keys/bounty_hunter

# This creates:
# - keys/bounty_hunter_dilithium      (signing private key)
# - keys/bounty_hunter_dilithium.pub  (signing public key)
# - keys/bounty_hunter_kyber          (encryption private key)
# - keys/bounty_hunter_kyber.pub      (encryption public key)
```

### Environment Setup

```bash
# Optional: Enable dev mode (skips license check)
export ADINKHEPRA_DEV=1

# Optional: Set Shodan API key for enhanced OSINT
export SHODAN_API_KEY="your_api_key"

# Optional: Set Censys credentials
export CENSYS_API_ID="your_id"
export CENSYS_API_SECRET="your_secret"
```

---

## Phase 1: Reconnaissance

### 1.1 Full System Audit (Local Targets / Source Code Access)

```bash
# Deep scan with all modules enabled
./bin/sonar \
  -dir /path/to/target-source \
  -verbose \
  -sign \
  -out phase1_recon.json

# Quick scan (faster, less thorough)
./bin/sonar \
  -dir /path/to/target-source \
  -quick \
  -out quick_recon.json
```

**What SONAR detects:**
- Device fingerprinting (anti-spoofing)
- Network ports and services
- Running processes and services
- Kernel modules (rootkit detection on Linux)
- Dependency manifests (package.json, go.mod, requirements.txt, etc.)
- Vulnerabilities (CVE database + heuristics)
- Secrets (API keys, passwords, tokens)
- Configuration issues

### 1.2 Web Application Crawling

```bash
# Crawl web application (uses SpiderFoot)
./bin/adinkhepra arsenal crawler https://target.example.com

# Output: scan_target.example.com.json
```

**Crawler discovers:**
- Subdomains
- Email addresses
- IP addresses
- Technology stack
- Hidden endpoints
- Linked domains
- DNS records

### 1.3 Offline Mode (Air-Gapped)

```bash
# No external API calls - 100% local scanning
./bin/sonar \
  -dir /path/to/target \
  -no-external \
  -out offline_scan.json
```

---

## Phase 2: Vulnerability Scanning

### 2.1 Built-in Vulnerability Scanner

The scanner automatically runs when you use `sonar`. It checks:

| Check | Description |
|-------|-------------|
| NPM Dependencies | lodash, express, axios vulnerabilities |
| Python Dependencies | django, flask, requests vulnerabilities |
| Go Modules | golang.org/x/net, golang.org/x/crypto |
| Config Issues | DEBUG=True, wildcard hosts, SSL disabled |

### 2.2 Compliance Scanning

```bash
# CIS Benchmark scan
./bin/sonar -dir . -compliance cis -out cis_audit.json

# STIG compliance scan
./bin/sonar -dir . -compliance stig -out stig_audit.json

# NIST 800-53 compliance scan
./bin/sonar -dir . -compliance nist -out nist_audit.json
```

### 2.3 Container Security

```bash
# Scan Dockerfile for misconfigurations
./bin/sonar -container ./Dockerfile -out container_scan.json
```

**Container checks:**
- Using `:latest` tag
- Running as root
- Disabled certificate verification
- chmod 777 permissions
- ADD with URLs

---

## Phase 3: Secret Detection

### 3.1 Automatic Secret Scanning

Secrets are automatically detected by SONAR. Patterns include:

| Type | Pattern |
|------|---------|
| AWS Access Key | `AKIA[0-9A-Z]{16}` |
| Private Keys | `-----BEGIN PRIVATE KEY-----` |
| API Keys | `api_key`, `apikey`, `api_secret` |
| Passwords | `password=`, `passwd=`, `pwd=` |
| JWT Tokens | `eyJ...` format |

### 3.2 Integrate External Secret Scanners

```bash
# Run Gitleaks separately, then ingest
gitleaks detect -s /path/to/repo -r gitleaks.json

# Ingest into Khepra for unified reporting
./bin/adinkhepra audit ingest phase1_recon.json -leaks gitleaks.json

# Ingest TruffleHog results
./bin/adinkhepra audit ingest phase1_recon.json -truffle trufflehog.json
```

---

## Phase 4: Web Application Testing

### 4.1 ZAP Integration

```bash
# Export ZAP findings to JSON, then ingest
./bin/adinkhepra audit ingest recon.json -zap zap_results.json
```

### 4.2 Manual Testing Checklist

Use findings from SONAR to guide manual testing:

```
[ ] Authentication bypass (check for hardcoded creds)
[ ] IDOR (check API endpoints found by crawler)
[ ] XSS (check user input fields)
[ ] SQL Injection (check database connections)
[ ] SSRF (check external URL fetching)
[ ] Path traversal (check file operations)
[ ] Privilege escalation (check permission models)
```

### 4.3 Packet Analysis (Network Interception)

```bash
# Capture traffic with Wireshark, export as JSON
# Then analyze for quantum-unsafe crypto

./bin/adinkhepra audit ingest recon.json -pcap capture.json
```

**Detects:**
- Cleartext HTTP traffic
- Legacy TLS versions
- Quantum-risky crypto (RSA/ECDSA)
- Potential MITM vulnerabilities

---

## Phase 5: API & Network Analysis

### 5.1 Network Topology Mapping

```bash
# Map network topology and attack paths
./bin/adinkhepra network map

# Analyze attack surface
./bin/adinkhepra network analyze
```

### 5.2 Port Scanning

The built-in scanner detects:
- Open ports on 0.0.0.0 (exposure risk)
- Service identification
- OS fingerprinting

### 5.3 SBOM Generation

```bash
# Generate Software Bill of Materials
./bin/adinkhepra sbom generate -dir /path/to/app -out sbom.json
```

---

## Phase 6: Report Generation

### 6.1 Generate Risk Attestation

```bash
# Create PQC-signed risk attestation
./bin/adinkhepra attest phase1_recon.json

# Output: phase1_recon.json.attestation.json
```

The attestation includes:
- Overall risk score (0-100)
- Categorized findings
- MITRE ATT&CK mapping
- Remediation recommendations
- Cryptographic signature (non-repudiation)

### 6.2 Executive Summary Reports

```bash
# Generate full compliance report
./bin/adinkhepra compliance scan -dir . -framework cmmc

# Generate ERT (Executive Roundtable) Analysis
./bin/adinkhepra ert-godfather /path/to/target
```

### 6.3 Export Formats

```bash
# After audit ingest, you get:
# - *.risk_report.json   (detailed findings)
# - *.superset.csv       (for analytics/BI tools)
# - *.affine.md          (executive memo in markdown)
```

---

## Command Reference

### SONAR (Security Scanner)

```bash
./bin/sonar [flags]

Flags:
  -dir string        Directory to scan (default ".")
  -quick             Skip deep enumeration
  -no-external       Offline mode (no API calls)
  -container string  Scan container image/Dockerfile
  -compliance string Run compliance check (cis/stig/nist)
  -sign              Sign output with PQC (Dilithium3)
  -out string        Output file (default "snapshot.json")
  -verbose           Enable verbose logging
```

### AdinKhepra CLI

```bash
./bin/adinkhepra <command> [args]

Reconnaissance:
  arsenal crawler <target>    Web application crawling

Analysis:
  audit ingest <scan.json>    Aggregate scan results
  attest <snapshot.json>      Generate risk attestation
  explain <file>              Analyze artifact type

Compliance:
  compliance scan             Run compliance assessment
  ert-godfather <dir>         Executive synthesis report

Crypto:
  keygen                      Generate PQC keypair
  kuntinkantan <pub> <file>   Encrypt file
  sankofa <priv> <file>       Decrypt file
```

### Audit Ingest Flags

```bash
./bin/adinkhepra audit ingest <snapshot.json> [flags]

Integration Flags:
  -leaks <file>       Gitleaks JSON output
  -truffle <file>     TruffleHog JSON output
  -zap <file>         OWASP ZAP JSON output
  -retire <file>      RetireJS JSON output
  -sarif <file>       SARIF format output
  -nessus <file>      Nessus scan output
  -kube <file>        Kubernetes audit output
  -crawler <file>     SpiderFoot crawler output
  -pcap <file>        Wireshark JSON capture
```

---

## Integration with External Tools

### Recommended Tool Stack

| Tool | Purpose | Integration |
|------|---------|-------------|
| Gitleaks | Secret scanning | `-leaks` flag |
| TruffleHog | Deep secret scanning | `-truffle` flag |
| OWASP ZAP | Web app scanning | `-zap` flag |
| Nessus | Network scanning | `-nessus` flag |
| Burp Suite | Manual testing | Export + manual review |
| Nuclei | Template-based scanning | SARIF export |
| ffuf | Fuzzing | Manual integration |

### Example Full Workflow

```bash
#!/bin/bash
TARGET="https://target.example.com"
TARGET_DIR="/path/to/source"

# Phase 1: Internal recon
./bin/sonar -dir $TARGET_DIR -verbose -sign -out recon.json

# Phase 2: Web crawling
./bin/adinkhepra arsenal crawler $TARGET

# Phase 3: External tools (run separately)
gitleaks detect -s $TARGET_DIR -r gitleaks.json
# zap-cli quick-scan $TARGET -o zap.json

# Phase 4: Aggregate all findings
./bin/adinkhepra audit ingest recon.json \
  -leaks gitleaks.json \
  -crawler scan_${TARGET}.json

# Phase 5: Generate attestation
./bin/adinkhepra attest recon.json

# Phase 6: Review
cat recon.json.attestation.json | jq '.findings[] | select(.severity == "CRITICAL")'
```

---

## Writing Winning Reports

### Report Structure (HackerOne Format)

```markdown
## Summary
[One-line description of the vulnerability]

## Severity
[Critical/High/Medium/Low] - CVSS: X.X

## Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Observe the vulnerability]

## Impact
[What can an attacker do with this?]

## Proof of Concept
[Screenshots, code, or commands]

## Remediation
[How to fix it]

## References
- [CVE-XXXX-XXXXX]
- [CWE-XXX]
- [OWASP Reference]
```

### Using Khepra Evidence

```bash
# Get finding details for report
cat recon.json.attestation.json | jq '.findings[0]'

# Get MITRE ATT&CK mapping
cat recon.json.attestation.json | jq '.mitre_mapping'

# Get remediation recommendations
cat recon.json.attestation.json | jq '.findings[].remediation'
```

### Pro Tips

1. **Always include evidence** - Use the PQC-signed snapshots as proof
2. **Map to standards** - Reference CVE, CWE, OWASP Top 10
3. **Show impact** - Explain real-world consequences
4. **Provide fix** - Include remediation steps
5. **Be professional** - Clear, concise, no fluff

---

## Threat Score Interpretation

| Score | Risk Level | Action |
|-------|------------|--------|
| 0-30 | Low | Monitor, report informational |
| 31-50 | Medium | Report as Medium severity |
| 51-70 | High | Report as High severity |
| 71-100 | Critical | Report immediately as Critical |

### Score Components

- Spoofing indicators: +10 each
- Critical vulnerabilities: +5 each
- High vulnerabilities: +2 each
- Rootkit indicators: +15 each
- Malware signatures: +20 each
- Secrets detected: +8 each
- Exposed ports (0.0.0.0, <1024): +1 each
- Compliance failure rate: up to +20

---

## Legal Disclaimer

**IMPORTANT**: Only test systems you have explicit authorization to test.

- Bug bounty programs have defined scopes - stay within them
- Never test production systems without permission
- Document your authorization (screenshots of program scope)
- Report responsibly through official channels

---

## Quick Reference Card

```
+------------------------------------------------------------------+
|                    GIZA CYBER SHIELD - QUICK REFERENCE           |
+------------------------------------------------------------------+
| RECON                                                             |
|   sonar -dir <path> -verbose -sign -out scan.json                |
|   adinkhepra arsenal crawler <url>                                |
+------------------------------------------------------------------+
| ANALYSIS                                                          |
|   adinkhepra audit ingest scan.json -leaks gl.json -zap zap.json |
|   adinkhepra attest scan.json                                     |
+------------------------------------------------------------------+
| COMPLIANCE                                                        |
|   sonar -compliance cis|stig|nist                                |
|   adinkhepra compliance scan -framework cmmc                      |
+------------------------------------------------------------------+
| REPORTS                                                           |
|   *.risk_report.json  - Detailed findings                        |
|   *.attestation.json  - Signed risk assessment                   |
|   *.affine.md         - Executive summary                        |
+------------------------------------------------------------------+
```

---

*Happy hunting! May your reports be accepted and your bounties be bountiful.*
