# Khepra Protocol: Executive Roundtable Demo Script
**15-Minute Live Demonstration with Visual Aids**

---

## Pre-Demo Setup Checklist (30 Minutes Before)

### Technical Setup
- [ ] Laptop fully charged + backup power adapter
- [ ] Demo server accessible (pre-staged with known vulnerabilities)
- [ ] Binaries verified: `./bin/sonar.exe`, `./bin/adinkhepra`
- [ ] Web dashboard running: `http://localhost:8080`
- [ ] PDF report loaded and ready to screenshare
- [ ] Backup: USB drive with all materials (if internet fails)

### Visual Aids Ready
- [ ] Slide 1: "Compliance Theater vs Causal Reality" comparison
- [ ] Slide 2: Demo architecture diagram
- [ ] Slide 3: Pricing tiers (Pilot packages)
- [ ] Terminal window: Pre-configured font size (18pt minimum for projection)
- [ ] Browser window: Dashboard pre-loaded (clear cache for fresh load)

### Mental Prep
- [ ] Practice opening hook (30-second version)
- [ ] Identify 1-2 "wow moment" findings to highlight
- [ ] Prepare backup plan if live demo fails (use pre-recorded screencast)

---

## MINUTE 0-3: THE PROBLEM (Set the Stage)

### VISUAL: Slide 1 - "Compliance Theater vs Causal Reality"

**TALKING POINTS:**

> "Good morning. I'm [Name] from NouchiX, and I'm here to solve a problem that costs your industry $billions every year: **proving** your security posture to regulators and auditors."

> "Right now, most companies do this:" *(point to left side of slide)*
> - "Hire auditors for $300K/year"
> - "They check boxes on a spreadsheet"
> - "You get a 300-page PDF that says 'mostly compliant'"
> - "Takes 4-6 months"

> "The problem? **Nobody can prove it's accurate**. Regulators ask:"
> - "Did you really check every server?"
> - "How do we know this data wasn't tampered with?"
> - "Which findings could actually bankrupt us?"

> *(pause for effect)*

> "What if you could do this instead?" *(point to right side of slide)*
> - "Prove security with the same math that protects nuclear launch codes"
> - "Get results in 48 hours, not 6 months"
> - "Give regulators a cryptographic receipt they can verify independently"

> "That's Khepra. Let me show you how it works."

**SLIDE CONTENT:**

```
┌─────────────────────────────────────┬─────────────────────────────────────┐
│   COMPLIANCE THEATER (Old Way)      │   CAUSAL REALITY (Khepra Way)       │
├─────────────────────────────────────┼─────────────────────────────────────┤
│ ❌ Audit logs + claims              │ ✅ Cryptographic proofs             │
│ ❌ Third-party trust required       │ ✅ Client-verifiable evidence       │
│ ❌ Isolated findings (checklists)   │ ✅ Causality graphs (domino effect) │
│ ❌ 6 months + $300K                 │ ✅ 4 weeks + $50K                   │
│ ❌ Static (annual audits)           │ ✅ Continuous (24/7 monitoring)     │
└─────────────────────────────────────┴─────────────────────────────────────┘
```

**TRANSITION:**
> "Let me show you a live demo. This will take about 12 minutes, and by the end, you'll see exactly how Khepra finds vulnerabilities, proves causality, and generates board-ready reports."

---

## MINUTE 4-8: THE SOLUTION (Live Sonar Scan)

### VISUAL: Terminal Window (Full Screen)

**ACTION:**
```bash
# Pre-staged command (visible on screen)
$ ./bin/sonar.exe --active --out demo-snapshot.json --quick
```

**TALKING POINTS (While Scanning):**

> "This is the Sonar agent—think of it like an X-ray machine for your servers. I'm running it right now on a demo server."

> *(Scanner starts outputting findings—point to specific lines)*

