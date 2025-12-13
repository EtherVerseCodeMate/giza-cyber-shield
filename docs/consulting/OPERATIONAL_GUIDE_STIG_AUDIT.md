# Operational Guide: Running Military-Grade Audits with KHEPRA

## Overview
This document explains how to deploy Khepra's **Enterprise Risk & Readiness Diagnostic** on customer environments.
The process leverages **Sonar** (Client Side) and **Khepra Core + STIGs-First Library** (Consultant Side).

---

## 🚀 Phase 1: Client-Side Deployment (Sonar Probe)

**Goal:** Collect objective security data without exposing Khepra IP.

1.  **Preparation:**
    *   Build the `sonar.exe` binary.
    *   Package it in a zip file (e.g., `Risk_Diagnostic_Tool_v1.zip`).

2.  **Execution (Customer Environment):**
    *   **Option A:** You run it (Preferred). Join a Zoom/Teams call, ask for control, and download/run the tool.
    *   **Option B:** Client IT runs it. Send them the zip with instructions.

    **Command:**
    ```powershell
    # Run the passive scan on their codebase/infrastructure
    .\sonar.exe -dir "C:\Path\To\SourceCode" -out client_audit_snapshot.json
    ```

3.  **Data Retrieval:**
    *   Get the `client_audit_snapshot.json` file.
    *   **Note:** This file contains *no secrets*, only metadata (file paths, checksums, package versions). It is safe to email or upload.

---

## 🧠 Phase 2: Consultant-Side Intelligence (BabyAGI + STIGs)

**Goal:** Transform raw data into a Military-Grade Risk Assessment.

1.  **Ingestion:**
    *   Move the snapshot to your laptop (The Khepra Workstation).
    *   Ensure the STIG Library is present at `docs/STIG_to_NIST171_Mapping_Ultimate.xlsx`.

2.  **Analysis (The "Magic"):**
    Run the ingestion command. This spins up Khepra's generic graph engine and applies the STIG Mapping logic.

    ```bash
    khepra audit ingest client_audit_snapshot.json
    ```

    **What Happens Inside:**
    *   **Decodes Snapshot:** Reads the JSON.
    *   **Builds Trust DAG:** Constructs the causal graph of the client's architecture.
    *   **Loads STIG Library:** Ingests the 6,003 STIG controls.
    *   **Heuristic Matching:** "BabyAGI" logic checks findings (e.g., "Unpinned Dependency") and maps them to a specific STIG ID (e.g., `CM-000000`).
    *   **Output:** Generates `client_audit_snapshot.json.risk_report.json`.

---

## 🏆 Phase 3: Deliverable Generation

**Goal:** The $5,000 Meeting.

1.  **Review the Risk Report:**
    Open the generated JSON. You will see items like:
    ```json
    {
      "severity": "HIGH",
      "title": "Unpinned NPM Dependency Tree",
      "stig_ref": "ASD-STIG-00123",
      "remediation": "Evaluate against Configuration Management Control CM-3"
    }
    ```

2.  **Draft the Executive Memo:**
    *   Don't send the JSON.
    *   Use the **STIG Reference** to add authoritative weight.
    *   *Script:* "We found a critical supply chain vulnerability. This isn't just best practice; it violates STIG Control [ID], which would automatically fail a DoD audit."

---

## ⚡ Why This Wins

*   **Speed:** You get a full audit snapshot in minutes.
*   **Safety:** Your patent-pending IP never leaves your machine.
*   **Authority:** Every finding is backed by a specific Government STIG ID.
*   **Scale:** You can run this on 10 clients a week.
