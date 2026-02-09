# TENABLE COMPETITOR INTELLIGENCE & INTEGRATION STRATEGY

## 1. Executive Summary
Tenable is a market leader in **Exposure Management**, shifting the industry from static vulnerability scanning (Nessus) to dynamic, risk-based exposure management (Tenable One).

**Khepra's Stance**: We do not compete directly with Tenable's enterprise scale. Instead, we compete **vertically** by offering **Quantum-Resilient Exposure Management** for high-security, hybrid environments (Defense, Critical Infrastructure). We leverage Tenable's methodologies to enhance Khepra's "Security Fabric" while adding our unique PQC value proposition.

## 2. Key Methodologies & Khepra Integration

### 2.1. Exposure Management vs. Vulnerability Management
**Tenable Concept**:
*   **Vulnerability Management**: Finding CVEs.
*   **Exposure Management**: Understanding the *context* of those CVEs (assets, identities, miss-configurations) to prioritize remediation.
*   **Key Metric**: **Cyber Exposure Score (CES)** - A unified risk score (0-1000).

**Khepra Integration**:
*   **Adinkra Resilience Score (ARS)**: Adopt a similar unified score (0-1000) for the Khepra Dashboard.
*   **Formula**: `ARS = (Base_Risk_Score * Asset_Criticality) / PQC_Obfuscation_Factor`
*   **Action**: Update `KhepraDashboard.tsx` to display this ARS metric, giving users a single "health" number.

### 2.2. Vulnerability Priority Rating (VPR)
**Tenable Concept**:
*   VPR prioritizes vulnerabilities based on *threat intelligence* (exploit availability, recency), not just CVSS severity. A "Critical" CVSS bug might have a Low VPR if no exploit exists.

**Khepra Integration**:
*   **Nkyinkyim Threat Index (NTI)**:
    *   Instead of generic threat intel, focus on **Quantum Threat Intel**.
    *   **High NTI**: A vulnerability in a crypto library susceptible to Shor's algorithm (e.g., RSA-2048).
    *   **Low NTI**: A standard buffer overflow in a non-critical UI component.
*   **Implementation**: Enhance `govulncheck` in the `/security_workflow` to weight crypto-related vulnerabilities higher.

### 2.3. Identity Exposure (Zero Trust)
**Tenable Concept**:
*   **Tenable.ad**: Secures Active Directory and identity paths. "Attack Path Analysis" shows how an attacker moves from a compromised workstation to Domain Admin.

**Khepra Integration**:
*   **Khepra Identity Graph**:
    *   Visualize the **DAG** not just as a ledger, but as an **Identity Graph**.
    *   Show relationships between **Nodes** (VPS, Edge) and **Licenses** (Egyptian Tiers).
    *   **Attack Path**: Highlight if a lower-tier node (Khepri) has write access to a high-tier (Osiris) resource.

### 2.4. Cloud Security & Asset Criticality
**Tenable Concept**:
*   **Asset Criticality Rating (ACR)**: Automates the classification of assets (1-10) based on business impact.

**Khepra Integration**:
*   **Egyptian Tier Criticality**:
    *   **Osiris (Pharaoh)**: ACR 10 (Critical Infrastructure, Air-Gapped).
    *   **Atum (Hive)**: ACR 8 (Core Business Logic).
    *   **Ra (Hunter)**: ACR 5 (Standard Server).
    *   **Khepri (Scout)**: ACR 2 (Edge/IoT).
*   **Action**: Hardcode these ACR values into `pkg/license/egyptian_tiers.go` to automatically weight risk.

## 3. Detailed Feature Roadmap

| Feature | Tenable Inspiration | Khepra Implementation | Status |
| :--- | :--- | :--- | :--- |
| **Unified Risk Score** | Cyber Exposure Score (CES) | **Adinkra Resilience Score (ARS)** | 🚧 Planned |
| **Prioritization** | VPR (Predictive Prioritization) | **Nkyinkyim Threat Index (NTI)** | 🚧 Planned |
| **Attack Visualization** | Attack Path Analysis | **DAG Trust Constellation** | ✅ In Progress |
| **Asset Context** | Asset Criticality Rating (ACR) | **Egyptian Tier Weighting** | ✅ Implemented |
| **Benchmarks** | Lumin (Peer Benchmarking) | **"Godfather" Report (Industry Comparison)** | 🚧 Planned |

## 4. Resource Aggregation (Legal & Strategic)

We interpret Tenable's public research as a baseline. Khepra must *exceed* this baseline in specific verticals:

*   **Research**: Tenable publishes "Vulnerability Landscape" reports.
    *   **Khepra Strategy**: We publish **"Post-Quantum Readiness"** reports. While Tenable focuses on *current* exploits, Khepra assesses *future* cryptographic risk (Q-Day).
*   **Guides**: Tenable's "Cybersecurity Guide" focuses on hygiene.
    *   **Khepra Strategy**: Our **TC-25 Operator Manual** focuses on *survivability* and *resilience* in verified hostile environments (DoD/Intel).

## 5. Next Steps

1.  **Dashboard Update**: Modify `KhepraStatus.tsx` to verify "Adinkra Resilience Score" calculation.
2.  **License Enhancement**: Add `ACR` field to `TierInfo` struct in `egyptian_tiers.go`.
3.  **Threat Feed**: Design a mock "Quantum Threat Feed" for the ERT module to simulate VPR-like updating.