> "See this line here?" *(point to Port 22 finding)*
> ```
> [FOUND] Port 22 (SSH) - OpenSSH 7.4 (CVE-2021-41617 - EXPLOITED)
> ```

> "This isn't just saying 'Port 22 is open' (which is useless information). It's telling us:"
> 1. "The SSH version is OpenSSH 7.4"
> 2. "There's a known vulnerability: CVE-2021-41617"
> 3. "The CIA has confirmed hackers are **actively exploiting** this right now"

> *(Scanner continues)*

> "And here—watch this:" *(point to Shodan correlation)*
> ```
> [FOUND] Port 3389 (RDP) - Publicly exposed on Shodan
> [THREAT LEVEL] CRITICAL - 47 public scans detected in last 30 days
> ```

> "Shodan is like Google for hackers. This line tells us that hackers have already **scanned this server 47 times** in the last month. They know it exists."

> *(Scanner completes)*

> "And here's the magic:" *(point to encryption line)*
> ```
> [ENCRYPTING] Snapshot sealed with Dilithium3 signature
> [DONE] demo-snapshot.json.sealed (2.3 MB)
> ```

> "All of this data is now encrypted with **post-quantum cryptography**—the same math NIST recommends for protecting classified data through 2035. Even if a quantum computer existed today, it couldn't fake this data."

**EXPECTED OUTPUT (Terminal):**
```
$ ./bin/sonar.exe --active --out demo-snapshot.json --quick

[SONAR v2.0] Initializing scan...
[TARGET] 192.168.1.10 (demo-server-01)

[SCANNING] Network services...
[FOUND] Port 22 (SSH) - OpenSSH 7.4 (CVE-2021-41617 - EXPLOITED)
[FOUND] Port 80 (HTTP) - Apache 2.4.29 (CVE-2021-44790)
[FOUND] Port 3389 (RDP) - Windows Remote Desktop

[CORRELATING] CISA Known Exploited Vulnerabilities (KEV)...
[MATCH] CVE-2021-41617 → ACTIVE EXPLOITATION CONFIRMED
[RISK] Elevation: HIGH → CRITICAL

[CORRELATING] Shodan public exposure...
[MATCH] 192.168.1.10 visible on Shodan
[THREAT LEVEL] CRITICAL - 47 scans detected (last 30 days)

[SCANNING] Installed packages (CVE correlation)...
[FOUND] 47 outdated packages with known CVEs
[TOP RISK] log4j-core@2.14.1 → CVE-2021-44228 (Log4Shell)

[SCANNING] File system (secrets detection)...
[FOUND] Hardcoded AWS credentials in /var/www/config.php
[FOUND] Unencrypted SSH private key in /home/admin/.ssh/id_rsa

[GENERATING] Trust Constellation DAG...
[NODES] 127 total findings
[CRITICAL] 5 findings
[HIGH] 23 findings
[MEDIUM] 99 findings

[ENCRYPTING] Snapshot with Dilithium3 + Kyber1024...
[SIGNATURE] f4a9c2e8b5d1... (3,293 bytes)
[SEALED] demo-snapshot.json.sealed (2.3 MB)

[DONE] Scan completed in 37 seconds
```

**TRANSITION:**
> "Alright, we have our snapshot. Now let me show you the **real magic**—how Khepra turns this list of findings into a causal story."

---

## MINUTE 9-11: THE PROOF (DAG Visualization)

### VISUAL: Web Browser (Dashboard - Full Screen)

**ACTION:**
```bash
# Open dashboard (pre-loaded in browser)
# URL: http://localhost:8080/dag-visualization
```

**TALKING POINTS:**

> "This is what we call the **Trust Constellation**—a 3D map of your security posture."

> *(Dashboard loads - show interactive graph with nodes and edges)*

> "Each circle is a finding. Each line shows a causal relationship. Let me zoom in on this cluster here." *(click on Port 22 node)*

