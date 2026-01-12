# TC 3-22.KHEPRA: OPERATOR FIELD MANUAL
**KHEPRA PROTOCOL (ASAF) — ADVISORY ATTESTATION ENGINE**
**Zero-Dependency Native Edition (v2.0)**

> **DISTRIBUTION RESTRICTION:** Proprietary Internal Tool. Not for public release.
> **PROPONENT:** SouHimBou AGI Architect (NouchiX)

---

## CHAPTER 1. EQUIPMENT & COMPATIBILITY

### 1-1. PURPOSE
This Training Circular (TC) provides Doctrine, Tactics, Techniques, and Procedures (TTPs) for deploying the KHEPRA Protocol using **Native Binaries** (`khepra.exe`, `sonar.exe`). This edition REPLACES previous SecureCRT/Databricks dependencies with native transfer tooling.

### 1-2. MISSION EQUIPMENT (THE FOOTBALL)
The field operator MUST possess the following validated loadout:

1.  **Operator Workstation:** Hardened Laptop (Windows 10/11 Enterprise or RHEL).
2.  **Console Software:** `khepra.exe` (v2.0+) with `kms init` completed (Tier 0).
3.  **Transfer Media:** FIPS 140-2 Level 3 Encrypted USB (IronKey) for Air-Gap.
4.  **Payload (Binaries):**
    *   `bin/sonar.exe` (The Sensor - Static Compilation `CGO_ENABLED=0`).
    *   `bin/khepra.exe` (The Engine / Transfer Utility).
5.  **Intelligence Database:** `docs/STIG_to_NIST171_Mapping_Ultimate.xlsx`.

### 1-3. COMPATIBILITY
*   **Target OS:** Generic Linux Node (Ubuntu 24.04 Reference), RHEL 7/8/9, Windows Server 2016+.
*   **Architecture:** AMD64 / ARM64.
*   **Dependencies:** ZERO. The binaries are self-contained. No Python/Node runtime required on Target.

---

## CHAPTER 2. OPERATIONAL MODELS

### 2-1. MODEL A: KHEPRA-EDGE (AIR-GAPPED)
*   **Designation:** "Cold Iron"
*   **Environment:** SCIF, Submarine, Oil Rig. Zero connectivity.
*   **Concept:** Operator physically bridges the air-gap using **Native Serial Transfer**.
*   **Transport:** `khepra transfer --mode serial`.

### 2-2. MODEL B: KHEPRA-HYBRID (MANAGED)
*   **Designation:** "Co-Pilot"
*   **Environment:** Corporate LAN/WAN.
*   **Concept:** Operator uses **Native SSH Transfer** to bridge Legacy Hosts.
*   **Ingestion:** `khepra engine` (Local SQLite/DuckDB) replaces Databricks.

### 2-3. MODEL C: KHEPRA-SOVEREIGN (DEDICATED)
*   **Designation:** "Ghost in the Machine"
*   **Environment:** AWS GovCloud / Private Cloud.
*   **Concept:** `khepra-agent` runs as a daemon reporting to self-hosted `khepra engine`.

---

## CHAPTER 3. PILOT PROGRAM DEPLOYMENT (CUSTOMER DISCOVERY)

### 3-0. EXECUTIVE ROUNDTABLE DEMO WORKFLOW
**Objective:** Demonstrate Khepra's value proposition in 15 minutes with live demo.
**Audience:** C-Suite executives, Board members, Compliance officers.

#### DEMO STRUCTURE (15 Minutes Total)

**MINUTE 1-3: THE PROBLEM (Compliance Theater)**
- Show slide: "Traditional audit = $300K + 6 months + unverifiable claims"
- **Visual**: Compliance Theater vs Causal Reality comparison table
- **Hook**: "What if you could prove security to regulators using nuclear-grade math?"

**MINUTE 4-8: THE SOLUTION (Live Sonar Scan)**
- **Action**: Run Sonar on demo server (pre-staged for speed)
  ```bash
  ./bin/sonar.exe --active --out demo-snapshot.json --quick
  ```
