# Khepra Commercial Pricing Strategy

> **Status**: DRAFT
> **Inspiration**: [n8n Pricing Model](https://n8n.io/pricing/)
> **Objective**: Standardized SaaS pricing adapted for dual-use (Commercial & Defense).

## Core Concept Mapping

We are adapting the **n8n Pricing Model** to the Khepra Ecosystem.

| n8n Concept | Khepra Equivalent | Description |
| :--- | :--- | :--- |
| **Shared Project** | **Scarab Node** | A single Khepra agent/instance running on a server or endpoint. |
| **Workflow Execution** | **Security Scan** | A complete cycle of scanning, drift detection, and remediation. |
| **Concurrent Executions** | **Concurrent Scans** | Number of scans running simultaneously across all nodes. |
| **AI Credits** | **TBot Queries** | Number of AI-driven threat analysis queries allowed. |

---

## Pricing Tiers

### 1. **Scarab Scout (Starter)**
*Target: Individual Developers, Small PoCs*
- **Cost**: Free Trial / low monthly ($50/mo)
- **Scarab Nodes**: **1** (Single Endpoint Protection)
- **Concurrent Scans**: 5
- **Scan Retention**: 24 Hours
- **Features**:
    - Basic Drift Detection
    - Community PQC (Dilithium-only)
    - Webhook Alerts

### 2. **Scarab Hunter (Pro)**
*Target: Small Teams, Defense Subcontractors*
- **Cost**: ~$500/mo (Reference: n8n Pro is smaller, but security commands higher premium)
- **Scarab Nodes**: **3** (Small Cluster)
- **Concurrent Scans**: 20
- **Scan Retention**: 7 Days
- **Features**:
    - Everything in Scout
    - **Premium PQC** (Kyber + Dilithium Hybrid)
    - **White-Box Cryptography**
    - Workflow History
    - Priority Support

### 3. **Scarab Hive (Business)**
*Target: Mid-sized GovCon, Enterprise Security Teams*
- **Cost**: ~$2000/mo
- **Scarab Nodes**: **10**
- **Concurrent Scans**: 50
- **Scan Retention**: 30 Days
- **Features**:
    - Everything in Hunter
    - **SSO / SAML Enforcement** (Critical for DoD)
    - **Role-Based Access Control (RBAC)**
    - Git Integration for Configuration

### 4. **Scarab Pharaoh (Enterprise)**
*Target: DoD Program Offices, Primes (Lockheed, Raytheon)*
- **Cost**: Custom (Annual Contracts)
- **Scarab Nodes**: **Unlimited**
- **Concurrent Scans**: 200+
- **Scan Retention**: 365 Days (Compliance Requirement)
- **Features**:
    - **Air-Gapped Licensing** (Offline Root Key)
    - **HSM Integration**
    - **Dedicate Support Engineer**
    - **Log Streaming** (to Splunk/Elastic)

---

## Technical Implementation Plan

To support this model, the Telemetry Server must enforce:

1.  **Node Limits**: `licenses.max_devices` already exists.
2.  **Scan Counting**: Need to track number of scans performed.
    -   *Action*: Update `license_heartbeats` to accept `scan_count` metrics.
    -   *Action*: Add `contracts` table to track monthly usage quotas? Or just simple limit in `licenses`.
3.  **Tier Enforcement**:
    -   Update `licenses` table to include `tier_config` (JSON) defining specific limits (concurrency, retention).

### Database Updates (Schema)

```sql
ALTER TABLE licenses ADD COLUMN max_concurrent_scans INTEGER DEFAULT 5;
ALTER TABLE licenses ADD COLUMN retention_days INTEGER DEFAULT 1;
ALTER TABLE licenses ADD COLUMN ai_credits_monthly INTEGER DEFAULT 50;
```

### Telemetry Updates
- **Agent**: Must report "Scan Started" and "Scan Finished" events to count usage.
- **Server**: Must reject "Scan Start" if quota exceeded (or just log overage for billing).
