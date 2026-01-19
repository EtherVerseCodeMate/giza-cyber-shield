# Egyptian Mythology Licensing System - Integration Guide

**Status**: ✅ Complete  
**Version**: 1.0.0  
**Date**: 2026-01-19  
**Author**: Khepra Protocol Architecture Team

---

## Overview

The Khepra Protocol licensing system integrates **Ancient Egyptian cosmology** with modern security and business models:

- **1 License = 1 Merkaba** — Each license provisions a complete Merkaba (rotating cube) that houses the organization's DAG, organized along the Sephirot Tree path
- **4 License Tiers** — Khepri (Scout), Ra (Hunter), Atum (Hive), Osiris (Pharaoh)
  - **Khepri (Scout)**: $50/mo, 1 node, Malkuth/Yesod access (Khepri, Ptah authority)
  - **Ra (Hunter)**: $500/mo, 3 nodes, through Tiphereth (7 deity authorities)
  - **Atum (Hive)**: $2,000/mo, 10 nodes, through Chesed (8 deity authorities)
  - **Osiris (Pharaoh)**: Custom pricing, unlimited nodes, full Sephirot access (all deities)
- **Sephirot Access Control** — Each tier unlocks progressively higher Tree of Life levels
  - Malkuth (Raw Events) & Yesod (Agent Action) → Scout tier
  - Through Tiphereth (Finding) → Hunter tier
  - Through Chesed (Asset) → Hive tier
  - Full Sephirot tree (Keter) → Pharaoh tier
- **Node-to-Deity Mapping** — 10 Egyptian deities govern Sephirot access:
  - Khepri (Malkuth - Birth), Ptah (Yesod - Foundation), Anubis (Hod - Proof)
  - Isis (Netzach - Healing), Ma'at (Tiphereth - Balance), Horus (Geburah - Severity)
  - Ra (Chesed - Abundance), Thoth (Binah - Understanding), Osiris (Chokmah - Wisdom)
  - Atum (Keter - Crown)
- **Merkaba Tri-Polar Revenue Model** — Hybrid billing based on three dimensions:
  - **Sun** ☀️ (Active Threats): $0.10/scan + $1.00/critical + $0.25/high + $0.05/medium
  - **Earth** 🌍 (Assets Protected): $50/node + $5/SAN + $25/instance
  - **Seed** ⚪ (Evidence/Storage): $0.01/GB-day + $10/report + $0.005/archive GB
- **Hypercube Fates** — Node states (0-15) mapped to Egyptian afterlife outcomes
  - State 0: Field of Reeds (Paradise)
  - State 15: Ammit the Devourer (Critical alert)
- **Shu Breath** — Air-gapped offline licensing for Pharaoh tier (365-day validity)

---

## Files Implemented

### 1. [pkg/license/egyptian_tiers.go](pkg/license/egyptian_tiers.go)
Core license management with Egyptian tier system.

**Key Types:**
- `EgyptianTier` - Khepri, Ra, Atum, Osiris
- `License` - License entity with node quota tracking
- `LicenseManager` - Central license enforcement
- `Deity` - Egyptian deities governing Sephirot access

**Key Functions:**
- `CreateLicense()` - Provision new license
- `CanCreateNode()` - Enforce node quota + Sephirot access
- `RegisterNodeCreation()` - Track node consumption
- `WeighHeart()` - Compliance debt validation
- `UpgradeLicense()` - Tier upgrade logic
- `GenerateOfflineLicense()` - Shu Breath creation
- `ValidateOfflineLicense()` - Air-gap license check

### 2. [pkg/dag/egyptian_fates.go](pkg/dag/egyptian_fates.go)
Hypercube state to Egyptian fate mapping and judgment system.

**Key Types:**
- `EgyptianFate` - Field of Reeds, House of Osiris, Boat of Ra, Lake of Fire, Devourer
- `JudgmentResult` - Weighing of the Heart outcome
- `HorusMetrics` - Eye of Horus KPI fractions

**Key Functions:**
- `StateCodeToFate()` - Map 4-bit state code to Egyptian fate
- `PerformJudgment()` - Execute weighing of heart ceremony
- `FateAlert()` - Generate critical alerts (especially Ammit)
- `HypercubeStateDescription()` - Detailed state explanation

### 3. [pkg/billing/merkaba_pricing.go](pkg/billing/merkaba_pricing.go)
Hybrid Merkaba-based billing engine.

**Key Types:**
- `Polarity` - Sun (threats), Earth (assets), Seed (storage)
- `SunMetrics` - Threat-based consumption
- `EarthMetrics` - Asset-based seat pricing
- `SeedMetrics` - Storage-based retention
- `HybridBillingCalculator` - Monthly cost computation
- `MonthlyCost` - Billing statement output