**VISUAL: Zoomed Graph Showing Attack Path**
```
┌─────────────────────────────────────────────────────────────┐
│                  ATTACK PATH VISUALIZATION                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   [Internet]                                                │
│       ↓                                                     │
│   [Port 22 Open] ← CVE-2021-41617 (Shodan visible)         │
│       ↓                                                     │
│   [SSH Brute Force] ← Default password "admin123"          │
│       ↓                                                     │
│   [Root Access] ← Sudo misconfiguration                    │
│       ↓                                                     │
│   [Shared SSH Key] ← /home/admin/.ssh/id_rsa               │
│       ↓                                                     │
│   [Database Server] ← No network segmentation              │
│       ↓                                                     │
│   [Customer PII] ← 500K records exposed                    │
│                                                             │
│   BLAST RADIUS: 3 servers compromised in 6 steps           │
│   BUSINESS IMPACT: $5.2M (GDPR fines + breach costs)       │
└─────────────────────────────────────────────────────────────┘
```

**TALKING POINTS (While clicking through graph):**

> "Here's what this tells us:" *(click each node sequentially)*

> **Node 1 (Port 22):**
> "Port 22 is open on your internet-facing server. That's the entry point."

> **Node 2 (CVE):**
> "There's a known vulnerability that hackers are exploiting **right now** (CISA confirmed). That's the weapon."

> **Node 3 (Brute Force):**
> "Your password is 'admin123' (we found it in a config file). That's the key to the front door."

> **Node 4 (Root):**
> "Once inside, a misconfigured sudo rule lets the attacker become root. That's total control of Server A."

> **Node 5 (SSH Key):**
> "We found an unencrypted SSH key in the admin's home directory. That key has access to Server B (your database)."

> **Node 6 (Database):**
> "Server B has 500,000 customer records. No network segmentation. Game over."

> *(pause for impact)*

> "This is the difference between a checklist and causality:"
> - "A checklist says: 'Port 22 open = Medium Risk' ✓"
> - "Khepra says: 'Port 22 open + exploited CVE + default password + lateral movement = **$5.2M breach in 6 steps**'"

> "This is what I mean by **causal reality**. We don't just find problems—we prove the domino effect."

**TRANSITION:**
> "Now, let me show you what you hand to your Board and regulators."

---

## MINUTE 12-14: THE DELIVERABLE (PDF Report)

### VISUAL: PDF Report (Screen Share)

**ACTION:**
- Open pre-generated PDF: `ClientName_Khepra_Pilot_Report.pdf`
- Navigate to key pages while narrating

**TALKING POINTS:**

> "This is the executive report Khepra generates automatically. Let me walk you through the highlights."

### Page 1: Executive Summary

**VISUAL:**
```
╔══════════════════════════════════════════════════════════╗
║       KHEPRA PROTOCOL - EXECUTIVE SUMMARY                ║
║       Client: Demo Corp | Date: 2025-12-25              ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  CRITICAL FINDINGS: 5                                    ║
║  Estimated Business Impact: $5.2M (if exploited)         ║
║                                                          ║
║  CMMC LEVEL 3 COMPLIANCE: 78/110 controls passing (71%)  ║
║  Gap to certification: 32 controls (estimated 60 hours)  ║
║                                                          ║
║  TOP RISKS:                                              ║
║  1. SSH exposed with exploited CVE (CRITICAL)            ║
║  2. Database lateral movement path (CRITICAL)            ║
║  3. Hardcoded AWS credentials in code (CRITICAL)         ║
║  4. Log4Shell vulnerability in production (HIGH)         ║
║  5. Unencrypted backups with PII (HIGH)                  ║
║                                                          ║
║  RECOMMENDED ACTION: Remediate 5 CRITICAL risks within   ║
║  7 days to avoid contract eligibility loss.              ║
╚══════════════════════════════════════════════════════════╝
```

**TALKING POINTS:**

