# Research Summary: IR & CMMC Level 2 Implementation

## Resource Analysis
**Source**: `timames/cmmc-level2-implementation-graylog_ollama`
**Focus**: CMMC Level 2 Compliance using Open Source (Graylog) and AI (Ollama).

### Key Architectural Patterns
1.  **Network Segmentation (VLANs)**:
    *   **CUI Zone (VLAN 10)**: Isolated processing of Controlled Unclassified Information.
    *   **Infra Zone (VLAN 20)**: Identity (AD) and Logging (Graylog).
    *   **Data Zone (VLAN 30)**: Encrypted file storage.
    *   **DMZ (VLAN 44)**: Remote access gateways.
    *   **Management (VLAN 99)**: Out-of-band administration.
2.  **AI Integration**:
    *   **Log Analysis**: Ollama models analyzing SIEM logs for anomalies.
    *   **Pattern Recognition**: Threat detection on aggregated data.
3.  **Core Principles**: Zero Trust, Least Privilege, Continuous Monitoring.

## Key Data Structures (Proposed for Khepra)

### Incident Response (IR)
Structure for `pkg/ir/incident.go`:
```go
type Incident struct {
    ID          string    `json:"id"`
    Title       string    `json:"title"`
    Severity    string    `json:"severity"` // CRITICAL, HIGH, MEDIUM, LOW
    Status      string    `json:"status"`   // OPEN, CONTAINED, ERADICATED, CLOSED
    Type        string    `json:"type"`     // MALWARE, PHISHING, DDOS, INSIDER
    DetectedAt  time.Time `json:"detected_at"`
    IOCs        []IOC     `json:"iocs"`
    Timeline    []Event   `json:"timeline"`
    PlaybookID  string    `json:"playbook_id"` // Link to automated response
}

type IOC struct {
    Type  string `json:"type"`  // IP, HASH, DOMAIN
    Value string `json:"value"`
}
```

### System Security Plan (SSP)
Structure for `pkg/compliance/ssp.go`:
```go
type SystemComponent struct {
    ID          string `json:"id"`
    Name        string `json:"name"`
    Type        string `json:"type"` // SERVER, NETWORK_DEVICE, SOFTWARE
    IsCUIAsset  bool   `json:"is_cui_asset"`
    Owner       string `json:"owner"`
}

type ControlImplementation struct {
    ControlID   string `json:"control_id"` // e.g., AC.L2-3.1.1
    Status      string `json:"status"`     // IMPLEMENTED, PLANNED, PARTIAL
    Narrative   string `json:"narrative"`  // How it is implemented
    EvidenceIDs []string `json:"evidence_ids"` // Links to DAG nodes
}
```

### CMMC Level 2 Compliance
The 110 Practices across 14 Domains:
- **AC**: Access Control
- **AU**: Audit and Accountability
- **CM**: Configuration Management
- **IA**: Identification and Authentication
- **IR**: Incident Response
- **MA**: Maintenance
- **MP**: Media Protection
- **PE**: Physical Protection
- **PS**: Personnel Security
- **RA**: Risk Assessment
- **CA**: Security Assessment
- **SC**: System and Communications Protection
- **SI**: System and Information Integrity
- **SR**: Supply Chain Risk Management (New/Emerging)
**Integration Pattern**:

The **Papyrus Engine**, integrated with **AGI**, acts as an autonomous ISSO (Information System Security Officer). It provides real-time suggestions, collaborative policy drafting, and anticipatory control mapping to ensure continuous compliance, while auditing controls via the `pkg/compliance` engine and logging evidence to the **DAG**.
