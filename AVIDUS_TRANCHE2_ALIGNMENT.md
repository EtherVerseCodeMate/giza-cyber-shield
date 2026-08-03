# Avidus Partnership — Grounded in Tranche 2 Unlock Requirements

**Date**: 2026-07-28 (updated to reflect the 2026-07 TRL10 remediation pass — see `PROJECT_STATUS.md`'s "TRL10 remediation update" section for the full list)
**Purpose**: The Avidus call brief (engineering capacity, design/brand capacity, ecosystem access) was written as a general partner-evaluation doc. This document re-grounds it against the actual state of the codebase — now audited across all three repos that make up the product (`giza-cyber-shield`, `Adinkhepra-ASAF`, `PQC-Khepra-MCP` — see `PROJECT_STATUS.md`, mirrored in all three) — and the LOI's specific, gated Tranche 2 requirements, so the call is spent probing the things that would actually move the milestone needle, not generic vendor diligence.

**Reality check on money available**: The LOI is not yet signed, and even once signed, only Tranche 1 ($100,000) is committed — released upon execution of definitive agreements (SSA/SHA), which follows Dubai LLC registration (25 days) and up to 60 days of due diligence. Tranche 2 ($300,000) is contingent on hitting the milestones below. **Scope every dollar of Avidus spend against Tranche 1's $100K, minus whatever legal/entity-registration/DD costs consume first** — do not plan against the full $400K.

---

## 1. Where the real gaps are (from `PROJECT_STATUS.md`, all three repos)

| Tranche 2 requirement | Status | What's actually missing | Is this an Avidus-shaped problem? |
|---|---|---|---|
| CMMC Compliance Graph Autopilot — GA | Partial: engineering complete in `giza-cyber-shield`, dollar-exposure gated off, no GA release. The public release repo (`Adinkhepra-ASAF`) only shows the graph against a hardcoded `DEMO_DAG` fixture and never uses the terms "blast radius"/"Autopilot" in its own UI. **Fixed 2026-07**: the fixture was source-commented as "real ASAF scan output" and its staging/approval/export buttons faked specific successful outcomes via `setTimeout`+`alert()` — both now honestly labeled as a UI preview with no real backend effect. The fixture-vs-live-backend gap itself is unchanged | Release engineering, un-gating/QA on the dollar-exposure feature, wiring the release repo's UI to a live backend instead of fixture data, a real GA announcement path — this is now the clearest remaining Track 1 ask on this item, since the mislabeling that was masking it is fixed | **Yes — Track 1** (QA/testing, release engineering), if their depth is real |
| Souhimbou Beta→GA + live billing + STIG console | **Billing fixed 2026-07**: both `giza-cyber-shield`'s and `PQC-Khepra-MCP`'s copies of `stripe_billing.go` now make a real Stripe Checkout Session call, with `/simulate-complete` gated behind a dev-mode env var. **Mock-data fixed 2026-07**: the Feb 2026 audit's dashboard findings, plus ~65 additional fabrication findings a follow-up TRL10 audit found, are now fixed with real backend calls or honest empty states. Still Beta-labeled; still no real credential-entry flow for several third-party integrations (DISA STIGs API, Open Controls) — these were previously hidden behind fabricated "connected" status and are now honestly visible as gaps instead | The remaining scoped ask is narrower than before: (a) remove/replace the stale Beta banner, (b) build real credential-entry UI for the 2–3 integrations that currently honestly report "not configured", (c) still worth consolidating the billing code into one shared implementation rather than two independently-maintained copies | **Yes — Track 1, but smaller than before.** The previous single highest-leverage ask (finish the billing stub) is done; what's left is real but more bounded work |
| Dubai subsidiary / active GCC engagement | Not started, zero references across all three repos | UAE entity registration (LOI §4) + a real GCC counterparty | **No.** Avidus is a US-based partner. Per the existing guardrail, nothing Avidus does can count toward this milestone — don't let it get discussed as if it could |
| 2 key hires (engineering + BD) | Not started — solo-founder pattern confirmed across all three repos (single committer identity in each; `MEMORY.md` lists hires as future targets) | Actual FTE or contractor onboarding | **No, structurally.** A services engagement is not a hire. If Avidus capacity is being mentally used to cover the "engineering function" gap, say so explicitly and get legal confirmation on whether it could ever count — don't assume it does |
| 3 DIB pilot contracts, $135K+ | Not started (0 signed) | Sales/BD pipeline | Only relevant via **Track 3** (ecosystem access) — and only if names are given, per the existing signal-check guardrail |
| $10K+ MRR | Not started ($0; 11 signups, 0 paid conversions per `docs/strategies/SPRINT_28_GTM_OCEANS11.md`) | Same billing dependency as the Souhimbou GA item above | **Yes, indirectly** — MRR literally cannot start accruing until the billing path above is finished |
| SDVOSB certification | Not started (VOSB status appears genuine and is corroborated in `Adinkhepra-ASAF`'s own marketing copy — Army Signal Corps 25S SATCOM, active Secret clearance; SBA cert not filed) | Legal/paperwork filing | **No.** Not Avidus's domain |

**New cross-repo wrinkle for the call**: `Adinkhepra-ASAF`'s actually-shipped checkout tiers are Advisory $5,000, Pilot $45,000/yr, Program Std $75,000/yr, Program Adv $120,000/yr, Enterprise $150,000–$250,000/yr — not the $0/$99/$499/mo SaaS figure the original brief cites for `souhimbou.ai`. That $0/$99/$499 figure exists only in a README table describing a *different* hosted product (`app.nouchix.com`). **Before scoping the souhimbou.ai Growth Pack with Avidus, confirm which product/pricing tier is actually being designed for** — the answer changes what "pricing page ($0/$99/$499) + product framing" in Track 2 priority #2 should even look like.

Separately, `PQC-Khepra-MCP` has real Iron Bank (`Dockerfile.ironbank`) and AWS GovCloud (`aws-govcloud/`) infrastructure that is *designed but not executed* — unchecked deployment checklist, placeholder secrets in the CloudFormation template. If Avidus's "Platform & Infrastructure" claim is real, this is a second concrete, checkable engineering ask beyond the billing fix — worth naming on the call alongside it.

---

## 2. Reframed priorities for the call

The original brief treated Track 1 (engineering) and Track 2 (design) as roughly parallel tracks to evaluate. Given the gap analysis above, they are not equally urgent:

1. **The billing stub and the Feb 2026 mock-data findings are now fixed in-house (2026-07)** — both were resolved before this Avidus engagement, so they're no longer available as the "prove your depth" test item they were in the original brief. **Track 1 engineering depth is still the real question, not Track 2 polish** — the test item has just moved. The clearest remaining scoped ask is finishing `Adinkhepra-ASAF`'s compliance-graph page: wiring its UI to a live backend instead of the (now honestly-labeled) `DEMO_DAG` fixture, since that's a real, bounded, checkable deliverable against a named Tranche 2 gate. Ask Avidus to quote against this directly, not against a generic capability pitch.
2. **The billing code is still duplicated across two repos, even though both copies are now individually correct.** Consolidating it into one shared implementation remains worth doing — not urgent anymore (neither copy fabricates results now), but still a maintenance-cost item worth naming if Avidus's engineering scope extends to it.
3. **If "Platform & Infrastructure" is real, there's a second concrete ask.** `PQC-Khepra-MCP`'s Iron Bank container hardening and AWS GovCloud CloudFormation are designed but not executed (unchecked checklist, placeholder secrets). Ask directly whether Avidus has done pre-launch DevOps/cloud security work of this specific kind — Iron Bank submission, GovCloud deployment — not generic "Platform & Infrastructure" support.
4. **Sequence Track 2 design spend, don't run it in parallel — and confirm which product it's for.** The $1,800 adinkhepra.com Scale Pack and $850 souhimbou.ai Growth Pack are affordable within Tranche 1, but:
   - Confirm which shipped product/pricing tier the souhimbou.ai work is actually for — `Adinkhepra-ASAF`'s live checkout charges DIB/enterprise tiers ($5K–$250K), not the $0/$99/$499/mo figure in the original brief, which describes a separate hosted product (`app.nouchix.com`). Scoping the wrong pricing model wastes the Growth Pack spend.
   - Don't let marketing sites claim GA status, live pricing, or capabilities ahead of what Gate 2 actually shows — a polished site advertising a "GA" product that's still Beta-labeled in its own UI, or a compliance-graph page still running on demo-fixture data, is a credibility risk with investors doing due diligence in the next 60–90 days.
   - The investor-deck valuation correction (pre-money **~$5.31M**, which is the actual math implied by the LOI's $5,714,286 post-money on $400K/7% — not the $7.3–7.5M figure flagged in the original brief) is a same-day, in-house fix. Don't pay Avidus's Scale Pack rate for a one-line number correction — do it before the call, and only use the Investor Deck line item for actual polish/refresh.
5. **Track 3 ecosystem-access claims are worth zero in the budget model until corroborated.** Nothing in the codebase or docs can verify Avidus's claimed investor/GCC connections. Apply the existing signal-check guardrail literally: if they can't name one or two portfolio companies they've actually connected to capital or GCC partners, price their "ecosystem access" at $0 of value in this engagement.
6. **State the exclusion out loud on the call.** Per the original guardrail, no Avidus engagement counts toward the Dubai/GCC milestone or the "2 key hires" milestone. Given the codebase shows both of those at zero progress across all three repos, there's a real temptation to want Avidus capacity to quietly cover the hiring gap. Don't let that happen implicitly — if the intent is ever to treat a long-term Avidus engineer as a stand-in for the "engineering hire" line, that needs to be a conscious, written decision with legal input on whether it would satisfy the LOI's plain language (it likely would not, since the milestone specifies "hires or full-time contractors onboarded," which arguably could include a dedicated FTE-equivalent contractor — but a project-scoped vendor engagement almost certainly does not qualify).

---

## 3. Illustrative Tranche 1 ($100K) allocation

Not exhaustive — legal and Dubai entity-registration costs are unknown-sized and come first by contractual necessity (LOI §4–§6):

| Line item | Est. cost | Why |
|---|---|---|
| Legal (SSA/SHA drafting, Dubai LLC registration) | Unknown, likely $10–25K | Contractually required before any of this matters |
| Engineering: `Adinkhepra-ASAF` compliance-graph live-backend wiring + real credential-entry flows for the 2–3 integrations flagged in the 2026-07 audit | ≤$15–20K, time-boxed | Billing completion and mock-data remediation were fixed in-house before this engagement — this is the next clear, scoped, checkable Track 1 deliverable against a real Tranche 2 gate |
| Design: adinkhepra.com Scale Pack + souhimbou.ai Growth Pack + investor deck refresh | ≤$3K | Sequenced *after* GA-status claims are accurate; valuation fix is free/in-house |
| Remainder: hiring runway | Largest remaining line | The "2 key hires" milestone is at zero and is the one gap no vendor engagement can substitute for — this should get priority over discretionary design/ecosystem spend |

---

## 4. Post-Call Decision Checklist (updated from the original brief)

- [ ] Engineering depth confirmed against the named gaps (compliance-graph live-backend wiring; real credential-entry flows for flagged integrations; billing-code consolidation across both repos if in scope; Iron Bank/GovCloud if Track 1 infra claims are pursued) — not generic capability claims. Note: billing completion and mock-data remediation, the original test items, were fixed in-house before this engagement
- [ ] Explicit written confirmation that Avidus scope excludes the GCC-partnership and "2 key hires" milestone lines
- [ ] Confirmed which product/pricing tier the souhimbou.ai design work targets (Adinkhepra-ASAF's shipped DIB/enterprise tiers vs. the $0/$99/$499 figure describing a different hosted product)
- [ ] Design spend sequenced behind accurate GA-status messaging (no site claims ahead of `PROJECT_STATUS.md` reality, across any of the three repos)
- [ ] Investor deck valuation corrected to ~$5.31M pre-money same week, in-house, independent of whether Avidus is engaged
- [ ] Ecosystem-access claims corroborated with named companies/investors, or priced at $0
- [ ] Scope agreement is time-boxed, not open-ended
- [ ] Pricing sensible relative to Tranche 1 ($100K), not the full $400K
- [ ] Hiring runway (the "2 key hires" milestone) is not deprioritized in favor of discretionary vendor/design spend

---

See `PROJECT_STATUS.md` for the full evidence-based scorecard this document is built on.
