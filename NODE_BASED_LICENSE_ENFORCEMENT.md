# AdinKhepra Node-Based License Enforcement Design

**Date:** December 31, 2025
**Status:** 🔴 CRITICAL - NO EXISTING NODE ENFORCEMENT
**Financial Impact:** HIGH - Revenue leakage risk without enforcement
**Security:** Post-Quantum Cryptographic Foundation (Dilithium3 + Kyber-1024)

---

## Executive Summary

**CURRENT STATE:**
- ✅ Single-machine license validation exists (`pkg/license/manager.go`)
- ✅ Dilithium3 cryptographic signatures for tamper-proof licenses
- ✅ HostID binding prevents license sharing across machines
- 🔴 **NO node counting or seat limit enforcement**
- 🔴 **NO tracking of concurrent deployments**
- 🔴 **NO entitlement-based feature gating beyond boolean capabilities**

**FINANCIAL RISK:**
Without node enforcement, a customer could:
1. Purchase a 1-node license ($2,499/month for Advisory tier)
2. Deploy to 100 servers using the same license file
3. Generate unlimited revenue for them, $0 for you

**RECOMMENDED SOLUTION:**
Implement a **3-tier node enforcement system** with cryptographic proof of compliance:

1. **Tier 1: Machine Binding** (IMPLEMENTED) - Single-host license verification
2. **Tier 2: Node Registry** (NEW) - Track deployment count against entitlement
3. **Tier 3: Feature Gating** (NEW) - Enforce capabilities based on node tier

---

## Current Licensing Infrastructure (What Exists)

### 1. License Structure

**File:** `pkg/license/manager.go`

```go
type LicenseClaims struct {
    Tenant       string   `json:"tenant"`        // Organization identifier
    HostID       string   `json:"host_id"`       // Machine fingerprint
    Capabilities []string `json:"capabilities"`  // ["compliance", "audit", "advisory"]
    Expiry       int64    `json:"expiry"`        // Unix timestamp
}

type LicenseFile struct {
    Claims    LicenseClaims `json:"claims"`
    Signature []byte        `json:"signature"`   // Dilithium3 signature
}
```

**Generation Command:**
```bash
# At Khepra HQ (private key holder)
adinkhepra license-gen khepra_master.priv "Acme Corp" "host-abc123" 365

# Outputs: license.adinkhepra (JSON file with signed claims)
```

**Verification Flow:**
```
1. User runs: adinkhepra compliance scan
2. Binary loads license.adinkhepra
3. Verifies Dilithium3 signature against embedded public key
4. Checks HostID matches current machine
5. Checks expiry timestamp
6. Allows/denies command execution
```

### 2. Machine Binding (HostID)

**Implementation:** `pkg/license/manager.go:GetHostID()`

```go
func GetHostID() string {
    hostname, _ := os.Hostname()
    ifaces, _ := net.Interfaces()

    var mac string
    for _, iface := range ifaces {
        if len(iface.HardwareAddr) > 0 {
            mac = iface.HardwareAddr.String()
            break
        }
    }

    // Fingerprint: SHA256(hostname + MAC + OS + Arch)
    data := hostname + mac + runtime.GOOS + runtime.GOARCH
    hash := sha256.Sum256([]byte(data))
    return hex.EncodeToString(hash[:])[:16]
}
```

**Strength:** Strong binding - license cannot be transferred to different hardware without re-issue

**Weakness:** Only prevents *single-license multi-machine* abuse, NOT *multiple licenses from same tenant* abuse

### 3. Capabilities Array (Feature Flags)

**Current Usage:**
```json
{
  "capabilities": ["compliance", "audit", "advisory"]
}
```

