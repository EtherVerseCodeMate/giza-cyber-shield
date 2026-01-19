# SouHimBou Dashboard Optimization Plan

> **Document Status**: Active Planning
> **Created**: 2026-01-19
> **Context**: Pre-implementation blockers identified during Implementation Plan Audit

---

## Executive Summary

Four critical optimization tasks must be completed before proceeding with the SouHimBou "Ultimate Dashboard" implementation. These are **blocking dependencies** that affect IronBank submission, air-gap deployment, and overall architecture viability.

---

## Optimization Tasks

### 1. LLM Model Size Decision
**Status**: 🟡 Analysis Complete - Decision Required
**Priority**: P0 - Critical
**Blocks**: IronBank submission, air-gap strategy, container architecture

#### Why This Matters
| Model Size | IronBank Feasibility | Air-Gap Transfer | Container Strategy |
|------------|---------------------|------------------|-------------------|
| < 1GB | ✅ In container | ✅ USB viable | Single container possible |
| 1-10GB | ⚠️ Separate artifact | ⚠️ Challenging | Mounted volume required |
| > 10GB | ❌ Not in container | ❌ Requires planning | External storage/appliance |

#### Current State Analysis (2026-01-19)

**YOU HAVE TWO SEPARATE AI SYSTEMS:**

| System | Type | Size | Location | Purpose |
|--------|------|------|----------|---------|
| **SouHimBou ML** | PyTorch Anomaly Detector | ~270 KB | `services/ml_anomaly/` | Behavioral anomaly detection |
| **KASA LLM** | Ollama (PHI4/GEMMA3) | 3-10 GB | `pkg/llm/ollama/` | Natural language reasoning |

##### System 1: SouHimBou ML (Python) - LIGHTWEIGHT
- **Architecture**: VAE + Isolation Forest Ensemble
- **Parameters**: ~60-70K trainable parameters
- **Model File**: `./models/souhimbou_v1.pt` (~270 KB)
- **Memory**: 20-50 MB peak (GPU optional)
- **External Dependencies**: ZERO (no API calls)
- **IronBank Status**: ✅ FULLY COMPATIBLE

##### System 2: KASA LLM (Go/Ollama) - HEAVYWEIGHT
| Model | Size | Parameters | VRAM Required | Air-Gap Viable |
|-------|------|------------|---------------|----------------|
| **PHI4** | 9.43 GB | ~14B | 12-16 GB | ⚠️ Challenging |
| **GEMMA3 4B** | 3.11 GB | ~4B | 6-8 GB | ✅ Feasible |

- **Communication**: HTTP to Ollama (`localhost:11434`)
- **Fallback**: Graceful degradation to heuristics if LLM unavailable
- **RAG**: Embedded markdown docs injected as system prompt
- **IronBank Status**: ⚠️ REQUIRES SEPARATE CONTAINER

#### Critical Decision Matrix

| Deployment Scenario | SouHimBou ML | KASA LLM | Recommendation |
|---------------------|--------------|----------|----------------|
| **IronBank Container** | ✅ Include | ❌ Separate | Split containers |
| **Air-Gap SCIF** | ✅ Bundle | ⚠️ Pre-load GEMMA3 | Ship with models |
| **Cloud/Connected** | ✅ Include | ✅ Remote Ollama | Centralized LLM |
| **Edge/Minimal** | ✅ Include | ❌ Heuristics only | No LLM required |

#### Decision Required
- [x] Document current model dependencies ✅ (See above)
- [x] Identify model size requirements ✅ (270KB + 3-10GB)
- [ ] **DECIDE**: Ship PHI4 (9GB) or GEMMA3 (3GB) for air-gap?
- [ ] **DECIDE**: Is LLM optional or required for core functionality?
- [ ] **DECIDE**: Single container with volume mount OR multi-container?
- [ ] Determine quantization options (Q4_K_M reduces PHI4 to ~5GB)
- [ ] Define minimum viable model for air-gap deployment
- [ ] Establish model distribution strategy (IronBank artifact vs USB bundle)

---

### 2. DAG Node/Edge Schema Definition
**Status**: 🔴 Not Started
**Priority**: P0 - Critical
**Blocks**: All visualization work (2D and 3D DAG)

#### Why This Matters
Cannot build visualization without knowing:
- What does a "node" represent? (Host? Finding? Control? User?)
- Can one host have multiple nodes?
- What are edge semantics? (causes, enables, requires, etc.)

#### Schema Requirements
```
Node Types:
- [ ] Define all node types
- [ ] Define node properties/attributes
- [ ] Define node states (critical, warning, normal, etc.)

Edge Types:
- [ ] Define edge semantics
- [ ] Define edge directionality
- [ ] Define edge weights/priorities
```

#### Deliverable
- JSON Schema for DAG serialization
- TypeScript types for frontend
- Go structs for backend

---

### 3. gRPC Bridge Prototype
**Status**: 🔴 Not Started
**Priority**: P0 - Critical
**Blocks**: IronBank submission (single-purpose container requirement)

