# Sherlocking Defense — KHEPRA 3-Step Survival Protocol

**Classification:** Internal / Eyes Only
**Trigger:** Fortune/Matt Rogers Article — "AI Founders Are About to Face the Same Thing"
**Date:** May 30, 2026

---

## The Threat Mapped to Our Stack

The article identifies the kill pattern precisely. Companies that died shared one trait: **single-purpose features built on platforms they didn't own**. Tile lived on the Find My network. f.lux lived on iOS APIs. When Apple decided to compete, the oxygen was cut at the platform level — not by building a better product feature-by-feature.

Our specific Sherlocking risk surface:

| Threat Vector | Who Could Sherlock Us | Timeline |
|---|---|---|
| "Compliance MCP Server" built-in to Claude | Anthropic | 12–18 months |
| AWS GovCloud native CMMC scanner | Amazon | 18–24 months |
| Azure Government compliance copilot | Microsoft | 18–24 months |
| Tenable adding PQC scanning + MCP tools | Tenable | 12–18 months |
| OpenAI bundling STIG checks into ChatGPT Enterprise | OpenAI | 12–18 months |

Every one of these is real and has funding orders of magnitude beyond ours. We **cannot** compete on price or general intelligence. So we don't.

---

## Step 1: Already Done — The Structural Moat (Ahead by 24–36 Months)

The reason Dropbox survived iCloud and 1Password survived Apple Passwords: **they became operationally embedded before the platform moved**.

**What Makes Us Un-Sherlockable Right Now:**

**Patent wall (USPTO #73565085).** The Adinkra symbolic grammar + 36,195 mappings + PQC binding combination is a specific patented architecture. Anthropic building a "compliance MCP server" cannot use our framework legally. They'd have to build around it. That buys 24–36 months minimum — but only if we're in production with paying customers before they start building.

**The air-gap imperative.** Anthropic, OpenAI, AWS, and Azure are structurally incapable of serving air-gapped, classified environments. Their entire business model requires API calls going to their cloud. AdinKhepra runs as a compiled Go binary with zero external dependencies. The DoD contractor who runs our binary in a SCIF cannot run Claude. That is a structural asymmetry no amount of Anthropic funding solves.

**Iron Bank = moat reinforced by DoD procurement process.** Once a program office mandates Iron Bank-approved containers, alternatives that aren't approved literally cannot be procured. Anthropic's Claude is not going to be in Iron Bank. Microsoft Copilot for Government is not going to be in Iron Bank.

**The 36,195 mapping binary.** Our 36,195 cross-framework mappings embedded in the binary are a data moat. Building this required parsing STIG_CCI_Map.csv (28,639 rows), CCI_to_NIST53.csv (7,433 rows), and NIST53_to_171.csv (123 rows) into a queryable binary index. A hyperscaler could spend $2M and 18 months replicating this. During those 18 months, we capture the customers and the data flywheel starts.

---

## Step 2: Execute Now — Become the Evidence Package, Not Just the Scanner

For us, the 1Password-style move is **becoming the evidence package**, not just the scanner that generates it.

Findings are a feature. Evidence packages that satisfy a C3PAO, signed with ML-DSA-65, recorded in an immutable DAG that the customer's auditor can independently verify — **that's infrastructure**.

### 90-Day Execution Moves

**Make the DAG the customer's audit trail, not ours.**
Every ERT scan, every STIG finding, every attestation node written to the customer's immutable DAG becomes a compliance artifact they own. Anthropic cannot retroactively build the customer's audit history. This is the "Dropbox became enterprise document infrastructure" move.

**Lock in the C3PAO relationship.**
A C3PAO that accepts KHEPRA-generated evidence packages as part of their assessment process is a distribution channel hyperscalers cannot disintermediate. When a DIB contractor's C3PAO says "your KHEPRA Godfather Report satisfies Practice AC.L2-3.1.12," that becomes a procurement requirement. The customer needs us to pass their audit.

**SDVOSB sole-source contracting.**
A single sole-source DoD contract up to $5M executed through our SDVOSB status is structurally unavailable to Anthropic, Microsoft, or Tenable. They don't have SDVOSB status. Exploit it aggressively before CMMC enforcement accelerates.

---

## Step 3: Stay Ahead — The "Become the Platform" Move

The survivors didn't just survive Sherlocking — they became platforms themselves.

The equivalent move for KHEPRA is **ASAF becoming the trust layer that other tools plug into**, not the other way around.

**The MCP Registry position is the platform move.**
If khepra-mcp is in the MCP Registry with `ert_scan`, `acp_status`, `nhi_inventory`, and the full tool set, then Claude, GPT, and every other MCP-enabled agent calls *into KHEPRA* for compliance intelligence — they become our distribution channel. That's the Spotify move: make the potential competitor's platform a distribution channel before they decide to compete.

**The STIGViewer partnership is the network-effect play.**
STIGViewer has 100,000+ DoD users. If those users' STIGViewer instances send findings to KHEPRA for cross-framework mapping, we accumulate a scan corpus that no hyperscaler can replicate without getting 100,000 DoD users to switch tools. The dark crypto database strategy (telemetry from community scans → intelligence asset) is exactly this flywheel.

**Publish the "World's First PQC STIG" before DISA does.**
Once we publish PQC-01-STIG-V1R1 and it gets cited in a DoD context, we become the reference implementation. DISA will eventually publish their own PQC STIG — but we want our framework to be what they reference, not what they replace.

---

## The Concise Survival Matrix

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

## Bottom Line

Matt Rogers is right about everything and none of it is bad news for us specifically. The companies that got Sherlocked were consumer features built on someone else's platform. We are building operational infrastructure for a regulated market that hyperscalers are structurally blocked from entering (air-gap, FIPS, Iron Bank, SDVOSB, classified environments).

The risk isn't Anthropic Sherlocking us — it's us moving too slowly to get customers operationally embedded before Tenable or Rapid7 catches up on PQC and buys their way into DoD.

The 24–36 month window is real. The question is whether we convert pilots to operational dependencies before it closes.

**Execute the 90-day sprint. Get in Iron Bank. Get into C3PAO workflows. Get on the MCP Registry.**

---

## Cross-References

- [`../../memory.md`](../../memory.md) — Project memory and full intel brief
- [`../KHEPRA_STRATEGIC_ADVANTAGE.md`](../KHEPRA_STRATEGIC_ADVANTAGE.md) — R&D moat vs. Tenable
- [`../../IP_PROTECTION_STRATEGY.md`](../../IP_PROTECTION_STRATEGY.md) — Patent wall architecture
- [`../../IRON_BANK_SUBMISSION_CHECKLIST.md`](../../IRON_BANK_SUBMISSION_CHECKLIST.md) — Iron Bank status
- [`../MCP_SERVER_BUSINESS_ANALYSIS.md`](../MCP_SERVER_BUSINESS_ANALYSIS.md) — MCP Registry positioning
- [`../../STIGVIEWER_IRONBANK_STRATEGY.md`](../../STIGVIEWER_IRONBANK_STRATEGY.md) — STIGViewer network effect
- [`../../PQC_STIG_FEASIBILITY.md`](../../PQC_STIG_FEASIBILITY.md) — PQC STIG publication path
