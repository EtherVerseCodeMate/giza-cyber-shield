# CYRARR: Cyber Yield & Risk Attestation Reporting Roadmap
**Unified Model**: Cyber-physical Resilience through Automated Response and Recovery
**Reference**: WO2023064898A1 / HMADS Architecture

## 1. Executive Summary
This framework defines the autonomous intelligence of the **Adinkhepra SCADA Pod**. By integrating the **Agentic Security Attestation Framework (ASAF)** with **Distributed Automated Response Control (ARC)**, we enable a SCADA system that doesn't just "detect" attacks, but "resists" and "recovers" from them without human intervention.

## 2. The Five phases of Resilience (FIG. 1)
Your SCADA Pod project evaluates system performance across five critical points:

1.  **RECON**: Proactive state awareness (Adinkhepra agents monitoring the switch).
2.  **RESIST**: Initial system response to mitigate/counter the disturbance (Symbolic Hardening).
3.  **RESPOND**: Stopping degradation and returning to the **Resilience Threshold**.
4.  **RECOVER**: The sum of autonomous mitigations (Agentic Consensus).
5.  **RESTORE**: Long-term performance restoration (Re-imaging firmware via ASAF).

## 3. The Trade-off Space (FIG. 3)
The core innovation of this project is the **Surgical Response**. When a cyber-attack is detected (e.g., Modbus Register Injection):
- **AdinKhepra ASAF** evaluates the stability impact of blocking a port vs. the security benefit.
- **Decision Engine**: If blocking a port causes a "Physical System Reaction" that drops performance below the **Minimum Normalcy**, the agent opts for a "Corrective Physical Response" (Offsetting the setpoint) instead of a "Cyber Response" (Killing the connection).

## 4. HMADS Tiered Hierarchy (FIG. 4)
The SCADA Pod implements a three-layer Multi-Agent System:

| Tier | Component | Action Type |
|-------|-----------|-------------|
| **Centralized (Orchestration)** | HMI / Cloud Portal | Wide-area Policy & Signature Updates. |
| **Intermediate (Defense)** | Network Switch / IDS | Cross-segment Analysis & SDN Rerouting. |
| **Distributed (Bottom)** | PLC / Relays | **Device Controls**: Isolation of services & local remedial action. |

## 5. Metrics for Presentation (Phase 3)
Your Master's project can quantify success using these metrics:
- **System Agility (S)**: The time latency (t) between the Attacker Action and the ASAF Remediation.
- **Robustness (R)**: The delta between the "Optimum Operation" and the "Adaptive Capacity" during a stress test.
- **Data Integrity (d)**: The measure of "Data Digression" prevented by ASAF's cryptographic checksums.

---
*The Logic is Eternal. The Resilience is Proven.*