#### Why This Matters
Current architecture uses subprocess calls (Python → Go CLI), which:
- Violates IronBank single-purpose container principle
- Creates brittle stdout parsing
- Prevents proper error propagation
- Adds performance overhead

#### Target Architecture
```
┌─────────────────┐    gRPC    ┌─────────────────┐
│  khepra-ml      │◄──────────►│  khepra-api     │
│  (Python)       │            │  (Go)           │
│  Port: 50051    │            │  Port: 50052    │
└─────────────────┘            └─────────────────┘
```

#### Implementation Steps
- [ ] Define `.proto` files for service interfaces
- [ ] Generate Go server stubs
- [ ] Generate Python client stubs
- [ ] Replace subprocess calls with gRPC calls
- [ ] Add health checks and retry logic

---

### 4. Auth Abstraction Interface
**Status**: 🔴 Not Started
**Priority**: P1 - High
**Blocks**: Dashboard security model

#### Why This Matters
DoD customers have varied auth requirements:
| Customer Type | Auth Method |
|---------------|-------------|
| DoD IL4/IL5 | Okta Gov, Azure AD Gov |
| DoD IL6+ | CAC/PKI only |
| DIB Contractors | Mixed |
| Air-gapped SCIFs | Local LDAP/Certs |

#### Target Architecture
```
┌─────────────────────────────────────────────┐
│         Auth Abstraction Layer              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │  Okta   │ │Keycloak │ │ CAC/PKI │       │
│  │ Adapter │ │ Adapter │ │ Adapter │       │
│  └────┬────┘ └────┬────┘ └────┬────┘       │
│       └───────────┼───────────┘             │
│                   ▼                         │
│       Unified RBAC Enforcement              │
└─────────────────────────────────────────────┘
```

#### Implementation Steps
- [ ] Define `AuthProvider` interface
- [ ] Define `RBACEnforcer` interface
- [ ] Implement Keycloak adapter (primary for air-gap)
- [ ] Implement Okta adapter (for cloud customers)
- [ ] Implement CAC/PKI adapter (for high-security)

---

## Task Dependencies

```
                    ┌─────────────────────┐
                    │ 1. LLM Model Size   │
                    │    Decision         │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
   ┌──────────────────┐ ┌───────────┐ ┌──────────────────┐
   │ IronBank Container│ │ Air-Gap   │ │ 3. gRPC Bridge   │
   │ Strategy          │ │ Strategy  │ │    Prototype     │
   └──────────────────┘ └───────────┘ └──────────────────┘
                                               │
                                               ▼
                               ┌───────────────────────────┐
                               │ Dashboard Implementation  │
                               └───────────────────────────┘

   ┌──────────────────┐        ┌───────────────────────────┐
   │ 2. DAG Schema    │───────►│ Visualization Work        │
   └──────────────────┘        └───────────────────────────┘

   ┌──────────────────┐        ┌───────────────────────────┐
   │ 4. Auth Interface│───────►│ Dashboard Security        │
   └──────────────────┘        └───────────────────────────┘
```

---

## Progress Tracking

| Task | Owner | Started | Completed | Notes |
|------|-------|---------|-----------|-------|
| 1. LLM Model Size | TBD | - | - | |
| 2. DAG Schema | TBD | - | - | |
| 3. gRPC Bridge | TBD | - | - | |
| 4. Auth Interface | TBD | - | - | |

---

## Appendix A: LLM Intel Report

### Python AI (`services/ml_anomaly/`) - SouHimBou ML

#### Architecture Overview
```
┌─────────────────────────────────────────────────────┐
│  FastAPI Server (localhost:8000)                    │
├─────────────────────────────────────────────────────┤
│  Endpoints:                                         │
│  - GET  /              (health check)               │
│  - GET  /soul          (personality state)          │
│  - POST /predict       (anomaly detection)          │
│  - POST /train         (background retraining)      │
│  - GET  /api/v1/dag/visualize  (mock DAG)          │
└────────────┬──────────────────────────────────────┘
             │
     ┌───────┴─────────┐
     │                 │
┌────▼─────────────┐  ┌─────────────────────────┐
│ EnsembleDetector │  │ SouHimBouPersonality    │
├──────────────────┤  ├─────────────────────────┤
│- Autoencoder     │  │- Archetype selection    │
│- Isolation Forest│  │- Threat assessment      │
│- Attention       │  │- Context analysis       │
│- PyTorch         │  │- Reasoning generation   │
└──────────────────┘  └─────────────────────────┘
```

#### Model Details
| Component | Parameters | Purpose |
|-----------|------------|---------|
| FeatureAttention | ~8.4K | Learned feature importance (Q-K-V) |
| AnomalyAutoencoder | ~23K | VAE-based reconstruction detection |
| IsolationForestTorch | ~28.8K | Path-length anomaly scoring |
| Ensemble Weights | 2 | Dynamic model combination (60/40) |
| **TOTAL** | **~60-70K** | **~270 KB serialized** |