**Enforcement:** Only checks boolean presence (has/doesn't have), NO quantitative limits

**Example:**
```go
// In cmd/adinkhepra/main.go
if !license.HasCapability("compliance") {
    fmt.Fprintf(os.Stderr, "Error: Compliance module requires license\n")
    os.Exit(1)
}
```

**Gap:** Cannot enforce "compliance scanning for up to 10 nodes" vs. "compliance scanning for up to 100 nodes"

---

## Proposed Node Enforcement Architecture

### Design Principles

1. **Cryptographically Enforceable:** Use Dilithium3 signatures for node limits
2. **Offline-First:** Work in air-gapped environments (no phone-home requirement)
3. **Audit-Ready:** Generate compliance proof for license audits
4. **Grace Periods:** Allow temporary overages with warnings
5. **Feature Tiering:** Different node limits for different features

---

## Option A: Node Registry (Centralized Tracking)

**Use Case:** SaaS/Cloud deployments with internet connectivity

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Khepra Licensing Authority                │
│                  (Supabase + Stripe Integration)            │
│                                                              │
│  Tables:                                                     │
│  ├─ licenses (tenant_id, max_nodes, expiry, capabilities)   │
│  └─ registered_nodes (license_id, host_id, last_heartbeat)  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ REST API (authenticated)
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌───────────────┐             ┌───────────────┐
│   Node #1     │             │   Node #2     │
│               │             │               │
│ license.json  │             │ license.json  │
│ HostID: abc   │             │ HostID: def   │
│               │             │               │
│ On first run: │             │ On first run: │
│ POST /register│             │ POST /register│
│ {host_id}     │             │ {host_id}     │
│               │             │               │
│ Heartbeat:    │             │ Heartbeat:    │
│ POST /ping    │             │ POST /ping    │
│ (every 24h)   │             │ (every 24h)   │
└───────────────┘             └───────────────┘
```

### Database Schema (Supabase)

**New Table: `license_nodes`**

```sql
CREATE TABLE license_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,

    -- Node identification
    host_id TEXT NOT NULL,              -- From GetHostID()
    hostname TEXT,                       -- Human-readable name
    os TEXT,                             -- linux, windows, darwin
    arch TEXT,                           -- amd64, arm64

    -- Registration tracking
    first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'active',  -- active, grace_period, suspended

    -- Deployment metadata
    deployment_type TEXT,                -- production, staging, dev
    version TEXT,                        -- adinkhepra version (e.g., v1.5.0)

    -- Compliance proof
    signature TEXT,                      -- Dilithium3 signature of registration

    UNIQUE(license_id, host_id)
);

-- Index for fast lookups
CREATE INDEX idx_license_nodes_license ON license_nodes(license_id);
CREATE INDEX idx_license_nodes_heartbeat ON license_nodes(last_heartbeat);
```

**Updated Table: `licenses`**

```sql
ALTER TABLE licenses ADD COLUMN max_nodes INTEGER NOT NULL DEFAULT 1;
ALTER TABLE licenses ADD COLUMN enforcement_mode TEXT NOT NULL DEFAULT 'strict';
-- enforcement_mode: 'strict', 'grace_period', 'monitoring_only'
```

### Registration Flow (Client-Side)

**File:** `pkg/license/registry.go` (NEW)

```go
type NodeRegistration struct {
    LicenseID string `json:"license_id"`
    HostID    string `json:"host_id"`
    Hostname  string `json:"hostname"`
    OS        string `json:"os"`
    Arch      string `json:"arch"`
    Version   string `json:"version"`
    Timestamp int64  `json:"timestamp"`
}

type RegistryClient struct {
    APIEndpoint string
    License     *LicenseFile
}

func (rc *RegistryClient) Register() error {
    reg := NodeRegistration{
        LicenseID: rc.License.Claims.Tenant,  // Use tenant as license ID
        HostID:    GetHostID(),
        Hostname:  getHostname(),
        OS:        runtime.GOOS,
        Arch:      runtime.GOARCH,
        Version:   VERSION,
        Timestamp: time.Now().Unix(),
    }

    // Sign registration with license private key (if available)
    // OR just send with license claims for server-side validation

    resp, err := http.Post(
        rc.APIEndpoint + "/api/licenses/register",
        "application/json",
        marshalJSON(reg),
    )

    if err != nil {
        // Graceful degradation: allow offline usage with warning
        log.Printf("[LICENSE] Registration failed: %v. Running in offline mode.", err)
        return nil  // Non-fatal
    }

    if resp.StatusCode == 403 {
        return fmt.Errorf("node limit exceeded - contact support to upgrade license")
    }

    return nil
}

