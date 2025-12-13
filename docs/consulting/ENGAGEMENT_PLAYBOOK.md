# Engagement Playbook: Enterprise Risk Audits
## Operational Guide for "Sonar" Deployment & Analysis

**Confidentiality:** INTERNAL USE ONLY
**Role:** Consultant / Risk Advisor

---

### 1. Pre-Engagement Setup

Before the engagement begins, you must prepare the "Client-Safe" diagnostic packet.

**The Golden Rule:**
> "Khepra Core never leaves your laptop. Only 'Sonar' touches the client infrastructure."

**Steps:**
1.  **Build the Sonar Probe:** (Cross-compile if necessary)
    ```bash
    # For Windows Client
    go build -o sonar.exe ./cmd/sonar
    # For Linux Client
    GOOS=linux go build -o sonar-linux ./cmd/sonar
    ```
2.  **Package the Artifact:**
    Zip the binary with a generic label like `risk-diagnostic-tool`.

---

### 2. The "Diagnostic Sprint" (Client Site)

**Phase A: Deployment**
Send the binary to the client POC (CTO/VP Engineering) or run it yourself via SSH.

**Script:**
> "I'm sending over the passive diagnostic scanner. It runs a read-only check on manifest files (package.json, go.mod) and dependency trees to map your supply chain hygiene. It does not access PII, databases, or secrets. It writes a single JSON output file."

**Phase B: Execution**
Command to run:
```bash
./sonar -dir /path/to/codebase -out client_scan_v1.json
```

**Phase C: Retrieval**
Retrieve the `client_scan_v1.json` file securely (sftp/email).

---

### 3. The "Clean Room" Analysis (Your Laptop)

This is where you "Wield Khepra".

1.  **Ingest the Data:**
    ```bash
    khepra audit ingest client_scan_v1.json
    ```
    *System Action:* Khepra parses the external JSON, builds an internal DAG of the client's architecture, and applies proprietary heuristics (Risk Rules).

2.  **Output Generation:**
    Khepra will generate a `client_scan_v1.json.risk_report.json`.

3.  **Refinement (The Advisor's Touch):**
    Open the generated JSON report. Use it to draft your **Executive Decision Memo**. 
    *   *Do not just email the JSON.* 
    *   Translate the "HIGH" severity risks into business language.

    *Example:*
    *   *Khepra Risk:* "Unpinned NPM Dependency Tree" ->
    *   *Advisory finding:* "Your payments infrastructure relies on open-source libraries that can be hijacked by a malicious update. We must implement a 'Frozen Lockfile' policy immediately before Series B diligence."

---

### 4. Legal / Defense Posture

*   **Audit Trail:** Retain the `client_scan_v1.json` (Source Artifact) in your secure storage. This is your proof that you *did* the work and that the risks *were* present if they later suffer a breach.
*   **IP Protection:** Since `sonar` contains no proprietary algorithms (just collection logic), reverse engineering it yields nothing of value. The Brain (Khepra Core) remains safe on your machine.
