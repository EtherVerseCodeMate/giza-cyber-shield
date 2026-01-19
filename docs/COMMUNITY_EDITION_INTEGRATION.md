# Khepra Protocol: Community Edition Integration Plan

> **Document Status**: Active Development
> **Created**: 2026-01-19
> **Strategy**: LLM-Optional, Anomaly Detection First

---

## Executive Summary

The Community Edition delivers a **complete, autonomous security platform** without requiring LLM capabilities. The LLM (KASA/Ollama) becomes an optional enhancement for paid tiers, while SouHimBou ML (anomaly detection) integrates comprehensively with all core components.

---

## Strategic Decision: LLM is Optional, SouHimBou AGI is Core

| Tier | LLM Status | SouHimBou AGI | Core Features |
|------|------------|---------------|---------------|
| **Community** | Not included | ✅ Full AGI | All features below + chat |
| **Enterprise** | Optional add-on | ✅ Full AGI | + Priority support |
| **Pharaoh** | Included (GEMMA3) | ✅ Full AGI | + Air-gap + enhanced NLP |

### What This Means

- **SouHimBou AGI replaces LLM** for chat and user assistance
- **No 3-10GB model distribution problem**
- **8GB RAM systems fully supported**
- **IronBank submission simplified** (no Ollama container needed for core)
- **SouHimBou AGI (~270KB model) ships with every edition**
- **BabyAGI-style autonomous agent capabilities** included free

### SouHimBou AGI Capabilities (LLM-Free)

| Capability | Implementation | Status |
|------------|---------------|--------|
| Chat/Assistant | Template + Rule-based | NEW |
| Intent Classification | Keyword + Pattern matching | NEW |
| Task Creation | ML + Rule engine | NEW |
| Task Prioritization | Risk scoring (CVSS + Anomaly) | NEW |
| Anomaly Detection | VAE + Isolation Forest | Existing |
| Response Generation | Structured templates | NEW |
| **NIST AI RMF Compliance** | Built-in validation | NEW |
| **Explainable AI** | Adinkra framework | NEW |
| **Adversarial Defense** | Input validation | NEW |
| **Model Drift Detection** | Continuous validation | NEW |

See: [SOUHIMBOU_AGI_ARCHITECTURE.md](./SOUHIMBOU_AGI_ARCHITECTURE.md) for full design

---

## Community Edition Feature Scope

### Core Deliverables (Must Ship)

| Feature | Component | Status | Integration Required |
|---------|-----------|--------|---------------------|
| **Sonar Scanner** | `cmd/sonar/` | ✅ Complete | Primary data source → ML |
| **Vulnerability Scanner** | `pkg/scanner/`, `pkg/vuln/` | ✅ Complete | CVE/CVSS → ML prioritization |
| **Secret Detection** | `pkg/arsenal/` (Gitleaks, TruffleHog) | ✅ Complete | Entropy → ML |
| **Container Scanner** | `pkg/arsenal/` | ✅ Complete | Misconfig → ML |
| **Autonomous Digital Forensics** | `pkg/forensics/` | ✅ Framework | Feature extraction → ML |
| **Penetration Testing** | `cmd/khepra-pentest/`, `pkg/arsenal/` | ✅ Complete | Scan results → ML |
| **Incident Response (IR)** | `pkg/ir/` | ✅ Complete | Incident patterns → ML |
| **Disaster Recovery (DRBC)** | `pkg/drbc/` | ✅ Complete | Anomaly-triggered backup |
| **Encryption/Decryption** | `pkg/adinkra/` | ✅ Complete | None (standalone) |
| **STIG/CMMC 2.0 Compliance** | `pkg/stig/`, `pkg/compliance/` | ✅ Complete | Compliance gaps → ML |
| **PQC Migration Scanning** | `pkg/stig/pqc_migration.go` | ✅ Complete | Crypto inventory → ML |
| **ERT Analysis** | `pkg/ert/` | ✅ Complete | Risk scoring → ML |
| **Knowledge Base (Intel)** | `pkg/intel/` | ✅ Complete | RAG context → ML |
| **Telemetry Server** | `adinkhepra-telemetry-server/` | ✅ Complete | License + beacon |
| **DAG Store** | `pkg/dag/` | ✅ Complete | Immutable audit trail |

### Sonar Scanner & Complementary Modules