#### Feature Vector (32 dimensions)
| Index | Category | Description |
|-------|----------|-------------|
| 0-3 | Temporal | Hour/day sin/cos encoding |
| 4 | Request Rate | Normalized Hz |
| 5-7 | HTTP Method | Read/Write/Delete flags |
| 8-11 | Request Chars | Body size, path depth, params, headers |
| 12-14 | Content Type | Structured/semi/form |
| 15-18 | Identity | Type score, ID hash, org hash |
| 19 | Trust Score | 0.0-1.0 baseline |
| 20-22 | Network Risk | Proxy, Tor, datacenter flags |
| 23-26 | Behavioral | Session duration, density, diversity, errors |
| 27-29 | Payload | Entropy, suspicious chars, JSON depth |
| 30-31 | Reserved | Padding |

#### Threat Postures
```
VIGILANT   → anomaly_score < 0.3   → Allow
SUSPICIOUS → 0.3 ≤ score < 0.6     → Challenge
DEFENSIVE  → 0.6 ≤ score < 0.85    → Block
HUNTING    → score ≥ 0.85          → Block + Alert
```

#### IronBank Considerations
- ✅ No external API calls
- ✅ CPU fallback supported
- ⚠️ Hardcoded paths in `config.py` need env var conversion
- ⚠️ PyTorch dependency (~2GB download, CPU-only ~500MB)

---

### Go AI (`pkg/llm/`) - KASA LLM via Ollama

#### Architecture Overview
```
┌─────────────────────────────────────────────────────────────┐
│                    KASA AGI Engine                          │
│  (Khepra Agentic Security Auditor - BabyAGI-inspired)      │
└────────┬────────────────────────────────────────────────────┘
         │
         ├─── LLM Provider (Ollama) ──────────────┐
         │     ├─ PHI4 (14B, 9.43GB)              │
         │     └─ GEMMA3 4B (4B, 3.11GB)          │
         │                                         │
         ├─── Python ML Service (Port 8000) ──────┤
         │     └─ SouHimBou Anomaly Detection     │
         │                                         │
         └─── Knowledge Base (RAG) ───────────────┘
              ├─ CISA KEV
              ├─ MITRE CVE Database
              └─ Embedded Markdown Docs
```

#### Provider Interface (`pkg/llm/provider.go`)
```go
type Provider interface {
    Generate(prompt string, systemPrompt string) (string, error)
    CheckHealth() bool
}
```

#### Ollama Client (`pkg/llm/ollama/client.go`)
- **Endpoint**: `POST {BaseURL}/api/generate`
- **Timeout**: 60 seconds
- **Auth**: Optional Bearer token
- **Streaming**: Disabled (single completion)

#### Model Manifests Present
| Model | Path | Size | Status |
|-------|------|------|--------|
| PHI4 | `ollama/manifests/.../phi4/latest` | 9.43 GB | ✅ Downloaded |
| GEMMA3 4B | `ollama/manifests/.../gemma3/4b` | 3.11 GB | ✅ Downloaded |

#### LLM Usage in KASA Engine (`pkg/agi/engine.go`)
1. **Threat Analysis** (lines 730-758): Scan results → LLM analysis with RAG context
2. **Commando Chat** (lines 910-932): User queries → "KASA Commando" persona response
3. **Fallback**: If LLM unavailable → heuristics only

#### Configuration (`pkg/config/config.go`)
```bash
ADINKHEPRA_LLM_PROVIDER=ollama      # Default
ADINKHEPRA_LLM_MODEL=phi4           # Default (9.43GB)
ADINKHEPRA_LLM_URL=http://localhost:11434
ADINKHEPRA_LLM_API_KEY=             # Optional
```

#### IronBank Considerations
- ⚠️ Model blobs stored in `pkg/llm/ollama/blobs/` (12.5+ GB total)
- ⚠️ Requires Ollama runtime (separate container)
- ⚠️ GPU recommended for inference speed
- ✅ Graceful degradation if unavailable
- ✅ Local-only operation (no cloud egress)

---

### Communication Flow Between Systems

```
┌──────────────────────────────────────────────────────────────┐
│                      KASA AGI Engine (Go)                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐     HTTP POST      ┌─────────────────────┐ │
│  │ Threat      │────────────────────▶│ Ollama (PHI4)       │ │
│  │ Analysis    │◀────────────────────│ localhost:11434     │ │
│  └─────────────┘     JSON Response   └─────────────────────┘ │
│         │                                                    │
│         │ Extract Features (32-dim)                          │
│         ▼                                                    │
│  ┌─────────────┐     HTTP POST      ┌─────────────────────┐ │
│  │ Intuition   │────────────────────▶│ SouHimBou (Python)  │ │
│  │ Check       │◀────────────────────│ localhost:8000      │ │
│  └─────────────┘     Anomaly Score   └─────────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Current Integration**: HTTP REST (not gRPC)
**Subprocess Risk**: `api.py` has commented code for `khepra dag export` CLI call

---

## Appendix B: Related Documents

- [Original Implementation Plan](./implementation-plan.md)
- [IronBank Submission Guide](./ironbank-guide.md)
- [Air-Gap Deployment Guide](./airgap-deployment.md)