func (rc *RegistryClient) Heartbeat() error {
    // Send periodic ping to update last_heartbeat
    // Non-blocking, fire-and-forget
    go func() {
        http.Post(
            rc.APIEndpoint + "/api/licenses/heartbeat",
            "application/json",
            marshalJSON(map[string]string{
                "host_id": GetHostID(),
                "license_id": rc.License.Claims.Tenant,
            }),
        )
    }()
    return nil
}
```

### API Endpoints (Supabase Edge Functions)

**Endpoint 1: `POST /api/licenses/register`**

**File:** `supabase/functions/license-register/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req) => {
  const { license_id, host_id, hostname, os, arch, version } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Fetch license details
  const { data: license, error: licenseError } = await supabase
    .from("licenses")
    .select("id, max_nodes, enforcement_mode")
    .eq("tenant_id", license_id)
    .single();

  if (licenseError) {
    return new Response(JSON.stringify({ error: "Invalid license" }), { status: 403 });
  }

  // 2. Count active nodes
  const { count: activeNodes } = await supabase
    .from("license_nodes")
    .select("*", { count: "exact", head: true })
    .eq("license_id", license.id)
    .eq("status", "active");

  // 3. Check if node already registered
  const { data: existingNode } = await supabase
    .from("license_nodes")
    .select("id")
    .eq("license_id", license.id)
    .eq("host_id", host_id)
    .maybeSingle();

  if (existingNode) {
    // Update heartbeat for existing node
    await supabase
      .from("license_nodes")
      .update({ last_heartbeat: new Date().toISOString() })
      .eq("id", existingNode.id);

    return new Response(JSON.stringify({ status: "updated" }), { status: 200 });
  }

  // 4. Enforce node limit
  if (activeNodes >= license.max_nodes) {
    if (license.enforcement_mode === "strict") {
      return new Response(
        JSON.stringify({
          error: "Node limit exceeded",
          max_nodes: license.max_nodes,
          current_nodes: activeNodes
        }),
        { status: 403 }
      );
    } else if (license.enforcement_mode === "grace_period") {
      // Allow registration but mark as grace_period status
      const { error } = await supabase.from("license_nodes").insert({
        license_id: license.id,
        host_id,
        hostname,
        os,
        arch,
        version,
        status: "grace_period",
      });

      return new Response(
        JSON.stringify({
          status: "grace_period",
          warning: `Exceeded license limit (${activeNodes}/${license.max_nodes}). Contact support within 7 days.`
        }),
        { status: 200 }
      );
    }
  }

  // 5. Register new node
  const { error } = await supabase.from("license_nodes").insert({
    license_id: license.id,
    host_id,
    hostname,
    os,
    arch,
    version,
    status: "active",
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ status: "registered" }), { status: 201 });
});
```

**Endpoint 2: `POST /api/licenses/heartbeat`**

```typescript
serve(async (req) => {
  const { license_id, host_id } = await req.json();

  const supabase = createClient(/* ... */);

  await supabase
    .from("license_nodes")
    .update({ last_heartbeat: new Date().toISOString() })
    .eq("host_id", host_id);

  return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
});
```

### Integration into Binary

**File:** `cmd/adinkhepra/main.go`

```go
func enforceLicense() {
    // ... existing license verification code ...

    // NEW: Register with licensing authority
    if os.Getenv("ADINKHEPRA_OFFLINE") != "1" {
        registry := &license.RegistryClient{
            APIEndpoint: "https://your-project.supabase.co",
            License:     lic,
        }

        if err := registry.Register(); err != nil {
            // In strict mode, this would exit
            // In grace mode, just log warning
            log.Printf("[LICENSE] Node registration failed: %v", err)
        }

        // Start heartbeat goroutine
        go func() {
            ticker := time.NewTicker(24 * time.Hour)
            for range ticker.C {
                registry.Heartbeat()
            }
        }()
    }
}
```

---

## Option B: Offline Node Manifests (Air-Gapped Deployments)

**Use Case:** DoD/Government customers with air-gapped networks

### Architecture

```
Khepra HQ                      Customer Site (Air-Gapped)
─────────                      ──────────────────────────

1. Customer requests:
   "License for 10 nodes"

2. Generate manifest:
   ┌─────────────────┐
   │ NodeManifest    │         3. Deliver via secure transfer
   │ Tenant: Acme    │            (encrypted email, physical media)
   │ MaxNodes: 10    │         ────────────────────────────────────>
   │ AllowedHosts:   │
   │   - host-abc    │         4. Customer deploys to each node:
   │   - host-def    │            ┌─────────────────────────┐
   │   - ...         │            │  adinkhepra --license   │
   │ Signature: ...  │            │  manifest.khepra        │
   └─────────────────┘            └─────────────────────────┘

                                 5. Each node validates:
                                    - Signature valid?
                                    - HostID in AllowedHosts?
                                    - Not expired?

                                 6. Compliance Export:
                                    ┌─────────────────────┐
                                    │ adinkhepra export   │
                                    │ --compliance-report │
                                    └─────────────────────┘
                                    Outputs: usage.khepra

   <──────────────────────────── 7. Customer sends report
   (for audit/renewal)               (encrypted bundle)

8. Verify usage against
   licensed node count