**Sonar** (`cmd/sonar/main.go`) is the primary data collection engine that feeds SouHimBou AGI:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SONAR v1.5.0-NUCLEAR                         │
│              Unified Security Audit Pipeline                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Device Fingerprinting (Anti-spoofing)                   │   │
│  │ Host Enumeration (OS, processes, services, users)       │   │
│  │ Network Intelligence (ports, interfaces, OS fingerprint)│   │
│  │ System Intelligence (kernel modules, rootkit detection) │   │
│  └─────────────────────────────────────────────────────────┘   │
│                             │                                   │
│                             ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Built-In Scanners (Zero External Dependencies)          │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ • Vulnerability Scanner (CVE + heuristics)              │   │
│  │ • Secret Detection (entropy + pattern matching)         │   │
│  │ • Container Scanner (misconfigurations)                 │   │
│  │ • Compliance Scanner (CIS/STIG/NIST)                    │   │
│  │ • Dependency Manifest Scanning                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                             │                                   │
│                             ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Output: JSON, CSV (Superset), AFFiNE (Executive Memo)   │   │
│  │ Signing: Dilithium-3 PQC signatures on all artifacts    │   │
│  │ Telemetry: Anonymous beacon (opt-in/opt-out)            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ 32-dim feature vector
┌─────────────────────────────────────────────────────────────────┐
│                    SouHimBou AGI                                │
│              Anomaly Detection + Task Creation                  │
└─────────────────────────────────────────────────────────────────┘
```

### Complementary Module Integration Matrix

| Module | Location | Feeds SouHimBou | SouHimBou Triggers |
|--------|----------|-----------------|-------------------|
| **Sonar** | `cmd/sonar/` | Host/network/vuln data | Scan recommendations |
| **Vulnerability Hunter** | `pkg/vuln/` | CVE findings | Patch prioritization |
| **Arsenal** | `pkg/arsenal/` | Tool outputs (Gitleaks, ZAP, etc.) | Tool selection |
| **Scanner** | `pkg/scanner/` | Port/service data | Network isolation |
| **Forensics** | `pkg/forensics/` | Evidence snapshots | Investigation tasks |
| **IR Manager** | `pkg/ir/` | Incident data | Severity prediction |
| **Compliance** | `pkg/compliance/` | Control status | Remediation tasks |
| **ERT** | `pkg/ert/` | Risk assessments | Executive alerts |
| **DRBC** | `pkg/drbc/` | Backup status | Auto-backup triggers |
| **Intel** | `pkg/intel/` | CISA KEV, MITRE CVE | Context enrichment |

---

## Integration Architecture: SouHimBou ML → All Components

### Current State (As-Is)

```
┌─────────────┐
│ KASA Engine │ ←── LLM (Ollama) [OPTIONAL NOW]
│ pkg/agi/    │
└──────┬──────┘
       │ HTTP POST
       ↓
┌─────────────────────┐
│ SouHimBou ML        │ ←── Only integration point
│ services/ml_anomaly │
└─────────────────────┘
```

### Target State (To-Be)

```
┌─────────────────────────────────────────────────────────────────┐
│                    SouHimBou ML Service                         │
│                    (localhost:8000)                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Unified Feature Ingestion API                          │   │
│  │  POST /predict { "source": "...", "features": [...] }   │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
     ┌───────────┬───────────┼───────────┬───────────┬───────────┐
     │           │           │           │           │           │
     ▼           ▼           ▼           ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Sonar   │ │Forensics│ │   IR    │ │  STIG   │ │  ERT    │ │  DRBC   │
│ Scanner │ │Collector│ │ Manager │ │Validator│ │ Engine  │ │ Module  │
└─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
     │           │           │           │           │           │
     └───────────┴───────────┴───────────┴───────────┴───────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    DAG Store    │
                    │  (Immutable)    │
                    └─────────────────┘
