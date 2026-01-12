# Khepra Protocol: Implementation Roadmap
## Deepening the Roots - Priority Enhancements

**Document Version**: 1.0
**Date**: 2025-12-25
**Status**: Planning Phase

---

## Overview

This roadmap addresses the critical gaps identified in the Causal Reality Analysis. The focus is on **deepening foundational capabilities** ("roots") rather than adding surface features ("leaves").

**Guiding Principle**: "They scaled the leaves and skipped the roots" - We will do the opposite.

---

## Phase 1: Critical Root Implementations (Q1 2026)

### 1.1 Runtime File Integrity Monitoring (FIM)
**Priority**: 🔴 CRITICAL
**Estimated Complexity**: Medium
**Dependencies**: None

#### Objective
Implement continuous file integrity monitoring to detect unauthorized modifications to critical system files in real-time, generating DAG attestation nodes for compliance violations.

#### Technical Approach

**File**: `pkg/fim/watcher.go`

```go
package fim

import (
    "crypto/sha256"
    "github.com/fsnotify/fsnotify"
    "github.com/yourusername/khepra/pkg/dag"
)

type FIMWatcher struct {
    watcher    *fsnotify.Watcher
    dag        *dag.DAG
    baselines  map[string]string  // filepath -> SHA256 hash
    critical   []string           // Paths to monitor
}

// Monitor critical OS files
var DefaultCriticalPaths = []string{
    "/etc/passwd",
    "/etc/shadow",
    "/etc/ssh/sshd_config",
    "/boot/grub/grub.cfg",
    // Windows equivalents
    "C:\\Windows\\System32\\config\\SAM",
    "C:\\Windows\\System32\\drivers\\etc\\hosts",
}

func (f *FIMWatcher) Start() error {
    // Initialize fsnotify watcher
    // Establish baseline hashes
    // Monitor for WRITE/CHMOD/DELETE events
    // Generate DAG nodes on unauthorized changes
}
```

#### DAG Integration

```go
// Generate FIM violation node
node := &dag.Node{
    Type: "fim:violation",
    Content: FIMEvent{
        FilePath:     "/etc/shadow",
        ExpectedHash: "abc123...",
        ActualHash:   "def456...",
        Timestamp:    time.Now(),
        Severity:     "CRITICAL",
    },
    Parents: []string{
        "asset:host:server01",
        "stig:control:RHEL-08-010160", // STIG V-230222 (file permissions)
    },
}
```

#### STIG Mapping
- **RHEL-08-010160**: System files must have appropriate permissions
- **RHEL-08-040300**: File integrity tool must notify sysadmin of changes
- **WIN10-CC-000050**: Windows audit policy for file system changes

#### Success Criteria
- [ ] Monitor 50+ critical OS files per host
- [ ] Generate DAG nodes within 5 seconds of unauthorized modification
- [ ] Link FIM events to STIG control violations
- [ ] Configurable baseline establishment (manual + auto-learned)
- [ ] Cross-platform support (Linux inotify, Windows FSEvents)

#### Testing Plan
1. Modify `/etc/shadow` → Verify DAG node generated
2. Change SSH config → Verify STIG violation linked
3. Stress test: 1000 file events/sec → Verify no dropped events
4. Performance: Monitor 10k files → CPU usage < 5%

---

### 1.2 Network Trust Flow Modeling
**Priority**: 🔴 CRITICAL
**Estimated Complexity**: High
**Dependencies**: Sonar agent data

#### Objective
Model lateral movement paths and attack graphs by constructing network topology DAGs that show how compromise of one asset enables access to others.

#### Technical Approach

**File**: `pkg/network/topology.go`

```go
package network

type NetworkTopology struct {
    dag       *dag.DAG
    hosts     map[string]*Host
    connections map[string]*Connection
}

type Host struct {
    Hostname   string
    IPAddress  string
    Services   []Service      // Port 22 (SSH), 3389 (RDP)
    Accounts   []Account      // Service accounts, shared creds
    TrustLevel string         // Based on attestation state
}

type Connection struct {
    SourceHost string
    DestHost   string
    Protocol   string  // SSH, SMB, RDP
    Port       int
    AuthMethod string  // Password, Key, Kerberos
}

func (nt *NetworkTopology) ComputeLateralMovementPaths(compromisedHost string) []AttackPath {
    // Graph traversal to find reachable hosts
    // Example: Host A (SSH key) → Host B (shared sudo) → Host C (domain admin)
}
```

