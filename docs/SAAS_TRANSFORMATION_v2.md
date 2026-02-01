# KHEPRA PROTOCOL - COMMERCIAL SAAS TRANSFORMATION (v2.0)

**Objective**: Transform validation suite into production-ready SaaS platform
**Target**: Enterprise customers (CuminMall.com, etc.)
**Date**: 2026-02-01
**Status**: 🔴 ARCHITECTURE REVIEW REQUIRED

---

## ⚠️ CRITICAL AUDIT FINDINGS

Before proceeding, these issues from v1.0 must be addressed:

### 1. TIMELINE IS UNREALISTIC

| v1.0 Proposed | Realistic Estimate | Why |
|---------------|-------------------|-----|
| Week 1: Standalone Installer | 4-6 weeks | Cross-platform packaging, testing, signing |
| Week 2: SaaS Authentication | 3-4 weeks | OAuth flows, multi-tenant isolation, testing |
| Week 3: Polymorphic Connector | 6-8 weeks | Interface design, 10+ adapters, discovery engine |
| Week 4: Master Console | 6-8 weeks | Multi-tenant dashboard, billing, RBAC |
| **Total: 4 weeks** | **20-26 weeks** | Complex infrastructure |

### 2. ARCHITECTURE CONTRADICTION

v1.0 states:
> "Goal: Remove Python/terminal dependency"

But Phase 1 proposes:
> "Use PyInstaller for Python components, Bundle Node.js runtime"

**Problem**: You're bundling THREE runtimes (Python + Go + Node.js) = 75MB installer that defeats the purpose.

**Solution**: Single Go binary with embedded static frontend (no Node.js runtime needed).

### 3. CONNECTORS ARE NOT POLYMORPHIC

Current state in `pkg/connectors/`:
```go
// These are 4 separate functions with DIFFERENT return types
func ParseCKL(path string) ([]Vuln, error)
func ParseNessus(path string) ([]ReportItem, error)
func ParseXCCDF(path string) ([]RuleResult, error)
func ParseKubeBench(path string) ([]KubeResult, error)
```

**Required**: Unified `Connector` interface with common `Finding` type.

### 4. MULTI-TENANCY DOESN'T EXIST

**Current**: License system is per-machine, not per-organization
- No `org_id` in any data model
- No Row-Level Security (RLS) in Supabase
- No tenant isolation in telemetry

**Required for SaaS**: Every table needs `org_id`, every query needs tenant filter.

### 5. MISSING CRITICAL INFRASTRUCTURE

| Component | Exists | Status |
|-----------|--------|--------|
| CI/CD Pipeline | ❌ | No GitHub Actions |
| Database Migrations | ❌ | Manual SQL only |
| IaC (Terraform) | ❌ | Script-based deploy |
| Secrets Management | ❌ | Hardcoded in scripts |
| APM/Monitoring | ❌ | No observability |

---

## 🎯 REVISED TRANSFORMATION GOALS

### From Developer Tool → Commercial SaaS

**Current State** (Validated):
- ❌ Requires Python, Go, Node.js installation
- ❌ Terminal-dependent (`python adinkhepra.py validate`)
- ❌ Manual configuration
- ❌ Per-machine licensing (no multi-tenant)
- ❌ Local-only deployment
- ✅ Supabase integration exists (partial)
- ✅ License tiers defined (Khepri/Ra/Atum/Osiris)
- ✅ Auth providers abstracted (6 providers)
- ✅ DAG persistence works

**Target State**:
- ✅ Single Go binary (no runtime dependencies)
- ✅ GUI-based (embedded web UI, opens browser)
- ✅ Auto-configuration via discovery
- ✅ Multi-tenant SaaS (organization-scoped)
- ✅ Three deployment models (Edge/Hybrid/Sovereign)

---