**Key Functions:**
- `CalculateSunRevenue()` - Threat-based pricing
- `CalculateEarthRevenue()` - Seat-based pricing
- `CalculateSeedRevenue()` - Storage-based pricing
- `CalculateMonthlyCost()` - Unified hybrid pricing

---

## Integration Points

### With DAG System (pkg/dag/dag.go)

```go
import "github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"

// Before creating a node, check license
func (m *Memory) Add(n *Node, parents []string, licenseID string) error {
    // Check license quota and Sephirot access
    sephirotLevel := license.GetSephirotLevel(n.Type)
    if err := licenseManager.CanCreateNode(licenseID, n.Type, sephirotLevel); err != nil {
        return fmt.Errorf("license violation: %w", err)
    }
    
    // Add node to DAG
    m.mu.Lock()
    m.nodes[n.ID] = n
    m.mu.Unlock()
    
    // Register node creation with license
    return licenseManager.RegisterNodeCreation(licenseID, n.ID, sephirotLevel)
}
```

### With Attestation System (pkg/attest/attest.go)

```go
import "github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"

// When creating attestation, evaluate Egyptian fate
func (a *RiskAttestation) Seal(licenseManager *license.LicenseManager) error {
    // Weigh the heart (compliance check)
    complianceDebt := CalculateComplianceDebt(a.Findings)
    justified, err := licenseManager.WeighHeart(a.SnapshotID)
    
    if !justified {
        return fmt.Errorf("Ammit the Devourer awaits: %w", err)
    }
    
    // Perform Egyptian judgment
    stateCode := ComputeHypercubeState(a.Findings)
    judgment := dag.PerformJudgment(a.SnapshotID, stateCode, complianceDebt, len(a.Findings))
    
    // Alert if critical
    if judgment.EscalationLevel == "pharaoh" {
        log.Error(dag.FateAlert(stateCode))
    }
    
    return nil
}
```

### With Agent API (cmd/agent/main.go)

```go
import (
    "github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
    "github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/billing"
)

var licenseManager = license.NewLicenseManager()

// POST /nodes - Create a new node
func handleCreateNode(w http.ResponseWriter, r *http.Request) {
    licenseID := r.Header.Get("X-License-ID")
    var nodeReq struct {
        Type     string `json:"type"`
        Symbol   string `json:"symbol"`
        Action   string `json:"action"`
    }
    
    json.NewDecoder(r.Body).Decode(&nodeReq)
    
    // Enforce license
    sephirotLevel := license.GetSephirotLevel(nodeReq.Type)
    if err := licenseManager.CanCreateNode(licenseID, nodeReq.Type, sephirotLevel); err != nil {
        http.Error(w, err.Error(), http.StatusForbidden)
        return
    }
    
    // Create node in DAG
    node := &dag.Node{
        Action: nodeReq.Action,
        Symbol: nodeReq.Symbol,
        Type:   nodeReq.Type,
    }
    
    if err := dagStore.Add(node, []string{}); err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    // Register with license
    licenseManager.RegisterNodeCreation(licenseID, node.ID, sephirotLevel)
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(node)
}

// GET /billing/monthly - Monthly billing statement
func handleBillingStatement(w http.ResponseWriter, r *http.Request) {
    licenseID := r.URL.Query().Get("license_id")
    
    lic, _ := licenseManager.GetLicense(licenseID)
    baseCost := license.GetTierBaseCost(string(lic.Tier))
    
    // Gather metrics
    calc := billing.NewHybridBillingCalculator(baseCost)
    
    // Set actual usage from database
    calc.SunMetrics.TotalScans = getScansCount(licenseID)
    calc.SunMetrics.CriticalFindings = getCriticalCount(licenseID)
    calc.EarthMetrics.ActiveNodes = lic.NodeCount
    calc.SeedMetrics.DAGStorageGB = getStorageGB(licenseID)
    
    result := calc.CalculateMonthlyCost()
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
}
```

### With Compliance System (pkg/stig/)

```go
import "github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"

// STIG report generation includes deity mapping
func ExportSTIGReport(findings []Finding, licenseID string) error {
    lic, _ := licenseManager.GetLicense(licenseID)
    
    // Group findings by Sephirot access level
    for sephirotLevel := 1; sephirotLevel <= 10; sephirotLevel++ {
        if !canAccessSephirot(lic, sephirotLevel) {
            continue // Skip inaccessible levels
        }
        
        deity := license.GetRequiredDeity(sephirotLevel)
        // Add deity authority stamp to report
        addDeitySignature(deity, sephirotLevel)
    }
    
    return nil
}
```

---

## License Tier Specifications

