# BD Outreach Tracker — NouchiX / SouHimBou AI
**Maintained by:** SDK (Souhimbou Doh Kone)
**Last updated:** May 21, 2026

---

## Contact Log

---

### QuBit Capital
**Status:** POST-CALL DILIGENCE — corrections submitted
**Call date:** May 2026
**Investor profile:** Micro-VC / angel network; sector focus cybersecurity, defense tech, dual-use, govtech; US + NATO geography

**Call outcome:** Three material misrepresentations identified and corrected (see
`docs/INVESTOR_DILIGENCE_QUBIT_CAPITAL.md`). Technology foundation validated.
Open questions: solo founder bandwidth (resolved — both degrees complete May 2026),
advisory board depth, no signed pilots.

**Action items:**
- [ ] Send QuBit corrected deck (v4)
- [ ] Prepare one-page honest traction summary
- [ ] Prepare written founder bandwidth answer (full-time from May 2026)
- [ ] Name at least one C3PAO / CMMC advisor being recruited (not just "TBD")

**Funding terms confirmed:** SAFE, $200K initial, $1M step-up on first signed pilot.
Open to direct equity for strategic investors. Full detail: `docs/INVESTOR_DILIGENCE_QUBIT_CAPITAL.md`

---

### Army FUZE Program
**Status:** CLOSED — redirected to CPE ES2
**Date contacted:** [prior to May 2026]
**Response received:** May 2026

**Their response (verbatim):**
> "Thank you for contacting the Army FUZE Team and showing interest in working with
> the Army FUZE Program. Currently, your product does not align to any of the priorities
> our program is pursuing. However, the product may align with efforts in CPE ES2.
> I recommend you contact the team at CPE ES2 for further discussion. Please continue
> to periodically check the PIT website (www.pit.army.mil) for future opportunities
> to participate in prize competitions, proposal submissions, or contracting competition."

**Analysis:**
- FUZE focuses on rapid tactical technology fielding for operational warfighters
  (hardware, gear, field-deployable systems). KHEPRA is enterprise IT/compliance.
  The mismatch was structural, not a product quality rejection.
- CPE ES2 redirect is a warm handoff from an Army program office. They reviewed
  the product, recognized value, and named a specific follow-on program — this is
  a meaningful signal.
- The PIT website note is a standing invitation to bid on future opportunities.

**Action items:**
- [ ] Contact CPE ES2 team (see approach guide below)
- [ ] Set monthly reminder to check www.pit.army.mil for open solicitations
- [ ] Follow up with FUZE POC in 6 months when Iron Bank approval is in hand

---

### Iron Bank (dsop/nouchix/adinkhepra — Project ID 18821)
**Status:** BLOCKED — awaiting admin action
**Date submitted:** January 2026
**Contact:** Jeffrey Goluba (Iron Bank platform team)
**Email sent:** ~January 2026

**Issue:** TruffleHog false positives on Go vendor commit SHAs. Admin must enable
`TRUFFLEHOG_CONFIG` CI variable for project ID 18821. One admin action unblocks
the full submission pipeline.

**Action items:**
- [ ] Send second follow-up email to Jeffrey Goluba (CC Iron Bank help desk)
- [ ] Escalate via Iron Bank CHT (Container Hardening Team) if no response by Jun 2026
- [ ] Reference pipeline #5008200 (main, 2026-03-08) and #4936932 (development, 2026-01-20)

---

### STIGViewer Partnership
**Status:** IN PROGRESS
**Contact:** [STIGViewer contact from UAlbany]
**Details:** CKL generator implemented (`pkg/stigs/ckl_generator.go`), co-branded
PDF and CBOM export framework in place. Revenue share: 70% NouchiX / 30% STIGViewer.

**Action items:**
- [ ] Schedule co-branded launch call for Q4 2026 target
- [ ] Demo CBOM + CKL export against live RHEL-09 scan results

---

## CPE ES2 — Approach Guide

### What CPE ES2 Is
**Cyber Protection Enterprise (CPE)** is the Army program executive office responsible
for enterprise cybersecurity capabilities — RMF compliance, STIG enforcement, network
defense tools, and cybersecurity workforce enablement across Army IT infrastructure.

**ES2** (Enterprise Security Solutions) is the specific program under CPE that sources
commercial cybersecurity tools for Army enterprise use. Unlike FUZE (rapid tactical
prototypes), CPE ES2 funds and fields tools used by Army IT staff, CISOs, and
cybersecurity teams at installations and program offices.

**Why KHEPRA fits CPE ES2 specifically:**
- Army operates one of the largest STIG-compliance estates in DoD
- Army installations (and their supporting DIB contractors) are all CMMC-bound
- CPE ES2 actively sources tools that reduce the STIG/RMF compliance burden
- PQC readiness is now a mandate (NSM-10) — Army is not exempt
- KHEPRA's air-gapped binary is deployable on Army NIPR/SIPR environments
  without cloud dependency — a hard requirement for Army enterprise tools

