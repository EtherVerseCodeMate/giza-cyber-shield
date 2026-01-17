# Khepra Secure Gateway Architecture
## The DEMARC Point - Zero-Trust API Tunnel

> **Classification**: INTERNAL - Security Architecture
> **Author**: Khepra Protocol Team
> **Last Updated**: 2026-01-17

---

## Executive Summary

The Khepra Secure Gateway is the **critical demarcation point** between customer environments (Paul's Cumin Mall, future enterprise clients) and the Khepra/SouHimBou.AI ecosystem. This is where vulnerabilities can enter - so it must be built like a **DMZ/Zero-Trust Network Zone** with defense-in-depth.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CUSTOMER ENVIRONMENT                                  │
│  (Paul's Cumin Mall, Enterprise Clients, DoD Contractors)                       │
│                                                                                 │
│    [Webhooks] ──┐                                                               │
│    [API Calls] ─┼──►  INTERNET (HOSTILE TERRITORY)                              │
│    [Events]   ──┘                                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    ╔══════════════════════════════════════════╗                 │
│                    ║     KHEPRA SECURE GATEWAY (DEMARC)       ║                 │
│                    ║   "The Scarab Guards the Threshold"      ║                 │
│                    ╚══════════════════════════════════════════╝                 │
│                                                                                 │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│   │   LAYER 1    │  │   LAYER 2    │  │   LAYER 3    │  │   LAYER 4    │       │
│   │   Firewall   │─►│   Auth &     │─►│   Anomaly    │─►│   Rate &     │       │
│   │   & WAF      │  │   Identity   │  │   Detection  │  │   Logging    │       │
│   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘       │
│         │                 │                 │                 │                │
│         │                 │                 │                 │                │
│         ▼                 ▼                 ▼                 ▼                │
│   ┌─────────────────────────────────────────────────────────────────────┐      │
│   │                    POLYMORPHIC SCHEMA ENGINE                        │      │
│   │         (Self-Learning API Contract Enforcement)                    │      │
│   └─────────────────────────────────────────────────────────────────────┘      │
│                                      │                                          │
└──────────────────────────────────────│──────────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         KHEPRA TRUSTED ZONE                                     │
│                                                                                 │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│   │  Telemetry  │    │  DAG Store  │    │   AGI/LLM   │    │ SouHimBou   │     │
│   │   Server    │    │  (Immutable)│    │   Gateway   │    │   .AI       │     │
│   └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Security Layers (Defense-in-Depth)

### Layer 1: Firewall & WAF (Perimeter Defense)

**Purpose**: Block known-bad traffic before it touches application logic.

```go
// pkg/gateway/layer1_firewall.go

type FirewallConfig struct {
    // IP Reputation
    BlockTorExitNodes     bool
    BlockKnownBadIPs      bool   // Integrate with Spamhaus, AbuseIPDB
    GeoBlockCountries     []string
    AllowOnlyCountries    []string  // For DoD: US-only

    // Protocol Enforcement
    RequireHTTPS          bool
    MinTLSVersion         string  // "1.3" for DoD
    AllowedMethods        []string // ["GET", "POST"]
    MaxRequestSize        int64    // 1MB default

    // WAF Rules (OWASP CRS)
    EnableSQLiProtection  bool
    EnableXSSProtection   bool
    EnableLFIProtection   bool
    EnableRCEProtection   bool
    CustomWAFRules        []WAFRule
}

type WAFRule struct {
    ID          string
    Pattern     string   // Regex
    Action      string   // "block", "log", "challenge"
    Severity    string   // "critical", "high", "medium", "low"
    Description string
}
```

**Implementation**:
- Cloudflare WAF in front (already have this)
- Go-level request validation as second layer
- IP reputation check against:
  - Local blocklist (updated from CISA, Spamhaus)
  - Real-time threat feeds
  - Historical abuse from our telemetry

### Layer 2: Authentication & Identity (Zero-Trust)

**Purpose**: Verify every request comes from a legitimate, authorized source.

```go
// pkg/gateway/layer2_auth.go

type AuthenticationConfig struct {
    // mTLS (Mutual TLS) - "Even localhost can't fake this"
    RequireMTLS           bool
    ClientCertCA          string   // Path to trusted CA
    CertRevocationCheck   bool

    // API Key Authentication
    APIKeyHeader          string   // "X-Khepra-API-Key"
    APIKeyHashAlgorithm   string   // "argon2id"

    // Enrollment Token (for first-time registration)
    EnrollmentTokenHeader string   // "X-Khepra-Enrollment-Token"

    // PQC Signature Verification
    RequirePQCSignature   bool
    SignatureHeader       string   // "X-Khepra-Signature"
    SignatureAlgorithm    string   // "ML-DSA-65" (Dilithium3)

    // JWT for session management
    JWTIssuer             string
    JWTAudience           string
    JWTMaxAge             time.Duration
}

type Identity struct {
    MachineID       string    // Hardware fingerprint
    OrganizationID  string    // Customer org
    LicenseTier     string    // "trial", "professional", "enterprise", "dod"
    Permissions     []string  // ["scan", "cve_check", "dashboard_view"]
    AuthMethod      string    // "mtls", "api_key", "pqc_signature"
    AuthenticatedAt time.Time
    ClientIP        string
    UserAgent       string
    Country         string    // From Cloudflare

    // Trust Score (ML-computed)
    TrustScore      float64   // 0.0 - 1.0
    RiskFactors     []string
}
```

**Zero-Trust Principles**:
1. **Never trust, always verify** - Every request re-authenticated
2. **Least privilege** - Tokens only grant necessary permissions
3. **Assume breach** - Log everything for forensics
4. **Verify explicitly** - Multiple auth factors

### Layer 3: Anomaly Detection (The ML Brain)

**Purpose**: Detect and block novel attacks that bypass signature-based defenses.

```go
// pkg/gateway/layer3_anomaly.go

type AnomalyDetector struct {
    // Baseline Learning
    BaselineWindow      time.Duration  // 7 days
    LearningMode        bool           // true during initial deployment

    // Detection Models
    RequestVolumeModel  *TimeSeriesModel  // Spike detection
    PayloadSizeModel    *StatisticalModel // Unusual sizes
    EndpointAccessModel *MarkovChain      // Unusual access patterns
    GeoVelocityModel    *VelocityAnalyzer // Impossible travel

    // PyTorch Integration (via gRPC)
    MLServiceEndpoint   string
    ModelVersion        string
}

type AnomalyScore struct {
    OverallScore       float64  // 0.0 (safe) to 1.0 (malicious)
    Components         map[string]float64
    Confidence         float64
    ExplanationVector  []string  // Human-readable explanations
    RecommendedAction  string    // "allow", "challenge", "block", "alert"
}

// Integration points for PyTorch-based models
type MLFeatures struct {
    // Request features
    RequestSize         int64
    HeaderCount         int
    QueryParamCount     int
    BodyEntropy         float64   // High entropy = encrypted/encoded payload

    // Behavioral features
    RequestsLastMinute  int
    RequestsLastHour    int
    UniqueEndpoints     int
    TimeSinceLastRequest time.Duration

    // Historical features
    HistoricalFailRate  float64
    HistoricalVolume    float64
    DayOfWeekNormality  float64
    TimeOfDayNormality  float64

    // Identity features
    AccountAge          time.Duration
    LicenseTier         string
    PreviousViolations  int
}
```

**ML Pipeline** (PyTorch Integration):
```
                    ┌─────────────────────────────────────┐
                    │     PyTorch Model Server            │
                    │     (Separate Container/Service)    │
                    │                                     │
   Request ───────► │  1. Feature Extraction              │
   Features         │  2. Model Inference (< 10ms)        │
                    │  3. Score + Explanation             │
                    │                                     │
                    │  Models:                            │
                    │  - Autoencoder (unsupervised)       │
                    │  - Isolation Forest (anomaly)       │
                    │  - LSTM (sequence modeling)         │
                    │  - Transformer (behavior patterns)  │
                    │                                     │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                              ┌────────────────┐
                              │ Score: 0.87    │
                              │ Action: BLOCK  │
                              │ Reason: [...]  │
                              └────────────────┘
```

### Layer 4: Rate Limiting & Comprehensive Logging

**Purpose**: Prevent abuse and maintain forensic evidence trail.

```go
// pkg/gateway/layer4_control.go

type RateLimitConfig struct {
    // Per-Identity Limits
    RequestsPerSecond   int     // Default: 10
    RequestsPerMinute   int     // Default: 100
    RequestsPerHour     int     // Default: 1000

    // Per-Endpoint Limits
    EndpointLimits      map[string]int

    // Burst Handling
    BurstAllowance      int     // Allow 2x burst for 5 seconds
    BurstWindow         time.Duration

    // Adaptive Limiting (based on trust score)
    TrustScoreMultiplier bool   // High trust = higher limits

    // Backoff Strategy
    BackoffStrategy     string  // "exponential", "linear", "fixed"
    MaxBackoffDuration  time.Duration
}

type AuditLog struct {
    // Request Metadata
    RequestID           string    `json:"request_id"`
    Timestamp           time.Time `json:"timestamp"`
    Method              string    `json:"method"`
    Path                string    `json:"path"`
    QueryParams         string    `json:"query_params"` // Hashed for privacy

    // Identity
    MachineID           string    `json:"machine_id"`
    OrganizationID      string    `json:"organization_id"`
    AuthMethod          string    `json:"auth_method"`

    // Network
    SourceIP            string    `json:"source_ip"`
    Country             string    `json:"country"`
    ASN                 string    `json:"asn"`
    UserAgent           string    `json:"user_agent"`

    // Security Decisions
    FirewallDecision    string    `json:"firewall_decision"`
    AuthDecision        string    `json:"auth_decision"`
    AnomalyScore        float64   `json:"anomaly_score"`
    RateLimitStatus     string    `json:"rate_limit_status"`
    FinalDecision       string    `json:"final_decision"` // "allow", "block", "challenge"

    // Response
    ResponseStatus      int       `json:"response_status"`
    ResponseTime        int64     `json:"response_time_ms"`
    BytesSent           int64     `json:"bytes_sent"`

    // Forensics
    ThreatIndicators    []string  `json:"threat_indicators"`
    MITREAttackTags     []string  `json:"mitre_attack_tags"`
    DAGNodeID           string    `json:"dag_node_id"` // Immutable DAG reference
}
```

**Logging Destinations**:
1. **Real-time**: WebSocket to SouHimBou.AI dashboard
2. **Immutable**: Khepra DAG (cryptographically secured)
3. **Analytics**: Telemetry server for ML training
4. **SIEM**: Export to customer's SIEM (Splunk, ELK, etc.)

---

## Polymorphic Schema Engine Integration

**Key Insight**: The Gateway should **learn** what valid requests look like and automatically reject deviations.

```go
// pkg/gateway/schema_enforcement.go

type SchemaEnforcer struct {
    // Schema Registry
    SchemaRegistry      map[string]*APISchema  // endpoint -> schema

    // Learning Mode
    LearningEnabled     bool
    LearningDuration    time.Duration

    // Evolution Triggers
    AutoEvolve          bool     // Automatically update schemas
    RequireApproval     bool     // Require human approval for changes
    NotifyChannel       string   // Slack/webhook for notifications
}

type APISchema struct {
    Version             string
    Endpoint            string
    Method              string

    // Request Schema
    RequiredHeaders     []string
    OptionalHeaders     []string
    HeaderPatterns      map[string]string  // header -> regex pattern

    QueryParamSchema    *JSONSchema
    BodySchema          *JSONSchema

    // Response Schema (for validation)
    ResponseSchema      *JSONSchema

    // Learned Patterns
    ObservedPatterns    []LearnedPattern
    AnomalyThreshold    float64

    // STIG Compliance
    STIGMappings        []string  // Control IDs this endpoint relates to
    ComplianceChecks    []func(*http.Request) error
}

// LearnedPattern represents ML-discovered request patterns
type LearnedPattern struct {
    FeatureVector       []float64
    ClusterID           int
    Frequency           int
    LastSeen            time.Time
    IsNormal            bool
}
```

**Self-Evolution Flow**:
```
Request ──► Schema Validation ──► Pass? ──► Process
                   │
                   ▼ Fail
            ┌──────────────────┐
            │ Learning Mode?   │
            │                  │
            │ YES: Add to      │
            │      training    │
            │      data        │
            │                  │
            │ NO: Block &      │
            │     Alert        │
            └──────────────────┘
```

---

## Implementation Priority

### Phase 1: Foundational Security (Week 1-2)
- [ ] mTLS implementation for agent ↔ gateway
- [ ] PQC signature verification (ML-DSA-65)
- [ ] Basic WAF rules (OWASP CRS)
- [ ] Rate limiting with Redis backend
- [ ] Audit logging to DAG

### Phase 2: Intelligence Layer (Week 3-4)
- [ ] PyTorch model server deployment
- [ ] Feature extraction pipeline
- [ ] Baseline learning mode
- [ ] Anomaly scoring integration

### Phase 3: Adaptive Defense (Week 5-6)
- [ ] Polymorphic schema learning
- [ ] Auto-blocking with appeal mechanism
- [ ] MITRE ATT&CK tagging
- [ ] SIEM export connectors

### Phase 4: Enterprise Hardening (Week 7+)
- [ ] FedRAMP documentation
- [ ] Penetration testing
- [ ] Red team exercises
- [ ] SOC 2 Type II preparation

---

## What You Might Be Missing (Your Request)

Based on your vision, here are additional security considerations:

### 1. **Client Certificate Pinning**
```go
// Prevent MITM even with valid-looking certs
type CertPinConfig struct {
    Pins        []string  // SHA-256 hashes of valid certs
    BackupPins  []string  // Rotation support
    MaxAge      time.Duration
    IncludeSubdomains bool
}
```

### 2. **Request Signing Chain**
```
Customer App ──sign──► Gateway ──verify──► Khepra Agent
                                              │
                                              ▼ sign
                                         Response
```
Every hop adds its signature. Tamper-evident chain.

### 3. **Canary Tokens / Honeypots**
```go
// Embed canary endpoints that only attackers would find
type CanaryConfig struct {
    Endpoints   []string  // "/admin", "/.env", "/backup.sql"
    AlertLevel  string
    AutoBlock   bool
}
```

### 4. **Behavioral Biometrics (Advanced)**
For dashboard users:
- Keystroke dynamics
- Mouse movement patterns
- Session fingerprinting

### 5. **Supply Chain Security**
```go
// Verify our own binaries haven't been tampered
type BinaryIntegrity struct {
    ExpectedHash    string
    SignedBy        string  // Your PQC key
    BuildTimestamp  time.Time
    ReproducibleBuild bool
}
```

### 6. **Fail-Secure Mode**
```go
// If anomaly detection is down, default to DENY
type FailSecureConfig struct {
    MLServiceTimeout    time.Duration
    FallbackAction      string  // "deny", "allow_with_logging"
    AlertOnDegradation  bool
}
```

### 7. **Data Sanitization at Boundary**
```go
// Never trust customer data - sanitize at DEMARC
type Sanitizer struct {
    HTMLEncode      bool
    SQLEscape       bool
    JSONNormalize   bool
    MaxStringLength int
    AllowedCharsets []string
}
```

---

## File Structure for Implementation

```
pkg/gateway/
├── gateway.go              # Main gateway server
├── config.go               # Configuration structures
├── layer1_firewall.go      # WAF and IP filtering
├── layer2_auth.go          # mTLS, PQC signatures, API keys
├── layer3_anomaly.go       # ML-based anomaly detection
├── layer4_control.go       # Rate limiting and logging
├── schema_enforcer.go      # Polymorphic schema validation
├── audit_logger.go         # Comprehensive audit trail
├── ml_client.go            # PyTorch service client
├── canary.go               # Honeypot endpoints
├── middleware.go           # HTTP middleware chain
└── handlers/
    ├── webhook.go          # Customer webhook ingestion
    ├── api.go              # API endpoints
    └── health.go           # Health checks
```

---

## Conclusion

The Khepra Secure Gateway is not just a reverse proxy - it's an **intelligent, self-learning defense system** that:

1. **Blocks known threats** (WAF, IP reputation)
2. **Verifies identity cryptographically** (mTLS, PQC)
3. **Detects novel attacks** (ML anomaly detection)
4. **Adapts to traffic patterns** (Polymorphic schemas)
5. **Maintains forensic evidence** (Immutable DAG logging)
6. **Enforces least privilege** (Fine-grained permissions)

This is the "firewall" you build with Khepra itself - using your own PQC infrastructure to protect the ecosystem.

**"The Scarab Guards the Threshold."**
