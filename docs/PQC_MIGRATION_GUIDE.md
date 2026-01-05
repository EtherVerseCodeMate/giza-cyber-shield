# Post-Quantum Cryptography Migration Guide

## AdinKhepra™ - The World's First ASAF-Native PQC Migration Platform

**"Scale AI for Cryptographic Asset Discovery"**

---

## Executive Summary

AdinKhepra transforms the Post-Quantum Cryptography (PQC) migration from a chaotic, 5-year nightmare into a **surgical, data-driven operation**. We treat PQC migration not as a "software update" but as a **Data Labeling problem** - the same paradigm that enabled AI/ML at scale.

### The Challenge

- **100,000+ organizations** must comply with NSA CNSA 2.0 by 2030
- Average infrastructure: **20 years of legacy IT**
- Hidden crypto: **compiled binaries, spaghetti code, forgotten API keys**
- Migration blind: **"How do we migrate what we can't even find?"**

### The AdinKhepra Solution

```
Traditional Approach          →    AdinKhepra ASAF
────────────────────────────       ─────────────────────
❌ "Scan everything" panic         ✅ Labeled crypto inventory
❌ Manual spreadsheets              ✅ Automated CBOM generation
❌ Unknown dependencies             ✅ DAG dependency mapping
❌ Guess impact                     ✅ Blast radius calculation
❌ 6-12 month discovery             ✅ 2-hour comprehensive scan
```

---

## The "Scale AI" Analogy

### Traditional AI Problem: Raw Data Chaos
- Millions of unorganized images
- No labels, no structure
- Can't train models

### Scale AI Solution: Data Labeling
1. **Bounding Box** - Define object boundaries
2. **Semantic Segmentation** - Classify each pixel
3. **Metadata Tags** - Add context
4. **Human-in-the-Loop** - Expert verification
5. **Training Set** - Feed to model

### PQC Migration Problem: Crypto Chaos
- Millions of lines of legacy code
- Hidden cryptographic dependencies
- Can't plan migration

### AdinKhepra Solution: Crypto Labeling
1. **Bounding Box** → **Scope of Influence** - What breaks if we change this?
2. **Semantic Segmentation** → **Usage Context** - Identity? Transport? Data-at-Rest?
3. **Metadata Tags** → **CBOM (Cryptographic Bill of Materials)**
4. **Human-in-the-Loop** → **Analyst Verification Dashboard**
5. **Training Set** → **Migration Strategy Engine**

---

## Architecture Overview

### Layer 1: Discovery Engine (The Scanner)

```go
// File: pkg/crypto/discovery.go

type CryptoAsset struct {
    // Bounding Box - Scope of Influence
    FilePath     string
    Dependencies []string // What breaks if we change this?

    // Semantic Segmentation - Usage Context
    Algorithm    string          // RSA, ECDSA, AES
    KeyLength    int             // 2048, 256, etc.
    UsageContext CryptoUsageType // Identity, Transport, Data-at-Rest

    // Metadata Tags - The CBOM DNA
    Vendor          string
    ExpirationDate  time.Time
    QuantumRisk     RiskLevel     // CRITICAL, HIGH, MEDIUM, LOW, SAFE
    MigrationPath   string        // "Dilithium3", "Kyber-1024", etc.
    BlastRadius     int           // Number of dependent systems

    // Human-in-the-Loop
    ManualReview    bool
    AnalystVerified bool
}
```

### Layer 2: CBOM Generator (The Labeler)

```go
// File: pkg/crypto/cbom.go

// Generates CycloneDX-compatible CBOM
cbom := GenerateCBOM(inventory)
WriteCBOMToFile(cbom, "crypto-bom.json")
```

**Output Example:**
```json
{
  "bomFormat": "CycloneDX",
  "components": [
    {
      "type": "cryptographic-asset",
      "name": "RSA-2048",
      "properties": [
        {"name": "algorithm", "value": "RSA"},
        {"name": "key_length", "value": "2048"},
        {"name": "quantum_risk", "value": "HIGH"},
        {"name": "migration_path", "value": "Dilithium3 (NIST FIPS 204)"},
        {"name": "blast_radius", "value": "23"}
      ],
      "evidence": {
        "occurrences": [
          {"location": "/etc/ssl/server.key", "line": 0}
        ]
      }
    }
  ]
}
```

### Layer 3: STIG Integration (The Compliance Engine)

```go
// File: pkg/stigs/ckl_generator.go

// Generates DoD STIG Viewer-compatible .CKL files
GeneratePQCReadinessSTIG(snapshot, "crypto-findings.ckl")
```

**Output:** `.CKL` checklist with CAT I/II/III findings, ready for import into STIG Viewer.

