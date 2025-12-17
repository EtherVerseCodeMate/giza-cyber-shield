# KHEPRA ACADEMY: Deployment Systems & Tools Playbook

**Instructor:** SouHimBou AGI Architect  
**Course:** KHEPRA-101: Operational Deployment  
**Status:** CLASS IS IN SESSION

---

## 1. KHEPRA-EDGE (The "Cold Iron" Model)
**Scenario**: You are walking into a SCIF (Sensitive Compartmented Information Facility) or an Oil Rig. There is NO internet. You are the only intelligence they have.

### The Kit (Hardware)
1.  **The Operator Laptop ("The Football")**:
    *   Hardened Laptop (Panasonic Toughbook or Dell Latitude Rugged).
    *   **OS**: Linux (RHEL/Ubuntu) or Windows 10/11 Enterprise (Hardened).
    *   **Disk Encryption**: BitLocker or LUKS (Full Disk Encryption).
2.  **Transfer Media**:
    *   **IronKey** or Hardware-Encrypted USB Drive (FIPS 140-2 Level 3). Used to move the binary IN and the report OUT.

### The Stack (Software)
1.  **The Binary**: `khepra.exe` (Windows) or `khepra` (Linux).
    *   *Note*: Must be pre-compiled with `CGO_ENABLED=0` (Static) to run without libraries.
2.  **The Brain**: `docs/STIG_to_NIST171_Mapping_Ultimate.xlsx`.
    *   This file **MUST** sit next to the binary. It is the intelligence database.
3.  **Optional Connectors (If installed on target)**:
    *   **OpenSCAP**: If the client requires XCCDF output (`oscap`).
    *   **SCC**: If the client is DoD and uses SCAP Compliance Checker.

### The Walkthrough
1.  **Entry**: You pass physical security. You plug your USB into the target "Air-Gap Server".
2.  **Deploy**: Copy `khepra` and `.xlsx` to `C:\Temp\Audit\`.
3.  **Execute**:
    ```powershell
    .\khepra compliance
    ```
    *   *System Action*: Khepra silently queries Registry/Filesystem.
4.  **Exfiltrate**:
    ```powershell
    .\khepra audit ingest snapshot.json ...
    .\khepra kuntinkantan your_key.pub report.json
    ```
    *   *System Action*: Encrypts the report. You copy `report.json.khepra` back to your USB.
5.  **Exit**: You leave. The raw data never left the USB in an unencrypted state.

---

## 2. KHEPRA-HYBRID (The "Co-Pilot" Model)
**Scenario**: A financial client has their own IT team, but they are overwhelmed. They need your expertise, but they cannot give you VPN access to everything.

### The Systems
1.  **Client Side**: Their standardized corporate workstations.
2.  **Operator Side ("The Listening Post")**: Your secure server/laptop running the **Khepra Dashboard** (Next.js).
3.  **The Bridge**: Secure Email, SharePoint, or a dedicated SFTP drop box.

### The Stack
1.  **Identity Keys**:
    *   Client runs: `khepra keygen -tenant "Bank-Alpha"`.
    *   Operator runs: `khepra keygen -tenant "Khepra-Ops"`.
    *   *Action*: You exchange **Public Keys** (`.pub`) via email.
2.  **The Package**:
    *   Client runs the audit.
    *   Client wraps it: `khepra kuntinkantan khepra_ops.pub audit_results.json`.
3.  **The Dashboard**:
    *   You receive the `.khepra` file.
    *   You decrypt: `khepra sankofa khepra_ops audit_results.json.khepra`.
    *   You load it into the **Next.js Dashboard** to visualize the Trust Constellation.

### The Walkthrough
1.  **Handshake**: "Here is my Public Key. Send me your daily scan."
2.  **Transfer**: They email you a specific, PQC-encrypted file. Even if their email is hacked, the data is safe (Quantum-Proof).
3.  **Analysis**: You open the Dashboard. You see they failed `STIG-IA-5` (Passwords).
4.  **Response**: You write a remediation script, sign it with your Key, and email it back.

---

## 3. KHEPRA-SOVEREIGN (The "Ghost in the Machine" Model)
**Scenario**: A Top Secret Cloud environment (AWS GovCloud). No one enters, no one leaves. Khepra must live there permanently.

### The Systems
1.  **Infrastructure**: AWS EC2, Azure VM, or Kubernetes Cluster (EKS/AKS).
2.  **Orchestration**: Terraform (to deploy), Ansible (to configure).
3.  **SIEM**: Splunk, ElasticSearch, or Azure Sentinel (The client's monitoring tool).

### The Stack
1.  **The Daemon**: `khepra-agent` (The HTTP Server mode).
    *   Runs as a `systemd` service or Docker container.
    *   Command: `./khepra agent start`.
2.  **The Monitor**: **KASA (SouHimBou AGI)**.
    *   A background Go routine inside the agent.
    *   It wakes up every 60 seconds (The "Heartbeat").
3.  **Integration**:
    *   Khepra writes logs to `stdout` or `/var/log/khepra.log`.
    *   Splunk agent reads these logs.

### The Walkthrough
1.  **Install**: You provide a Docker Image or RPM. They deploy it to their VPC.
2.  **Activation**: The `khepra-agent` starts. KASA initializes "Guardian Mode".
3.  **Loop**:
    *   *08:00 AM*: KASA wakes up. Runs `compliance` scan. Checks `sshd_config`.
    *   *08:01 AM*: Finds `PermitRootLogin yes` (Config Drift!).
    *   *08:02 AM*: KASA logs a **Fawohodie** (Revocation) event to the internal DAG.
    *   *08:03 AM*: Splunk sees the event and pages the client's admin `[CRITICAL STIG FAIL]`.
4.  **Zero-Touch**: You (the vendor) never logged in. The software did the work and reported to *their* system.

---

## Summary of Tools by Model

| Model | Primary Tool | Key Artifact | Transport | Operator Role |
| :--- | :--- | :--- | :--- | :--- |
| **EDGE** | `khepra` CLI | USB Drive | Sneakernet | Physical Presence |
| **HYBRID** | CLI + Dashboard | `.khepra` Bundle | Email/SFTP | Remote Analyst |
| **SOVEREIGN** | `khepra-agent` | SIEM Log / DAG | Internal VPC | Code Vendor (Hands-off) |

**Class Dismissed.**
