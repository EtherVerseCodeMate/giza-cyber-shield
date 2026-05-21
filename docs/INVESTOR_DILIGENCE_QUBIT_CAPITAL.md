# QuBit Capital — Post-Call Memo & Action Items
**Call date:** May 2026
**Participants:** Souhimbou Doh Kone (NouchiX), QuBit Capital analyst team
**Document type:** Internal diligence response — confidential

---

## Summary Judgment

QuBit Capital conducted a thorough diligence call that surfaced three material
misrepresentations from the pre-call pitch materials and four material corrections
that sharpen the honest company story. The product technology is real and verified.
The commercial story requires cleanup. All corrections are made below and reflected
in `docs/NOUCHIX_PITCH_DECK_V4.md`.

---

## Material Corrections (Must Fix Before Any Investor Meeting)

### 1 — "94% C3PAO Pass Rate" → REMOVE AS A NOUCHIX CLAIM

**What the original deck said:** Slides 7 and 12 cited "94% C3PAO pass rate" as a
NouchiX performance metric.

**What was confirmed on call (22:47):** No C3PAO assessor has accepted any
NouchiX-generated evidence package in an actual CMMC Level 2 assessment. The
"94%" figure was a projection, not a measured outcome. Cost barrier: ~$80K per
C3PAO engagement, which a bootstrapped company cannot fund pre-revenue.

**Correct framing:** The "94% audit failure risk" figure belongs in the PROBLEM
slide as an industry statistic (94% of DIB contractors are at risk of failing
CMMC audits). It must not appear as a NouchiX pass rate anywhere.

**Fix applied in v4:** Problem table uses "94% Audit Failure Risk" as a market
problem. NouchiX compliance posture section explicitly states: "No NouchiX-generated
evidence package has been submitted to or accepted by a C3PAO assessor in a live
CMMC Level 2 assessment yet. C3PAO validation is a funded milestone (Q1 2027)."

---

### 2 — "SOC2 Compliant" on Title Slide → REMOVE ENTIRELY

**What the original deck said:** Title slide listed "SOC2 Compliant" as a credential.

**What was confirmed on call (18:35):** NouchiX has not applied for SOC 2 Type I or
Type II certification. What the founder meant: the company uses SOC 2-compliant
infrastructure tooling (e.g., Supabase, cloud providers with SOC 2 certs). This
is standard for any startup using major cloud services — it is not a NouchiX cert.

**Correct framing:** Remove from all materials. Replace with "CMMC Level 1 self-certified."
ISO 27001 named as a future compliance target post-funding.

**Fix applied in v4:** SOC 2 claim does not appear. Compliance posture section on
Traction slide lists what NouchiX IS and IS NOT certified for, explicitly.

---

### 3 — "Pilot Program LOIs" as a Traction Credential → REMOVE

**What the original deck said:** Pilot Program LOIs listed as a credibility marker
in the traction section.

**What was confirmed on call (12:59, 14:45):** One early pilot was initiated with a
company, then voluntarily paused because the software needed to be revamped.
LinkedIn and QCL outreach campaigns were intentionally held pending that revamp.
**There are no active pilots, no signed LOIs, and no advanced-stage prospects today.**

**Correct framing:** "Seeking first pilots. One early-stage pilot was started and
voluntarily paused for software revamp. Binary is now deployment-ready. 3 pilot LOIs
targeted by Q3 2026." Voluntary pause for quality purposes is defensible — presenting
it as current traction is not.

**Fix applied in v4:** Pilot slide updated with accurate language. LOIs are goals
only, not current credentials.

---

## Material Additions (Strengthen the Story)

### 4 — Company Formation: Clean Delaware C-Corp

SecRed Knowledge Inc. incorporated as a Delaware C-Corp on January 2, 2024.
Operating as a foreign entity in New York State. Standard clean formation for
institutional investment. Added to Slide 16 team bio.

### 5 — Patent Notification: Active (Not Just "Pending")

USPTO notification received week of April 22, 2026. Patent #73565085 is
active in examination. 12 continuation claims that can be developed into
distinct products (post-quantum key management system named as one Year-2 candidate).

**Note:** FIPS 140-3 specific alignment was not addressed on the call. If investors
ask, the honest answer is: CIRCL v1.6.3 implements NIST FIPS 203/204 algorithms
(ML-KEM, ML-DSA). FIPS 140-3 *module* validation (the lab certification process)
has not been pursued. This is different from algorithm compliance.

### 6 — MVP Scope: Correctly Defined

The current MVP is: **digital forensic audit trail for compliance purposes.**
Customers download a binary, run audits, and generate immutable evidence signed
with ML-KEM + ML-DSA (NIST PQC standards). Product is deployment-ready with
finishing touches remaining. This is the right positioning — not "full autonomous
CMMC autopilot." The evidence trail is the value, PQC signing is the moat.

