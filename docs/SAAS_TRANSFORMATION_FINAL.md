# KHEPRA PROTOCOL - COMMERCIAL SAAS TRANSFORMATION (FINAL)

**Version**: 3.0 (Merged)  
**Date**: 2026-02-01  
**Status**: ✅ ARCHITECTURE APPROVED  
**Timeline**: 6 months to production

---

## 🎯 DEPLOYMENT MODELS

### 1. EDGE MODE - $29/endpoint/month
**Positioning**: Enterprise-grade endpoint security, not "lightweight"

**What Ships**: `khepra-edge` (15MB Go binary)
- ✅ Full PQC cryptography (Dilithium + Kyber)
- ✅ Local DAG cache (7-day offline grace)
- ✅ Autonomous threat detection
- ✅ Real-time telemetry beacon
- ✅ Host inventory & drift detection
- ✅ Managed via souhimbou.ai console

**Value Proposition**: "CrowdStrike-level protection at 1/3 the price"

### 2. HYBRID MODE - $299/environment/month
**Target**: CuminMall.com, corporate networks

**What Ships**: `khepra-hybrid` (25MB Go binary)
- Everything in Edge, PLUS:
- ✅ Embedded Web UI (React served via Go)
- ✅ Local DAG store (SQLite)
- ✅ Polymorphic connector framework
- ✅ Auto-discovery engine
- ✅ KASA autonomous engine
- ✅ 30-day offline mode

### 3. SOVEREIGN MODE - $9,999 + $2,000/year
**Target**: DoD, air-gapped networks

**What Ships**: `khepra-sovereign.iso` (200MB)
- Everything in Hybrid, PLUS:
- ✅ Local license server
- ✅ Offline ML models
- ✅ Manual USB activation
- ✅ FIPS 140-3 certified builds

---

## 🏗️ ARCHITECTURE

```
┌─────────────────────────────────────────┐
│  SOUHIMBOU.AI CONTROL PLANE             │
│  • Multi-tenant auth (Supabase)         │
│  • License enforcement (org-scoped)     │
│  • DAG aggregation                      │
│  • Threat intelligence                  │
│  • Billing (Stripe)                     │
└─────────────────────────────────────────┘
         ↓ mTLS + PQC (Kyber/Dilithium)
┌─────────────────────────────────────────┐
│  CUSTOMER ENVIRONMENT                   │
│  • khepra-edge (15MB) OR                │
│  • khepra-hybrid (25MB) OR              │
│  • khepra-sovereign (full stack)        │
└─────────────────────────────────────────┘
```

---

## 🚀 IMPLEMENTATION ROADMAP (6 Months)

### Phase 0: Foundation (Weeks 1-2)
**Critical Prerequisites**

1. **CI/CD Pipeline**
```yaml
# .github/workflows/build.yml
- Build matrix: linux/amd64, darwin/amd64, windows/amd64
- Code signing (Windows + macOS certs)
- Publish to GitHub Releases
```

2. **Database Migrations**
```sql
-- Multi-tenancy foundation
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

ALTER TABLE licenses ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE dag_nodes ADD COLUMN org_id UUID;

-- Row-Level Security
ALTER TABLE dag_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON dag_nodes
  USING (org_id = current_setting('app.current_org_id')::uuid);
```

3. **Secrets Management**
- Remove hardcoded secrets from `deploy-fly.sh`
- Integrate Doppler/Vault

**Deliverables**: GitHub Actions, Supabase migrations, secrets vault

---

### Phase 1: Single Binary Agent (Weeks 3-6)
**Goal**: Eliminate Python/Node.js dependencies

**Tasks**:
1. **Embed Frontend in Go**
```go
//go:embed static/*
var staticFS embed.FS

func main() {
    http.Handle("/", http.FileServer(http.FS(staticFS)))
    http.ListenAndServe(":3000", nil)
}
```

2. **Build Static Frontend**
```bash
cd souhimbou_ai/SouHimBou.AI
npm run build && npm run export
# Output: out/ directory (no Node.js runtime)
```

3. **Cross-Platform Installers**
- Windows: WiX Toolset (signed .msi)
- macOS: Notarized .pkg
- Linux: .deb + .rpm + AppImage