> "Page 1 is your **bottom line**. If you're a CEO, this is all you need to read:"
> - "5 CRITICAL risks that could cost you $5.2 million"
> - "You're 71% compliant with CMMC Level 3 (DoD requires 100% to bid on contracts)"
> - "Good news: All fixable in about 60 hours of work"

---

### Page 5: CMMC Compliance Scorecard

**VISUAL:**
```
┌──────────────────────────────────────────────────────────┐
│  CMMC LEVEL 3 COMPLIANCE SCORECARD                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Access Control (AC):          12/17 passing (71%)       │
│    ❌ AC.3.018 - MFA not enforced on admin accounts      │
│    ❌ AC.3.014 - Session timeout > 15 minutes            │
│                                                          │
│  Audit & Accountability (AU):  8/12 passing (67%)        │
│    ❌ AU.3.046 - Audit logs not centralized              │
│    ❌ AU.3.049 - Log retention < 1 year                  │
│                                                          │
│  System & Communications (SC): 15/18 passing (83%)       │
│    ✅ SC.3.177 - Boundary protection enforced            │
│    ❌ SC.3.191 - Encryption in transit (HTTP not HTTPS)  │
│                                                          │
│  ... (110 total controls)                                │
│                                                          │
│  OVERALL: 78/110 (71%) - DOES NOT MEET CMMC LEVEL 3      │
└──────────────────────────────────────────────────────────┘
```

**TALKING POINTS:**

> "Page 5 is for your compliance officer. This is the exact scorecard your C3PAO auditor will use:"
> - "Each X is a control you're failing"
> - "Each checkmark is proof you're compliant"
> - "We've mapped every finding to the specific NIST 800-171 and STIG requirements"

> "Here's the kicker:" *(point to cryptographic signature at bottom of page)*
> - "See this signature? That's quantum-proof math"
> - "Your auditor can run a simple command to verify this data is authentic"
> - "No more 'trust me, we checked' — this is **provable** compliance"

---

### Page 10: Remediation Playbook

**VISUAL:**
```yaml
# AUTO-GENERATED ANSIBLE PLAYBOOK
# Issue: Port 22 exposed to internet with exploited CVE
# Risk Level: CRITICAL
# Estimated Time: 15 minutes

---
- name: Remediate SSH exposure (CRITICAL)
  hosts: demo-server-01
  become: yes
  tasks:
    - name: Update OpenSSH to latest version
      apt:
        name: openssh-server
        state: latest

    - name: Restrict SSH to internal network only
      ufw:
        rule: allow
        port: 22
        src: 10.0.0.0/8

    - name: Block public SSH access
      ufw:
        rule: deny
        port: 22
        src: 0.0.0.0/0

    - name: Enforce key-based auth (disable passwords)
      lineinfile:
        path: /etc/ssh/sshd_config
        regexp: '^PasswordAuthentication'
        line: 'PasswordAuthentication no'

    - name: Restart SSH service
      service:
        name: sshd
        state: restarted
```

**TALKING POINTS:**

> "Page 10 is where it gets **really** practical. This is an Ansible playbook that fixes the Port 22 issue automatically."

> "Your DevOps team can run this script—takes 15 minutes—and the problem is solved."

> "We generate these for every critical finding. You don't need to hire us to fix things (though we can help if you want). **The playbooks are yours to keep**."

> "And here's the best part:" *(flip to next page showing before/after comparison)*
> - "We re-scan after you apply the fix"
> - "We generate a **proof of remediation** report with cryptographic timestamps"
> - "You hand that to your auditor and say: 'Problem found on Dec 1st, fixed on Dec 3rd, here's the math that proves it'"

---

## MINUTE 15: THE ASK (Close the Deal)

### VISUAL: Slide 3 - Pilot Program Pricing

**TALKING POINTS:**

> "Alright, here's what happens next."

> "We offer a **pilot program** in three tiers:"