- **Narration (while scanning)**:
  - "This is scanning a demo server right now—checking 900+ security controls"
  - "It's correlating findings with CISA's database of actively exploited vulnerabilities"
  - "All data encrypted with quantum-proof cryptography (can't be hacked in 2035)"
- **Result**: Show terminal output finding critical issues (Port 22 exposed, CVE correlations)

**MINUTE 9-11: THE PROOF (DAG Visualization)**
- **Action**: Open web dashboard showing Trust Constellation
  ```bash
  khepra engine visualize demo-snapshot.json.sealed --web
  ```
- **Visual**: 3D graph showing attack paths
- **Click Through**:
  - "Port 22 exposed on Server A"
  - "Attacker pivots to Server B via shared SSH key"
  - "Database compromise = 3 clicks from internet"
- **Narration**: "This is causality, not checklists—we prove the domino effect"

**MINUTE 12-14: THE DELIVERABLE (PDF Report)**
- **Action**: Show pre-generated executive report (sanitized demo data)
- **Page 1**: "5 CRITICAL risks = $3.2M potential loss"
- **Page 5**: CMMC compliance scorecard (78/110 controls passing)
- **Page 10**: Auto-generated Ansible remediation playbook
- **Narration**: "This is what you hand to your Board and regulators—proof, not promises"

**MINUTE 15: THE ASK**
- "Pilot program: $15K-$50K, 4 weeks, zero disruption to operations"
- "Worst case: detailed security audit for fraction of Big 4 cost"
- "Best case: Win DoD contracts your competitors can't touch"
- **Close**: "Want to try this on your own network?"

---

## CHAPTER 4. PILOT PROGRAM EXECUTION (4-WEEK PLAYBOOK)

### WEEK 1: DISCOVERY & DEPLOYMENT

#### DAY 1-2: KICKOFF & SCOPING
**Participants**: Client CISO, IT Director, Lead Engineer + Khepra Consultant

**Agenda (2-Hour Meeting)**:
1. **Understand Business Context** (30 min)
   - What compliance frameworks matter? (CMMC, NIST 800-171, HIPAA, PCI-DSS)
   - What's the deadline? (Contract deadline, audit date, certification goal)
   - What's the risk tolerance? (DoD contractor = zero tolerance, startup = moderate)

2. **Identify Crown Jewels** (45 min)
   - "Which 5-10 servers would bankrupt you if hacked?"
   - Examples: Domain controller, database server, payment gateway, VPN gateway
   - Document: Hostname, IP, OS, criticality level (1-5)

3. **Technical Readiness Check** (30 min)
   - Can we SSH into servers? (Need credentials/bastion access)
   - Any air-gapped systems? (Deploy via serial/USB if needed)
   - Firewall rules? (Outbound HTTPS for OSINT lookups - optional)

4. **Set Expectations** (15 min)
   - "You'll spend 4 hours total over 4 weeks"
   - "We'll deliver: PDF report + DAG visualization + remediation playbook"
   - "Data never leaves your network unless you approve cloud hosting"

**Deliverable**: Signed SOW + Server inventory spreadsheet + Calendar holds for Week 4 briefing

---

#### DAY 3-4: SONAR DEPLOYMENT
**Operator Role**: Khepra Field Consultant (remote or on-site)

**Step 1: Pre-Flight Checklist**
- [ ] Binaries compiled (`CGO_ENABLED=0` for maximum compatibility)
- [ ] KMS Tier 0 initialized on operator workstation
- [ ] VPN/SSH access to client network verified
- [ ] Intelligence databases updated (CISA KEV, MITRE ATT&CK, Shodan API key)

**Step 2: Deploy Sonar Agents (15 min per server)**

**Option A: SSH Deployment (90% of cases)**
```bash
# From operator workstation
for SERVER in $(cat pilot-servers.txt); do
  scp bin/sonar.exe $SERVER:/tmp/
  ssh $SERVER "chmod +x /tmp/sonar.exe && /tmp/sonar.exe --passive --out /tmp/snapshot-$SERVER.json"
done
```