```

### Node Manifest Structure

**File:** `pkg/license/manifest.go` (NEW)

```go
type NodeManifest struct {
    Tenant      string   `json:"tenant"`
    MaxNodes    int      `json:"max_nodes"`
    AllowedHosts []string `json:"allowed_hosts"`  // List of HostIDs
    Capabilities []string `json:"capabilities"`
    IssuedAt    int64    `json:"issued_at"`
    Expiry      int64    `json:"expiry"`
    Signature   []byte   `json:"signature"`      // Dilithium3 signature
}

// Verify checks signature and host eligibility
func (nm *NodeManifest) Verify(pubKey []byte) error {
    // 1. Verify Dilithium3 signature
    if !verifyDilithiumSignature(nm.Signature, nm.dataToSign(), pubKey) {
        return fmt.Errorf("invalid manifest signature")
    }

    // 2. Check expiry
    if time.Now().Unix() > nm.Expiry {
        return fmt.Errorf("manifest expired")
    }

    // 3. Check if current host is in AllowedHosts
    currentHost := GetHostID()
    for _, allowedHost := range nm.AllowedHosts {
        if allowedHost == currentHost {
            return nil  // Host authorized
        }
    }

    return fmt.Errorf("host %s not in manifest (licensed hosts: %d/%d used)",
        currentHost, len(nm.AllowedHosts), nm.MaxNodes)
}
```

### Manifest Generation (HQ-Side)

**Command:** `adinkhepra license-manifest <tenant> <max-nodes> <days>`

```go
func generateManifest(tenant string, maxNodes int, days int) error {
    manifest := &NodeManifest{
        Tenant:       tenant,
        MaxNodes:     maxNodes,
        AllowedHosts: []string{},  // Empty = allow any hosts up to MaxNodes
        Capabilities: []string{"compliance", "audit"},
        IssuedAt:     time.Now().Unix(),
        Expiry:       time.Now().AddDate(0, 0, days).Unix(),
    }

    // Sign with Khepra HQ private key
    privKey, _ := loadDilithiumPrivateKey("khepra_master.priv")
    manifest.Signature = signDilithium(manifest.dataToSign(), privKey)

    // Encrypt manifest with customer's public key (Kyber-1024)
    encrypted := encryptManifest(manifest, customerPubKey)

    // Output: manifest.khepra (encrypted bundle)
    os.WriteFile("manifest.khepra", encrypted, 0644)

    fmt.Printf("Manifest generated for %s (%d nodes, %d days)\n", tenant, maxNodes, days)
    return nil
}
```

### Host Pre-Registration (Customer-Side)

**Workflow:**

1. Customer runs discovery: `adinkhepra discover-hosts`
2. Outputs list of HostIDs: `host-abc123, host-def456, ...`
3. Customer sends list to Khepra HQ
4. HQ generates manifest with pre-populated `AllowedHosts`
5. Customer deploys manifest to all nodes

**Alternative (Self-Registration):**

1. HQ generates manifest with `AllowedHosts: []` (empty = dynamic)
2. Customer deploys to first node → generates `registered_hosts.json`
3. Each subsequent node appends its HostID to `registered_hosts.json`
4. Local file acts as node registry (max MaxNodes entries allowed)
5. Periodically export `registered_hosts.json` for HQ audit

### Compliance Export

**Command:** `adinkhepra compliance-export --output usage.khepra`

**File:** `pkg/license/compliance.go` (NEW)

```go
type ComplianceReport struct {
    Tenant        string   `json:"tenant"`
    ReportDate    int64    `json:"report_date"`
    LicensedNodes int      `json:"licensed_nodes"`
    ActiveNodes   []string `json:"active_nodes"`  // List of HostIDs
    Violations    []string `json:"violations"`    // If any overages
    Signature     []byte   `json:"signature"`     // Signed by customer
}