```

---

## Component Integration Specifications

### 1. Sonar Scanner → ML Integration

**Location**: `cmd/sonar/main.go`

**Current**: Outputs JSON/CSV audit snapshots with threat scores
**Enhancement**: Extract 32-dim features and send to ML for anomaly scoring

```go
// Feature extraction from Sonar scan results
type SonarFeatures struct {
    // Port activity (indices 0-3)
    OpenPorts      float64 // Count of open ports
    HighRiskPorts  float64 // 22, 23, 445, 3389, etc.
    ServiceDiversity float64 // Unique services detected
    PortChangeRate float64 // Delta from baseline

    // Process behavior (indices 4-7)
    ProcessCount   float64
    SuspiciousProcs float64 // Hidden, orphaned, privileged
    ResourceUsage  float64 // CPU + memory anomalies
    ProcessEntropy float64 // Name randomness

    // Network patterns (indices 8-11)
    InboundConns   float64
    OutboundConns  float64
    UnusualDests   float64 // Non-local, Tor, VPN
    DNSQueries     float64 // Volume anomaly

    // Security indicators (indices 12-15)
    RootkitScore   float64 // From kernel module analysis
    MalwareScore   float64 // From signature matching
    SecretScore    float64 // Entropy-based credential detection
    ComplianceGaps float64 // STIG/CIS failures

    // System state (indices 16-19)
    Uptime         float64
    KernelVersion  float64 // Age/vulnerability proxy
    PatchLevel     float64
    ConfigDrift    float64 // From known-good baseline

    // Temporal (indices 20-23)
    HourSin        float64
    HourCos        float64
    DayOfWeekSin   float64
    DayOfWeekCos   float64

    // Behavioral (indices 24-27)
    ScanDuration   float64
    ErrorRate      float64
    RetryCount     float64
    NetworkLatency float64

    // Reserved (indices 28-31)
    Reserved1-4    float64
}
```

**Integration Point**: After scan completion, before DAG recording

```go
// In Sonar post-scan processing
features := extractSonarFeatures(scanResult)
mlResponse, err := pythonClient.GetIntuition(features, map[string]string{
    "source": "sonar",
    "target": target,
})
if err == nil {
    scanResult.AnomalyScore = mlResponse.AnomalyScore
    scanResult.MLConfidence = mlResponse.Confidence
}
// Continue to DAG recording with enriched data
```

---

### 2. Forensics Collector → ML Integration

**Location**: `pkg/forensics/collector.go`

**Current**: Collects evidence types with hashes and chain of custody
**Enhancement**: Detect anomalous evidence patterns

```go
// Feature extraction from forensic snapshot
type ForensicsFeatures struct {
    // Process anomalies
    HiddenProcessCount    float64
    OrphanedProcessCount  float64
    PrivilegedProcessCount float64
    ProcessTreeDepth      float64

    // File system anomalies
    ModifiedSystemFiles   float64
    NewExecutables        float64
    DeletedLogFiles       float64
    TimestampAnomalies    float64 // MACE inconsistencies

    // Network forensics
    EstablishedConns      float64
    ListeningPorts        float64
    RawSocketUsage        float64
    PacketCaptureSigns    float64

    // User activity
    FailedLogins          float64
    PrivilegeEscalation   float64
    SudoUsage             float64
    NewUserAccounts       float64

    // Memory forensics
    SuspiciousMemRegions  float64
    InjectedCode          float64
    HookedFunctions       float64

    // Artifact analysis
    RegistryChanges       float64 // Windows
    CronChanges           float64 // Linux
    StartupModifications  float64

    // Temporal + Reserved
    // ... (indices 24-31)
}
```

**Use Case**: During incident investigation, ML identifies whether evidence patterns match known attack signatures vs. normal administrative activity.

---

### 3. Incident Response → ML Integration

**Location**: `pkg/ir/manager.go`

**Current**: Incident lifecycle management with IOC tracking
**Enhancement**: Predict incident severity and recommend actions

```go
// Feature extraction from incident data
type IRFeatures struct {
    // Incident characteristics
    IOCCount              float64
    IOCDiversity          float64 // IP, domain, hash, etc.
    SeverityScore         float64 // Current assessment
    TimeToDetection       float64

    // Pattern matching
    SimilarIncidentCount  float64 // Historical matches
    RecurrenceRate        float64
    AttackVectorScore     float64 // MITRE ATT&CK mapping

    // Impact indicators
    AffectedAssetCount    float64
    DataExfilRisk         float64
    LateralMovementRisk   float64
    PersistenceRisk       float64

    // Response metrics
    TimeInState           float64 // Time in current status
    EscalationCount       float64
    ContainmentActions    float64

    // Correlation
    RelatedAlertCount     float64
    CrossSystemIndicators float64
    ThreatIntelMatches    float64

    // ... (remaining indices)
}
```

**Use Case**: ML predicts whether an incident will escalate, enabling proactive resource allocation.

---

### 4. STIG/Compliance → ML Integration

**Location**: `pkg/stig/validator.go`

**Current**: Framework validation with pass/fail/POA&M
**Enhancement**: Predict compliance drift and prioritize remediation

```go
// Feature extraction from compliance results
type ComplianceFeatures struct {
    // Overall scores
    STIGPassRate          float64
    NISTPassRate          float64
    CISPassRate           float64
    CMMCPassRate          float64

    // Category breakdown
    AccessControlScore    float64 // AC family
    AuditScore            float64 // AU family
    ConfigMgmtScore       float64 // CM family
    IdentityScore         float64 // IA family

    // Risk indicators
    CriticalFindings      float64
    HighFindings          float64
    POAMItemCount         float64
    OverduePOAMCount      float64

    // Trend analysis
    ScoreDelta30Day       float64 // Change from 30 days ago
    ScoreDelta90Day       float64
    RemediationVelocity   float64 // Fixes per week

    // Cross-framework
    OverlappingFailures   float64 // Same control fails multiple frameworks
    UniqueFailures        float64

    // PQC readiness
    QuantumVulnCount      float64
    PQCAdoptionRate       float64
    CryptoInventoryAge    float64

    // ... (remaining indices)
}
```

**Use Case**: ML identifies systems likely to fail upcoming audits, enabling preemptive remediation.

---

### 5. ERT Engine → ML Integration

**Location**: `pkg/ert/`

**Current**: 4-package executive analysis
**Enhancement**: Predict material business risk with ML confidence

```go
// Feature extraction from ERT analysis
type ERTFeatures struct {
    // Package A: Strategy
    RegulatoryConflicts   float64
    StrategicAlignment    float64
    BlockerCount          float64

    // Package B: Architecture
    DependencyRisk        float64
    SupplyChainVulns      float64
    ShadowITScore         float64
    TechnicalDebt         float64

    // Package C: Crypto
    PQCReadiness          float64
    IPPurity              float64 // Proprietary vs OSS vs GPL
    LicenseRisk           float64
    CryptoVulnCount       float64

    // Package D: Synthesis
    MaterialRiskScore     float64
    BusinessImpact        float64
    CausalChainDepth      float64

    // ... (remaining indices)
}
```

**Use Case**: ML provides confidence intervals on executive risk assessments.

---

### 6. DRBC → ML Integration

**Location**: `pkg/drbc/`

**Current**: Genesis archival, Scorpion binding, restoration
**Enhancement**: Trigger backup based on anomaly detection

```go
// Anomaly-triggered DRBC workflow
func CheckDRBCTrigger(anomalyScore float64, confidence float64) DRBCAction {
    switch {
    case anomalyScore >= 0.9 && confidence >= 0.8:
        return DRBCAction{
            Type: "GENESIS_IMMEDIATE",
            Reason: "Critical anomaly detected - full system backup",
        }
    case anomalyScore >= 0.7 && confidence >= 0.7:
        return DRBCAction{
            Type: "SCORPION_BIND",
            Reason: "High anomaly - secure critical assets",
        }
    case anomalyScore >= 0.5 && confidence >= 0.6:
        return DRBCAction{
            Type: "CHECKPOINT",
            Reason: "Moderate anomaly - incremental backup",
        }
    default:
        return DRBCAction{Type: "NONE"}
    }
}
```

**Use Case**: Automated backup triggers when ML detects impending compromise.

---

## Implementation Phases

### Phase 1: Feature Extraction Layer (Week 1-2)

**Goal**: Create unified feature extraction from all components

```
pkg/ml/
├── features/
│   ├── extractor.go      # Interface + factory
│   ├── sonar.go          # Sonar → 32-dim
│   ├── forensics.go      # Forensics → 32-dim
│   ├── ir.go             # IR → 32-dim
│   ├── compliance.go     # STIG/CMMC → 32-dim
│   ├── ert.go            # ERT → 32-dim
│   └── common.go         # Shared utilities
└── client/
    └── souhimbou.go      # HTTP client to Python service