#### Attack Graph Generation

```go
// DAG representation of attack path
path := &AttackPath{
    Nodes: []*dag.Node{
        {Type: "asset:host", Content: "web-server-01"},
        {Type: "connection:ssh", Content: "web-server-01 → db-server-01"},
        {Type: "asset:host", Content: "db-server-01"},
        {Type: "connection:smb", Content: "db-server-01 → dc-01"},
        {Type: "asset:host", Content: "dc-01"},
    },
    BlastRadius: []string{"web-server-01", "db-server-01", "dc-01"},
    Severity: "CRITICAL",  // Pivot path to domain controller
}
```

#### Integration with Sonar
- Use Sonar scan data (open ports, services, banners)
- Correlate with credential findings (Gitleaks, config files)
- Map shared service accounts (e.g., Ansible automation user)

#### Success Criteria
- [ ] Generate network topology DAG from Sonar scans
- [ ] Identify lateral movement paths (A → B → C)
- [ ] Calculate blast radius for each compromised asset
- [ ] Link attack paths to MITRE ATT&CK techniques (T1021 - Remote Services)
- [ ] Visualize attack graphs (GraphViz/D3.js export)

#### Testing Plan
1. Simulate 3-tier architecture (web → app → db)
2. Inject shared SSH key between hosts
3. Verify lateral movement path detected
4. Stress test: 1000-node network → Path computation < 10 seconds

---

### 1.3 SBOM Integration for Supply Chain Visibility
**Priority**: 🟡 HIGH
**Estimated Complexity**: Medium
**Dependencies**: Arsenal tool integration

#### Objective
Generate Software Bill of Materials (SBOM) for deployed systems and correlate components with CVE database to detect supply chain vulnerabilities.

#### Technical Approach

**File**: `pkg/sbom/generator.go`

```go
package sbom

import (
    "github.com/CycloneDX/cyclonedx-go"
    "github.com/yourusername/khepra/pkg/intel"
)

type SBOMGenerator struct {
    scanner    string  // syft, trivy, grype
    cveLookup  *intel.VulnerabilityDB
}

func (sg *SBOMGenerator) GenerateSBOM(target string) (*cyclonedx.BOM, error) {
    // Scan container image, filesystem, or binary
    // Generate CycloneDX SBOM
    // Correlate components with CVE database
}

func (sg *SBOMGenerator) CorrelateVulnerabilities(sbom *cyclonedx.BOM) []VulnerableComponent {
    // Match SBOM components against intel.VulnerabilityDB
    // Example: log4j-core@2.14.1 → CVE-2021-44228 (Log4Shell)
}
```

#### DAG Integration

```go
// Link SBOM component to vulnerability
node := &dag.Node{
    Type: "component:library",
    Content: Component{
        Name:    "log4j-core",
        Version: "2.14.1",
        PURL:    "pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1",
    },
    Parents: []string{
        "asset:container:webapp:latest",
        "vuln:cve:CVE-2021-44228",
    },
}
```

#### Tool Integration
- **Syft**: Container image SBOM generation
- **Grype**: Vulnerability scanning
- **Trivy**: Multi-format support (containers, filesystems, git repos)

#### Success Criteria
- [ ] Generate CycloneDX SBOM for containers and filesystems
- [ ] Auto-correlate SBOM components with CVE database and STIGs
- [ ] Generate DAG nodes linking components → vulnerabilities
- [ ] Track SBOM changes over time (detect new vulnerable dependencies)
- [ ] Export SBOM for regulatory compliance (EO 14028)

#### Testing Plan
1. Scan vulnerable container (log4j 2.14.1) → Verify CVE-2021-44228 detected
2. Generate SBOM for production app → Verify all dependencies tracked
3. Performance: SBOM generation for 10GB container → < 5 minutes

---

## Phase 2: Enhanced Intelligence Capabilities (Q2 2026)

### 2.1 Threat Hunting Query Language
**Priority**: 🟡 HIGH
**Estimated Complexity**: High