---

### Pitch Reframe for CPE ES2

**Do not lead with:** "compliance autopilot for DIB contractors"
**Lead with:** "STIG-enforcement and RMF automation for Army enterprise IT"

The Army CISO's office has the same problem as DIB contractors — thousands of systems
requiring STIG validation, no automated cross-framework translation, and a growing PQC
migration mandate. KHEPRA solves this for internal Army IT environments, not just the
supply chain.

**Key proof points to emphasize to CPE ES2:**
1. RHEL-09 STIG validation — real OS checks, no mocks (Army runs RHEL heavily)
2. 36,195 mapping rows: STIG → CCI → NIST 800-53 → 800-171 (RMF uses all of these)
3. Air-gapped binary — deployable on classified Army networks without cloud egress
4. Dilithium-signed DAG audit trail — satisfies AU-2/AU-3 (NIST 800-53 audit controls)
5. ML-KEM-1024 PQC — aligned to NSM-10 mandate Army must comply with by 2030
6. SDVOSB-Eligible veteran-owned — Army gives preference to veteran-owned businesses
7. Active Secret Clearance (SDK) — enables classified environment conversations

**Avoid:** Overemphasizing "AI" language; Army program offices in compliance are
skeptical of AI-first positioning. Lead with "automated STIG enforcement" and
"cryptographically verifiable audit trail."

---

### CPE ES2 Outreach Template

**Subject:** STIG/RMF Automation + PQC Readiness Tool for Army Enterprise — Referred by Army FUZE

**Opening:**
> The Army FUZE Program reviewed SouHimBou AI by NouchiX and recommended we connect
> with CPE ES2 for further discussion. We are a veteran-owned (SDVOSB-Eligible), Army
> Signal Corps-founded cybersecurity company building automated STIG enforcement and
> post-quantum cryptographic readiness tools for Army enterprise IT environments.

**The problem we solve:**
> RHEL-09 STIG validation today requires 40+ hours of manual cross-framework translation
> per audit cycle. Our compiled Go binary performs real system-state checks against
> 36,195 cross-mapped controls (STIG→CCI→NIST 800-53→800-171→CMMC) in a single
> air-gapped executable — no cloud, no API calls, no token costs. Every result is
> logged to a Dilithium-signed immutable audit chain that satisfies AU-2/AU-3.

**The PQC angle:**
> Per NSM-10, Army must complete PQC asset inventories by 2026. Our CBOM (CycloneDX)
> export identifies every cryptographic asset on a system and flags RSA-2048/P-256
> vulnerabilities for migration — zero manual enumeration required.

**Traction:**
> - Demonstrated full PQC key ceremony on STM32U585 hardware at UAlbany NSA CAE-CDE
> - Running persistently on Raspberry Pi 2 (1GB/900MHz) — validates operation on
>   Army edge/OT-adjacent hardware classes
> - 85,500+ lines of production Go; 91 test files; zero cloud dependencies

**Ask:**
> 15-minute introductory call to determine alignment with CPE ES2 current priorities.
> We can provide a binary demo on RHEL 9 in a sandboxed environment at your request.

---

### PIT Website — Monitoring Plan

**URL:** www.pit.army.mil
**Check frequency:** Monthly (set calendar reminder)
**Opportunity types to watch:**
- Prize competitions related to: CMMC, STIG, RMF, PQC, cybersecurity automation
- Open BAAs (Broad Agency Announcements) for cybersecurity tools
- SBIR topics posted by Army CISO / CPE

**SBIR note:** Army SBIR topics relevant to KHEPRA appear annually in the DoD SBIR
solicitation (typically Jan and Jun). Watch for topics under:
- Army Cyber (AC) topic areas
- Cybersecurity automation
- CMMC compliance tools for Army supply chain
- PQC / quantum-resistant cryptography for tactical systems

---

## Outreach Pipeline Summary

| Organization | Status | Next Action | Priority |
|-------------|--------|-------------|---------|
| **CPE ES2** | NEW — warm redirect from FUZE | Initial outreach email | **HIGH** |
| **Iron Bank (Jeff Goluba)** | Blocked | Second follow-up email | **HIGH** |
| **STIGViewer** | In progress | Co-brand launch meeting | **HIGH** |
| **Army FUZE** | Closed (redirected) | Revisit post-Iron Bank approval | Low |
| **PIT Website** | Monitor | Monthly check | Ongoing |
| **QCL targets (150)** | 0 qualified yet | Active outreach | **HIGH** |
| **SBIR Phase I** | Pending reauth | Apply upon reauthorization | Medium |
| **HPE GreenLake** | Roadmap | Intro meeting after pilot LOI | Medium |
| **AWS GovCloud** | Roadmap | After AWS Marketplace listing (Q1 2027) | Medium |