**Option B: Air-Gap Deployment (SCIF/High-Security)**
```bash
# Copy to USB drive
cp bin/sonar.exe /media/usb/

# On target server (manual transfer)
chmod +x /media/usb/sonar.exe
/media/usb/sonar.exe --passive --out /tmp/snapshot.json
```

**Step 3: Verify Collection**
```bash
# Check snapshot files are created and sealed
ls -lh /tmp/snapshot-*.json.sealed

# Spot-check one snapshot (decrypt to verify integrity)
khepra engine decrypt snapshot-server01.json.sealed --verify-only
```

**Deliverable**: 5-10 encrypted snapshot files (avg 2-5 MB each)

---

### WEEK 2-3: ANALYSIS & INTELLIGENCE FUSION

#### DAY 5-10: AUTOMATED ANALYSIS
**Operator Role**: Khepra Data Analyst (runs locally, no client interaction needed)

**Step 1: Ingest Snapshots**
```bash
# Transfer snapshots to operator workstation (if remote)
scp client-server:/tmp/snapshot-*.sealed ./intake/

# Batch decrypt and load into DAG
khepra engine batch-ingest --input ./intake/ --output pilot-dag.db
```

**Step 2: Build Trust Constellation**
```bash
# Generate DAG graph (correlates all findings)
khepra engine dag build --input pilot-dag.db --output trust-constellation.json

# Compute attack paths (lateral movement analysis)
khepra engine dag analyze --graph trust-constellation.json --mode attack-paths
```

**Step 3: Threat Intelligence Correlation**
```bash
# Cross-reference with CISA KEV (actively exploited CVEs)
khepra intel correlate --source cisa-kev --dag pilot-dag.db

# Shodan lookup (public exposure check)
khepra intel correlate --source shodan --dag pilot-dag.db --api-key $SHODAN_KEY

# MITRE ATT&CK mapping
khepra intel correlate --source mitre-attack --dag pilot-dag.db
```

**Step 4: CMMC/STIG Compliance Mapping**
```bash
# Load STIG-to-NIST mapping database
khepra compliance map-stigs --input docs/STIG_to_NIST171_Mapping_Ultimate.xlsx

# Generate compliance scorecard
khepra compliance scorecard --dag pilot-dag.db --framework cmmc-level3 --output scorecard.json
```

**Step 5: Risk Scoring (Context-Aware)**
```bash
# Calculate causal risk scores (not just CVSS)
khepra risk score --dag pilot-dag.db --mode contextual --output risk-rankings.json

# Prioritize findings by business impact
khepra risk prioritize --input risk-rankings.json --top 20
```

**Deliverable**:
- `trust-constellation.json` (DAG graph - 10-50 MB)
- `scorecard.json` (CMMC compliance results)
- `risk-rankings.json` (Top 20 critical findings)

---

#### DAY 11-15: REPORT GENERATION

**Step 1: Generate Executive PDF**
```bash
khepra report generate \
  --template executive-summary \
  --dag pilot-dag.db \
  --scorecard scorecard.json \
  --risks risk-rankings.json \
  --output "ClientName_Khepra_Pilot_Report.pdf"
```

**Report Structure (Auto-Generated)**:
- **Page 1**: Executive Summary (5 CRITICAL risks, compliance %, business impact $)
- **Page 2-5**: Risk Details (causal chains, attack paths, proof of exploitability)
- **Page 6-8**: CMMC Compliance Scorecard (controls passing/failing, gap analysis)
- **Page 9-12**: Remediation Playbook (Ansible scripts, estimated hours, priority order)
- **Page 13-15**: Threat Intelligence (CISA KEV matches, Shodan exposure, MITRE tactics)
- **Appendix A**: DAG Visualization (graph screenshot)
- **Appendix B**: Cryptographic Receipts (verification commands for auditors)

**Step 2: Generate Interactive Dashboard**
```bash
# Export DAG for web visualization
khepra engine visualize trust-constellation.json --export-web ./dashboard/

# Start local web server for demo
cd dashboard && python -m http.server 8080
```