#### Objective
Enable declarative queries against the DAG to hunt for specific threat patterns without manual correlation.

#### Query Examples

```
// Find hosts with SSH exposed AND outdated OpenSSL
FIND asset:host
WHERE connection:port:22 OPEN
  AND component:openssl VERSION < 3.0.0

// Identify blast radius of compromised host
TRAVERSE FROM asset:host:web-01
FOLLOW connection:*
MAX_DEPTH 3

// Detect privilege escalation paths
FIND PATH FROM asset:host:*
TO asset:host:domain-controller
WHERE connection:auth CONTAINS "shared_key"
```

#### Technical Approach
- Implement graph query DSL (inspired by Cypher/Gremlin)
- Compile queries to DAG traversal operations
- Support filtering, aggregation, path finding

---

### 2.2 Causal Risk Scoring (Context-Aware CVSS)
**Priority**: 🟡 HIGH
**Estimated Complexity**: Medium

#### Objective
Replace generic CVSS scores with context-aware risk scores that factor in public exposure, exploit availability, and business impact.

#### Scoring Formula

```
ContextualRisk = BaseScore × ExposureFactor × ExploitFactor × BusinessImpact

Where:
- BaseScore = CVSS score (0-10)
- ExposureFactor = 1.5 if Shodan-visible, 1.0 otherwise
- ExploitFactor = 2.0 if CISA KEV, 1.2 if public exploit exists
- BusinessImpact = 1.5 if critical service, 1.0 otherwise
```

#### Example
```
CVE-2023-1234:
  CVSS: 7.5 (HIGH)
  Shodan Visible: Yes → 1.5x
  CISA KEV: Yes → 2.0x
  Critical Service: Yes → 1.5x

  ContextualRisk = 7.5 × 1.5 × 2.0 × 1.5 = 33.75 → CRITICAL (rescaled to 10.0)
```

---

### 2.3 Adversarial Simulation Integration
**Priority**: 🟢 MEDIUM
**Estimated Complexity**: High

#### Objective
Integrate Atomic Red Team to validate STIG controls under adversarial pressure.

#### Technical Approach
- Execute MITRE ATT&CK techniques via Atomic Red Team
- Generate DAG nodes for simulated attacks
- Compare expected defenses (STIG controls) vs actual outcomes
- Flag controls that fail under testing

---

## Phase 3: Operational Automation (Q3 2026)

### 3.1 Automated Remediation Workflows
**Priority**: 🟢 MEDIUM
**Estimated Complexity**: High

#### Objective
Generate Ansible/Terraform playbooks from DAG findings to auto-remediate common vulnerabilities.

#### Example Workflow

```yaml
# Auto-generated from DAG finding: "Port 22 exposed to internet"
---
- name: Restrict SSH to internal network
  hosts: web-server-01
  tasks:
    - name: Update firewall rules
      ufw:
        rule: allow
        port: 22
        src: 10.0.0.0/8
    - name: Block public SSH
      ufw:
        rule: deny
        port: 22
        src: 0.0.0.0/0
```

#### Safety Gates
- Human approval required for destructive actions
- Dry-run mode (simulate remediation without applying)
- Rollback capability (revert to Genesis snapshot)

---

### 3.2 Continuous Compliance Attestation
**Priority**: 🟢 MEDIUM
**Estimated Complexity**: Medium

#### Objective
Generate real-time compliance attestations that update automatically as system state changes.

#### Implementation
- Monitor FIM events → Auto-update STIG control compliance
- Network topology changes → Recalculate attack surface
- CVE database updates → Rescan SBOM for new vulnerabilities
- Generate timestamped attestation reports for auditors

---

## Phase 4: GenAI Provenance & Code Safety (Q4 2026)

### 4.1 AI-Generated Code Tracking
**Priority**: 🟢 MEDIUM
**Estimated Complexity**: Low

#### Objective
Tag AI-generated code in SBOM with model ID and prompt hash to prevent IP contamination.

#### Metadata Format

```json
{
  "component": "utils/encryption.go",
  "generator": {
    "type": "ai",
    "model": "gpt-4-2024-11-20",
    "prompt_hash": "sha256:abc123...",
    "timestamp": "2025-12-25T10:30:00Z",
    "vetted": false
  },
  "signature": "dilithium3:abc123def456..."
}
```