### 7 — STIG Coverage: Full Spectrum via Partnership

STIGViewer partnership provides free API access to the full DISA STIG database.
The internal mapping DB (36,195 rows: STIG→CCI→NIST 800-53→800-171→800-172)
is maintained and ingested into the software. The platform is designed to cover
the full spectrum of DISA STIG benchmarks. Confirmed at call 20:30.

---

## Founder Bandwidth — How to Handle in Meetings

**What was disclosed (25:29, 27:24, 30:25):**
- Solo founder — no CTO, no full-time engineers, no in-house security practitioners
- Was simultaneously enrolled in MBA + M.S. Digital Forensics (both programs)
- Preparing a TED Talk
- Described pursuing acting / film work

**Investor concern:** This signals distraction and raises questions about full-time
commitment to the company.

**Honest resolution available:**
- Both master's programs completed May 2026. This bandwidth drain is resolved.
- The MBA and M.S. Digital Forensics are additive credentials for the company's
  positioning in the defense market (MBA = commercialization; Digital Forensics =
  product credibility). Frame as "founder's academic credentials are complete and
  reinforce the product domain."
- For TED Talk: if it's a DoD/cybersecurity topic, it is market-building; frame it
  that way rather than hiding it.
- For acting/film: do not bring this up in investor meetings. It will not help.

**What to say when asked about bandwidth:**
> "Both graduate programs completed May 2026 — I'm full-time on NouchiX from this
> point. First use of pre-seed funds is the Security Engineer hire, which immediately
> expands the team. The CTO role is the second hire. We go from solo to three within
> 90 days of close."

---

## Advisory Board — Gap to Address

**Confirmed (24:15):** Advisory board today consists of MBA mentor, STIGViewer
contact, and UAlbany professor. No specific names or time commitments disclosed.

**Gap:** No C3PAO practitioner, no DISA/DoD insider, no prime contractor affiliate,
no named cybersecurity executive.

**Recommended additions before Series A:**
- One C3PAO-certified assessor (gives credibility on the evidence package design)
- One Army/DoD cybersecurity program office alumni (connects to CPE ES2 outreach)
- One CMMC-AB registered advisor (validates compliance claims to institutional investors)

These do not need to be in place for the pre-seed close, but should be named as
"advisors being recruited" rather than listed as TBD with no names.

---

## Funding Structure Confirmed

| Parameter | Detail |
|-----------|--------|
| Instrument | SAFE (preferred); open to direct equity for strategic investors |
| Initial target | $200K pre-seed |
| Step-up trigger | First signed pilot contract |
| Step-up amount | $1M |
| Investor profile | Angels, HNIs, micro-VCs, family offices |
| Sector focus | Cybersecurity, defense tech, dual-use, industrial IoT, govtech |
| Geography | US + NATO countries |

---

## QuBit Capital Status

**Status:** Post-call diligence phase. No term sheet issued.

**What they saw:** Strong technology foundation, real PQC implementation, clear
market timing. Three material pitch deck misrepresentations identified (flagged above).
Founder bandwidth and solo team are open diligence questions.

**What needs to happen before a follow-up:**
- [ ] Send QuBit the corrected deck (v4 with all three fixes applied)
- [ ] Prepare a one-page "honest traction" summary: what's live, what's targeted
- [ ] Prepare founder bandwidth answer (both degrees done, full-time from May 2026)
- [ ] Name at least one specific C3PAO / CMMC advisor being recruited

---

## Claims Map — What to Say vs. What to Remove

| Original Claim | Status | Replacement Language |
|---------------|--------|---------------------|
| "94% C3PAO pass rate" | REMOVE from NouchiX claims | "94% DIB contractor audit failure rate (industry problem we solve)" |
| "SOC2 Compliant" | REMOVE entirely | "CMMC Level 1 self-certified. SOC2 is a post-funding target." |
| "Pilot Program LOIs" as traction | REMOVE as credential | "Seeking first pilots. 3 LOIs targeted Q3 2026." |
| "47 defense contractors secured" | REMOVE | Not in v4 deck |
| "500+ defense systems secured" | REMOVE | Not in v4 deck |
| "SDVOSB certified" | CORRECTED | "SDVOSB-Eligible (certification in progress)" |
| "80,600+ lines Go" | CORRECTED | "85,500+ lines Go (verified)" |
| "9 RHEL-09 controls" | CORRECTED | "8 live controls; framework supports 291+" |
| "SCORPION HMAC" | CORRECTED | "SCORPION AES-256-GCM ceremony (Argon2id KDF)" |
| "Iron Bank submission complete" | CORRECTED | "Manifest complete; pipeline unblock pending admin action" |