func exportCompliance(manifestPath string) error {
    manifest := loadManifest(manifestPath)

    // Load local node registry
    registeredHosts := loadRegisteredHosts()

    report := &ComplianceReport{
        Tenant:        manifest.Tenant,
        ReportDate:    time.Now().Unix(),
        LicensedNodes: manifest.MaxNodes,
        ActiveNodes:   registeredHosts,
        Violations:    []string{},
    }

    // Check for violations
    if len(registeredHosts) > manifest.MaxNodes {
        report.Violations = append(report.Violations,
            fmt.Sprintf("Exceeded node limit: %d/%d", len(registeredHosts), manifest.MaxNodes))
    }

    // Customer signs report (proves authenticity)
    report.Signature = signReport(report)

    // Encrypt for HQ
    encrypted := encryptReport(report, khepraHQPubKey)

    os.WriteFile("usage.khepra", encrypted, 0644)
    fmt.Printf("Compliance report exported: %d nodes (%d licensed)\n",
        len(registeredHosts), manifest.MaxNodes)

    return nil
}
```

---

## Option C: Feature-Tiered Licensing (Hybrid)

**Use Case:** Multi-tier product pricing (Starter, Professional, Enterprise)

### Pricing Tiers

| Tier          | Price/Month | Max Nodes | Capabilities                          |
|---------------|-------------|-----------|---------------------------------------|
| **Starter**   | $499        | 1         | compliance, audit                     |
| **Professional** | $2,499   | 10        | compliance, audit, network_analysis   |
| **Enterprise** | $9,999     | 100       | compliance, audit, network_analysis, advisory, API |
| **Unlimited** | Custom      | ∞         | All features + custom integrations    |

### Enhanced License Structure

```go
type LicenseClaims struct {
    Tenant       string            `json:"tenant"`
    Tier         string            `json:"tier"`  // starter, professional, enterprise
    MaxNodes     int               `json:"max_nodes"`
    Capabilities map[string]int    `json:"capabilities"`  // Feature → node limit
    Expiry       int64             `json:"expiry"`
}

// Example capabilities mapping:
{
  "compliance": 10,      // Can run compliance on up to 10 nodes
  "network_analysis": 5, // Can run network analysis on 5 nodes
  "advisory": 1          // Advisory services for 1 tenant
}
```

### Enforcement Logic

```go
func checkFeatureEntitlement(license *LicenseFile, feature string, currentNodes int) error {
    // Check if feature exists in capabilities
    limit, ok := license.Claims.Capabilities[feature]
    if !ok {
        return fmt.Errorf("feature '%s' not included in %s tier", feature, license.Claims.Tier)
    }

    // Check node limit for this feature
    if currentNodes > limit {
        return fmt.Errorf("node limit exceeded for '%s': %d/%d (upgrade to Enterprise for more nodes)",
            feature, currentNodes, limit)
    }

    return nil
}

// Usage:
if err := checkFeatureEntitlement(license, "network_analysis", 7); err != nil {
    fmt.Fprintf(os.Stderr, "Error: %v\n", err)
    os.Exit(1)
}
```

---

## Recommended Implementation Roadmap

### Phase 1: Foundation (Week 1) - CRITICAL FOR REVENUE

**Priority:** 🔴 URGENT

**Tasks:**
1. ✅ Extend `LicenseClaims` with `MaxNodes` field
2. ✅ Update license generation to include node limits
3. ✅ Add node count validation in `enforceLicense()`
4. ✅ Implement `NodeManifest` for offline deployments
5. ✅ Add `--license-info` command to show node limits

**Deliverable:** Basic node limit enforcement in binary (no registry yet)

**Code Changes:**

```go
// pkg/license/manager.go
type LicenseClaims struct {
    Tenant       string   `json:"tenant"`
    MaxNodes     int      `json:"max_nodes"`      // NEW
    Capabilities []string `json:"capabilities"`
    Expiry       int64    `json:"expiry"`
}

// cmd/adinkhepra/main.go
func enforceLicense() {
    // ... existing verification ...

    // NEW: Check node limit (simple file-based tracking)
    nodeCount := countDeployedNodes()  // Read from local registry file

    if nodeCount > lic.Claims.MaxNodes {
        fmt.Fprintf(os.Stderr,
            "LICENSE ERROR: Node limit exceeded (%d/%d)\n" +
            "Contact sales@khepraprotocol.com to upgrade your license.\n",
            nodeCount, lic.Claims.MaxNodes)
        os.Exit(1)
    }
}
```

**Testing:**
```bash
# Generate 5-node license
adinkhepra license-gen khepra_master.priv "Acme Corp" "host-abc" --max-nodes 5 --days 365