#### Compliance Gate
- Flag unvetted AI code for human review before production
- Track lineage in DAG: `code:file` → `generator:ai:gpt4`
- Generate reports for IP due diligence (VC/M&A)

---

## Implementation Priorities

### Immediate (Q1 2026)
1. ✅ **FIM Implementation** (pkg/fim/watcher.go)
2. ✅ **Network Topology Modeling** (pkg/network/topology.go)
3. ✅ **SBOM Generation** (pkg/sbom/generator.go)

### Short-Term (Q2 2026)
4. **Threat Hunting Query Language** (pkg/dag/query.go)
5. **Causal Risk Scoring** (pkg/intel/context_risk.go)

### Medium-Term (Q3 2026)
6. **Automated Remediation** (pkg/remediation/playbook.go)
7. **Adversarial Simulation** (pkg/arsenal/atomic_red_team.go)

### Long-Term (Q4 2026)
8. **AI Code Provenance** (pkg/sbom/ai_metadata.go)
9. **Continuous Attestation** (pkg/attest/continuous.go)

---

## Success Metrics

### Technical Metrics
- **FIM Coverage**: 100+ critical files monitored per host
- **Network Modeling**: Lateral movement paths detected in < 10s
- **SBOM Accuracy**: 95%+ component coverage for containers
- **Query Performance**: Threat hunting queries complete in < 5s

### Business Metrics
- **CMMC Level 3 Certification**: Achieved by Q2 2026
- **False Positive Rate**: < 5% (high signal-to-noise)
- **Remediation Time**: 50% reduction via automation
- **Audit Efficiency**: Continuous attestation vs annual audits

---

## Risk Mitigation

### Technical Risks
- **FIM Performance**: Monitor 10k+ files without excessive CPU usage
  - Mitigation: Implement selective monitoring (critical paths only)

- **Network Topology Complexity**: 1000-node graphs may be slow to compute
  - Mitigation: Incremental graph updates, caching common queries

- **SBOM False Positives**: Component version mismatches
  - Mitigation: Fuzzy matching, manual verification for critical components

### Organizational Risks
- **Scope Creep**: Adding "leaves" instead of "roots"
  - Mitigation: Strict architectural review (roots-first principle)

- **Resource Constraints**: Limited engineering bandwidth
  - Mitigation: Phase 1 features only (defer Phases 2-4 if needed)

---

## Conclusion

This roadmap focuses on **deepening the roots** of the Khepra Protocol:

1. **FIM**: Continuous verification (not just snapshots)
2. **Network Modeling**: Blast radius analysis (not isolated findings)
3. **SBOM**: Supply chain visibility (not blind dependencies)
4. **Threat Hunting**: Declarative queries (not manual correlation)

By implementing these foundational capabilities, Khepra will move from "compliance attestation" to "causal security proof"—the difference between documenting controls and proving they work under adversarial pressure.

**Next Step**: Begin Phase 1 implementation (FIM, Network Topology, SBOM).

---

**Document Maintained By**: Khepra Protocol Core Team
**Review Cadence**: Monthly (adjust priorities based on user feedback)

---

# Khepra x SouHimBou.AI Integration Roadmap ("Father & Son")

> **CONFIDENTIAL**: For Internal Dev Swarm Only.
> **Subject**: Integration of Khepra Protocol (The Father) as the Shadow Sentinel for SouHimBou.AI (The Son).

## Mission Directive
**SouHimBou.AI** is the public face—a super-polymorphic compliance platform.
**Khepra Protocol** is the hidden protector—a Post-Quantum Cryptography (PQC) layer and "Shadow OS" that ensures the integrity, secrecy, and survival of the platform.

Khepra acts as a **Secret Protector Backdoor** and **Integrity Engine**. If SouHimBou is the body, Khepra is the immune system and the conscience.

---

## 📅 Phase 1: The Tether (Sidecar & Heartbeat)
*Goal: Establish a secure, local link between the Node.js application and the Khepra Daemon.*

### For SouHimBou Dev (Next.js/TS)
1.  **Daemon Check**: fast-fail startup if Khepra Agent is not running on port `45444`.
2.  **The Umbilical Cord**: Implement a `KhepraClient` singleton in TypeScript that talks to `http://127.0.0.1:45444`.
3.  **Registration**: On startup, SouHimBou must "confess" its identity to Khepra.
    *   Call Khepra: `POST /dag/add` with `action: "boot"`, `symbol: "SouHimBou-Core"`.
