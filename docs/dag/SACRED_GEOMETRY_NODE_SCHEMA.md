# Sacred Geometry DAG Node Schema

**Version**: 1.0.0
**Status**: ✅ Complete
**Created**: 2026-01-19

---

## Executive Summary

The Khepra DAG uses **Sacred Geometry** principles from the Khepra Lattice to define a hierarchical, semantically-rich node/edge schema. This approach leverages:

1. **Sephirot (Tree of Life)** - 10-level node type hierarchy
2. **Merkaba (Dual Tetrahedrons)** - Node polarity classification
3. **Hypercube (16 vertices)** - 4-bit state encoding

This schema unifies **event-based**, **agent-based**, and **security-based** node types into a coherent ontology suitable for 2D and 3D DAG visualization.

---

## 1. The Sephirot Hierarchy (10 Node Types)

### Visual Representation

```
                    ┌──────────────┐
                    │    KETER     │ (10) Meta-Governance
                    │  Crown/Will  │      DoD Policies, NIST Framework
                    └──────┬───────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                                   │
    ┌────▼────┐                         ┌───▼────┐
    │ CHOKMAH │ (9) Strategic            │ BINAH  │ (8) Tactical
    │ Wisdom  │     Control              │ Under. │     Control
    └────┬────┘     STIG Baselines       └───┬────┘     Specific STIGs
         │                                    │
         └─────────────────┬──────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                                   │
    ┌────▼────┐                         ┌───▼─────┐
    │ CHESED  │ (7) Asset                │ GEBURAH │ (6) Threat
    │ Mercy   │     Hosts/Containers     │ Severity│     CVEs/Vulns
    └────┬────┘                          └───┬─────┘
         │                                   │
         └─────────────────┬──────────────────┘
                           │
                     ┌─────▼──────┐
                     │ TIPHERETH  │ (5) Finding
                     │  Balance   │     STIG Findings
                     └─────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                                   │
    ┌────▼────┐                         ┌───▼────┐
    │ NETZACH │ (4) Remediation          │  HOD   │ (3) Attestation
    │ Victory │     Fixes/Patches        │ Glory  │     Audit Logs
    └────┬────┘                          └───┬────┘
         │                                   │
         └─────────────────┬──────────────────┘
                           │
                     ┌─────▼──────┐
                     │   YESOD    │ (2) Agent Action
                     │ Foundation │     AI Decisions
                     └─────┬──────┘
                           │
                     ┌─────▼──────┐
                     │  MALKUTH   │ (1) Raw Event
                     │  Kingdom   │     FIM/Logs/Metrics
                     └────────────┘
```

### Node Type Mapping

| Level | Sephira | Node Type | Semantic Meaning | Examples |
|-------|---------|-----------|------------------|----------|
| **10** | Keter | `meta_governance` | Divine Will, Ultimate Authority | DoD Policy Mandates, NIST Framework, Executive Orders |
| **9** | Chokmah | `strategic_control` | Wisdom, High-Level Guidance | STIG Baselines, NIST 800-53 Control Families |
| **8** | Binah | `tactical_control` | Understanding, Specific Rules | RHEL-08-010030, Individual STIG Controls |
| **7** | Chesed | `asset` | Mercy, Abundance, Resources | Hosts, Containers, VMs, Applications |
| **6** | Geburah | `threat` | Severity, Judgment, Danger | CVEs, Vulnerabilities, Misconfigurations |
| **5** | Tiphereth | `finding` | Balance, Beauty, Harmony | STIG Findings (Open/NotAFinding/NotReviewed) |
| **4** | Netzach | `remediation` | Victory, Endurance | Fix Actions, Patches, Configuration Changes |
| **3** | Hod | `attestation` | Splendor, Glory, Proof | Audit Logs, Verification Proofs, Signatures |
| **2** | Yesod | `agent_action` | Foundation, Automation | AI Agent Decisions, Autonomous Actions |
| **1** | Malkuth | `raw_event` | Kingdom, Physical Reality | FIM Events, Log Entries, Metrics, Raw Data |

### Path to Keter (Governance Traceability)

Every node can trace its **authority path** up the Tree of Life to the root governance policy:

```
Example: STIG Finding → STIG Control → STIG Baseline → NIST Framework → DoD Policy
         (Tiphereth)     (Binah)        (Chokmah)       (Keter)         (Keter)
```

This ensures **full compliance traceability** for audits.

---

## 2. The Merkaba Polarity System

### Visual Representation

```
                    ▲
                   ╱│╲
                  ╱ │ ╲
                 ╱  │  ╲
                ╱   │   ╲
               ╱    │    ╲
              ╱     │     ╲
             ╱      │      ╲
            ╱───────┼───────╲
           ◄────────●────────►  SUN (Active/Forward ⟳)
            ╲       │       ╱   Threats, Findings, Violations
             ╲      │      ╱
              ╲     │     ╱
               ╲    │    ╱
                ╲   │   ╱
                 ╲  │  ╱
                  ╲ │ ╱
                   ╲│╱
                    ▼

                    ▲
                   ╱│╲
                  ╱ │ ╲
                 ╱  │  ╲
                ╱   │   ╲
               ╱    │    ╲
              ╱     │     ╲
             ╱      │      ╲
            ╱───────┼───────╲
           ◄────────●────────►  EARTH (Passive/Reverse ⟲)
            ╲       │       ╱   Assets, Controls, Remediations
             ╲      │      ╱
              ╲     │     ╱
               ╲    │    ╱
                ╲   │   ╱
                 ╲  │  ╱
                  ╲ │ ╱
                   ╲│╱
                    ▼

                    ●          SEED (Neutral/Stillness)
                                Attestations, Logs, Observations
```

### Polarity Classification

| Polarity | Spin | Symbol | Node Types | Color (3D Viz) | Semantic Meaning |
|----------|------|--------|------------|----------------|------------------|
| **Sun** | Forward ⟳ | 🔴 | `threat`, `finding` | Red/Orange | Active, Dangerous, Requires Action |
| **Earth** | Reverse ⟲ | 🔵 | `asset`, `strategic_control`, `tactical_control`, `remediation` | Blue/Green | Passive, Protective, Stabilizing |
| **Seed** | Stillness | ⚪ | `meta_governance`, `attestation`, `agent_action`, `raw_event` | White/Gray | Neutral, Observational, Foundational |

### Merkaba Flow Types (Edge Classification)

| Flow Type | From → To | Semantic Meaning | Example |
|-----------|-----------|------------------|---------|
| `sun_to_sun` | Threat → Threat | Threat propagation | CVE enables exploit |
| `earth_to_earth` | Control → Control | Control inheritance | Policy → Implementation |
| `sun_to_earth` | Threat → Asset | Attack targeting | Vuln affects Host |
| `earth_to_sun` | Remediation → Finding | Mitigation | Patch remediates Finding |
| `seed_to_any` | Attestation → Any | Verification | Audit log attests action |
| `any_to_seed` | Any → Raw Event | Event generation | Action generates log |

---

## 3. The Hypercube State Encoding (16 States)

### 4-Bit State Structure

```
┌─────────────────────────────────────────────┐
│  Bit 3   │  Bit 2    │  Bit 1     │  Bit 0   │
│ Severity │ Verified  │ Status     │ Lifecycle│
├──────────┼───────────┼────────────┼──────────┤
│ 0 = Low  │ 0 = No    │ 0 = Fixed  │ 0 = Arch │
│ 1 = High │ 1 = Yes   │ 1 = Open   │ 1 = Live │
└─────────────────────────────────────────────┘
```

### State Code Examples

| Code | Binary | Severity | Verified | Status | Lifecycle | Interpretation |
|------|--------|----------|----------|--------|-----------|----------------|
| `0` | `0000` | Low | No | Fixed | Archived | Closed low-severity finding |
| `1` | `0001` | Low | No | Fixed | Live | Recently fixed low-sev |
| `7` | `0111` | Low | Yes | Open | Live | Verified low-sev open finding |
| `10` | `1010` | High | No | Fixed | Archived | Resolved critical issue |
| `15` | `1111` | High | Yes | Open | Live | **CRITICAL ALERT** |

### Full State Object

```json
{
  "severity": "critical",
  "verified": true,
  "status": "open",
  "lifecycle": "live",
  "state_code": 15
}
```

### State Transitions