# Attempt to deploy on 6th node
./adinkhepra compliance scan
# Expected: "LICENSE ERROR: Node limit exceeded (6/5)"
```

---

### Phase 2: Node Registry (Week 2-3)

**Priority:** 🟡 HIGH

**Tasks:**
1. Create `license_nodes` table in Supabase
2. Implement `pkg/license/registry.go` with Register/Heartbeat
3. Create Supabase Edge Functions for `/api/licenses/register` and `/api/licenses/heartbeat`
4. Add `--register` flag to adinkhepra binary
5. Implement grace period logic (7 days after overage)

**Deliverable:** Centralized node tracking with online enforcement

**Revenue Impact:** Enables SaaS pricing model with real-time enforcement

---

### Phase 3: Compliance Reporting (Week 4)

**Priority:** 🟢 MEDIUM

**Tasks:**
1. Implement `adinkhepra compliance-export` command
2. Create `ComplianceReport` structure with usage metrics
3. Add audit trail for license checks
4. Build HQ dashboard to view customer node usage

**Deliverable:** Audit-ready compliance proof for enterprise customers

**Sales Value:** Required for DoD/FedRAMP customers who need audit trails

---

### Phase 4: Feature Tiering (Month 2)

**Priority:** 🔵 LOW (but high revenue potential)

**Tasks:**
1. Migrate `Capabilities` from `[]string` to `map[string]int`
2. Implement per-feature node limits
3. Create tiered pricing SKUs in Stripe
4. Update license generation to support tiers
5. Add upsell messaging when limits hit

**Deliverable:** Multi-tier pricing (Starter, Professional, Enterprise)

**Revenue Impact:** Enables $499 → $2,499 → $9,999 upgrade path

---

## Security Considerations

### 1. Tamper Resistance

**Threat:** User modifies `MaxNodes` in license.json file

**Mitigation:** Dilithium3 signature verification fails if claims are modified

**Code:**
```go
func (lf *LicenseFile) Verify(pubKey []byte) error {
    // Re-compute expected signature from claims
    data := marshalJSON(lf.Claims)

    // Verify using post-quantum Dilithium3
    if !adinkra.VerifyDilithium3(pubKey, data, lf.Signature) {
        return fmt.Errorf("license signature invalid - file may be tampered")
    }

    return nil
}
```

### 2. License Sharing

**Threat:** User copies `license.adinkhepra` to multiple machines

**Mitigation (Current):** HostID binding prevents single-license multi-machine use

**Mitigation (Proposed):** Node registry tracks all HostIDs using a license

**Code:**
```go
// In registry check
if activeNodesForLicense > license.MaxNodes {
    return fmt.Errorf("license shared across %d machines (limit: %d)",
        activeNodesForLicense, license.MaxNodes)
}
```

### 3. Offline Bypass

**Threat:** User disables internet to bypass node registry

**Mitigation:** Offline mode requires `NodeManifest` with pre-registered HostIDs

**Code:**
```go
if os.Getenv("ADINKHEPRA_OFFLINE") == "1" {
    // Must use manifest-based licensing
    manifest := loadManifest("manifest.khepra")

    if !manifest.Contains(GetHostID()) {
        return fmt.Errorf("host not in offline manifest")
    }
}
```

### 4. Time Manipulation

**Threat:** User sets system clock back to bypass expiry

**Mitigation:** Check against NTP time (if online), record last-known-good time

**Code:**
```go
func getSecureTime() time.Time {
    // Try NTP first
    if ntpTime, err := getNTPTime("pool.ntp.org"); err == nil {
        return ntpTime
    }

    // Fallback: check against last recorded time
    lastTime := loadLastKnownTime()
    currentTime := time.Now()

    if currentTime.Before(lastTime) {
        log.Fatal("SECURITY: System clock appears to have been set backward. License enforcement failed.")
    }

    saveLastKnownTime(currentTime)
    return currentTime
}
```

### 5. Binary Modification

**Threat:** User patches binary to skip license checks

**Mitigation:** Code signing + integrity checks

**Code:**
```go
// At startup
func verifyBinaryIntegrity() {
    // Compute SHA-256 of current binary
    exe, _ := os.Executable()
    data, _ := os.ReadFile(exe)
    hash := sha256.Sum256(data)

    // Compare against embedded signature (set at build time via -ldflags)
    if hex.EncodeToString(hash[:]) != EXPECTED_BINARY_HASH {
        log.Fatal("SECURITY: Binary integrity check failed. Re-download from official source.")
    }
}
```

---

## Pricing Model Recommendations

### Recommended SKUs

```yaml
Tiers:
  Starter:
    price: $499/month
    max_nodes: 1
    capabilities: [compliance, audit]
    target: "Small businesses, single-server deployments"

  Professional:
    price: $2,499/month
    max_nodes: 10
    capabilities: [compliance, audit, network_analysis, stig_mapper]
    target: "Mid-market companies, multi-server environments"

  Enterprise:
    price: $9,999/month
    max_nodes: 100
    capabilities: [compliance, audit, network_analysis, stig_mapper, advisory]
    target: "Large enterprises, DoD contractors"

  Unlimited:
    price: "Custom"
    max_nodes: 999999  # Effectively unlimited
    capabilities: ["*"]
    target: "Government agencies, Fortune 500, custom integrations"
