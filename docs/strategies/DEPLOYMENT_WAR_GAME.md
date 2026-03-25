# OPERATION: THREE-HEADED DOG (Deployment Stress-Test Plan)

**OBJECTIVE:** Battle-test the three Khepra deployment models (EDGE, HYBRID, SOVEREIGN) to validate security claims, operational feasibility, and market fit.

**DATE:** TBD
**LOCATION:** Hybrid (Physical for Edge / Virtual for Cloud)

---

## 1. THE COMBATANTS (Participants)

### 🔴 RED CELL (The Adversaries)
**Who:** SUNY Cyber Defense Organization (Students/Alumni).
**Mission:** Break the model. Prove the claims false.
** Capabilities:**
*   Penetration Testing (Kali Linux, Burp Suite).
*   Reverse Engineering (Ghidra vs. Nkyinkyim).
*   Compliance Evasion.

### ⚪ WHITE CELL (The Evaluators)
**Who:** OneDay Program Founders.
**Mission:** Evaluate "Buy-ability" and UX.
**Perspective:**
*   **Startup Founder Persona:** "Is this too complex for my team?"
*   **Gov/Enterprise Persona:** "Does this actually solve my compliance headache?"

### 🔵 BLUE CELL (The Defenders)
**Who:** Khepra Core Team.
**Mission:** Monitor telemetry (where applicable), defend infrastructure, and support White Cell deployment.

---

## 2. THE BATTLEFIELDS (Scenarios)

### 🛡️ SECTOR 1: KHEPRA-EDGE (The Bunker)
*Target: Enclaves, SCIFs, Submarines.*
*Claim: "Offline licensing. No call home. Local evidence."*

#### 🧪 Test A: "The Faraday Cage" (Red Cell)
*   **Setup:** Deploy Khepra binary on a laptop with physically disabled network adapters.
*   **Challenge:**
    1.  Activate the license without internet. (Validates `pkg/license` offline keys).
    2.  Ingest "Secret" logs.
    3.  Attempt to extract the data via USB (Simulate "Exfiltration").
*   **Success Metric:** System functions 100% offline. Zero network packets generated. Data is encrypted at rest (PQC).

#### 🧪 Test B: "The Field Kit" (White Cell)
*   **Setup:** Hand a founder a USB drive with the binary and a PDF manual.
*   **Challenge:** "You are in a forward operating base. Get this running in 10 minutes."
*   **Success Metric:** Time-to-Hello-World < 10 mins. No frustration with "missing dependencies."

---

### 🤝 SECTOR 2: KHEPRA-HYBRID (The Tether)
*Target: Standard Enterprise.*
*Claim: "Client controls runtime. We manage complexity (Shadow CISO)."*

#### 🧪 Test C: "The Severed Link" (Red Cell)
*   **Setup:** Run Khepra normally, then aggressively block all outbound traffic to Khepra HQ.
*   **Challenge:** Does the runtime crash? Does it fail open or fail safe?
*   **Success Metric:** Runtime continues to operate (perhaps in degraded mode) without panicking. Evidence is queued locally.

#### 🧪 Test D: "The Bad Advisor" (White Cell)
*   **Setup:** Feed the system a deliberate misconfiguration (e.g., "Allow 0.0.0.0/0 on SSH").
*   **Challenge:** Does the "Shadow CISO" (Managed Service/LLM) catch it? How is the alert delivered?
*   **Success Metric:** User understands the alert and fixes the config.

---

### 🏛️ SECTOR 3: KHEPRA-SOVEREIGN (The Fortress)
*Target: Nation States / Regulated Clouds.*
*Claim: "Single-tenant. Region locking."*

#### 🧪 Test E: "The Residency Leak" (Red Cell)
*   **Setup:** Khepra Sovereign instance hosted in "AWS GovCloud (US-East)".
*   **Challenge:** Attempt to force the instance to store data in a generic S3 bucket in "EU-West".
*   **Success Metric:** System rejects the non-compliant storage target.

#### 🧪 Test F: "The Keys to the Kingdom" (White Cell)
*   **Setup:** "You are the Admin. We are just the vendor."
*   **Challenge:** Request Khepra Support to "reset a password".
*   **Success Metric:** Blue Cell *cannot* reset the password because we don't hold the keys. White Cell must feel completely in control.

---

## 3. SCORING & FEEDBACK

| Metric | Score (1-5) | Notes |
| :--- | :--- | :--- |
| **Resilience** | | Did it crash under Red Cell pressure? |
| **Stealth** | | Did Trufflehog/Nmap find it easily? |
| **Usability** | | Did White Cell throw the keyboard? |
| **Truthfulness**| | Did the "Offline" mode actually try to call home? |

## 4. NEXT STEPS (Preparation)
1.  **Build the "Edge" Artifact:** Compile a static binary with `pkg/license` enabled.
2.  **Refine the "Shadow CISO":** Ensure `pkg/compliance` has at least 3 active check rules.
3.  **Schedule the Session:** Invite SUNY & OneDay contacts for a 2-hour "War Game."
