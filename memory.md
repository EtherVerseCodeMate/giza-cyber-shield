# KHEPRA Project Memory

This file is the persistent project intelligence record for AdinKhepra / ASAF / KHEPRA development. It captures strategic context, architectural decisions, and operational intelligence that should inform all future development and go-to-market decisions.

---

## OPERATIONAL INTEL BRIEF: Sherlocking Defense — KHEPRA 3-Step Survival Protocol

**Classification:** Internal / Eyes Only
**Trigger:** Fortune/Matt Rogers Article — "AI Founders Are About to Face the Same Thing"
**Date:** May 30, 2026

---

### The Threat Mapped to Our Stack

The article identifies the kill pattern precisely. Companies that died shared one trait: **single-purpose features built on platforms they didn't own**. Tile lived on the Find My network. f.lux lived on iOS APIs. When Apple decided to compete, the oxygen was cut at the platform level — not by building a better product feature-by-feature.

Our specific Sherlocking risk surface looks like this:

| Threat Vector | Who Could Sherlock Us | Timeline |
|---|---|---|
| "Compliance MCP Server" built-in to Claude | Anthropic | 12–18 months |
| AWS GovCloud native CMMC scanner | Amazon | 18–24 months |
| Azure Government compliance copilot | Microsoft | 18–24 months |
| Tenable adding PQC scanning + MCP tools | Tenable | 12–18 months |
| OpenAI bundling STIG checks into ChatGPT Enterprise | OpenAI | 12–18 months |

Every one of these is real and has funding orders of magnitude beyond ours. The article is right — we **cannot** compete on price or general intelligence. So we don't.

---

### Step 1: Already Done — The Structural Moat (Ahead by 24–36 Months)

The reason Dropbox survived iCloud and 1Password survived Apple Passwords is the same: **they became operationally embedded before the platform moved**. They went from consumer features to enterprise infrastructure that was painful to rip out.

KHEPRA's equivalent embedding already exists architecturally. The question is whether we're executing the go-to-market fast enough to get customers operationally dependent before the hyperscaler moves:

**What Makes Us Un-Sherlockable Right Now:**