```

### Node Overage Pricing

**Model:** Tiered overage pricing

```yaml
Overage:
  first_5_nodes: $50/node/month   # $2,499 + $250 = $2,749 for 15 nodes
  next_15_nodes: $40/node/month   # Better rate at scale
  over_20_nodes: "Contact sales for Enterprise tier"
```

**Example:**
- Customer has Professional (10 nodes, $2,499/month)
- Deploys 13 nodes total
- Overage: 3 nodes × $50 = $150/month
- New bill: $2,649/month
- Message: "Upgrade to Enterprise for $9,999 and get 100 nodes"

---

## Grace Period Policy

### Recommended Enforcement Levels

```yaml
Days 1-3 (Warning):
  enforcement: "log_only"
  message: "⚠️  Node limit exceeded (13/10). You have 4 days to remove excess nodes or upgrade."
  action: "Continue normal operation, send daily email"

Days 4-7 (Grace Period):
  enforcement: "degraded_mode"
  message: "⚠️  GRACE PERIOD: Running in degraded mode. Upgrade within 3 days."
  action: |
    - Disable advanced features (network_analysis, advisory)
    - Keep core compliance scanning active
    - Send daily email + in-app notification

Days 8+ (Lockout):
  enforcement: "strict"
  message: "🔒 LICENSE SUSPENDED: Node limit exceeded (13/10). Contact sales immediately."
  action: |
    - Block all commands except 'license-info' and 'compliance-export'
    - Customer must export compliance report and contact sales
    - Automatic Stripe email for upgrade
```

### Implementation

```go
func enforceGracePeriod(license *LicenseFile, nodeCount int) {
    overage := nodeCount - license.MaxNodes

    if overage <= 0 {
        return  // Within limits
    }

    // Check when overage started
    overageStart := getOverageStartDate(license.Tenant)
    daysSinceOverage := time.Since(overageStart).Hours() / 24

    if daysSinceOverage <= 3 {
        log.Printf("⚠️  WARNING: Node limit exceeded (%d/%d). %d days until grace period.",
            nodeCount, license.MaxNodes, int(4 - daysSinceOverage))
        return  // Allow operation
    } else if daysSinceOverage <= 7 {
        log.Printf("⚠️  GRACE PERIOD: Degraded mode active. %d days until suspension.",
            int(8 - daysSinceOverage))
        disableAdvancedFeatures()
        return  // Degraded operation
    } else {
        log.Fatal("🔒 LICENSE SUSPENDED: Node limit exceeded. Contact sales@khepraprotocol.com")
    }
}
```

---

## Integration with Stripe

### Webhook Enhancement

**File:** `supabase/functions/stripe-webhook/index.ts`

```typescript
// Handle node limit upgrades
if (event.type === "customer.subscription.updated") {
  const subscription = event.data.object as Stripe.Subscription;

  // Extract new tier from subscription metadata
  const newTier = subscription.metadata.tier;  // "professional", "enterprise"
  const newMaxNodes = parseInt(subscription.metadata.max_nodes || "10");

  // Update license in database
  await supabase
    .from("licenses")
    .update({
      tier: newTier,
      max_nodes: newMaxNodes
    })
    .eq("stripe_customer_id", subscription.customer);

  // Re-generate license file
  const licenseFile = await generateLicenseFile(subscription.customer);

  // Email new license to customer
  await sendLicenseEmail(customer.email, licenseFile);
}
```

### Self-Service Upgrade Flow

**User Journey:**

1. User hits node limit in CLI
2. CLI shows: "Upgrade to Professional for 10 nodes → https://app.khepraprotocol.com/upgrade"
3. User clicks link → Stripe Checkout
4. Webhook updates license → new `license.adinkhepra` emailed
5. User replaces old license file → nodes unlock

**Revenue Impact:** Frictionless upgrade path = higher conversion

---

## Dashboard Metrics (Supabase)

### Customer License Dashboard

**URL:** `https://app.khepraprotocol.com/licenses`

**View Query:**

```sql
CREATE VIEW customer_license_overview AS
SELECT
    l.tenant_id,
    l.tier,
    l.max_nodes,
    COUNT(ln.id) AS active_nodes,
    CASE
        WHEN COUNT(ln.id) > l.max_nodes THEN 'OVERAGE'
        WHEN COUNT(ln.id) = l.max_nodes THEN 'AT_LIMIT'
        ELSE 'ACTIVE'
    END AS status,
    MAX(ln.last_heartbeat) AS last_activity
FROM licenses l
LEFT JOIN license_nodes ln ON ln.license_id = l.id AND ln.status = 'active'
GROUP BY l.id;
```

**UI Display:**

