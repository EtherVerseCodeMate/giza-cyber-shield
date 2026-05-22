# Sprint Operations & Current Blockers
**Updated:** May 2026
**Source:** Sprint review with Donnie Yancey (mentor/accountability partner)

---

## Current Development Status

### What Is Complete
- Binary text-processing component — done
- `adinkhepra` main CLI binary (85,500+ LoC) — builds and runs
- Dashboard UI — exists but NOT yet wired to backend
- khepra-mcp MCP server — implemented; needs final integration pass
- 36,195-row mapping database — embedded and verified
- RHEL-09 STIG validator (8 live SV-IDs) — real OS checks, no mocks
- PQC engine (ML-KEM + ML-DSA via CIRCL) — production-ready
- DAG audit trail (AES-256-GCM + Dilithium-signed) — production-ready
- ERT / Godfather report engine — 4 report types, wired to CLI

### What Is Blocking Launch

**Blocker 1 — Dashboard ↔ Backend Integration (CRITICAL)**
The dashboard UI exists but requires full functional integration with all backend
components before launch. This is the primary deployment blocker. Action item:
wire all dashboard components to the Go API server (`cmd/apiserver/`). Use rapid
prototyping approach — functionality over polish.

**Blocker 2 — MCP Server Final Integration (CRITICAL)**
`khepra-mcp` is the primary deployment channel (easier market fit via Claude Code,
Cursor, Kiro, Windsurf). A final integration pass is required to ensure all tools
surface correctly and the PQC-signed responses flow end-to-end before launch.

**Blocker 3 — End-to-End Testing Cycle (CRITICAL)**
Product must "do what it says" before enterprise launch. Testing and fine-tuning
are the last development hurdles. Skipping this risks premature market entry and
enterprise trust damage. Complete the test cycle before resuming outreach.

**Blocker 4 — Iron Bank Pipeline (EXTERNAL)**
Awaiting Jeffrey Goluba / Iron Bank admin to enable `TRUFFLEHOG_CONFIG` CI variable
for project `dsop/nouchix/adinkhepra` (ID: 18821). Send second follow-up.
This does not block commercial launch — only DoD container registry listing.

---

## Delivery Model (Confirmed)

**Dual approach:**
- **Primary:** Downloadable binary — customers own data locally, zero cloud dependency,
  air-gap capable. This is the core product and the competitive moat.
- **Secondary:** Cloud-based login dashboard — required for monitoring, operation
  visibility, and SaaS licensing. Keep minimal; don't over-invest in the dashboard
  before functional integration is proven.

**Primary go-to-market channel:** Custom MCP server (`khepra-mcp`) — integrates
directly into AI development environments where security engineers already work.
Easier market fit than standalone dashboard or pure CLI.

---

## Marketing Strategy (Post-Launch)

**Current status:** All advertising and outreach campaigns intentionally paused
pending product stabilization. External marketing support on hold.

**Plan for post-launch:**
- Email drip campaigns via Apollo (list-building underway, messaging to be updated)
- ZoomInfo for prospect data augmentation
- CRM-driven nurture sequences before scaling paid spend
- No paid advertising until product is demonstrably market-ready
- QCL outreach (150-target list) resumes on product readiness confirmation

**Focus:** Build email list → drip campaign → qualified leads → pilot LOIs.
Cost-effective acquisition that doesn't require a large upfront budget.

---

## Fundraising Status

**Active raise:** $200K pre-seed via SAFE (preferred) or equity (strategic investors)
**Advisory firm:** QuBit Capital — cybersecurity specialist; reviewed pitch deck,
provided recommendations, has investor network access.
**Long-term target:** $1M to significantly scale operations and product

**Updated $200K use of funds:**
| Allocation | % | Purpose |
|-----------|---|---------|
| Security Engineer hire | 35% | Workload relief, development acceleration |
| CMMC L2 + SOC 1 / SOC 2 audits | 20% | Compliance credibility for enterprise sales |
| Cloud infra + AWS Marketplace | 20% | Deployment infrastructure + marketplace listing |
| BD outreach (Apollo, ZoomInfo, QCL) | 15% | Email campaigns + lead gen without paid ads |
| Legal + advisory recruitment | 10% | Patent prosecution (12 claims) + advisor onboarding |

**Important:** SOC 1/SOC 2 certification is a funded milestone — not a current claim.
Do not use "SOC2 Compliant" language in investor or customer materials until certified.

---

## Operational Notes

### Solo Founder Capacity
- Solo founder situation acknowledged as a constraint on bandwidth and execution speed
- Advisory board formation is a near-term priority for credibility and governance
- External accountability: sprint review process with Donnie Yancey as accountability partner
- Squad buddy system for focused sprint updates and feedback loops

### Advisory Board Gap (Action Item)
Current advisors: MBA mentor, UAlbany professor, STIGViewer contact.
Missing: C3PAO practitioner, DoD/Army program office contact, CMMC-AB advisor.
These gaps are known and should be addressed before Series A. At pre-seed stage,
having 1 named CMMC or C3PAO advisor would materially strengthen investor confidence.

### CMMC Documentation Partnership
Active discussion underway with a company operating CMMC compliance questionnaire
platforms. Their gap: structured, accurate data collection before questionnaire distribution.
NouchiX gap-fill: automated STIG validation output feeds into their workflow upstream.
This is a potential B2B channel partnership — prioritize follow-up.

### Bandwidth Note (for investor conversations)
Both M.S. Digital Forensics and MBA programs completed May 2026. Ongoing SQL Server
bootcamp training (professional development) is managed around NouchiX work schedule.
Full operational focus on NouchiX from May 2026 forward. Day 1 hire (Security Engineer)
immediately expands team and provides workload relief.

---

## Sprint Accountability Structure

**Process:** Structured sprint reviews with Donnie Yancey as external accountability partner.
Each sprint review covers: product progress, deployment timeline update, fundraising status.
Output: board-ready presentation slides summarizing progress.

**Current sprint priorities (in order):**
1. Dashboard ↔ backend full integration
2. MCP server final integration pass
3. End-to-end testing cycle
4. Iron Bank second follow-up email (Jeff Goluba)
5. QuBit Capital: send corrected deck v4 + honest traction summary
6. Apollo: update messaging to reflect current product scope
7. Board update presentation slides

---

## Action Items by Owner

### Souhimbou Kone
- [ ] Integrate and fully connect dashboard with backend components (deployment blocker)
- [ ] Complete MCP server final integration pass (primary channel blocker)
- [ ] Run end-to-end testing cycle (enterprise readiness gate)
- [ ] Send second follow-up to Jeff Goluba re: Iron Bank TRUFFLEHOG_CONFIG
- [ ] Send QuBit Capital corrected deck (v4) + one-page traction summary
- [ ] Update Apollo messaging to reflect current product scope
- [ ] Resume email drip campaigns post-product stabilization
- [ ] Prepare board update presentation (progress + timeline + fundraising)
- [ ] Follow up on CMMC documentation company partnership discussion

### External (Donnie Yancey / QuBit Capital)
- [ ] Donnie: Review AI-generated notes + summary for board update prep
- [ ] QuBit Capital: Next steps on deck review and investor introductions