```

**Deliverable**: `pkg/ml/` package with feature extractors for each component

---

### Phase 2: Python Service Enhancement (Week 2-3)

**Goal**: Extend SouHimBou ML to handle multi-source features

```python
# services/ml_anomaly/api.py

class PredictRequest(BaseModel):
    features: List[float]          # 32-element vector
    source: str                    # "sonar", "forensics", "ir", "compliance", "ert"
    metadata: Optional[Dict] = None

@app.post("/predict")
async def predict(request: PredictRequest):
    # Source-aware normalization
    normalized = normalize_by_source(request.features, request.source)

    # Ensemble prediction
    result = model_instance(normalized)

    # Source-specific explanation
    explanation = explain_by_source(result, request.source)

    return PredictResponse(
        anomaly_score=result["anomaly_score"],
        is_anomaly=result["anomaly_score"] > get_threshold(request.source),
        confidence=result["confidence"],
        archetype_influence=explanation,
        source=request.source
    )
```

**Deliverable**: Multi-source prediction with source-aware thresholds

---

### Phase 3: Component Integration (Week 3-4)

**Goal**: Wire up each component to ML service

| Component | Integration File | Changes Required |
|-----------|-----------------|------------------|
| Sonar | `cmd/sonar/main.go` | Add post-scan ML call |
| Forensics | `pkg/forensics/collector.go` | Add evidence analysis |
| IR | `pkg/ir/manager.go` | Add incident prediction |
| STIG | `pkg/stig/validator.go` | Add compliance prediction |
| ERT | `pkg/ert/*.go` | Add risk confidence |
| DRBC | `pkg/drbc/genesis.go` | Add anomaly trigger |

**Deliverable**: All components call ML service for enrichment

---

### Phase 4: DAG Enhancement (Week 4-5)

**Goal**: Store ML predictions in DAG for audit trail

```go
type EnhancedNode struct {
    Node
    // ML enrichment
    AnomalyScore  float64            `json:"anomaly_score,omitempty"`
    MLConfidence  float64            `json:"ml_confidence,omitempty"`
    MLSource      string             `json:"ml_source,omitempty"`
    MLExplanation map[string]float64 `json:"ml_explanation,omitempty"`
}
```

**Deliverable**: DAG nodes include ML predictions for historical analysis

---

### Phase 5: Dashboard Integration (Week 5-6)

**Goal**: Visualize ML predictions in frontend

```typescript
// Frontend components needed
interface AnomalyWidget {
    score: number;
    confidence: number;
    trend: number[];  // Last 24 hours
    source: string;
    explanation: Record<string, number>;
}

// Dashboard sections
- Executive Overview: Aggregate anomaly score
- Sonar Results: Per-scan anomaly overlay
- Compliance Dashboard: Drift prediction
- Incident Board: Severity prediction
- Forensics Timeline: Evidence anomaly markers
```

**Deliverable**: Frontend displays ML insights across all modules

---

## LLM-Optional Degradation Matrix

When LLM is not available, these features degrade gracefully:

| Feature | With LLM | Without LLM | User Impact |
|---------|----------|-------------|-------------|
| Threat analysis | Natural language | ML score + rules | None (same accuracy) |
| Compliance explanation | Conversational | Static help text | Minor (less dynamic) |
| Incident triage | AI recommendations | ML + rule-based | None (same recommendations) |
| Report narrative | AI-generated prose | Template-based | Minor (less polished) |
| Chat interface | Full KASA persona | Disabled/hidden | Feature unavailable |

**Key Insight**: Core security functions are **ML-powered, not LLM-dependent**.

---

## Validation Criteria

### Community Edition Must Pass

1. **Autonomous Forensics**: Collect evidence, detect anomalies, maintain chain of custody
2. **PenTest**: Scan, enumerate, assess vulnerabilities with ML confidence
3. **IR**: Create incident, track IOCs, predict severity
4. **DRBC**: Genesis backup, Scorpion bind, restore with ML triggers
5. **Encryption**: PQC encrypt/decrypt without errors
6. **STIG/CMMC**: Validate against all 7 frameworks, predict compliance drift
7. **PQC Migration**: Inventory cryptographic assets, calculate blast radius

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Sonar scan + ML | < 60 seconds | 100-host network |
| ML prediction latency | < 100 ms | P99 |
| Memory (8GB system) | < 4 GB total | All components running |
| DAG write throughput | > 1000 nodes/sec | Burst ingestion |
| Compliance check | < 5 minutes | Full 7-framework sweep |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ML service unavailable | Medium | Low | Graceful degradation to rules |
| Feature extraction mismatch | Low | Medium | Strict 32-dim validation |
| Performance regression | Medium | Medium | Benchmark before merge |
| DAG size explosion | Low | High | Pruning + archival strategy |

---

## Next Steps

1. **Create `pkg/ml/` package** with feature extraction interfaces
2. **Implement Sonar feature extractor** (highest value, most data)
3. **Extend Python service** for multi-source handling
4. **Wire Sonar → ML → DAG** end-to-end
5. **Repeat for other components**

---

## Appendix: Current Python Client Location

**Go client**: `pkg/apiserver/python_client.go`

```go
type PythonServiceClient struct {
    BaseURL    string
    HTTPClient *http.Client
}

func (c *PythonServiceClient) GetIntuition(features []float64, metadata map[string]string) (*PredictResponse, error)
```

This client will be enhanced to support source-aware predictions.