**Deliverables**: 
- `khepra-edge` (15MB)
- `khepra-hybrid` (25MB)
- Signed installers

---

### Phase 2: Multi-Tenant Foundation (Weeks 7-9)
**Goal**: Organization-scoped everything

**Tasks**:
1. Upgrade license manager (per-org, not per-machine)
2. Add `org_id` to all tables
3. Implement RLS policies
4. Update telemetry beacon (org-scoped)

**Deliverables**: Multi-tenant data model, RLS policies

---

### Phase 3: Polymorphic Connectors (Weeks 10-15)
**Goal**: Unified integration framework

**Interface**:
```go
type Finding struct {
    ID          string
    Source      string  // "nessus", "ckl", "aws"
    Severity    Severity
    Title       string
    Description string
    Asset       string
    Timestamp   time.Time
}

type Connector interface {
    ID() string
    Configure(config map[string]any) error
    Discover() ([]Asset, error)
    Scan(assets []Asset) (<-chan Finding, error)
    Close() error
}
```

**Connectors to Build**:
1. Migrate existing (CKL, Nessus, XCCDF, KubeBench)
2. HTTP/REST (web app monitoring)
3. AWS Security Hub
4. Azure Defender
5. Network (SNMP)
6. Windows WMI

**Deliverables**: Connector framework, 10 connectors, auto-discovery

---

### Phase 4: Control Plane (Weeks 16-21)
**Goal**: Master console at souhimbou.ai

**Features**:
- Organization management
- License assignment
- Agent health monitoring
- DAG aggregation
- Compliance reporting
- Billing (Stripe integration)

**Deliverables**: Admin dashboard, billing API, alerting

---

## 📋 USER FLOW (CuminMall.com Example)

### Installation
```
1. Visit https://souhimbou.ai/download
2. Download khepra-hybrid-installer.msi (25MB)
3. Double-click installer
4. Opens browser → https://souhimbou.ai/activate
5. Login with email/password
6. Select organization: "CuminMall"
7. Installer receives activation token
8. Agent auto-configures and starts
```

### Auto-Discovery
```
Agent discovers:
✅ Web app: https://cuminmall.com
✅ Database: PostgreSQL (port 5432)
✅ Redis: port 6379
✅ Network: 192.168.1.0/24
✅ Endpoints: 15 Windows servers

User approves connections
```

### Monitoring
```
User accesses: https://souhimbou.ai/console
Views:
✅ Real-time security posture
✅ Incident dashboard
✅ Compliance status (NIST, CMMC)
✅ Threat intelligence
```

---

## 💰 PRICING COMPARISON

| Product | Price | Coverage |
|---------|-------|----------|
| CrowdStrike | $8-15/endpoint/mo | EDR only |
| Wiz | $50k+/year | Cloud only |
| Tenable | $3k+/year | Vuln scanning |
| **Khepra Edge** | **$29/endpoint/mo** | **Full stack** |
| **Khepra Hybrid** | **$299/env/mo** | **All-in-one** |

---

## ✅ SUCCESS CRITERIA

### MVP (Month 3)
- ✅ Single binary installs on all platforms
- ✅ User logs in via souhimbou.ai
- ✅ Agent connects to organization
- ✅ Basic scanning works
- ✅ Results in control plane

### Production (Month 6)
- ✅ 10+ connectors
- ✅ Auto-discovery functional
- ✅ Billing live
- ✅ CuminMall.com case study
- ✅ SOC 2 Type 1 initiated

---

## 🚨 CRITICAL FIXES FROM v1.0

1. ✅ **Realistic Timeline**: 6 months (not 4 weeks)
2. ✅ **Single Binary**: Go only (no Python/Node.js runtime)
3. ✅ **Multi-Tenancy**: Org-scoped from day 1
4. ✅ **Unified Connectors**: Common `Finding` interface
5. ✅ **Edge Positioning**: Enterprise-grade, not "lightweight"
6. ✅ **Pricing**: Competitive with market ($29 vs $49)

---

**Status**: ✅ READY TO IMPLEMENT  
**Next Step**: Phase 0 - Foundation (CI/CD + Migrations)  
**Timeline**: 6 months to production launch
