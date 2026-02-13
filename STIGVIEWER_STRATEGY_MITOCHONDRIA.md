# Protocol Mitochondrial: STIGViewer API Integration Strategy
**"Powering the Cellular Defense with Atomic Intelligence"**

**Date:** 2026-02-12
**Status:** PROPOSED
**Target:** Secure Sandbox (Mitochondrial API Motherboard/DMZ)

---

## 1. Executive Summary

We are upgrading the **Khepra Compliance Engine** from a "static snapshot" model (embedded CSVs) to a **"Mitochondrial" model**—a living, breathing power source of compliance data.

By integrating the new **STIGViewer API**, we move beyond simple checklists. We will ingest "decomposed," atomic, verifiable requirements that are enriched with complexity ratings and role mappings. This data will flow through our **Mitochondrial API Motherboard (The Gateway)** to energize the entire GRC ecosystem.

**The Edge:**
1.  **Live Intelligence**: No more waiting for quarterly CSV updates.
2.  **Atomic Precision**: Handling rules at the *requirement* level, not just the *finding* level.
3.  **AI-Native**: Using the MCP server to let agents (Claude/Copilot) "think" in STIGs.

---

## 2. Architecture: The Mitochondrial Motherboard

We will implement this as a purely additive "Intelligence Layer" on top of the existing `pkg/gateway` and `pkg/stig` infrastructure.

### The Components

1.  **The Source (STIGViewer API)**:
    *   Provides enriched, decomposed STIG data.
    *   Outputs: Atomic JSON requirements, Role Mappings/Complexity.

2.  **The Motherboard (Gateway DMZ)**:
    *   **Location**: `pkg/gateway`
    *   **Role**: The Secure Proxy & Caching Layer.
    *   **Responsibility**:
        *   Securely connects to STIGViewer API using the provided API Key.
        *   Validates and Sanitizes incoming JSON.
        *   **Caches** the data for Air-Gapped/Offline operations (The "ATP" energy store).
        *   Exposes an internal secure endpoint for Khepra Agents.

3.  **The Consumer (Khepra Engine)**:
    *   **Location**: `pkg/stig`
    *   **Role**: Compliance Logic.
    *   **Upgrade**: Updates the `ComplianceDatabase` struct to support "Hybrid Mode" (Disk + Live API).

4.  **The Agent (MCP Client)**:
    *   **Role**: Dynamic Querying.
    *   **Impact**: Enables "Chat-with-your-STIG" capabilities for the user.

---

## 3. Data Flow Strategy

```mermaid
graph TD
    External[STIGViewer API] -->|HTTPS/TLS 1.3| DMZ[Gateway "Motherboard"]
    
    subgraph "Secure Sandbox / DMZ"
        DMZ -->|Enriched JSON| Cache[Local "ATP" Cache]
        DMZ -->|MCP Protocol| Agent[AI Agents]
    end
    
    subgraph "Khepra Core"
        Cache -->|Update| DB[pkg/stig Database]
        DB -->|Validation| Runtime[System Validator]
    end
    
    Runtime -->|Audit Logs| Dashboard[GRC Dashboard]
```

---

## 4. Implementation Plan

### Phase 1: The MCP Link (Immediate)
**Goal:** Enable AI agents to query the data immediately for planning and analysis.
*   **Action**: Configure the STIGViewer MCP Server within the `.agent/mcp/` configuration.
*   **Result**: Agents can answer: *"What is the verification complexity for SV-257777r925318?"* or *"Show me all rules owned by the Database Admin role."*

### Phase 2: The Motherboard Connector (Gateway)
**Goal:** Create the secure conduit for data ingestion.
*   **Action**: Create `pkg/gateway/stig_connector.go`.
*   **Features**:
    *   API Key management (Vault/Env).
    *   Rate limiting handling (respecting STIGViewer limits).
    *   Automatic caching (Redis or In-Memory).

### Phase 3: The "Atomic" Database Upgrade
**Goal:** Update the Khepra compliance engine to consume decomposed rules.
*   **Action**: Refactor `pkg/stig/database.go`.
*   **Change**:
    *   Add `AtomicRequirement` struct.
    *   Add `RoleMapping` field to `Finding`.
    *   Add `Complexity` enum (Low/Med/High).
*   **Benefit**: Reports now show *who* needs to fix a finding and *how hard* it will be.

---

## 5. Security & Compliance (Air-Gap Strategy)

Since Khepra often operates in air-gapped DoD environments:
1.  **The "Sneakernet" Update**: The Motherboard (internet-connected) fetches the latest atomic data.
2.  **The "Energy Packet"**: It bundles this into a signed `compliance_update.sig` file.
3.  **The Injection**: This file is manually (or via diode) transferred to the air-gapped Khepra instance, updating its internal "Mitochondria."

---

## 6. Next Steps

1.  **Approve Strategy**: Confirm this architecture fits the "Mitochondrial" vision.
2.  **Receive API Key**: Input key into the Secure Sandbox environment variables.
3.  **Execute Phase 1**: Boot up the MCP server and verify connectivity.

---
**Prepared for:** Dorian Cougias / SouHimBou Team
**By:** Protocol Khepra Architect
