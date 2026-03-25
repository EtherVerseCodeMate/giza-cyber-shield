# PegaProx Integration Evaluation
**For: GIZA CYBER SHIELD / ADINKHEPRA Protocol (ASAF)**
**Date:** 2026-03-11
**Status:** Recommended — Conditional Integration

---

## Executive Summary

[PegaProx](https://pegaprox.com/) is a **free, open-source datacenter management platform for Proxmox VE and XCP-NG** — not a traditional proxy/VPN service. It provides multi-cluster VM orchestration, real-time monitoring, RBAC, SSO, vulnerability scanning, and a REST API.

**Verdict:** PegaProx is a **strong fit** for giza-cyber-shield's infrastructure layer, specifically for deployments targeting the **Sovereign ($99/endpoint)** and **Iron Bank (DoD)** tiers where on-premise Proxmox VE is common. It complements — rather than duplicates — existing capabilities.

---

## What PegaProx Provides

| Feature | Description |
|---|---|
| Multi-cluster management | Single dashboard for multiple Proxmox VE / XCP-NG clusters |
| Real-time monitoring | CPU, RAM, storage via Server-Sent Events (SSE) |
| VM live migration | Zero-downtime cross-cluster migration, ESXi import |
| Built-in CVE scanning | Vulnerability detection across nodes and VMs |
| Security hardening | One-click best-practice configurations for Proxmox hosts |
| RBAC & multi-tenancy | Admin / Operator / Viewer roles; VM-level ACLs; IP whitelisting |
| SSO | LDAP, Active Directory, OIDC (Entra ID, Keycloak, Google), 2FA |
| REST API | Token-based; auto-creates PVE API tokens; 2FA-compatible |
| Audit log API | `GET /api/audit/log` — logs user identity + IP for all actions |
| Storage support | Ceph, LVM COW snapshots, iSCSI SAN |
| Cost | Free / open-source; sponsorware model |

---

## Integration Opportunities

### 1. Infrastructure Layer for Sovereign & Iron Bank Deployments

giza-cyber-shield's **Aaru Realm** (Hybrid, 60s) and **Aten Realm** (Sovereign, 5min) are designed for on-premise, air-gapped environments — the exact target market for Proxmox VE. PegaProx can serve as the hypervisor management layer beneath giza-cyber-shield.

**Integration point:** The `APIGatewayManager` (`src/services/APIGatewayManager.ts`) can proxy requests to PegaProx's REST API for cluster health and node status data, feeding into the DAG causal risk model.

```typescript
// src/services/PegaProxClient.ts (new)
const PEGAPROX_BASE = process.env.PEGAPROX_API_URL;  // e.g. https://proxmox-mgmt.internal
const PEGAPROX_TOKEN = process.env.PEGAPROX_API_TOKEN;

async function getClusterHealth(): Promise<ClusterStatus[]> {
  const res = await fetch(`${PEGAPROX_BASE}/api/clusters`, {
    headers: { Authorization: `Bearer ${PEGAPROX_TOKEN}` },
  });
  return res.json();
}
```

---

### 2. Vulnerability Scan Data → STIG/DAG Enrichment

PegaProx performs built-in CVE scanning across Proxmox nodes and VMs. This output can be ingested into giza-cyber-shield's **36,000+ STIG mapping engine** and the **Khepra DAG** to correlate infrastructure-level CVEs with compliance posture.

**Integration point:** Scheduled pull of PegaProx scan results → transform to STIG finding format → ingest via existing `STIGMapper` service.

```go
// pkg/stig/pegaprox_ingest.go (new)
type PegaProxFinding struct {
    NodeID string `json:"node_id"`
    CVE    string `json:"cve"`
    CVSS   float64 `json:"cvss_score"`
}

func IngestPegaProxFindings(findings []PegaProxFinding) ([]STIGFinding, error) {
    // Map CVE → STIG rule IDs via existing CVE-to-STIG lookup table
}
```

---

### 3. Audit Log Fusion → Causal DAG

PegaProx's `GET /api/audit/log` endpoint returns timestamped, user-attributed infrastructure actions. These events — VM starts, migrations, config changes — are **causal inputs** for giza-cyber-shield's DAG-based risk model.

**Integration point:** Khepra daemon polls `GET /api/audit/log`, converts entries to DAG nodes, and links them to security events using Dilithium-signed attestations.

```go
// Audit event pulled from PegaProx
type PegaProxAuditEvent struct {
    Timestamp time.Time `json:"timestamp"`
    UserID    string    `json:"user_id"`
    ClientIP  string    `json:"client_ip"`
    Action    string    `json:"action"`
    Resource  string    `json:"resource"`
}
```

This transforms infrastructure operations into **verifiable, causally-ordered security evidence** — directly strengthening ADINKHEPRA's core value proposition.

---

### 4. Identity/SSO Bridge

PegaProx supports LDAP, AD, OIDC (Entra ID, Keycloak). giza-cyber-shield's enterprise customers likely already have one of these. A shared SSO configuration eliminates dual credential management across the hypervisor and security layers.

**Integration point:** Configure both PegaProx and giza-cyber-shield's Supabase Auth to use the same OIDC provider, so a single identity controls both infrastructure access and security posture dashboards.

---

### 5. RBAC Alignment

| PegaProx Role | Suggested giza-cyber-shield Mapping |
|---|---|
| Admin | Full Khepra orchestration + gateway config |
| Operator | Duat/Aaru realm actions (remediation, scan triggers) |
| Viewer | Dashboard-only; Aten realm read access |

VM-level ACLs in PegaProx can mirror the asset scoping already implemented in giza-cyber-shield's `LicenseEnforcer`.

---

### 6. Ceph / Storage Monitoring → Capacity Planning

PegaProx's Ceph cluster management exposes pool health and OSD status. For deployments running giza-cyber-shield scan artifacts, logs, or DAG snapshots on Ceph-backed storage, this data can inform the Ouroboros self-healing cycle (e.g., auto-archive when storage hits threshold).

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| PegaProx stores credentials in SQLite (`config/` dir) — not FIPS-validated | High (Iron Bank) | Run PegaProx outside the Iron Bank trust boundary; treat as infrastructure-tier, not data-tier |
| Small team (3 devs), open-source sustainability risk | Medium | Pin to specific releases; maintain an internal fork for DoD use cases |
| PegaProx REST API is not documented as FIPS 140-3 compliant | High (DoD) | Wrap all calls through giza-cyber-shield's existing TLS 1.3 / FIPS gateway (`pkg/gateway/`) |
| Audit log polling creates a dependency on PegaProx uptime | Low | Cache last-known state; mark as "unverified" in DAG if stale |
| No native PQC support in PegaProx API tokens | Medium | Tunnel API calls through Phantom mesh or Tailscale; add Dilithium attestation wrapper at ingest |

---

## Implementation Phases

### Phase 1 — Read-Only Monitoring (Low effort, immediate value)
- Add `PegaProxClient` service in `src/services/`
- Pull cluster health + audit log into existing dashboards
- Display Proxmox node health in the ADINKHEPRA compliance dashboard

### Phase 2 — CVE Ingest → STIG Enrichment (Medium effort)
- Build `pegaprox_ingest.go` in `pkg/stig/`
- Map PegaProx CVEs to STIG rule IDs
- Surface findings as new DAG nodes in the Khepra risk graph

### Phase 3 — Causal DAG Integration (Higher effort, high value)
- Khepra daemon consumes PegaProx audit log as a DAG event source
- Dilithium-sign each ingested event for tamper-evidence
- Correlate infrastructure ops with security posture changes over time

### Phase 4 — SSO + RBAC Unification (Optional)
- Configure shared OIDC provider (e.g., Keycloak) for both systems
- Map PegaProx roles to giza-cyber-shield permission scopes

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│              Customer Environment                │
│                                                  │
│  ┌──────────────────┐   ┌─────────────────────┐ │
│  │   PegaProx UI    │   │  giza-cyber-shield  │ │
│  │  (Proxmox Mgmt)  │   │  ADINKHEPRA Dashboard│ │
│  └────────┬─────────┘   └──────────┬──────────┘ │
│           │ REST API                │             │
│           │ GET /api/audit/log      │             │
│           │ GET /api/clusters       │             │
│           ▼                         │             │
│  ┌──────────────────────────────────┴──────────┐ │
│  │        Khepra Daemon (pkg/gateway/)          │ │
│  │  • TLS 1.3 tunnel to PegaProx API            │ │
│  │  • Dilithium-sign ingested audit events      │ │
│  │  • Map CVEs → STIG findings → DAG nodes      │ │
│  └──────────────────────────────────────────────┘ │
│                                                  │
│  ┌──────────────────────────────────────────────┐ │
│  │         Proxmox VE / XCP-NG Clusters         │ │
│  │   (managed by PegaProx, scanned by Khepra)   │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Recommendation

| Deployment Tier | PegaProx Fit | Priority |
|---|---|---|
| SaaS / Edge ($29) | Low — cloud-hosted, no Proxmox | Skip |
| Hybrid ($49) | Medium — some on-prem nodes | Optional |
| Sovereign ($99) | **High** — full on-prem Proxmox | **Recommended** |
| Iron Bank (DoD) | High (with FIPS wrapper) | **Recommended with caveats** |

**Proceed with Phase 1 and Phase 2 implementation.** PegaProx adds a missing hypervisor-management integration layer for on-premise deployments, enriches the STIG engine with live CVE data, and strengthens the causal DAG with infrastructure audit events — all at zero licensing cost.

---

## References

- [PegaProx Official Site](https://pegaprox.com/)
- [PegaProx GitHub Repository](https://github.com/PegaProx/project-pegaprox)
- [PegaProx Documentation](https://docs.pegaprox.com/)
- [Cloud News: PegaProx Architecture Overview](https://cloudnews.tech/pegaprox-the-promise-of-enterprise-management-for-multi-cluster-proxmox-infrastructures/)