**SLIDE CONTENT:**
```
┌─────────────────────────────────────────────────────────┐
│  PILOT PROGRAM PRICING                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  TIER 1: PROOF OF CONCEPT                               │
│  ├─ Scope: Up to 10 servers                             │
│  ├─ Duration: 4 weeks                                   │
│  ├─ Deliverables: PDF report + DAG + playbooks          │
│  └─ Price: $15,000 one-time                             │
│                                                         │
│  TIER 2: DEPARTMENT PILOT                               │
│  ├─ Scope: Up to 50 servers                             │
│  ├─ Duration: 8 weeks                                   │
│  ├─ Deliverables: Tier 1 + continuous monitoring        │
│  └─ Price: $50,000 one-time                             │
│                                                         │
│  TIER 3: ENTERPRISE PILOT                               │
│  ├─ Scope: Unlimited servers (single business unit)     │
│  ├─ Duration: 12 weeks                                  │
│  ├─ Deliverables: Tier 2 + SIEM integration             │
│  └─ Price: $150,000 one-time                            │
│                                                         │
│  ⚡ GUARANTEE: Find 10+ critical issues or 50% refund   │
└─────────────────────────────────────────────────────────┘
```

**TALKING POINTS:**

> "Tier 1 is our most popular—$15K, 4 weeks, up to 10 servers. Perfect for proving the value before rolling out enterprise-wide."

> "Here's what you get:"
> 1. "A report like the one I just showed you"
> 2. "The DAG visualization (interactive, browser-based)"
> 3. "Remediation playbooks for your team"

> "Total time investment from your team: **less than 8 hours** over 4 weeks:"
> - "Week 1: 2-hour kickoff (we figure out which servers to scan)"
> - "Week 2-3: We do all the work (you go about your business)"
> - "Week 4: 2-hour briefing (we present findings)"

> "And here's my guarantee:" *(point to guarantee line)*
> - "If we don't find at least 10 critical issues you didn't already know about, I'll refund 50% of the pilot fee"
> - "Why? Because I've never seen a network that doesn't have at least 10 hidden landmines"

> *(pause, make eye contact)*

> "So... **who wants to be the guinea pig?**" *(smile)*

> "I'm looking for 2-3 companies in this room to run pilots in the next 60 days. First company that signs up gets a **20% early adopter discount** ($15K becomes $12K)."

> "Questions?"

---

## Q&A HANDLING (Extra Time if Available)

### Question 1: "How do we know your findings are accurate?"

**ANSWER:**
> "Great question. Three ways we prove accuracy:"

> 1. **Cryptographic Signatures**: Every finding is signed with Dilithium3 (quantum-proof). Your auditor can verify it independently using a free open-source tool.

> 2. **Reproducibility**: We give you the exact commands we ran. You can re-run them yourself to verify results.

> 3. **Third-Party Correlation**: We cross-reference findings with:
>    - CISA (government database of exploited vulnerabilities)
>    - Shodan (public exposure verification)
>    - MITRE ATT&CK (adversary technique mapping)

> "If all three sources agree, it's not a false positive—it's a real threat."

---

### Question 2: "What if we already use [Tenable/Qualys/Rapid7]?"

**ANSWER:**
> "Those are excellent **scanners**. Khepra is a **proof engine**—we actually integrate with those tools."

> "Here's the difference:"
> - **Your scanner says**: "Port 22 open (Medium Risk)"
> - **Khepra says**: "Port 22 open + exploited CVE + Shodan visible + lateral movement path to database = **$5.2M risk**"

> "We take their raw data and add three things:"
> 1. **Causality** (show the attack path)
> 2. **Proof** (cryptographic receipts)
> 3. **Business impact** (translate to dollars and compliance gaps)

> "Think of it this way: Your scanner is the thermometer, Khepra is the diagnosis and prescription."

---

### Question 3: "What happens to our data? Is it secure?"

**ANSWER:**
> "Your data **never leaves your network** unless you explicitly approve cloud hosting."