```
     ┌─────────────────┐
     │  Raw Event (1)  │ state_code: 1 (Low, No, Fixed, Live)
     └────────┬────────┘
              │ AI Agent analyzes
              ▼
     ┌─────────────────┐
     │  Finding (15)   │ state_code: 15 (High, Yes, Open, Live)
     └────────┬────────┘
              │ Remediation applied
              ▼
     ┌─────────────────┐
     │  Finding (14)   │ state_code: 14 (High, Yes, Fixed, Live)
     └────────┬────────┘
              │ Archival
              ▼
     ┌─────────────────┐
     │  Finding (12)   │ state_code: 12 (High, Yes, Fixed, Archived)
     └─────────────────┘
```

---

## 4. Edge Semantics

### Edge Types

| Edge Type | Meaning | Typical Flow | Example |
|-----------|---------|--------------|---------|
| `causes` | A causes B | Sun → Sun | Misconfiguration causes vulnerability |
| `enables` | A enables B | Sun → Sun | Vulnerability enables exploit |
| `requires` | A requires B | Any → Any | Control requires asset |
| `mitigates` | A mitigates B | Earth → Sun | Control mitigates threat |
| `remediates` | A remediates B | Earth → Sun | Remediation fixes finding |
| `attests` | A attests B | Seed → Any | Audit log verifies action |
| `derives_from` | A derives from B | Any → Governance | Control implements policy |
| `implements` | A implements B | Earth → Earth | STIG implements NIST |
| `violates` | A violates B | Sun → Earth | Finding violates control |
| `complies_with` | A complies with B | Earth → Earth | Asset complies with control |
| `spawns` | A spawns B | Agent → Any | Agent spawns action |
| `supersedes` | A supersedes B | Any → Any | New policy replaces old |

### Edge Weight

```json
{
  "strength": 0.85,      // 0.0 - 1.0 (how strong is relationship)
  "confidence": 0.95,    // 0.0 - 1.0 (how certain are we)
  "priority": 5          // 1-5 (processing priority)
}
```

### Sephirot Path (Tree Navigation)

```json
{
  "from_level": 5,       // Tiphereth (Finding)
  "to_level": 8,         // Binah (Tactical Control)
  "ascends": true,       // Moving toward Keter (governance)
  "crosses_pillar": false
}
```

---

## 5. Complete Schema Examples

### Example 1: Critical CVE (Threat Node)

```json
{
  "id": "a8f5e2c1b9d4...",
  "parents": [],
  "node_type": "threat",
  "polarity": "sun",
  "state": {
    "severity": "critical",
    "verified": true,
    "status": "open",
    "lifecycle": "live",
    "state_code": 15
  },
  "sephirot": {
    "sephira": "Geburah",
    "level": 6
  },
  "action": "CVE-2024-12345 detected",
  "symbol": "⚠️",
  "timestamp": "2026-01-19T10:30:00Z",
  "attributes": {
    "threat": {
      "cve_id": "CVE-2024-12345",
      "cvss_score": 9.8,
      "attack_vector": "network"
    }
  },
  "hash": "a8f5e2c1b9d4...",
  "signature": "base64_dilithium_sig..."
}
```

### Example 2: Host Asset (Earth Node)

```json
{
  "id": "c3d7a1f9e2b8...",
  "parents": [],
  "node_type": "asset",
  "polarity": "earth",
  "state": {
    "severity": "low",
    "verified": true,
    "status": "open",
    "lifecycle": "live",
    "state_code": 5
  },
  "sephirot": {
    "sephira": "Chesed",
    "level": 7
  },
  "action": "RHEL 8 server registered",
  "symbol": "🖥️",
  "timestamp": "2026-01-19T10:00:00Z",
  "attributes": {
    "asset": {
      "hostname": "prod-web-01",
      "ip_address": "10.0.1.50",
      "asset_type": "host",
      "classification": "cui"
    }
  },
  "hash": "c3d7a1f9e2b8...",
  "signature": "base64_dilithium_sig..."
}
```

### Example 3: Remediation → Finding Edge

