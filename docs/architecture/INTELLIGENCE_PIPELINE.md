# Khepra Intelligence Pipeline: Artifact to DAG

**Strategic Concept**: This document defines the process of transforming a raw `khepra_snapshot.json` (Artifact) into the **Causal Risk Attestation** (Evidentiary DAG).

## 1. The Strategic Distinction

### Phase A: The Defense Diagnostic (Consulting Strategy)
*   **Purpose**: **Sales & Discovery**. Demonstrates "Financial Liability Vectors" to executive buyers.
*   **Tooling**: `Unified Sonar V2` (Passive Mode / `--active=false`).
*   **Operation**: Consultant runs the tool on a representative node (e.g., developer laptop).
*   **Output**: `manifest_scan.json`.
*   **Result**: A "Control Map" showing unmanaged dependencies. Used to close the deal.

### Phase B: The Deployment (Platform Strategy)
*   **Purpose**: **Operational Enforcement**. Continuous monitoring and attestation.
*   **Tooling**: `Native Sidecar` (`--active=true`).
*   **Operation**: Installed as a background service (daemon/systemd) on critical infrastructure.
*   **Output**: `khepra_snapshot.json` (Full Spectrum: Network + OSINT + FS).
*   **Result**: The **Evidentiary DAG** (Non-Repudiable Proof of Stat).

---

## 2. The Processing Logic (Artifact -> DAG)

The "Intelligence Engine" follows a strictly defined 3-step normalization process.

### Step 1: Ingestion (The Snapshot)
The Sidecar produces the **Atomic Unit of Truth**:
```json
// khepra_snapshot.json (Signed with PQC)
{
  "scan_id": "uuid",
  "active_mode": true,
  "data": {
    "network": { "port_22": "open" },
    "osint": { "shodan_vulns": ["CVE-2024-1234"] }
  }
}
```

### Step 2: Normalization (The Risk Nodes)
The engine ingests the JSON and maps raw data to **Risk Ontology**:
*   **Raw**: `Port 22: Open`
*   **Node**: `RISK_SSH_EXPOSED (Severity: High)`
*   **Raw**: `Manifest: log4j 2.14`
*   **Node**: `RISK_VULN_DEPENDENCY (Severity: Critical)`

### Step 3: Graph Construction (The Causal Link)
The engine builds the DAG by linking Nodes based on **Exploitability Paths**:
> `[RISK_SSH_EXPOSED]` --enables--> `[RISK_ROOT_BRUTEFORCE]` --compromises--> `[ASSET_PQC_KEYS]`

---

## 3. Delivery Models: Execution Flow

### Type A: KHEPRA-EDGE (Air-Gapped / SCIF)
*   **Compute Location**: **Local Only**.
*   **Flow**:
    1.  Sidecar runs -> RAM.
    2.  Local Engine normalizes Artifact -> DAG.
    3.  Report written to disk (`/var/log/khepra/risk_report.pdf`).
*   **Telemetry**: **None**.

### Type B: KHEPRA-HYBRID (Managed "Shadow CISO")
*   **Compute Location**: **Cloud-Augmented**.
*   **Flow**:
    1.  Sidecar runs -> `khepra_snapshot.json`.
    2.  Encrypted Push (Mutual TLS) -> `api.khepra.io`.
    3.  Cloud Engine processes DAG & Benchmarks against industry data.
*   **Telemetry**: Metadata & Risk Nodes.

### Type C: KHEPRA-SOVEREIGN (Dedicated Tenant)
*   **Compute Location**: **Private Cloud**.
*   **Flow**:
    1.  Sidecar runs -> `snapshot.json`.
    2.  Push -> `private-api.customer-domain.com`.
    3.  Customer owns the Engine instance.