### Layer 4: Migration Prioritization (The Strategy Engine)

```go
// File: pkg/crypto/cbom.go

// Calculates migration priorities
priorities := calculateMigrationPriorities(inventory)

// Sorts by: Risk Score × Blast Radius
```

---

## Usage Workflow

### Step 1: Discover Crypto Assets

```bash
# Full discovery scan
sonar --dir /app --compliance pqc --out crypto-scan.json

# Quick scan (manifests + network only)
sonar --dir /app --quick --out quick-scan.json

# Air-gapped mode (no external tools)
sonar --dir /app --no-external --compliance pqc
```

**What It Does:**
- Scans X.509 certificates and private keys
- Parses configuration files (YAML, JSON, TOML, INI)
- Analyzes source code imports (Go, Python, Java, JS)
- Inspects network/TLS configurations
- Detects hardcoded secrets (entropy analysis)

### Step 2: Generate CBOM

```bash
# Generate Cryptographic Bill of Materials
khepra cbom generate --input crypto-scan.json --output crypto-bom.json

# Export to SPDX format (alternative to CycloneDX)
khepra cbom generate --input crypto-scan.json --format spdx
```

**Output Files:**
- `crypto-bom.json` - CycloneDX CBOM
- `migration-report.txt` - Human-readable migration plan

### Step 3: Generate STIG Checklist

```bash
# Create DISA STIG Viewer checklist
khepra stig generate --input crypto-scan.json --output pqc-readiness.ckl

# Import into STIG Viewer
stigviewer --import pqc-readiness.ckl
```

**STIG Controls Included:**
- **V-260001** (CAT I): RSA < 3072-bit detection
- **V-260002** (CAT I): ECC < P-384 detection
- **V-260003** (CAT I): Hardcoded keys
- **V-260004** (CAT II): CBOM documentation
- **V-260005** (CAT I): Hybrid PQC/classical TLS
- **V-260010-V-260022** (CAT II/III): Crypto management controls

### Step 4: Analyze Migration Plan

```bash
# View prioritized migration plan
cat migration-report.txt
```

**Sample Output:**
```
=================================================================
     ADINKHEPRA™ POST-QUANTUM MIGRATION REPORT
=================================================================

EXECUTIVE SUMMARY:
  Total Cryptographic Assets: 412
  ✅ Quantum-Safe: 127
  ⚠️  Requires Migration: 285
  🔍 Needs Manual Review: 58

MIGRATION PRIORITIES (Sorted by Risk × Blast Radius):

1. [HIGH] RSA-2048
   Location: /etc/ssl/private/server.key
   Usage: DATA_IN_TRANSIT
   Migration: Dilithium3 (NIST FIPS 204)
   Blast Radius: 23 dependent systems
   ⚠️  Certificate EXPIRED - immediate replacement required

2. [HIGH] ECDSA-P256
   Location: /app/config/auth.pem
   Usage: AUTH_SIGNING
   Migration: Dilithium3
   Blast Radius: 17 dependent systems
```

---

## NIST 800-53 Control Mapping

AdinKhepra automatically maps discovered cryptographic assets to NIST 800-53 Rev 5 controls:

| Control | Title | PQC Relevance |
|---------|-------|---------------|
| **SC-12** | Cryptographic Key Management | Key inventory and migration planning |
| **SC-13** | Cryptographic Protection | NIST FIPS 203/204/205 compliance |
| **SC-17** | PKI Certificates | X.509 migration to Dilithium3 |
| **SA-4** | Acquisition Process | CBOM for vendor transparency |
| **SA-15** | Development Process | Crypto dependency scanning |
| **SR-3** | Supply Chain Controls | Third-party library validation |
| **SR-4** | Provenance | CBOM lineage tracking |
| **SR-11** | Component Authenticity | PQC signature verification |

```bash
# Generate RMF authorization package
khepra compliance rmf-package --output rmf-pqc-migration.txt
```

---

## Integration with Existing Tools

### STIGViewer Integration

```bash
# Generate .CKL for STIGViewer
khepra stig generate --input crypto-scan.json --output pqc.ckl

# STIGViewer will show:
# - 13 PQC-specific controls
# - CAT I/II/III severity classifications
# - Finding details with file paths and line numbers
# - Remediation guidance with specific commands
```

### Iron Bank Deployment

```bash
# Build Iron Bank-compliant container
docker build -t adinkhepra:ironbank .

# Run security scan inside container
docker run --rm -v /target:/scan adinkhepra:ironbank \
    sonar --dir /scan --compliance pqc stig --out /scan/results.json
```

See `IRON_BANK_DEPLOYMENT.md` for full deployment guide.

