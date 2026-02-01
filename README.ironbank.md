# ADINKHEPRA Protocol - Iron Bank Edition

[![Iron Bank](https://img.shields.io/badge/Iron_Bank-Pending-blue?style=for-the-badge&logo=kubernetes)](https://repo1.dso.mil) [![STIG](https://img.shields.io/badge/STIG-RHEL--09--V1R3-green?style=for-the-badge)](https://public.cyber.mil/stigs/) [![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)](LICENSE)

**Post-Quantum Cryptographic Security Scanner for DoD/IC Environments**

---

## Overview

ADINKHEPRA (Agentic Security Attestation Framework) is a hardened security scanner built for Department of Defense and Intelligence Community deployments. This Iron Bank edition provides STIG-compliant vulnerability scanning with post-quantum cryptography integration.

**Key Capabilities:**
- **Post-Quantum Cryptography**: NIST-approved Dilithium3 (ML-DSA-65) and Kyber-1024 (ML-KEM-1024)
- **STIG Compliance Scanning**: Automated RHEL-09-STIG-V1R3 compliance verification
- **NIST Framework Mapping**: Native support for NIST 800-53 Rev 5 and 800-171 Rev 2
- **Air-Gapped Ready**: Vendored dependencies, no external network requirements
- **Anonymous Telemetry**: Opt-in usage metrics with PQC-signed beacons (anti-spoofing)

---

## Quick Start

### Pull from Iron Bank Registry (After Approval)

```bash
# Login to Iron Bank
docker login registry1.dso.mil

# Pull ADINKHEPRA
docker pull registry1.dso.mil/dsop/nouchix/adinkhepra:1.0.0

# Run security scan
docker run --rm -v /path/to/scan:/data \
  registry1.dso.mil/dsop/nouchix/adinkhepra:1.0.0 \
  sonar --dir /data --stig
```

### Build from Source

```bash
# Vendor Go dependencies
go mod vendor
go mod verify

# Build Iron Bank container
docker build -f Dockerfile.ironbank -t adinkhepra:1.0.0 .

# Run functional tests
bash scripts/functional-test.sh
bash scripts/fips-test.sh
```

---

## Components

### Sonar Scanner

The `sonar` binary is a lightweight security scanner that performs:
- System enumeration and baseline configuration
- CVE vulnerability detection (offline database)
- STIG compliance checking (RHEL-09-STIG-V1R3)
- Cryptographic inventory (RSA/ECC key strength analysis)
- Secret detection (entropy-based + pattern matching)
- NIST 800-53/800-171 control mapping

**Basic Usage:**
```bash
# Scan current directory
docker run --rm -v $(pwd):/data adinkhepra:1.0.0 sonar --dir /data

# STIG compliance scan
docker run --rm -v /etc:/data adinkhepra:1.0.0 sonar --dir /data --stig

# Output to JSON
docker run --rm -v $(pwd):/data adinkhepra:1.0.0 sonar --dir /data --output /data/report.json
```

### Additional Binaries

| Binary | Purpose |
|--------|---------|
| `sonar` | Security scanner (default entrypoint) |
| `adinkhepra` | Main CLI for encryption, signing, integrity monitoring |
| `khepra-daemon` | Continuous monitoring agent |
| `gateway` | API server for remote management |
| `agent` | Autonomous security monitoring agent |

---

## Architecture

### Container Hardening (RHEL-09-STIG-V1R3)

- **Base Image**: `registry1.dso.mil/ironbank/redhat/ubi/ubi9-minimal:9.3`
- **Runtime User**: Non-root (UID 1001, GID 0)
- **Build Type**: Multi-stage, static binaries (CGO_ENABLED=0)
- **Attack Surface**: Minimal (20MB base, no shell, no package manager)
- **Permissions**: Read-only root filesystem, group-writable data directories

### Post-Quantum Cryptography

ADINKHEPRA integrates NIST-approved post-quantum algorithms via Cloudflare CIRCL:

- **Dilithium3 (ML-DSA-65)**: Digital signatures for telemetry anti-spoofing
- **Kyber-1024 (ML-KEM-1024)**: Key encapsulation for encrypted communications

**Patent Notice**: This software includes proprietary Khepra-PQC lattice-based cryptography (USPTO Patent Pending #73565085). The Dilithium3/Kyber implementations use open-source Cloudflare CIRCL library.

---

## Compliance Frameworks

### Supported Standards

| Framework | Version | Coverage |
|-----------|---------|----------|
| RHEL-09-STIG | V1R3 | Automated scanning |
| NIST 800-53 | Rev 5 | Control mapping (2,120 CCIs) |
| NIST 800-171 | Rev 2 | Control mapping (320 controls) |
| CMMC | Level 3 | AC.3.018, SC.3.177, SI.3.216, SR.3.227 |
| FedRAMP | High | Baseline scanning |

### Compliance Data (Community Edition)

This Iron Bank container includes public compliance mapping CSVs:
- `docs/CCI_to_NIST53.csv` - CCI to NIST 800-53 mapping (1,800 rows)
- `docs/NIST53_to_171.csv` - NIST 800-53 to 800-171 mapping (320 rows)

**Enterprise Edition**: Full compliance library available separately with extended STIG coverage (contact: sales@nouchix.com)

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KHEPRA_MODE` | `community` | Deployment mode (`community` or `enterprise`) |
| `KHEPRA_TELEMETRY` | `false` | Enable anonymous telemetry (opt-in) |
| `KHEPRA_TELEMETRY_SERVER` | `https://telemetry.khepra.io/beacon` | Telemetry endpoint |
| `KHEPRA_HOME` | `/var/lib/khepra` | Data directory |
| `KHEPRA_LOG_DIR` | `/var/log/khepra` | Log directory |

### Anonymous Telemetry (Opt-In)

ADINKHEPRA includes optional anonymous telemetry to improve the scanner:

**What is Collected** (if opted-in):
- Anonymous ID (SHA256-hashed hardware fingerprint - no PII)
- Scan metadata (duration, target count, findings count)
- Cryptographic inventory counts (RSA-2048, ECC P-256, etc. - NOT actual keys)
- Container runtime (Docker, Podman, Kubernetes)

**What is NOT Collected**:
- IP addresses, hostnames, usernames
- Actual cryptographic keys or secrets
- File paths, directory names
- Scan results or findings details

**Enable Telemetry** (Community Mode):
```bash
docker run --rm -e KHEPRA_TELEMETRY=true \
  -v $(pwd):/data adinkhepra:1.0.0 \
  sonar --dir /data
```

---

## Deployment

### Kubernetes (Platform One)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: adinkhepra-scanner
  namespace: security
spec:
  replicas: 1
  selector:
    matchLabels:
      app: adinkhepra
  template:
    metadata:
      labels:
        app: adinkhepra
    spec:
      securityContext:
        runAsUser: 1001
        runAsGroup: 0
        fsGroup: 0
        readOnlyRootFilesystem: true
      containers:
      - name: adinkhepra
        image: registry1.dso.mil/dsop/nouchix/adinkhepra:1.0.0
        command: ["/usr/local/bin/sonar"]
        args: ["--dir", "/data", "--stig", "--output", "/var/lib/khepra/report.json"]
        volumeMounts:
        - name: scan-data
          mountPath: /data
          readOnly: true
        - name: khepra-home
          mountPath: /var/lib/khepra
        resources:
          limits:
            memory: 512Mi
            cpu: 500m
          requests:
            memory: 256Mi
            cpu: 250m
      volumes:
      - name: scan-data
        persistentVolumeClaim:
          claimName: adinkhepra-data
      - name: khepra-home
        emptyDir: {}
```

### Docker Compose

```yaml
version: '3.8'

services:
  adinkhepra:
    image: registry1.dso.mil/dsop/nouchix/adinkhepra:1.0.0
    container_name: adinkhepra-scanner
    user: "1001:0"
    read_only: true
    volumes:
      - /path/to/scan:/data:ro
      - adinkhepra-home:/var/lib/khepra
      - adinkhepra-logs:/var/log/khepra
    environment:
      - KHEPRA_MODE=community
      - KHEPRA_TELEMETRY=false
    command: sonar --dir /data --stig --output /var/lib/khepra/snapshot.json

volumes:
  adinkhepra-home:
  adinkhepra-logs:
```

---

## Security

### STIG Compliance (RHEL-09-STIG-V1R3)

- Non-root user execution (UID 1001, GID 0)
- No setuid/setgid binaries
- No world-writable files or directories
- Static binary compilation (no dynamic libraries)
- Minimal package installation (ca-certificates, tzdata only)
- No unnecessary services or daemons

### Supply Chain Security

- **SBOM**: Generated by Iron Bank pipeline
- **CVE Scanning**: Anchore scan results available in Iron Bank
- **Binary Hashes**: SHA256 checksums in `hardening_manifest.yaml`
- **Signature Verification**: Cosign signatures (post-approval)

### Export Control

This software contains post-quantum cryptography subject to U.S. Export Administration Regulations (EAR):

- **ECCN**: 5D992 (Mass Market / Anti-Terrorism)
- **Algorithms**: Dilithium3 (NIST FIPS 204), Kyber-1024 (NIST FIPS 203)
- **Compliance**: Not subject to EAR export licensing (publicly available NIST standards)

**Note**: Verify export compliance requirements with your organization's legal counsel before international deployment.

---

## License

**Proprietary License** - SecRed Knowledge Inc. dba NouchiX

This software is provided under the [KHEPRA MASTER LICENSE AGREEMENT v3.0](LICENSE) with the following key terms:

### U.S. Government Rights (DFARS Compliance)

**RESTRICTED RIGHTS LEGEND**:
```
Use, duplication, or disclosure by the Government is subject to restrictions
as set forth in paragraph (b)(3) of the Rights in Noncommercial Computer
Software and Noncommercial Computer Software Documentation clause at
DFARS 252.227-7014.

Manufacturer: SecRed Knowledge Inc. dba NouchiX
              401 New Karner Rd, Suite 301, Albany, NY 12205
```

### Community Edition (Iron Bank)

- **Free for DoD/IC**: Non-production evaluation and testing
- **Free for Contractors**: Development and testing for DoD/IC support
- **Production Use**: Requires commercial license (contact sales@nouchix.com)

### Commercial Licensing

For production deployments, enterprise features, or extended compliance libraries:
- **Email**: sales@nouchix.com
- **Website**: https://nouchix.com
- **Support**: support@nouchix.com

---

## Support

### Iron Bank Issues

- **GitLab**: https://repo1.dso.mil/dsop/nouchix/adinkhepra/-/issues
- **Security Contact**: security@nouchix.com
- **Vulnerability Reporting**: https://vat.dso.mil

### Commercial Support

- **Sales**: sales@nouchix.com
- **Technical Support**: support@nouchix.com
- **Documentation**: https://docs.nouchix.com/adinkhepra

---

## Development

### Building Locally

```bash
# Clone repository
git clone git@github.com:nouchix/adinkhepra-asaf-ironbank.git
cd adinkhepra-asaf-ironbank

# Vendor dependencies
go mod vendor
go mod verify

# Build binaries
go build -o bin/sonar ./cmd/sonar

# Run tests
go test ./...

# Build Docker image
docker build -f Dockerfile.ironbank -t adinkhepra:dev .
```

### Contributing

This is a **proprietary product** distributed via Iron Bank. External contributions are not accepted.

**For DoD/IC users**: Report security findings via https://vat.dso.mil

---

## Credits

**Developed by**: NouchiX SecRed Knowledge Inc.
**Maintainer**: Souhimbou D. Kone (cyber@nouchix.com)
**Post-Quantum Cryptography**: Cloudflare CIRCL library (Dilithium3, Kyber-1024)
**Compliance Mapping**: DISA STIG/CCI database (public subset)
**Iron Bank Submission**: Platform One, DoD DevSecOps
**Distribution**: Registry1 (https://registry1.dso.mil)

---

## Repository

- **GitHub**: git@github.com:nouchix/adinkhepra-asaf-ironbank.git
- **Iron Bank GitLab**: https://repo1.dso.mil/dsop/nouchix/adinkhepra
- **Registry**: registry1.dso.mil/dsop/nouchix/adinkhepra

---

## Version

**Current Release**: 1.0.0 (2026-01-20)

See [CHANGELOG.md](CHANGELOG.md) for version history and [LICENSE](LICENSE) for full license terms.

---

**Last Updated**: 2026-01-20
**Iron Bank Status**: Pre-Submission