## 🏗️ REVISED ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                    SOUHIMBOU.AI CONTROL PLANE                   │
│                    (https://souhimbou.ai)                       │
├─────────────────────────────────────────────────────────────────┤
│  • Supabase Auth (existing) + OAuth/SAML                       │
│  • Organization Management (NEW)                                │
│  • License Enforcement (upgrade from per-machine)               │
│  • DAG Aggregation + Threat Intelligence                        │
│  • Billing (Stripe integration exists)                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
              mTLS + PQC Signatures (Kyber/Dilithium)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    KHEPRA DATA PLANE                            │
│                    (Customer Environment)                       │
├──────────────────┬──────────────────┬──────────────────────────┤
│   EDGE MODE      │   HYBRID MODE    │   SOVEREIGN MODE         │
│   (Beacon)       │   (Full Agent)   │   (Air-Gapped)           │
│   Single Binary  │   Single Binary  │   Full Stack + License   │
│   ~15MB          │   ~25MB          │   ~50MB + Offline Key    │
└──────────────────┴──────────────────┴──────────────────────────┘
```

---

## 📦 REVISED DEPLOYMENT MODELS

### 1. EDGE MODE (Lightweight Beacon)
**Use Case**: Individual endpoints, workstations, IoT

**What Ships**:
```
khepra-edge (single Go binary, ~15MB)
├── Telemetry beacon (heartbeat to control plane)
├── Basic host inventory
├── PQC key material (Dilithium signing)
├── Offline cache (7-day grace)
└── NO local UI (managed via souhimbou.ai console)
```

**Architecture**:
```
┌──────────────────────────────────┐
│  Endpoint                        │
│  ┌────────────────────────────┐  │
│  │  khepra-edge               │  │
│  │  • Collects host metrics   │  │
│  │  • Signs with Dilithium    │  │
│  │  • Beacons to control plane│  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
         ↓ HTTPS + mTLS
┌──────────────────────────────────┐
│  telemetry.souhimbou.org         │
│  (Cloudflare Workers - EXISTS)   │
│  • Validates PQC signature       │
│  • Stores in D1 (per-org)        │
│  • Triggers alerts               │
└──────────────────────────────────┘
```

**Pricing**: $29/endpoint/month (adjusted from $49 - SMB-friendly)

---

### 2. HYBRID MODE (Full Agent)
**Use Case**: Corporate networks, SaaS platforms (CuminMall.com)

**What Ships**:
```
khepra-hybrid (single Go binary, ~25MB)
├── Everything in Edge, plus:
├── Local DAG store (SQLite)
├── Embedded Web UI (Go embed.FS)
├── Connector framework (10+ integrations)
├── KASA autonomous engine
├── Auto-discovery module
└── Offline mode (30-day grace)
```

**Architecture**:
```
┌──────────────────────────────────────────────┐
│  Customer Environment                        │
│  ┌────────────────────────────────────────┐  │
│  │  khepra-hybrid                         │  │
│  │  ┌──────────────────────────────────┐  │  │
│  │  │  Embedded Web UI (port 3000)     │  │  │
│  │  │  (React app served via Go)       │  │  │
│  │  └──────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────┐  │  │
│  │  │  Agent API (port 45444)          │  │  │
│  │  │  (existing Go HTTP server)       │  │  │
│  │  └──────────────────────────────────┘  │  │
│  │  ┌──────────────────────────────────┐  │  │
│  │  │  Connector Registry              │  │  │
│  │  │  • Web (HTTP/REST)               │  │  │
│  │  │  • Network (SNMP/NetFlow)        │  │  │
│  │  │  • STIG (CKL/XCCDF - EXISTS)     │  │  │
│  │  │  • Vuln (Nessus/KubeBench-EXISTS)│  │  │
│  │  │  • Cloud (AWS/Azure/GCP)         │  │  │
│  │  └──────────────────────────────────┘  │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
         ↕ Bidirectional Sync (WebSocket)
┌──────────────────────────────────────────────┐
│  souhimbou.ai Control Plane                  │
│  • DAG aggregation (org-scoped)              │
│  • Policy push                               │
│  • Threat intel feed                         │
│  • Compliance dashboard                      │
└──────────────────────────────────────────────┘
```

**Pricing**: $299/environment/month (adjusted from $499)

---

### 3. SOVEREIGN MODE (Air-Gapped)
**Use Case**: DoD, classified networks, SCIF environments

**What Ships**:
```
khepra-sovereign.iso (~200MB)
├── Everything in Hybrid, plus:
├── Local license server
├── Offline ML models (SouHimBou)
├── Local threat intel database
├── Manual update mechanism
└── USB activation key
```

**Critical Existing Assets**:
- ✅ Offline license key support (`OFFLINE_ROOT_KEY.secret`)
- ✅ FIPS BoringCrypto builds (`Makefile.fips-boring-build`)
- ✅ Iron Bank Dockerfile exists
- ✅ AWS GovCloud deployment guide exists

**Pricing**: $9,999/deployment + $2,000/year support (adjusted from $4,999)
- DoD procurement is complex; one-time license too cheap
- Perpetual + annual support is standard in gov contracts

---

## 🔧 REVISED IMPLEMENTATION ROADMAP

### Phase 0: Foundation (2 weeks) - PREREQUISITE
**Goal**: Build the infrastructure that makes everything else possible

**Tasks**:
1. **Set up CI/CD Pipeline**
   ```yaml
   # .github/workflows/build.yml
   - Build matrix: linux/amd64, linux/arm64, darwin/amd64, darwin/arm64, windows/amd64
   - Run tests on PR
   - Sign binaries (code signing cert required)
   - Publish to GitHub Releases
   ```

2. **Database Migration Framework**
   - Add Supabase migrations to repo
   - Create org_id columns for multi-tenancy
   - Implement RLS policies

3. **Secrets Management**
   - Remove hardcoded secrets from `deploy-fly.sh`
   - Integrate with Doppler/Vault/AWS Secrets Manager

**Deliverables**:
- GitHub Actions workflow
- Supabase migration scripts in `supabase/migrations/`
- Secrets rotation playbook

---

### Phase 1: Single Binary Agent (4 weeks)
**Goal**: Eliminate Python/Node.js runtime dependencies

**Tasks**:
1. **Embed Frontend in Go**
   ```go
   // cmd/khepra-hybrid/main.go
   //go:embed static/*
   var staticFS embed.FS

   func main() {
       // Serve React build from embedded filesystem
       http.Handle("/", http.FileServer(http.FS(staticFS)))
   }
   ```

2. **Build Frontend as Static**
   ```bash
   # Build Next.js to static export
   npm run build && npm run export
   # Output: out/ directory (no Node.js runtime needed)
   ```

3. **Unified Entry Point**
   ```go
   // Single binary that runs:
   // 1. Self-validation
   // 2. License check
   // 3. DAG initialization
   // 4. Start HTTP server (UI + API on same port)
   // 5. Open browser to localhost:3000
   ```

4. **Cross-Platform Installers**
   - Windows: WiX Toolset (not NSIS - better for enterprise)
   - macOS: notarized .pkg
   - Linux: .deb + .rpm + AppImage

**Deliverables**:
- `khepra-edge` binary (~15MB)
- `khepra-hybrid` binary (~25MB)
- Platform installers (signed)

---

### Phase 2: Multi-Tenant Foundation (3 weeks)
**Goal**: Every resource scoped to organization

**Tasks**:
1. **Organization Model**
   ```sql
   -- supabase/migrations/001_organizations.sql
   CREATE TABLE organizations (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       name TEXT NOT NULL,
       slug TEXT UNIQUE NOT NULL,
       created_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE org_members (
       org_id UUID REFERENCES organizations(id),
       user_id UUID REFERENCES auth.users(id),
       role TEXT NOT NULL DEFAULT 'member',
       PRIMARY KEY (org_id, user_id)
   );
   ```

2. **Row-Level Security**
   ```sql
   -- Every table gets this pattern
   ALTER TABLE dag_nodes ENABLE ROW LEVEL SECURITY;

   CREATE POLICY org_isolation ON dag_nodes
       USING (org_id = current_setting('app.current_org_id')::uuid);
   ```

3. **License Upgrade**
   - Change `license.Manager` from per-machine to per-org
   - Add `org_id` to license requests
   - Enforce node limits per organization

4. **Telemetry Upgrade**
   - Add `org_id` to beacon storage
   - Implement org-scoped queries in admin dashboard

**Deliverables**:
- Multi-tenant database schema
- RLS policies
- Updated license manager

---

### Phase 3: Polymorphic Connector Framework (6 weeks)
**Goal**: Extensible integration system

**Tasks**:
1. **Define Common Interface**
   ```go
   // pkg/connectors/interface.go
   type Finding struct {
       ID          string
       Source      string  // "nessus", "ckl", "aws"
       Severity    Severity
       Title       string
       Description string
       Remediation string
       Asset       string
       Timestamp   time.Time
       Raw         map[string]any
   }

   type Connector interface {
       ID() string
       Name() string
       Category() Category  // Vulnerability, Compliance, Network, Cloud
       Configure(config map[string]any) error
       Discover() ([]Asset, error)  // Auto-discovery
       Scan(assets []Asset) (<-chan Finding, error)  // Streaming results
       Close() error
   }
   ```

2. **Migrate Existing Parsers**
   ```go
   // Wrap existing ParseCKL, ParseNessus, etc.
   type NessusConnector struct {
       path string
   }

   func (n *NessusConnector) Scan(assets []Asset) (<-chan Finding, error) {
       items, err := ParseNessus(n.path)
       // Convert []ReportItem to []Finding
   }
   ```

3. **Build New Connectors** (priority order)
   - HTTP/REST (web app monitoring)
   - AWS Security Hub
   - Azure Defender
   - Network discovery (SNMP)
   - Windows WMI

4. **Connector Registry**
   ```go
   var registry = make(map[string]func() Connector)

   func Register(id string, factory func() Connector) {
       registry[id] = factory
   }

   func List() []ConnectorInfo {
       // Return all registered connectors
   }
   ```

**Deliverables**:
- Connector interface + base types
- 10 connectors (4 migrated + 6 new)
- Discovery engine
- Configuration UI

---

### Phase 4: Control Plane (6 weeks)
**Goal**: Multi-tenant management console at souhimbou.ai

**Tasks**:
1. **Admin Dashboard**
   - Organization management (CRUD)
   - User management (invite, roles)
   - License management (assign tiers)
   - Deployment status (agent health)

2. **DAG Aggregation**
   - Ingest DAG nodes from hybrid agents
   - Cross-org threat correlation (anonymized)
   - Compliance roll-up reporting

3. **Billing Integration**
   - Extend Stripe functions
   - Usage-based metering (endpoints, API calls)
   - Invoice generation

4. **Alerting**
   - Webhook system
   - Email/Slack/PagerDuty integrations

**Deliverables**:
- Admin console UI
- Billing API
- Alerting engine

---

## 🔐 SECURITY ARCHITECTURE (Corrected)

### Agent ↔ Control Plane Communication

```
Agent                                    Control Plane
  │                                           │
  │  1. Generate ephemeral Kyber keypair      │
  │  2. Request control plane's Kyber pubkey  │
  │─────────────────────────────────────────▶│
  │                                           │
  │◀─────────────────────────────────────────│
  │  3. Receive Kyber pubkey + Dilithium sig  │
  │  4. Verify signature with known root      │
  │                                           │
  │  5. Encapsulate shared secret (Kyber)     │
  │  6. Establish TLS 1.3 + PQC hybrid        │
  │═══════════════════════════════════════════│
  │        (All traffic encrypted)            │
  │═══════════════════════════════════════════│
```

### Data Flow with DAG Attestation

```
Customer Environment                    Control Plane
┌─────────────────────┐          ┌─────────────────────┐
│  Scan runs          │          │  Receives           │
│       ↓             │          │       ↓             │
│  Finding generated  │          │  Verifies signature │
│       ↓             │          │       ↓             │
│  Write to local DAG │──sync──▶ │  Appends to org DAG │
│  (Dilithium signed) │          │  (immutable audit)  │
│       ↓             │          │       ↓             │
│  Local compliance   │          │  Aggregate reports  │
│  reporting          │          │  Cross-org intel    │
└─────────────────────┘          └─────────────────────┘
```

---

## 💰 REVISED PRICING MODEL

### Based on Actual Cost Structure

| Tier | Target | Price | Justification |
|------|--------|-------|---------------|
| **Edge** | SMB, individuals | $29/endpoint/mo | Minimal infra cost, beacon-only |
| **Hybrid** | Enterprise | $299/environment/mo | Full agent, connectors, support |
| **Sovereign** | DoD/Gov | $9,999 + $2,000/yr | Air-gapped, compliance, dedicated support |

### Comparison to Competitors

| Product | Price | Notes |
|---------|-------|-------|
| CrowdStrike Falcon | $8-15/endpoint/mo | EDR only |
| Wiz | $50k+/year | Cloud-only |
| Tenable.io | $3k+/year | Vuln scanning only |
| **Khepra Edge** | $29/endpoint/mo | Full stack |
| **Khepra Hybrid** | $299/env/mo | All-in-one |

---

## 📋 REALISTIC TIMELINE

```
2026
├── Feb (Weeks 1-2): Phase 0 - Foundation
│   └── CI/CD, migrations, secrets
│
├── Feb-Mar (Weeks 3-6): Phase 1 - Single Binary
│   └── Embed frontend, cross-platform builds
│
├── Mar-Apr (Weeks 7-9): Phase 2 - Multi-Tenant
│   └── Org model, RLS, license upgrade
│
├── Apr-May (Weeks 10-15): Phase 3 - Connectors
│   └── Interface, 10 connectors, discovery
│
├── May-Jun (Weeks 16-21): Phase 4 - Control Plane
│   └── Dashboard, billing, alerting
│
└── Jul: Beta Launch with CuminMall.com
```

**Total: ~6 months (not 4 weeks)**

---

## ✅ REVISED SUCCESS CRITERIA

### MVP Ready (Month 3)
- ✅ Single binary installs on Windows/Linux/Mac
- ✅ User logs in via souhimbou.ai (Supabase)
- ✅ Agent connects to org (multi-tenant)
- ✅ Basic scanning works (existing connectors)
- ✅ Results visible in control plane

### Production Ready (Month 6)
- ✅ 10+ connectors deployed
- ✅ Auto-discovery functional
- ✅ Billing live (Stripe)
- ✅ CuminMall.com case study complete
- ✅ SOC 2 Type 1 audit initiated

---

## 🚨 RISKS & MITIGATIONS

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Next.js static export breaks features | Medium | High | Audit which features require Node.js runtime |
| D1 (Cloudflare) hits 10GB limit | Medium | High | Plan migration to Supabase/PlanetScale |
| PQC libraries not stable | Low | Critical | Pin versions, test extensively |
| Code signing costs ($300-500/yr) | Certain | Low | Budget for Windows + macOS certs |
| Enterprise sales cycle (6-12 months) | High | Medium | Focus on freemium → self-serve |

---

## APPENDIX: EXISTING ASSETS INVENTORY

### Ready to Use
- ✅ License tier system (Khepri/Ra/Atum/Osiris)
- ✅ Auth provider abstraction (6 providers)
- ✅ DAG persistence engine
- ✅ Telemetry server (Cloudflare Workers)
- ✅ Supabase project configured
- ✅ Stripe webhook functions
- ✅ 4 vulnerability parsers (CKL, Nessus, XCCDF, KubeBench)
- ✅ FIPS build targets
- ✅ Iron Bank Dockerfile

### Needs Work
- ⚠️ Connectors need interface unification
- ⚠️ License manager needs org-scope
- ⚠️ Frontend needs static export
- ⚠️ Telemetry needs org-isolation

### Doesn't Exist
- ❌ CI/CD pipeline
- ❌ Database migrations
- ❌ Multi-tenant data model
- ❌ Admin dashboard
- ❌ Billing metering
- ❌ Cross-platform installers

---

**Document Version**: 2.0
**Status**: 🟡 ARCHITECTURE APPROVED (pending Phase 0)
**Next Step**: Implement Phase 0 (CI/CD + Migrations)
**Author**: Architecture Review
**Supersedes**: v1.0 (2026-01-31)