```json
{
  "id": "edge_abc123...",
  "from": "remediation_node_id",
  "to": "finding_node_id",
  "edge_type": "remediates",
  "directionality": "forward",
  "weight": {
    "strength": 1.0,
    "confidence": 0.95,
    "priority": 5
  },
  "merkaba_flow": "earth_to_sun",
  "sephirot_path": {
    "from_level": 4,
    "to_level": 5,
    "ascends": true
  },
  "verified": true,
  "timestamp": "2026-01-19T11:00:00Z"
}
```

---

## 6. Visualization Mappings

### 2D DAG Visualization

| Property | Visual Encoding |
|----------|-----------------|
| Node Type | **Shape** (circle, square, diamond, hexagon) |
| Polarity | **Color** (red=sun, blue=earth, gray=seed) |
| Severity | **Size** (larger = more severe) |
| State Code | **Border thickness** (verified = thick border) |
| Sephirot Level | **Y-position** (higher = closer to Keter) |

### 3D DAG Visualization

| Property | Visual Encoding |
|----------|-----------------|
| Node Type | **Geometry** (sphere, cube, tetrahedron) |
| Polarity | **Rotation** (sun=CW, earth=CCW, seed=static) |
| Severity | **Glow/Pulse** (critical nodes pulse) |
| Sephirot Level | **Y-axis** (vertical Tree of Life) |
| Verified | **Particle effects** (verified nodes emit particles) |

---

## 7. Implementation Roadmap

### ✅ Phase 1: Schema Definition (COMPLETE)
- [x] JSON Schema for nodes/edges
- [x] TypeScript types
- [x] Go structs
- [x] Documentation

### 🔄 Phase 2: Migration (IN PROGRESS)
- [ ] Migrate existing DAG nodes to new schema
- [ ] Add Sephirot metadata to all nodes
- [ ] Compute Hypercube state codes
- [ ] Add Merkaba polarity classification

### 🔜 Phase 3: Visualization Integration
- [ ] Update D3.js visualization to use Sephirot hierarchy
- [ ] Add Merkaba polarity colors
- [ ] Implement Hypercube state visualizations
- [ ] Build 3D Sacred Geometry view

### 🔜 Phase 4: Advanced Features
- [ ] Path-to-Keter governance tracing
- [ ] Sephirot-based filtering
- [ ] Merkaba flow analysis
- [ ] State transition animations

---

## 8. Benefits of Sacred Geometry Approach

### 1. **Hierarchical Clarity**
- 10 distinct node types map to clear security ontology
- Natural ordering (Malkuth → Keter = Data → Policy)

### 2. **Visual Intuitiveness**
- Merkaba polarity (red/blue) instantly shows threat vs. protection
- Sephirot levels create natural vertical layout

### 3. **Semantic Richness**
- Edge types encode precise relationships
- Path-to-Keter enables compliance traceability

### 4. **Cultural Alignment**
- Builds on existing Khepra Lattice architecture
- Leverages Adinkra symbols already in use

### 5. **State Compression**
- 4-bit Hypercube encoding enables efficient state queries
- 16 states cover all practical node conditions

---

## 9. FAQ

**Q: Can one host have multiple nodes?**
A: Yes. A host would be one `asset` node (Chesed), but it can have multiple `finding` nodes (Tiphereth), `threat` nodes (Geburah), etc. The host asset is connected via edges.

**Q: How do I query for all critical findings?**
A: Filter by `node_type: "finding"` AND `state.severity: "critical"` OR `state.state_code >= 8` (high-severity bit set).

**Q: What if a node doesn't fit the hierarchy?**
A: Use `raw_event` (Malkuth) as a catch-all, then classify it properly later.

**Q: Can nodes change Sephira levels?**
A: No. Sephira is determined by `node_type`, which is immutable. If classification changes, create a new node.

---

## 10. Related Documents

- [Khepra Lattice Specification](../architecture/ADINKHEPRA_LATTICE_SPEC.md)
- [DAG Implementation](../../pkg/dag/dag.go)
- [AgentDAG TypeScript](../../souhimbou_ai/SouHimBou.AI/src/khepra/dag/AgentDAG.ts)
- [Optimization Plan](../../OPTIMIZATION_PLAN.md)

---

**Document Status**: ✅ Complete
**Last Updated**: 2026-01-19
**Maintainer**: Giza Cyber Shield Team