4.  **Pulse**: Every 30 seconds, send a heartbeat to Khepra. If missed, Khepra flags the system as "Silent/Compromised".

### For Khepra Dev (Go)
*   Already implemented: Agent running on `45444`, DAG storage.
*   **Next**: Add strict validation for "Son" signatures (ensure requests come from localhost only).
*   **Note**: SouHimBou (the client) just needs to know which port to knock on.

### Future "Shadow Mode" Upgrades (Roadmap Items)
1.  **Port Knocking**: Khepra stays completely silent (doesn't even ACK TCP) until a specific "magic packet" is received.
2.  **Mutual TLS (mTLS)**: Even if someone gets on the localhost (e.g., malware), they can't talk to Khepra without a specific client certificate signed by the "Father" CA.

---

## 📅 Phase 2: The Veil (PQC Data Obfuscation)
*Goal: "Weave" sensitive data so even the DB Admin cannot read it without Khepra.*

### For SouHimBou Dev (Next.js/TS)
1.  **Intercept Writes**: In your Supabase/Postgres repository layer, before saving sensitive fields (e.g., STIG findings, API Keys):
    *   Call Khepra: `POST /adinkra/weave` (Payload: Raw Data).
    *   Receive: `x_khepra_weave` (The PQC/Nkyinkyim obfuscated string).
    *   Save ONLY the `x_khepra_weave` string to the database.
2.  **Intercept Reads**: When fetching data for authenticated Admin flows:
    *   Call Khepra: `POST /adinkra/unweave`.
    *   Display cleartext only in memory; never log it.

### For Khepra Dev (Go)
*   **Endpoint**: Expose `pkg/nkyinkyim.Weave` and `Unweave` via the Agent API.
*   **Key Management**: Ensure Dilithium/Kyber keys are persistent and effectively "seal" the data.

---

## 📅 Phase 3: The Watcher (File Integrity & "Backdoor" Access)
*Goal: Khepra monitors the codebase for unauthorized mutations (e.g., XSS injection, rogue devs).*

### For SouHimBou Dev (Next.js/TS)
1.  **Manifest Generation**: During build time (`npm run build`), generate a `manifest.json` containing SHA-256 hashes of all `.tsx` and `.ts` files.
2.  **Submission**: Post this manifest to Khepra (`POST /attest/codebase`).

### For Khepra Dev (Go)
1.  **FIM (File Integrity Monitor)**: Khepra background routine periodically scans the `SouHimBou/src` directory.
2.  **Comparison**: If a file changes and its hash does not match the last signed manifest in the DAG:
    *   **Action**: LOCK the `Unweave` endpoint. (Stop serving decrypted data).
    *   **Alert**: Log a "Mutation Detected" event in the DAG.
3.  **The Backdoor**:
    *   Implement a specialized "God Mode" CLI command in Khepra (`khepra override --unlock`).
    *   This allows the "Father" (Operator) to override the lockdown manually.

---

## 📅 Phase 4: The Judgment (Gateway Logic)
*Goal: Use Khepra as the final authorization gate for High-Risk Actions.*

### For SouHimBou Dev (Next.js/TS)
1.  **LLM Guardrails**: Before sending a prompt to GPT-5/Claude via the `LLMGatewaySDK`:
    *   Send the prompt hash to Khepra.
    *   Khepra returns `ALLOWED` or `DENIED` based on internal heuristics (or simple "killswitch" status).

---

## Technical Contract (API Spec Draft)

**Base URL**: `http://127.0.0.1:45444`

| Method | Endpoint | Purpose |
| method | endpoint | purpose |
| --- | --- | --- |
| `GET` | `/healthz` | Check if Father is watching. |
| `POST` | `/dag/add` | Log an immutable event (Audit Log). |
| `POST` | `/adinkra/weave` | Encrypt/Obfuscate data (PQC). |
| `POST` | `/adinkra/unweave`| Decrypt data (Requires Valid State). |
| `POST` | `/attest/verify` | Verify system integrity before critical ops. |