```
┌─────────────────────────────────────────────────────────┐
│ Your Licenses                                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Tier: Professional                    ⚠️  6/10 nodes used │
│                                                         │
│ Active Nodes:                                           │
│  ✓ web-server-01    (last seen: 2h ago)                │
│  ✓ db-primary       (last seen: 5h ago)                │
│  ✓ db-replica-01    (last seen: 5h ago)                │
│  ✓ app-server-01    (last seen: 1h ago)                │
│  ✓ app-server-02    (last seen: 1h ago)                │
│  ✓ monitoring-01    (last seen: 3h ago)                │
│                                                         │
│ [Upgrade to Enterprise (100 nodes) →]                  │
└─────────────────────────────────────────────────────────┘
```

---

## Testing Strategy

### Unit Tests

**File:** `pkg/license/manager_test.go`

```go
func TestNodeLimitEnforcement(t *testing.T) {
    license := &LicenseFile{
        Claims: LicenseClaims{
            Tenant: "test-tenant",
            MaxNodes: 5,
            Expiry: time.Now().Add(365 * 24 * time.Hour).Unix(),
        },
    }

    // Test: Within limit
    if err := validateNodeCount(license, 3); err != nil {
        t.Errorf("Expected no error for 3/5 nodes, got: %v", err)
    }

    // Test: At limit
    if err := validateNodeCount(license, 5); err != nil {
        t.Errorf("Expected no error for 5/5 nodes, got: %v", err)
    }

    // Test: Exceeded limit
    if err := validateNodeCount(license, 6); err == nil {
        t.Errorf("Expected error for 6/5 nodes, got nil")
    }
}
```

### Integration Tests

**Scenario 1: Single-Node Deployment**

```bash
# Generate 1-node license
adinkhepra license-gen test.priv "test-customer" "host-abc" --max-nodes 1

# Deploy to first node (should succeed)
./adinkhepra --license license.json compliance scan
# Expected: Success

# Copy license to second node (should fail)
scp license.json node2:/opt/adinkhepra/
ssh node2 './adinkhepra compliance scan'
# Expected: "LICENSE ERROR: HostID mismatch"
```

**Scenario 2: Node Registry**

```bash
# Generate 3-node license
adinkhepra license-gen test.priv "test-customer" --max-nodes 3

# Register 3 nodes
for i in {1..3}; do
    ssh node$i './adinkhepra --register'
done
# Expected: All succeed

# Attempt 4th registration
ssh node4 './adinkhepra --register'
# Expected: "Node limit exceeded (4/3)"
```

---

## Conclusion

### Recommended Immediate Actions (This Week)

1. **⚠️  CRITICAL:** Extend `LicenseClaims` to include `MaxNodes` field
2. **⚠️  CRITICAL:** Update license generation command to set node limits
3. **⚠️  CRITICAL:** Add basic node count enforcement in binary (file-based tracking)
4. **🔴 HIGH:** Create Supabase `license_nodes` table
5. **🔴 HIGH:** Implement node registration API endpoint

### Why This Matters for Revenue

**Without node enforcement:**
- Customer pays $2,499 for 10-node Professional license
- Deploys to 50 nodes
- You lose: $7,500/month in overage fees OR upsell to Enterprise

**With node enforcement:**
- Customer deploys to 50 nodes
- System detects overage → shows upgrade prompt
- Customer upgrades to Enterprise ($9,999/month)
- Revenue gain: $7,500/month × 12 months = **$90,000/year per customer**

### Risk of Delayed Implementation

**If you ship V1.5 without node enforcement:**
- Early adopters deploy at scale with no limits
- Contractual obligation to grandfather their pricing
- **Estimated revenue loss:** $500K+ annually (assuming 50 early enterprise customers)

### Post-Quantum Security Advantage

Your Dilithium3 + Kyber-1024 licensing foundation is **unique in the market**:
- Competitors (Tenable, Qualys, Rapid7) use RSA-2048 or ECDSA
- Vulnerable to quantum attacks (Shor's algorithm)
- **Sales pitch:** "License enforcement secure against quantum computers through 2035"

---

## Next Steps

**Choice Required:**

**Option A: Fast Track (Online-Only)**
- Implement node registry with Supabase (1 week)
- SaaS-first approach
- Best for: Cloud/hybrid customers

**Option B: Offline-First**
- Implement manifest-based licensing (1 week)
- Air-gap compatible
- Best for: DoD/Government contracts

**Option C: Hybrid (Recommended)**
- Both online registry AND offline manifests (2 weeks)
- Maximum market coverage
- Best for: All customer segments

**Which option should I implement first?**