> "The default deployment:"
> - Sonar runs on your servers (collects data locally)
> - Data is encrypted **before** it leaves the server (Dilithium3 + Kyber)
> - Analysis happens on our consultant's laptop (which we can do on-site if you prefer)
> - You own the data—we're just processing it

> "We also support air-gapped deployments (SCIF, submarines, oil rigs):"
> - Transfer via serial cable or USB
> - Zero network connectivity required

> "And for extra paranoid clients:" *(smile)*
> - "We can run Khepra entirely on **your** infrastructure (private cloud deployment)"
> - "You control the encryption keys, we never touch them"

---

### Question 4: "Can we test this on a non-production server first?"

**ANSWER:**
> "Absolutely. That's exactly what the pilot is for."

> "In fact, I recommend starting with 3-5 crown jewel servers (domain controller, database, VPN gateway) rather than your entire network."

> "Why?"
> 1. **Lower risk** (if something goes wrong, it doesn't affect production)
> 2. **Faster results** (4 weeks instead of 12)
> 3. **Prove value** (find the scariest stuff first, then expand)

> "After the pilot, if you like what you see, we scale up to all servers."

---

### Question 5: "How long does a scan actually take? Will it disrupt operations?"

**ANSWER:**
> "Two modes:"

> **Passive Scan (90% of pilots)**:
> - "Takes 5-10 minutes per server"
> - "Zero disruption (just reads config files, doesn't send network traffic)"
> - "Can run during business hours"

> **Active Scan (optional, for deeper findings)**:
> - "Takes 20-30 minutes per server"
> - "Sends network probes (port scans, banner grabs)"
> - "We schedule during maintenance windows (weekends, nights)"

> "Real example: We scanned a 50-server environment in 6 hours total (overnight job). IT team didn't even notice."

---

## POST-DEMO FOLLOW-UP (What to Send)

### Within 24 Hours

**Email to all attendees:**
```
Subject: Khepra Protocol Pilot - Next Steps

Hi [Name],

Thank you for attending today's demo. As promised, here are the materials:

1. Executive Summary (PDF): [Link to pitch deck]
2. Technical Datasheet: [Link to architecture docs]
3. Sample Report: [Link to sanitized pilot report]
4. Pilot Proposal: [Customized SOW with pricing]

Next Steps:
- Schedule a 30-minute technical deep-dive with your IT team (optional)
- Review the pilot proposal with your CFO/CISO
- If interested, we can start as early as [Date + 2 weeks]

Early Adopter Offer:
First 2 companies to sign up get 20% off Tier 1 pilot ($12K instead of $15K).

Questions? Reply to this email or call me: [Phone]

Best,
[Your Name]
NouchiX - Causal Defense Intelligence
```

---

### Follow-Up Call (1 Week Later)

**Agenda:**
1. "Did you have a chance to review the materials?"
2. "Any questions from your technical team?"
3. "What's your timeline for making a decision?"
4. "Can I walk you through the pilot SOW in detail?"

**Goal:** Get to YES or NO (not maybe). If NO, understand why (price? timeline? not a priority?). If YES, schedule kickoff call for Week 1.

---

## BACKUP PLAN (If Live Demo Fails)

### Option 1: Pre-Recorded Screencast
- Have a 5-minute video of the Sonar scan + DAG visualization pre-loaded
- Narrate over it live ("This is what we'd see if we ran it right now...")

### Option 2: Static Screenshots
- Print out key terminal outputs and dashboard screenshots
- Pass around printed copies (old-school but effective)

### Option 3: Pivot to Story Mode
- "Instead of showing you live, let me tell you about a recent pilot we did..."
- Walk through a real (sanitized) case study with business outcomes

---

**END OF DEMO SCRIPT**

Remember:
- **Slow down** - Executives need time to absorb technical concepts
- **Use analogies** - "X-ray machine", "Google for hackers", "nuclear-grade math"
- **Show don't tell** - Live demos beat slides 10x
- **Focus on outcomes** - They don't care about Dilithium3, they care about avoiding $5M fines