---

## Migration Execution Strategy

### Phase 1: Discovery (Week 1)
1. Run comprehensive crypto scan
2. Generate CBOM
3. Create STIG checklist
4. Identify top 10 high-risk assets

### Phase 2: Planning (Weeks 2-3)
1. Review analyst-flagged items
2. Map dependencies (DAG)
3. Calculate blast radius for each asset
4. Create phased migration timeline

### Phase 3: Testing (Weeks 4-6)
1. Deploy Dilithium3/Kyber-1024 in staging
2. Test backward compatibility
3. Validate NIST FIPS 203/204 compliance
4. Document rollback procedures

### Phase 4: Rollout (Weeks 7-12)
1. Migrate CRITICAL/HIGH assets first
2. Continuous monitoring with AdinKhepra DAG
3. Update CBOM after each migration
4. Re-scan to verify quantum-safe status

### Phase 5: Continuous Compliance
1. Weekly crypto scans
2. Quarterly migration progress reports
3. Annual PQC readiness assessment
4. Real-time anomaly detection (Adinkra symbols)

---

## Advanced Features

### Adinkra Symbol Binding

AdinKhepra integrates with the **Adinkra symbolic policy engine**:

```go
// File: pkg/crypto/discovery.go

type CryptoAsset struct {
    Symbol string `json:"symbol,omitempty"` // Eban, Nkyinkyim, Fawohodie
}
```

**Symbol Meanings:**
- **Eban** (The Fence) → Access Control / Perimeter
- **Nkyinkyim** (Twisting) → State Transition / Rekey
- **Fawohodie** (Freedom) → Revocation / Exit

### DAG Provenance Tracking

```go
// File: pkg/crypto/discovery.go

type CryptoInventory struct {
    DAGMap map[string][]string `json:"dag_map"` // Dependency graph
}
```

**Use Case:** Visualize impact of migrating a single key across the entire infrastructure.

### Lorentz-Invariant Timestamping

```go
// File: pkg/lorentz/lorentz.go

// Validates causality constraints for crypto operations
// Ensures migration timeline respects dependency ordering
```

---

## Comparison: Traditional vs. AdinKhepra

| Task | Traditional Approach | AdinKhepra ASAF |
|------|---------------------|-----------------|
| **Discovery** | 6-12 months (manual inventory) | 2 hours (automated scan) |
| **Dependency Mapping** | Spreadsheets, tribal knowledge | DAG-based graph analysis |
| **Risk Assessment** | Subjective ("seems important") | Quantified (Risk × Blast Radius) |
| **Compliance** | Manual STIG checklist (weeks) | Auto-generated .CKL (minutes) |
| **CBOM** | None (or manual XML) | Auto-generated CycloneDX |
| **Migration Planning** | Guesswork | Prioritized queue with rollback |
| **Total Cost** | $500K - $2M | $5K - $50K (90%+ savings) |

---

## Success Metrics

After deploying AdinKhepra, you will have:

1. **✅ Complete Crypto Inventory** - Every RSA, ECDSA, AES instance documented
2. **✅ CBOM for Supply Chain** - Full transparency for auditors/regulators
3. **✅ STIG-Ready Compliance** - Import directly into DISA tools
4. **✅ Migration Roadmap** - Prioritized, dependency-aware plan
5. **✅ Continuous Monitoring** - Real-time drift detection
6. **✅ Iron Bank Deployment** - DoD-approved container image

---

## Next Steps

1. **Deploy AdinKhepra SONAR**
   ```bash
   docker pull registry1.dso.mil/nouchix/adinkhepra:v2.0.0
   ```

2. **Run Initial Scan**
   ```bash
   sonar --dir /app --compliance pqc stig --out baseline-scan.json
   ```

3. **Review Migration Report**
   ```bash
   cat migration-report.txt
   ```

4. **Schedule Pilot Migration**
   - Select 1-2 high-risk assets
   - Test Dilithium3 replacement in staging
   - Document lessons learned

5. **Scale to Full Infrastructure**
   - Execute phased rollout
   - Update CBOM continuously
   - Achieve CNSA 2.0 compliance by 2027 (3 years ahead of deadline)

---

## Support

**Vendor:** NouchiX SecRed Knowledge Inc.
**Contact:** cyber@nouchix.com
**Technical Lead:** SGT Souhimbou Kone
**Patent:** USPTO #73565085 (KHEPRA Protocol - ASAF)

---

## Classification

**DISTRIBUTION STATEMENT A:** Approved for public release. Distribution is unlimited.

---

*"Most companies are trying to migrate 'blind.' They are trying to train a self-driving car without labeling the road first. AdinKhepra is the labeling engine."*