**Step 3: Generate Remediation Playbooks**
```bash
# Auto-generate Ansible playbooks for top 10 issues
khepra remediate generate-playbooks \
  --risks risk-rankings.json \
  --output ./playbooks/ \
  --format ansible

# Example output: playbooks/close-ssh-port-22.yml
```

**Deliverable**:
- `ClientName_Khepra_Pilot_Report.pdf` (25-40 pages)
- `dashboard/` (interactive web visualization)
- `playbooks/` (10-20 Ansible YAML files)

---

### WEEK 4: EXECUTIVE BRIEFING & HANDOFF

#### DAY 16-20: PRESENTATION PREP
**Operator Role**: Khepra Consultant + Sales Engineer

**Step 1: Rehearse Presentation** (Internal)
- Practice telling the "story" (not just data dump)
- Prepare answers to likely objections:
  - "How urgent are these findings?"
  - "Can our team fix these without you?"
  - "What's the cost to remediate?"

**Step 2: Customize Talking Points**
- Tailor to client's industry (DoD contractor, healthcare, finance)
- Link findings to specific business outcomes:
  - "Fixing Port 22 issue = keeps you eligible for $20M contract"
  - "Remediating these 5 CRITICAL risks = avoids $1.5M HIPAA fine"

**Step 3: Prepare Demo Environment**
- Load DAG visualization on laptop (no internet required)
- Have PDF report ready to share screen
- Pre-stage 2-3 "wow moment" findings:
  - "You have a database password in a public GitHub repo"
  - "Your VPN is visible on Shodan with a known exploit"

---

#### DAY 21: EXECUTIVE BRIEFING (90 Minutes)
**Participants**: Client CEO, CFO, CISO, Board member (optional) + Khepra team

**Agenda**:

**PART 1: THE BOTTOM LINE (15 min)**
- **Slide 1**: "We found X CRITICAL risks that could cost you $Y"
- **Slide 2**: "You're 78% compliant with CMMC Level 3 (need 100% by [date])"
- **Slide 3**: "Good news: All issues are fixable in 40-80 hours of work"

**PART 2: THE PROOF (30 min)**
- **Demo**: Open DAG visualization
  - Walk through 1-2 attack paths (show causal chain)
  - Click on high-risk finding: "Port 22 exposed → Shodan visible → CISA KEV exploit available"
- **Show**: Cryptographic receipt
  - "This finding is signed with quantum-proof math—regulators can verify it independently"
- **Explain**: Why this beats traditional audits
  - "Checklist says 'SSH configured' ✓, but doesn't catch that it's exposed to the internet"

**PART 3: THE ACTION PLAN (30 min)**
- **Page through PDF report**:
  - Section 1: Top 5 risks (with business impact)
  - Section 2: CMMC gap analysis (which controls are failing)
  - Section 3: Remediation playbook (step-by-step fixes)
- **Show**: Ansible playbook example
  - "This script closes Port 22 to external traffic (takes 5 minutes to run)"
- **Discuss**: Remediation timeline
  - "If you start next week, you can be 95% compliant in 30 days"

**PART 4: Q&A (15 min)**
- Common questions:
  - "How accurate are these findings?" → Show verification process
  - "Can we fix this ourselves?" → Yes, playbooks are yours to keep
  - "What happens after the pilot?" → Optional ongoing monitoring ($X/month)

**Deliverable**: Client has PDF report, dashboard access, and remediation playbooks

---

### POST-PILOT: DECISION POINT

#### CLIENT OPTION 1: "Let's Roll This Out Enterprise-Wide"
**Next Steps**:
1. Expand scope to all servers (100-1000+)
2. Deploy continuous monitoring (agents run 24/7)
3. Integrate with SIEM/SOAR (Splunk, ServiceNow)
4. Annual subscription: $50K-$250K depending on scale

**Deliverable**: Full enterprise deployment SOW

---