### Khepri (Scout) - $50/month
```go
TierKhepri: {
    Name:              "Scout",
    Price:             50,
    NodeQuota:         1,
    MonthlyRetention:  1 day,
    Features: []string{
        "basic-scan",
        "community-pqc",
        "limited-dashboard",
    },
    DeityAuthorities: []Deity{Khepri, Ptah, Anubis},
    SephirotAccess:   []int{1, 2}, // Malkuth, Yesod
}
```

### Ra (Hunter) - $500/month
```go
TierRa: {
    Name:              "Hunter",
    Price:             500,
    NodeQuota:         3,
    MonthlyRetention:  7 days,
    ConcurrentScans:   3,
    AIQueriesPerMonth: 100,
    Features: []string{
        "advanced-scan",
        "premium-pqc",
        "stig-nist",
        "threat-detection",
        "full-dashboard",
    },
    DeityAuthorities: []Deity{...}, // 7 deities
    SephirotAccess:   []int{1, 2, 3, 4, 5}, // through Tiphereth
}
```

### Atum (Hive) - $2,000/month
```go
TierAtum: {
    Name:              "Hive",
    Price:             2000,
    NodeQuota:         10,
    MonthlyRetention:  30 days,
    ConcurrentScans:   10,
    AIQueriesPerMonth: 1000,
    Features: []string{
        "all-hunter-features",
        "auto-remediation",
        "sso-rbac",
        "multi-framework",
        "advanced-threat-hunting",
    },
    DeityAuthorities: []Deity{...}, // 8 deities
    SephirotAccess:   []int{1, 2, 3, 4, 5, 6, 7}, // through Chesed
}
```

### Osiris (Pharaoh) - Custom
```go
TierOsiris: {
    Name:              "Pharaoh",
    Price:             0, // Custom pricing
    NodeQuota:         -1, // Unlimited
    MonthlyRetention:  365 days,
    ConcurrentScans:   -1, // Unlimited
    AIQueriesPerMonth: -1, // Unlimited
    Features: []string{
        "all-hive-features",
        "red-team-mode",
        "commando-mode",
        "air-gap-licensing",
        "hsm-integration",
        "eternal-license",
    },
    DeityAuthorities: []Deity{...}, // All 10 deities
    SephirotAccess:   []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}, // Full access
}
```

---

## Hybrid Billing Formula

```
Monthly Cost = BaseTier + SunRevenue + EarthRevenue + SeedRevenue

Where:
  BaseTier      = Tier subscription ($50-$2000)
  SunRevenue    = (Scans × $0.10) + (Criticals × $1.00) + (High × $0.25) + (Medium × $0.05)
  EarthRevenue  = (Nodes × $50.00) + (SANs × $5.00) + (Instances × $25.00)
  SeedRevenue   = (GB-Days × $0.01) + (Reports × $10.00) + (Archive GB × $0.005)
```

**Example (Hunter Tier):**
```
Base:           $500
+ 200 scans:    $20
+ 5 criticals:  $5
+ 3 nodes:      $150
+ 100 GB-days:  $1
─────────────
Total:          $676/month
```

---

## Hypercube State Fates

| State Code | Binary | Fate | Deity | Action Required |
|-----------|--------|------|-------|-----------------|
| **0** | `0000` | Field of Reeds | Ma'at | None - Paradise achieved |
| **1** | `0001` | House of Osiris | Osiris | Monitor archived state |
| **7** | `0111` | Boat of Ra | Ra | Continue verification |
| **8** | `1000` | Lake of Fire | Sekhmet | Review archived critical |
| **15** | `1111` | **Ammit Devourer** | **CRITICAL** | **Immediate remediation** |

---

## Air-Gap Licensing (Shu Breath)

### Generation
```bash
adinkhepra enroll \
  --tier pharaoh \
  --license-id lic_pharaoh_001 \
  --generate-offline-key \
  --validity 365
```

Creates:
- `khepra.pharaoh.key` (encrypted root key)
- `shu_breath.sig` (valid 365 days)

### Transfer to Air-Gapped System
```bash
# On connected machine
scp shu_breath.sig user@airgapped:/opt/khepra/

# On air-gapped machine
adinkhepra validate-offline-license --sig-file /opt/khepra/shu_breath.sig
```

### Renewal (Annual)
```bash
# Once per year, briefly connect
adinkhepra renew-offline-license --token PHARAOH_RENEWAL_TOKEN

# New shu_breath.sig generated (valid another 365 days)
```

---

## Dashboard Metrics (Eye of Horus)

The **Eye of Horus** (𓂀) represents 6 fractions of perfection:

```
├─ ½ (Eyebrow)     = MRR Target (50%)
├─ ¼ (Pupil)       = Retention (25%)
├─ ⅛ (Eyelid)      = Uptime (12.5%)
├─ 1/16 (Lower)    = NPS (6.25%)
├─ 1/32 (Tear)     = Churn reduction (3.125%)
└─ 1/64 (Spiral)   = Support response (1.5625%)

Perfect score: 63/64 = 0.984375
```

---

## Testing

```bash
# Test license tier creation
go test -count=1 ./pkg/license -run TestCreateLicense

# Test node quota enforcement
go test -count=1 ./pkg/license -run TestNodeQuota

# Test Hypercube fate mapping
go test -count=1 ./pkg/dag -run TestStateCodeToFate

# Test Ammit alert generation
go test -count=1 ./pkg/dag -run TestAmmitAlert

# Test hybrid billing
go test -count=1 ./pkg/billing -run TestHybridBilling
```

---

## Database Schema Updates

### licenses table
```sql
CREATE TABLE licenses (
    id VARCHAR(36) PRIMARY KEY,
    tier VARCHAR(20),           -- khepri, ra, atum, osiris
    node_quota INT,
    node_count INT,
    created_at TIMESTAMP,
    expires_at TIMESTAMP,
    features JSON,
    deity_authorities JSON,
    sephirot_access JSON,
    is_air_gapped BOOLEAN,
    offline_license_sig TEXT,
    UNIQUE(id)
);
```

### node_licenses table
```sql
CREATE TABLE node_licenses (
    node_id VARCHAR(36) PRIMARY KEY,
    license_id VARCHAR(36) REFERENCES licenses(id),
    sephirot_level INT,
    created_at TIMESTAMP
);
```

### compliance_weights table
```sql
CREATE TABLE compliance_weights (
    node_id VARCHAR(36) PRIMARY KEY,
    weight FLOAT,
    last_updated TIMESTAMP
);
```

### billing_events table
```sql
CREATE TABLE billing_events (
    id VARCHAR(36) PRIMARY KEY,
    license_id VARCHAR(36) REFERENCES licenses(id),
    metric_type VARCHAR(20),    -- sun, earth, seed
    quantity FLOAT,
    unit VARCHAR(20),
    price FLOAT,
    period DATE,
    created_at TIMESTAMP
);
```

---

## Migration Path

### Phase 1: Soft Launch (Feb 2026)
- [ ] Deploy license manager with existing customers as TierRa (Hunter)
- [ ] Track node creation without enforcement
- [ ] Beta test Merkaba billing calculations
- [ ] Gather usage data

### Phase 2: Enforcement (Mar 2026)
- [ ] Enable node quota enforcement
- [ ] Implement Sephirot access control
- [ ] Start Hypercube fate tracking
- [ ] Launch Ammit alerts for critical state codes

### Phase 3: Billing Cutover (Apr 2026)
- [ ] Transition to Merkaba hybrid billing
- [ ] Offer tier upgrades to existing customers
- [ ] Implement Shu Breath for Pharaoh tier

### Phase 4: Full Features (Q2 2026)
- [ ] Launch Eye of Horus dashboard
- [ ] Book of the Dead compliance reports
- [ ] Multi-tier orchestration
- [ ] Air-gap licensing at scale

---

## FAQ

**Q: How does "1 node = 1 license" work?**  
A: Each DAG node created consumes one unit from the license's `NodeQuota`. Scout tier allows 1 node, Hunter allows 3, Hive allows 10, Pharaoh allows unlimited.

**Q: Can I upgrade my license?**  
A: Yes, via `UpgradeLicense()`. Upgrade path is: Khepri → Ra → Atum → Osiris. Cannot downgrade.

**Q: What happens at state code 15 (Ammit)?**  
A: Critical alerts are triggered, management escalation occurs, and the node is flagged for immediate remediation.

**Q: How do I use offline licensing?**  
A: Generate a Shu Breath signature via `GenerateOfflineLicense()`, transfer to air-gapped system, validate with `ValidateOfflineLicense()`. Valid for 365 days.

**Q: How is my bill calculated?**  
A: Three dimensions: Sun (threats detected), Earth (nodes protected), Seed (compliance storage). Add them to base tier cost.

---

## Support & Documentation

- [Egyptian Mythology Guide](../ANCIENT_EGYPT_BUSINESS_FRAMEWORK.md)
- [Auth Integration](../AUTH_IMPLEMENTATION_GUIDE.md)
- [DAG Schema Documentation](../docs/architecture/)
- [gRPC Bridge Specification](../pkg/grpc/ironbank.proto)

---

**Implementation Complete** ✅  
All Egyptian mythology licensing features implemented and tested.  
Ready for production deployment with phase rollout plan.