**Patent wall (USPTO #73565085).** The Adinkra symbolic grammar + 36,195 mappings + PQC binding combination is a specific patented architecture. Anthropic building a "compliance MCP server" cannot use our framework legally. They'd have to build around it. That buys 24–36 months minimum — but only if we're in production with paying customers before they start building.

**The air-gap imperative.** Anthropic, OpenAI, AWS, and Azure are structurally incapable of serving air-gapped, classified environments. Their entire business model requires API calls going to their cloud. AdinKhepra runs as a compiled Go binary with zero external dependencies. The DoD contractor who runs our binary in a SCIF cannot run Claude. That is a structural asymmetry no amount of Anthropic funding solves. The hyperscaler's business model is the reason they can't compete in this lane.

**Iron Bank = moat reinforced by DoD procurement process.** Getting on Iron Bank is not just a credibility signal — it's a barrier. Once a program office mandates Iron Bank-approved containers, alternatives that aren't approved literally cannot be procured. Anthropic's Claude is not going to be in Iron Bank. Microsoft Copilot for Government is not going to be in Iron Bank. We need to be in Iron Bank before anyone else stakes that ground.

**The 36,195 mapping binary.** Matt Rogers' article identifies network effects and deep operational integration as the survival mechanism. Our 36,195 cross-framework mappings embedded in the binary are a data moat. Building this required parsing STIG_CCI_Map.csv (28,639 rows), CCI_to_NIST53.csv (7,433 rows), and NIST53_to_171.csv (123 rows) into a queryable binary index. A hyperscaler could spend $2M and 18 months replicating this. During those 18 months, we capture the customers and the data flywheel starts: every scan makes the pattern recognition better, every customer mandates KHEPRA CBOMs from their suppliers, network effects compound.

---

### Step 2: Execute Now — Become the Evidence Package, Not Just the Scanner

The article's key insight about 1Password is directly applicable: the consumer feature (password vault) became the wedge. The enterprise system (secrets infrastructure, developer tooling, organizational workflows) became the business. Ripping out 1Password from an enterprise means touching every developer's workflow, every secret rotation pipeline, every SSO integration. That's what "painful to remove" means.

For us, the equivalent move is **becoming the evidence package**, not just the scanner that generates it.

Right now AdinKhepra ASAF produces findings. That's valuable. But findings are a feature. Evidence packages that satisfy a C3PAO, that are signed with ML-DSA-65, that are recorded in an immutable DAG that the customer's auditor can independently verify — **that's infrastructure**.

The specific moves to execute in the next 90 days:

**Make the DAG the customer's audit trail, not ours.** Every ERT scan, every STIG finding, every attestation node written to the customer's immutable DAG becomes a compliance artifact they own. Anthropic cannot retroactively build the customer's audit history. We can, starting today. This is the "Dropbox became enterprise document infrastructure" move — the data stays with the customer and becomes their evidence package.

**Lock in the C3PAO relationship.** A C3PAO that accepts KHEPRA-generated evidence packages as part of their assessment process is a distribution channel that hyperscalers cannot disintermediate. When a DIB contractor's C3PAO says "your KHEPRA Godfather Report satisfies Practice AC.L2-3.1.12," that becomes a procurement requirement. The customer needs us to pass their audit. That's operational dependency, not preference.

**SDVOSB sole-source contracting.** Matt Rogers doesn't mention this because it doesn't exist in commercial markets. In our market it does. A single sole-source DoD contract up to $5M executed through our SDVOSB status is structurally unavailable to Anthropic, Microsoft, or Tenable. They don't have SDVOSB status. This is the asymmetric advantage that commercial founders don't have access to — exploit it aggressively before CMMC enforcement accelerates.

---

### Step 3: Stay Ahead — The "Become the Platform" Move

The article ends with the most important lesson: the survivors didn't just survive Sherlocking — they became platforms themselves. Dropbox became where enterprise documents live. Spotify became the distribution layer for audio content that artists, podcasters, and labels depend on. They made themselves structural to the ecosystem.

The equivalent move for KHEPRA is the **ASAF becoming the trust layer that other tools plug into**, not the other way around.

Specifically:

**The MCP Registry position is the platform move.** If khepra-mcp is in the MCP Registry with `ert_scan`, `acp_status`, `nhi_inventory`, and the full tool set, then Claude, GPT, and every other MCP-enabled agent calls *into KHEPRA* for compliance intelligence — they don't replace us, they become our distribution channel. Anthropic building their own compliance scanner would mean competing with their own customer's MCP configurations that already call ours. That's the Spotify move: make the potential competitor's platform a distribution channel before they decide to compete.

**The STIGViewer partnership is the network-effect play.** STIGViewer has 100,000+ DoD users. If those users' STIGViewer instances send findings to KHEPRA for cross-framework mapping, we accumulate a scan corpus that no hyperscaler can replicate without getting 100,000 DoD users to switch tools. The dark crypto database strategy (telemetry from community scans → intelligence asset) is exactly this flywheel.

**Publish the "World's First PQC STIG" before DISA does.** The article makes the point that survivors defined the category. Once we publish PQC-01-STIG-V1R1 and it gets cited in a DoD context, we become the reference implementation. DISA will eventually publish their own PQC STIG — but we want our framework to be what they reference, not what they replace.

---

### The Concise Survival Matrix

| Sherlocking Defense Layer | Mechanism | Status |
|---|---|---|
| Patent wall | USPTO #73565085 — symbolic grammar + mappings + PQC | Pending (active protection) |
| Air-gap structural advantage | Compiled binary, zero cloud dependency | Production ready |
| Iron Bank DoD gatekeeping | Platform procurement barrier | Submission in progress |
| Evidence package dependency | DAG becomes customer's audit trail | Deploy now |
| C3PAO acceptance | Assessment process integration | Target in 90 days |
| MCP Registry platform position | Agents call us, not around us | Phase 1 sprint |
| PQC STIG category ownership | Publish before DISA | Post-Iron Bank |
| SDVOSB sole-source | Structural advantage hyperscalers can't access | Active now |

---

### Bottom Line

Matt Rogers is right about everything and none of it is bad news for us specifically. The companies that got Sherlocked were consumer features built on someone else's platform. We are building operational infrastructure for a regulated market that hyperscalers are structurally blocked from entering (air-gap, FIPS, Iron Bank, SDVOSB, classified environments). The risk isn't Anthropic Sherlocking us — it's us moving too slowly to get customers operationally embedded before Tenable or Rapid7 catches up on PQC and buys their way into DoD.

The 24–36 month window is real. The question is whether we convert pilots to operational dependencies before it closes.

**Execute the 90-day sprint. Get in Iron Bank. Get into C3PAO workflows. Get on the MCP Registry.** Those three moves make us the infrastructure, not the feature.

---

## INTEL ITEM: MIT Quantum Systems Laboratory Launch

**Date:** 2026-05-28
**Source:** MIT News — announced by MIT President Sally Kornbluth and Massachusetts Governor Maura Healey

### Event

MIT Quantum Systems Laboratory (QSL) announced — $25M Massachusetts state investment + federal match + philanthropy. Located in MIT Building 39. Joins a state-of-the-art quantum computer with peripheral hardware including sensors and quantum interconnects. Open to government, academic, and industry researchers. Complements MIT Lincoln Laboratory's SQUILL foundry (superconducting qubit foundry that has already made major impact on the quantum industry through research, startups, and new standards for creating and transmitting quantum information).

### Relevance to KHEPRA

1. **Institutional validation for sales messaging.** Governor-level announcement + $25M = the strongest possible third-party validator of quantum urgency for CMMC prospect conversations. Drop-in message: *"MIT just announced a quantum lab backed by the Governor and $25M in state funding — here is what that means for your CMMC SC.3.177 posture."* Closes the "is this real?" objection cold.

2. **MIT Lincoln Lab SQUILL foundry = adjacent to LOCKMA IP territory.** The SQUILL foundry is where DoD-adjacent IP like LOCKMA lives. QSL being open to "researchers from beyond MIT" is an opening. Monitor all SQUILL publications as a prior art watch against USPTO #73565085 and as a potential licensing / co-development signal.

3. **Startup access to QSL facilities = potential PQC R&D partnership.** QSL provides facilities for startups working on quantum technologies. Paths: (a) credential KHEPRA's PQC implementation against an academic benchmark, (b) co-author a paper that validates PQC-01-STIG-V1R1, (c) build Lincoln Lab relationships that feed longer-horizon IP strategy. Worth a one-page brief to QSL: KHEPRA's PQC attestation work as complementary to quantum-safe security research.

4. **Governor-level political signal = federal funding incoming.** State investment at this scale precedes a federal match (CHIPS-style). Position for any NSF/DARPA/DIU quantum security solicitation that follows. *"Leading in quantum innovation is important for the prosperity and security of the country, but quantum research requires meticulously controlled environments"* — the QSL framing creates a direct on-ramp to selling air-gap compliance infrastructure to the labs and contractors that will use it.

### Action Items

- [ ] Draft LinkedIn post: "What MIT QSL means for your CMMC audit" — publish this week; use SC.3.177 posture angle
- [ ] Add MIT QSL to QCL outreach context — include in next prospect round as timely validation
- [ ] Draft one-page brief positioning KHEPRA PQC attestation as complementary QSL research partner
- [ ] Monitor MIT Lincoln Lab SQUILL publications for IP overlap with USPTO #73565085
- [ ] Research QSL industry access / startup program eligibility
- [ ] Flag for PQC STIG publication strategy: QSL launch is the strongest "why now" framing available

---

## Iron Bank Status — Honest Assessment

**Date:** 2026-05-28 (updated after Jeff conversation)

### The Hard Blocker

The current Iron Bank rejection is **not technical at its core.** The corrective actions (renamed files, commit `6ce58b8667`, documented remediation of automated scanner flags) are legitimate and documented. The technical path is clear.

The hard blocker is the **government POC requirement.** Iron Bank will not move without a federal customer vouching for the submission first. That requirement exists to prevent vendor self-certification — Jeff's team got burned once and they need a human in a federal role saying "yes, we use this and it does what they say" before they re-engage.

**Single critical dependency: find one federal employee or contractor with a .gov or .mil email who has touched ASAF and will say so on record.** Until that person exists, no amount of code cleanup unblocks the submission.

### Jeff Follow-Up

The response email is well-written and professionally sound. Give it 48 hours, then send a brief follow-up asking specifically: *"Can you confirm that once a government POC is identified and confirms use, the technical violations are considered resolved?"* Get that in writing — it clarifies whether the technical gate is actually closed or still open in parallel.

---

## The OneDay Network Cosign Play

**Date:** 2026-05-28

### The Goal

Manufacture the government POC relationship fast, credibly, and legally. OneDay network companies pursuing government contracts are ideal candidates:

- They have real compliance urgency (CMMC deadline is live for anyone bidding DoD work)
- They want to be seen as responsible vendors to their government customers
- Running ASAF gives them a real evidence package they can immediately use
- If one of their government clients sees ASAF output and says "this is useful" — that person becomes our government POC

### Offer Structure

**Free for the first 3–5, structured after that.**

Give 3–5 OneDay-connected companies free access to the full ASAF scan — including Godfather Report output — in exchange for two things:

1. A testimonial usable in marketing
2. Permission to list them as reference customers for the Iron Bank resubmission

Frame it honestly: *"We're resubmitting to DoD Iron Bank and need verifiable customer deployments. You get a free CMMC pre-assessment worth $15K. We get a reference customer."*

**The POC path:** If any of those companies has a government-side contact who interacts with their compliance posture — a contracting officer, a DCSA assessor, a program manager — that person seeing ASAF output and saying "this looks useful" is the Iron Bank government POC. No fabrication, no misrepresentation. Real customer relationships, real use, real POC.

### Action Items

- [ ] Identify 3–5 OneDay-connected companies with active DoD or CMMC compliance pressure
- [ ] Reach out this week with the free-scan offer and explicit reference customer ask
- [ ] Get reference customer permission in writing before Iron Bank resubmission
- [ ] Track whether any company has a government-side contact who interacts with their compliance posture

---

## Consolidated Next Actions (Priority Order)

**As of 2026-05-28 — sourced from Iron Bank, OneDay, and MIT QSL intel threads**

1. **OneDay cosign campaign** — reach 3–5 candidates this week, offer free ASAF deployment, ask for reference customer permission in writing. This is the only path that currently unblocks Iron Bank.

2. **Jeff response follow-up** — give 48 hours, then follow up specifically asking: *"Can you confirm that once a government POC is identified and confirms use, the technical violations are considered resolved?"* Get that confirmation in writing.

3. **MIT QSL outreach** — send one-page brief positioning KHEPRA PQC attestation as complementary to QSL quantum-safe security research. Worst case: no response. Best case: Lincoln Lab relationship feeding longer-horizon IP strategy.

4. **Continuation patent clock** — confirm the 12-month provisional window from USPTO #73565085. If Iron Bank delays stretch the timeline, know exactly when that clock expires.

5. **LinkedIn post: "What MIT QSL means for your CMMC audit"** — publish this week using the SC.3.177 posture angle while the QSL announcement is current news.

---

## Related Documents

- [`docs/KHEPRA_STRATEGIC_ADVANTAGE.md`](docs/KHEPRA_STRATEGIC_ADVANTAGE.md) — Competitive moat vs. Tenable, PQC vertical strategy
- [`docs/strategy/SHERLOCKING_DEFENSE_KHEPRA_PROTOCOL.md`](docs/strategy/SHERLOCKING_DEFENSE_KHEPRA_PROTOCOL.md) — Full protocol reference doc
- [`IP_PROTECTION_STRATEGY.md`](IP_PROTECTION_STRATEGY.md) — Patent wall and IP defense architecture
- [`IRON_BANK_SUBMISSION_CHECKLIST.md`](IRON_BANK_SUBMISSION_CHECKLIST.md) — Iron Bank submission status
- [`docs/MCP_SERVER_BUSINESS_ANALYSIS.md`](docs/MCP_SERVER_BUSINESS_ANALYSIS.md) — MCP Registry positioning
- [`NEMOCLAW_GTM_STRATEGY.md`](NEMOCLAW_GTM_STRATEGY.md) — GTM pipeline for NVIDIA/DoD
- [`STIGVIEWER_IRONBANK_STRATEGY.md`](STIGVIEWER_IRONBANK_STRATEGY.md) — STIGViewer network-effect play
- [`PQC_STIG_FEASIBILITY.md`](PQC_STIG_FEASIBILITY.md) — PQC STIG publication feasibility