#### CLIENT OPTION 2: "We'll Remediate and Re-Scan"
**Next Steps**:
1. Client's IT team uses playbooks to fix issues (4-8 weeks)
2. Khepra re-scans to verify fixes
3. Generate "proof of remediation" report for auditors
4. Optional: Annual compliance certification ($25K/year)

**Deliverable**: Remediation verification report + cryptographic proof

---

#### CLIENT OPTION 3: "Not Right Now"
**Next Steps**:
1. Client keeps the pilot report (no ongoing obligation)
2. Khepra stays in touch (quarterly check-ins)
3. Re-engage when compliance deadline approaches

**Deliverable**: None (pilot stands alone)

---

## CHAPTER 5. TACTICS, TECHNIQUES, AND PROCEDURES (TTPs)

### TTP-01: AIR-GAP DEPLOYMENT (EDGE)
**Role:** Physical Operator using Native Serial.

1.  ** ESTABLISH CONNECTION**
    *   Connect Operator Workstation to Target via Serial Console.
    *   Verify binary integrity: `sha384sum -c sonar.exe.sha384`

2.  ** DEPLOY SENSOR (NATIVE SERIAL)**
    *   On Host: `khepra transfer receive --device /dev/ttyS0 --output /tmp/sonar.exe`
    *   On Operator: `khepra transfer push --device /dev/ttyUSB0 --file sonar.exe`
    *   *Result:* Authenticated transfer without ZModem.

3.  ** EXECUTE DIAGNOSTIC (ACTIVE)**
    *   Run Command: `./sonar.exe --active --out /tmp/snapshot.json`
    *   *System Action:* Performs Port Scan, OSINT, and File Scan.
    *   *System Action:* Seals artifact with **Triple-Layer Hybrid PQC**.

4.  ** EXFILTRATE EVIDENCE**
    *   On Host: `khepra transfer push --device /dev/ttyS0 --file /tmp/snapshot.json.sealed`
    *   On Operator: `khepra transfer receive --device /dev/ttyUSB0`
    *   *Result:* Evidence secured on Operator Workstation.

5.  ** ANALYZE (LOCAL)**
    *   Run Command: `khepra engine analyze snapshot.json.sealed --output report.pdf`
    *   *Result:* PDF Report generated locally (No Cloud).

### TTP-02: LEGACY INGESTION (HYBRID)
**Role:** Remote Analyst using Native SSH.

1.  ** STAGING**
    *   Operator targets a legacy RHEL server.
    *   Goal: Move snapshot to **Local Intake** (replacing S3).

2.  ** BATCH TRANSFER (SSH)**
    *   Run Command:
        ```bash
        khepra transfer batch \
          --hosts-file legacy-servers.txt \
          --pattern "/var/log/khepra/*.sealed" \
          --destination ./intake/
        ```
    *   *Result:* All artifacts pulled to local workstation.

3.  ** NATIVE PROCESSING**
    *   Run Command: `khepra engine batch-analyze --input ./intake/`
    *   *System Action:* Decrypts using **KMS Tier 2 Keys**.
    *   *System Action:* Generates aggregate compliance report.

### TTP-03: VALIDATION DRILL (SMOKE TEST)
**Role:** Verification before Deployment.

1.  ** COMMAND**
    *   On Operator Workstation:
        ```bash
        khepra attest --self-test
        ```
2.  ** CHECKLIST**
    *   [ ] Binaries built (`CGO_ENABLED=0`)?
    *   [ ] KMS Master Seed Present (`master_seed.sealed`)?
    *   [ ] Triple-Layer Signing Verified?

---

## APPENDIX A: LICENSE & PROPRIETARY NOTICE

**KHEPRA PROPRIETARY LICENSE AGREEMENT**
*   **Licensor:** SecRed Knowledge Inc. dba NouchiX.
*   **Grant:** Internal Business Use / Government Rights (DFARS 252.227-7014).
*   **Restriction:** NO Reverse Engineering. The "Symbolic Attestation Logic" is a Trade Secret.

**END OF MANUAL**
