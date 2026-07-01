# AdinKhepra ASAF — The CMMC Quran
## Complete User Journey: From First Login to C3PAO Certification
**SecRed Knowledge Inc. / NouchiX — CONFIDENTIAL**

**Version 2.0 | Corrected Edition**
**Supersedes:** CMMC Bible v1.0
**Source docs:** NIST SP 800-171r3, CMMC AG Level 2, CMMC Scoping Guide Level 3, NIST SP 800-172, live binary verification (`adinkhepra validate`, 2026-06-27)

---

## CHANGE LOG FROM v1.0 → v2.0

| # | Issue | v1.0 | v2.0 Fix |
|---|---|---|---|
| 1 | Control mapping count | 36,195 (raw pre-dedup CSV sum) | **25,185** (deduplicated, what actually loads at runtime) — cited everywhere, with footnote explaining the delta |
| 2 | Phase structure | Narrative sequence only | Added **formal state machine** (§0.6) with explicit gate conditions and required DAG nodes per transition |
| 3 | Data model | Scattered inline JSON/Go snippets per phase | Added **canonical data model** (§0.5) — one source of truth referenced by type name throughout |
| 4 | Error handling | Happy-path only | Added **error states and unhappy paths** to every phase |
| 5 | APDL language | One example, no grammar | Added **full language specification** (§9) |
| 6 | Sephirot/Merkaba in UI | Internal labels bled into CISO-facing mockups | Added **Presentation Layer Translation Table** (§10) — internal model stays internal |
| 7 | Scale envelope | Unaddressed | Added **§11: Scale & Performance Envelope** |
| 8 | STIG coverage claim | Implied "complete" | Corrected to state actual coverage: 9 of 291+ RHEL-09 controls live, pattern established for remainder |

---

## PREAMBLE: THE PHILOSOPHY

AdinKhepra ASAF answers exactly one question: **Will I pass my CMMC audit?**

Every feature, every screen, every button in this product exists to move the user closer to "yes" — or to give them an honest "no" with a specific remediation path. Nothing else matters.

The CMMC journey has a beginning (ignorance of your compliance posture) and an end (a signed, dated, C3PAO-accepted evidence package). This document is the complete map between those two points. Every UX screen maps to a real step in the official CMMC assessment methodology (CMMC AG Level 2 V2.0 FINAL).

The user is not a compliance expert. They are a CISO, a Contracts Officer, or a System Administrator who got handed a DFARS 252.204-7012 clause and told "you have 18 months." This product must be their expert.

**This is the platform's ASAF product surface only.** SouHimBou AI (the agentic SOC product) and PQC-MCP (the agent channel) are separate products with separate buyer narratives and are documented elsewhere. Do not conflate them in this document or in any customer-facing material.

---

## REGULATORY FOUNDATION

### What CMMC Actually Is

CMMC (Cybersecurity Maturity Model Certification) is a DoD program that enforces cybersecurity requirements for Defense Industrial Base (DIB) contractors who handle:

- **FCI** (Federal Contract Information): Any information provided by or generated for the Government under a contract, not intended for public release.
- **CUI** (Controlled Unclassified Information): Information the Government creates or possesses that requires safeguarding per law, regulation, or policy.

### The Three Levels

| Level | Practices | Applies To | Assessment |
|-------|-----------|-----------|-----------|
| CMMC Level 1 | 15 practices (FAR 52.204-21) | Contractors who handle FCI only | Annual self-assessment |
| **CMMC Level 2** | **110 practices (NIST SP 800-171r3)** | **Contractors who handle CUI** | **C3PAO third-party assessment (every 3 years)** |
| CMMC Level 3 | 110 + 24 additional (NIST SP 800-172) | Critical programs (DARPA, nuclear, special access) | DIBCAC government assessment |

**Our target buyer is Level 2.** The Pilot-tier customer ($45K–$55K/yr) is a DIB contractor with a DoD prime contract containing DFARS 252.204-7012 who handles CUI.

### The Compliance Clock (Why This Is Urgent)

| Phase | Date | Trigger |
|-------|------|---------|
| Phase 1 | March 2026 | CMMC required for contracts with Level 1/2 requirements |
| **Phase 2** | **October 2026** | **ALL new DoD contract awards require CMMC certification** |
| Phase 3 | October 2027 | All DoD contract renewals and options require CMMC |

The October 2026 deadline is the buying trigger. Every Level 2 contractor without a C3PAO assessment booked is at risk of losing their DoD contract revenue.

### The CMMC Assessment Methodology (How C3PAOs Actually Grade)

The CMMC Assessment Guide Level 2 defines three assessment methods for each practice:

1. **Examine** — Review documentation (policies, procedures, plans, SSP, logs)
2. **Interview** — Talk to responsible personnel
3. **Test** — Observe the mechanism in operation (technical verification)

Each of the 110 practices has specific assessment objectives. A practice is evaluated as:
- **MET** — Evidence satisfies all objectives
- **NOT MET** — Evidence does not satisfy one or more objectives
- **NOT APPLICABLE** — Legitimately excluded (rare, requires documentation)
- **NOT REVIEWED** — Deferred to POA&M (allowed in limited cases)

**SPRS Score Calculation:**
- Start at 110 points
- Each NOT MET practice deducts its SPRS weight (1, 3, or 5 points)
- Practices scored by DoD impact: 5-point items are high-impact (AC, IA, SC, SI)
- Score range: -203 (all fail) to 110 (all pass)
- Submitted to SPRS (Supplier Performance Risk System) at sprs.apps.mil

---

## §0.5 CANONICAL DATA MODEL

**This section is the single source of truth for every struct referenced elsewhere in this document.** Other sections reference these types by name — they do not redefine them.

### Core Types

```go
// Asset — a system, host, or cloud resource in the compliance scope
type Asset struct {
    ID              string    // UUID
    Hostname        string
    IPAddress       string
    Category        AssetCategory // enum: CUIAsset | SecurityProtectionAsset |
                                    //       ContractorRiskManaged | SpecializedAsset |
                                    //       OutOfScope
    OS              string
    STIGProfile     string    // e.g. "RHEL-09-STIG-V1R3"
    DiscoveryMethod string    // "sonar" | "agent" | "cloud_api" | "manual_import"
    ClassifiedAt    time.Time
    DAGNodeID       string    // reference to the asset/Chesed node
}

// Finding — a single control check result
type Finding struct {
    ID           string  // STIG ID, e.g. "SV-257777r925318_rule"
    Title        string
    Description  string
    Severity     Severity // enum: CAT1 | CAT2 | CAT3
    Status       FindingStatus // enum: Met | NotMet | NotApplicable | NotReviewed
    SPRSWeight   int     // 1, 3, or 5
    AssetID      string  // FK to Asset
    CMMCPractice string  // e.g. "AC.L2-3.1.1"
    References   []string // cross-references from the 25,185-mapping DB
    CheckedAt    time.Time
    DAGNodeID    string  // reference to the finding/Tiphereth node
}

// ChangeRequest — a proposed or executed remediation action
type ChangeRequest struct {
    AgentID   string   // Nkyinkyim-bound Adinkra identity
    Symbol    string   // "Eban" required for kernel-level operations
    ControlID string   // STIG/CMMC control this serves (e.g. "SC-13")
    Command   []string // e.g. ["sysctl", "-w", "crypto.fips_enabled=1"]
    Signature []byte   // ML-DSA-65 over Command + timestamp
    Staging   bool     // true = mirror environment only, false = production
    DAGParent string   // proves chain of custody
}

// POAMItem — a plan-of-action-and-milestones entry
type POAMItem struct {
    ID              string
    FindingID       string  // FK to Finding
    Milestones      []Milestone
    ResponsibleRole string
    TargetDate      time.Time
    EffortHours     int
    Status          POAMStatus // enum: Open | InProgress | Closed
    DAGNodeID       string
}

type Milestone struct {
    Description string
    TargetDate  time.Time
    Completed   bool
}

// SSPSection — one of the 14 control-family sections of the System Security Plan
type SSPSection struct {
    Family                 string // e.g. "AC" (Access Control)
    Practices               []PracticeImplementation
    ResponsibleRole         string
}

type PracticeImplementation struct {
    PracticeID              string // e.g. "AC.L2-3.1.1"
    ImplementationNarrative  string
    ResponsibleRole          string
    Status                   FindingStatus
    POAMRef                  string // if not met
}

// EvidencePackage — the Phase 8 deliverable
type EvidencePackage struct {
    OrganizationName string
    CAGECode         string
    AssessmentDate   time.Time
    SPRSScore        int
    SSP              []SSPSection
    Findings         []Finding
    POAMItems        []POAMItem
    DAGChainExport   string // path to signed DAG export
    OSCALPath        string
}
```

### Enumerations

```go
type AssetCategory string
const (
    CUIAsset                AssetCategory = "cui_asset"
    SecurityProtectionAsset AssetCategory = "security_protection_asset"
    ContractorRiskManaged   AssetCategory = "contractor_risk_managed"
    SpecializedAsset        AssetCategory = "specialized_asset"
    OutOfScope              AssetCategory = "out_of_scope"
)

type Severity string
const (
    CAT1 Severity = "cat1" // SPRS weight 5
    CAT2 Severity = "cat2" // SPRS weight 3
    CAT3 Severity = "cat3" // SPRS weight 1
)

type FindingStatus string
const (
    Met            FindingStatus = "met"
    NotMet         FindingStatus = "not_met"
    NotApplicable  FindingStatus = "not_applicable"
    NotReviewed    FindingStatus = "not_reviewed"
)

type POAMStatus string
const (
    Open       POAMStatus = "open"
    InProgress POAMStatus = "in_progress"
    Closed     POAMStatus = "closed"
)
```

**Note on control mapping count:** The compliance database embeds **25,185 control mappings** (STIG + NIST 800-171r2 + CMMC 2.0), verified via live `adinkhepra validate` output. This number supersedes any reference to 36,195 elsewhere — 36,195 is the raw pre-deduplication row sum across the three source CSVs (`STIG_CCI_Map.csv`: 28,639 rows; `CCI_to_NIST53.csv`: 7,433 rows; `NIST53_to_171.csv`: 123 rows); 25,185 is what actually loads into the queryable database after deduplication. Cite 25,185 in all customer-facing and evidence-package contexts.

---

## §0.6 PHASE STATE MACHINE

The eight phases are not a loose narrative — they are a formal state machine with explicit gate conditions. A phase cannot begin until its predecessor's gate condition is satisfied and the required DAG node exists.

| From Phase | To Phase | Gate Condition | Required DAG Node |
|---|---|---|---|
| — (start) | 1 (Scope) | License activated, organization profile complete | `meta_governance/Keter` — license activation node |
| 1 (Scope) | 2 (Discover) | Scope boundary map signed; every network segment/cloud account has a category or out-of-scope justification | `meta_governance/Keter` — scope-declared node |
| 2 (Discover) | 3 (SSP) | All discovered assets classified — **zero remaining `UNKNOWN`** | `asset/Chesed` nodes for 100% of inventory |
| 3 (SSP) | 4 (Baseline) | SSP completion gate 100% (all 110 practices have implementation narratives; system owner signed off) | SSP OSCAL export, signed |
| 4 (Baseline) | 5 (POA&M) | Baseline scan complete; SPRS score computed and stored | Scan-completion node with SPRS score attribute |
| 5 (POA&M) | 6 (Remediate) | Every NOT MET 5-point (CAT1) practice has ≥1 POA&M item with a milestone and a responsible role | POA&M signed node |
| 6 (Remediate) | 7 (Readiness) | **Hard gate:** all CAT1 (5-point) practices are MET | Remediation DAG chain, one attestation node per closed CAT1 finding |
| 7 (Readiness) | 8 (Evidence) | Readiness checklist 100% — no ❌ items remaining | Godfather Report generated and signed |

**Backward transitions are permitted at any point** (e.g., discovering a new asset during Phase 6 sends the user back through Phase 2→3 for that asset only) but do not roll back completed DAG nodes — the DAG is append-only, so a correction is a new node, never an edit.

**A user cannot skip forward.** The UI must disable navigation to any phase whose gate condition is unmet, with an inline explanation of what's missing (see §Error States below).

---

## THE EIGHT-PHASE CMMC JOURNEY

```
Phase 1: SCOPE        → Define your CMMC boundary
Phase 2: DISCOVER     → Agentic asset inventory
Phase 3: SSP          → System Security Plan authoring
Phase 4: BASELINE     → Initial compliance scan (sets SPRS baseline)
Phase 5: POAM         → Plan of Action and Milestones
Phase 6: REMEDIATE    → Fix gaps (ASAF Daemon + staging gate)
Phase 7: READINESS    → Pre-assessment gate check
Phase 8: EVIDENCE     → C3PAO package generation

Each phase produces signed DAG nodes.
The Compliance Graph visualizes the complete journey in real-time.
```

---

## PHASE 0: ONBOARDING (First Launch Experience)

### Trigger
User downloads and runs the installer. License key received from NouchiX.

### UX Flow

**Screen 0.1 — License Activation**
```
+--------------------------------------------------+
| AdinKhepra ASAF                                  |
| Sovereign CMMC Autopilot Engine                  |
|                                                  |
| License Key: [_________________________________]  |
| Organization: [_________________________________] |
| Contract # (CAGE): [_____________________________]|
|                                                  |
| [Activate License]                               |
+--------------------------------------------------+
```
- License key is ML-DSA-65 verified against machine ID (hardware-bound)
- CAGE code links to SAM.gov for DoD contractor verification
- Activation writes a signed DAG node: `meta_governance / Keter` level
- **Zero egress**: verification is offline against embedded public key

**Screen 0.2 — Organization Profile**
```
Organization Name:        [SecRed Knowledge Inc.         ]
Primary CAGE Code:        [7XYZ1                         ]
CMMC Target Level:        [● Level 2]  [ ] Level 1  [ ] Level 3
Handling CUI Since:       [2024-01-15  ]
Prime Contractor:         [                              ]
Prime Contract Number:    [                               ]
DFARS Clause:             [● 252.204-7012] [● 252.204-7019]
Assessment Target Date:   [2026-10-01  ]
C3PAO Assigned:           [________________] (or "Not yet assigned")
```

**Screen 0.3 — CMMC Education Gate**
For first-time users only. Brief mandatory orientation covering:
- What is CUI? (with examples relevant to their industry)
- The 14 CMMC control families (brief overview)
- What a C3PAO will actually examine, interview, and test
- The SPRS score and why it matters
- Estimated time to complete each phase

This establishes the mental model before the user sees any technical controls.

### Error States — Phase 0

| Condition | UX Behavior |
|---|---|
| License key invalid or expired | Block activation. Show: "This license key is invalid or expired. Contact support@nouchix.com." No partial state saved. |
| CAGE code doesn't resolve on SAM.gov (offline environment) | Warn but do not block: "Could not verify CAGE code against SAM.gov (no network access — expected in sovereign deployments). Proceeding on your declaration." Log to DAG as `unverified_cage` attribute. |
| Machine ID changes after activation (e.g., VM clone/migration) | Require re-activation. Do not silently re-bind — this is a licensing integrity event, logged and requiring explicit user action. |

---

## PHASE 1: SCOPING (Define Your CMMC Boundary)

### Why This Is First

The most common reason contractors fail CMMC assessments is **scope creep** — either they declared too little (missed in-scope systems) or too much (created unnecessary compliance burden). Before a single control is evaluated, the boundary must be correct.

Source authority: **CMMC Scoping Guide Level 2 (Version 2.0, November 2021)**

### Asset Categories (CMMC Official)

The scoping guide defines five categories, matching `AssetCategory` in §0.5. Every system in your environment must be placed in exactly one:

| Category | Icon | In Scope | Definition |
|----------|------|----------|-----------|
| **CUI Assets** | 🔴 | YES — full CMMC L2 | Process, store, or transmit CUI |
| **Security Protection Assets** | 🟠 | YES — full CMMC L2 | Provide security for CUI (firewalls, IAM, SIEM) |
| **Contractor Risk Managed** | 🟡 | YES — risk managed | On same network but don't touch CUI |
| **Specialized Assets** | 🔵 | YES — limited | OT/IoT, GFE, RD&E equipment |
| **Out-of-Scope** | ⚪ | NO | Clearly isolated, no connectivity to CUI environment |

**Critical rule**: An asset starts as IN SCOPE. The contractor must affirmatively demonstrate it meets the criteria for Contractor Risk Managed or Out-of-Scope. The burden of proof is on the contractor, not the C3PAO.

### UX: Scope Declaration Wizard

**Step 1.1 — CUI Category Identification**
```
Which types of Controlled Unclassified Information does your organization handle?

[ ] Technical Data - Defense
[ ] Technical Data - Restricted
[ ] Export Controlled (ITAR / EAR)
[ ] Personally Identifiable Information (DoD)
[ ] Acquisition Sensitive
[ ] Intelligence (Controlled)
[ ] Privacy (DoD)
[ ] Operations Security
[ ] Proprietary Business Information
[ ] [Other ________________]

Select all that apply. This determines which CMMC practices receive enhanced scrutiny.
```

**Step 1.2 — Environment Topology Declaration**
```
Describe how CUI flows through your organization:

Network Segments that process CUI:
+ [Add Network Segment]
  Name: [                    ]
  VLAN/Subnet: [             ]
  CUI Type: [                ]

Cloud Environments:
+ [Add Cloud Account]
  Provider: [                ]
  Account ID: [              ]
  Services: [                ]

External Connections to CUI environment:
+ [Add Connection]
  Type: [                    ]
  Remote Party: [            ]
  Data Flow: [               ]
```

**Step 1.3 — Asset Classification Review**
After the topology is declared, the system presents a classification grid. Each network segment/cloud account must be categorized:

```
+-------------------------------------------------------+
|  Network Segment: [name]                               |
|  Subnet: [subnet]                                       |
|                                                       |
|  Does this segment process, store, or transmit CUI?   |
|  [Yes/No] → CUI Asset Category                         |
|                                                       |
|  Are there systems on this segment that protect CUI   |
|  assets (firewall, IDS, AD, MFA)?                     |
|  [Yes/No] → also contains Security Protection Assets   |
|                                                       |
|  Are there systems that have no CUI contact but share  |
|  the network segment?                                 |
|  [Yes/No] → Contractor Risk Managed Assets             |
+-------------------------------------------------------+
```

**Step 1.4 — Out-of-Scope Justification**
For any segment/cloud marked Out-of-Scope, the user must complete a signed declaration:

```
Out-of-Scope Justification for: [segment name]

Physical/Logical Isolation Method:
[ ] Physical separation (air gap or separate hardware)
[ ] Logical separation (firewall rules + VLAN isolation)
[ ] Cloud tenant isolation

Describe the isolation controls:
[                                                      ]

This declaration will be ML-DSA-65 signed and stored as a DAG attestation node.
A C3PAO may request evidence of the described isolation controls.

[Sign and Declare Out-of-Scope]
```

**Step 1.5 — Scope Boundary Map**
Visual output of the declared scope: a topology diagram showing:
- Color-coded segments by asset category
- Data flow arrows between segments
- External connections highlighted
- Out-of-scope segments grayed out with justification

This map becomes Appendix A of the SSP.

### Error States — Phase 1

| Condition | UX Behavior |
|---|---|
| User attempts to mark a segment Out-of-Scope without completing the isolation justification | Block the "Sign and Declare" button. Inline validation: "Isolation method and description are required before an out-of-scope declaration can be signed." |
| User declares zero CUI categories in Step 1.1 | Warn: "You've indicated you handle no CUI. If this is a Level 1 assessment, proceed. If Level 2 was selected in onboarding, this is inconsistent — please review." Does not hard-block (a contractor genuinely might be re-scoping to drop CUI handling), but requires explicit acknowledgment. |
| Sonar discovery (Phase 2) later finds an asset that contradicts an Out-of-Scope declaration (e.g., a device on a "physically separated" segment is observed communicating with a CUI asset) | **Does not silently override the Phase 1 declaration.** Raises a flagged discrepancy: "Asset [X] on segment declared Out-of-Scope was observed communicating with CUI Asset [Y]. This isolation declaration may be inaccurate. [Review Declaration] [Reclassify Asset] [Dismiss — False Positive, explain why]." Every path writes a DAG node; "Dismiss" requires a signed justification, same as the original declaration. |

### DAG Output from Phase 1
```
Node: meta_governance / Keter
  action: "CMMC Level 2 scope declared"
  symbol: Gye Nyame (God's omnipotence — the governance authority)
  contains: scope boundary definition, asset category counts
  ML-DSA-65 signed by user's identity key
  timestamp: ISO 8601
```

---

## PHASE 2: ASSET DISCOVERY (Agentic Inventory)

### Why Agentic Discovery

DIB contractors consistently underestimate their asset count. A 50-person engineering firm often has 200+ assets in scope when you include:
- Developer workstations
- CAD/CAM workstations handling technical drawings
- Engineering servers (file servers, CAD license servers)
- Network infrastructure (firewalls, switches, VPN concentrators)
- Cloud instances and storage buckets
- Email systems handling CUI-embedded communications

Manual inventory produces gaps. ASAF's Sonar agent discovers what's actually there.

### Discovery Methods

**Method A — Network Scan (Sonar)**
```
Active scan of declared network segments.
Discovers: live hosts, open ports, services, OS fingerprinting.
Requires: scan credentials (SSH/WinRM) for deep inspection.
Output: asset list with preliminary classification.
```

**Method B — Agent-Based Discovery**
```
Lightweight sensor deployed on each host.
Reports: software inventory, running services, network connections,
         CUI-handling application detection.
Requires: admin push via GPO or Ansible.
Output: detailed asset profile per host.
```

**Method C — Cloud API Integration**
```
AWS Organizations / Azure Management Group / GCP Resource Manager API.
Discovers: all cloud resources without installing anything.
Requires: read-only IAM role.
Output: cloud asset inventory with service types.
```

**Method D — Manual Import (CSV)**
```
For sites with strict network controls or OT environments.
Template: Asset Name, IP/Hostname, OS, Asset Category, Responsible Owner.
ASAF validates against declared scope boundary after import.
```

### UX: Discovery Dashboard

```
+-----------------------------------------------+
| ASSET DISCOVERY                                |
| Scope: [declared segment]                      |
+-----------------------------------------------+
| [▶ Start Sonar Scan]  [+ Manual Import]        |
|                                                |
| Scan Progress:  ████████░░  78%                |
| Hosts Discovered: [n]                          |
| Pending Classification: [n]                    |
+-----------------------------------------------+
| DISCOVERED ASSETS                              |
+-----------------------------------------------+
| 🔴 [ip]   [hostname]    CUI Asset             |
|                [OS/role]                       |
|                                               |
| 🟠 [ip]    [hostname]    Sec. Protect          |
|                [device type]                   |
|                                               |
| 🟡 [ip]    [hostname]   Risk Managed          |
|                [device type]                   |
|                                               |
| ❓ [ip]  UNKNOWN            [Classify ▼]       |
|                [OS / unknown services]         |
+-----------------------------------------------+
```

### Classification Assistant for Unknown Assets

For each unclassified asset, ASAF presents:
1. Services discovered and their CUI-relevance
2. Network connections to other classified assets
3. AI-suggested classification with reasoning
4. User confirms or overrides

### Error States — Phase 2

| Condition | UX Behavior |
|---|---|
| Sonar scan credentials fail (SSH/WinRM auth failure) | Asset is still listed (from the network-layer discovery) but marked `⚠️ Limited Visibility — credential auth failed`. Does not block phase progress but the Phase 2→3 gate requires the user to either fix credentials or manually classify the asset — it cannot remain in an unclassified "limited visibility" state at gate-check time. |
| Cloud API returns a permissions error (IAM role insufficient) | Halt cloud discovery for that account, surface: "AdinKhepra needs read-only access to [service]. Current role is missing: [permission]. [View Required IAM Policy]." Partial results already fetched are kept. |
| Asset count exceeds the scale envelope for the deployment tier (see §11) | Warn at 80% of the tier's tested ceiling: "This environment has [n] assets, approaching the tested limit of [ceiling] for your tier. Discovery and Compliance Graph performance may degrade beyond this. Contact support about Program/Enterprise tier scaling." |
| Manual CSV import contains an asset category not in the five-category enum | Reject the row with a specific error, not a silent drop: "Row 14: 'IoT-Sensor' is not a valid category. Valid values: cui_asset, security_protection_asset, contractor_risk_managed, specialized_asset, out_of_scope." |
| Gate check at Phase 2→3: assets remain `UNKNOWN` | Hard block. "3 assets remain unclassified. All discovered assets must be classified before proceeding to SSP authoring. [Go to Discovery Dashboard]" |

### Asset Inventory DAG Output

Each asset gets a DAG node:
```
Node: asset / Chesed (Level 7)
  action: "Asset discovered and classified"
  polarity: Earth (protective)
  state_code: [severity/verified/status/lifecycle encoding — see §0.5 Finding.Severity]
  attributes: {hostname, ip, os, stig_profile, asset_category}
  ML-DSA-65 signed
```

---

## PHASE 3: SYSTEM SECURITY PLAN (SSP)

### What the SSP Is

The System Security Plan is the **primary document** a C3PAO reads before setting foot in your building. It describes:
1. Your system boundary (what's in scope)
2. How you implement each of the 110 NIST 800-171r3 requirements
3. Who is responsible for each requirement
4. What policies and procedures exist
5. What interconnections exist with other systems

**If your SSP is good, the C3PAO assessment is efficient.**
**If your SSP is bad, every other investment was wasted.**

Source authority: NIST SP 800-171, Section 3.12.4 (CA.L2-3.12.4)

### SSP Structure (NIST 800-171A Aligned)

```
Section 1: System Identification
  1.1 System Name
  1.2 System Boundary (from Phase 1)
  1.3 System Description
  1.4 System Owner
  1.5 System Security Officer
  1.6 Assignment of Security Responsibility (CA.L2-3.12.3)

Section 2: System Operational Status

Section 3: System Environment
  3.1 General Description
  3.2 Hardware Inventory (from Phase 2)
  3.3 Software Inventory
  3.4 Network Diagram
  3.5 External Systems and Interconnections

Sections 4-17: The 14 Control Families (110 requirements)
  [Each requirement: Policy | Implementation | Responsible Role | Evidence Pointer]

Section 18: Appendices
  A. Network/Boundary Diagrams
  B. Asset Inventory
  C. POA&M
  D. CUI categories handled
  E. Interconnection Security Agreements (ISAs)
```

### UX: SSP Builder — Practice-Level View

```
+-------------------------------------------------------+
| SYSTEM SECURITY PLAN — ACCESS CONTROL (AC)            |
| 22 requirements | [n] MET | [n] NOT MET | [n] IN PROGRESS  |
+-------------------------------------------------------+
|                                                       |
| AC.L2-3.1.1  Limit system access to authorized users  |
|              CMMC Weight: ████░ 5 pts                 |
|              NIST 800-53: AC-2, AC-3, AC-17           |
|                                                       |
| Implementation Status: [dropdown: Met/Not Met/In Progress] |
|                                                       |
| AI Suggested Implementation:                         |
| [Generated from discovered asset context.]            |
| [Edit this description...]                            |
|                                                       |
| Responsible Role: [dropdown                  ]        |
|                                                       |
| C3PAO Assessment Objectives:                        |
| ✎ Examine: Access control policy, user account list  |
| 🗣 Interview: Sys admin re: account provisioning     |
| 🔧 Test: Verify access control enforcement           |
|                                                       |
| [View STIG Findings] [Generate APDL Policy]          |
+-------------------------------------------------------+
```

### SSP Completion Gate

The SSP cannot be marked "complete" until:
- [ ] All 110 practices have an implementation description
- [ ] All "NOT MET" practices have a POA&M entry or documented rationale
- [ ] Network diagram attached (from Phase 1)
- [ ] Asset inventory linked (from Phase 2)
- [ ] Responsible roles assigned for all 14 domains
- [ ] System owner signed off (identity-bound)

Output: SSP in OSCAL format (system-security-plan), ML-DSA-65 signed

### Error States — Phase 3

| Condition | UX Behavior |
|---|---|
| AI-suggested implementation narrative is generated but the user never reviews/edits it before attempting to sign off | Block system-owner sign-off on any practice whose narrative is still flagged `ai_generated_unreviewed`. Require an explicit "Reviewed" click per practice, logged with a timestamp distinct from the generation timestamp. This prevents an unreviewed AI narrative from becoming attributed evidence in front of a C3PAO. |
| User attempts to mark a practice "Met" with no linked evidence pointer (no asset, no STIG finding, no policy document referenced) | Warn, don't block on first attempt: "This practice is marked Met with no supporting evidence linked. A C3PAO Examine/Test will likely fail without evidence. [Link Evidence] [Mark Met Anyway — requires justification note]." The override path requires a typed justification, logged. |
| Responsible role field left blank for a control family at completion-gate check | Hard block: "Section [X] has no responsible role assigned. CA.L2-3.12.3 requires documented assignment of security responsibility." |
| SSP completion gate is satisfied but system owner is a different identity than the one currently logged in | Allow proceeding but flag prominently: "SSP is ready for sign-off by [system owner name] — this is not the currently authenticated user. [Request Sign-off] [I am authorized to sign on their behalf — requires delegation record]." |

---

## PHASE 4: BASELINE ASSESSMENT SCAN

### Purpose

The baseline scan answers: **"Where do we stand right now?"**

This is the technical truth that the SSP's narrative must match.

### The Mapping Chain

```
STIG Rule ID     → CCI ID      → NIST 800-53  → NIST 800-171 → CMMC Practice
[example rule]   → CCI-000192  → AC-2 (f)     → 3.1.1         → AC.L2-3.1.1
```

This is the **25,185-mapping** compliance database in action (see §0.5 note on the 25,185 vs. 36,195 distinction). Every STIG finding maps to a CMMC practice and an SPRS weight.

### STIG Profiles Applied

| Asset Type | STIG Applied | Coverage Status |
|-----------|-------------|-----------|
| RHEL 9 | RHEL-09-STIG (V1R3+) | **9 of 291+ controls implemented; pattern established for remaining coverage** |
| Windows Server 2022 | WinSvr2022-STIG | Roadmap |
| Windows 10/11 | Win10/11-STIG | Roadmap |
| Active Directory | AD-Forest-STIG | Roadmap |
| FortiGate | FortiGate-v7-STIG | Roadmap |
| Apache HTTPD | Apache-2.4-RHEL-STIG | Roadmap |
| PostgreSQL | Postgres-STIG | Roadmap |
| Kubernetes | Kubernetes-STIG | Roadmap |

**Product honesty note (correction applied):** As of this writing, the live scanner implements 9 of the 291+ RHEL-09 STIG controls with real system checks (no mocks, no placeholders — each of the 9 queries actual system state via `os.Stat`, `exec.Command`, `/proc`, `/etc` reads, etc.). The remaining controls follow an established, documented pattern (see the checker template in the engineering codebase) and are a scoped, near-term build item — **not yet shipped.** Any customer-facing material, pilot conversation, or evidence package **must** state current coverage accurately rather than imply full 291-control coverage exists today. This same discipline applies to CIS, NIST 800-53, NIST 800-171, and CMMC framework checkers, which currently ship with sample coverage (4–5 checks each) pending expansion.

### UX: Baseline Scan Dashboard

```
+----------------------------------------------------------+
| BASELINE ASSESSMENT SCAN                                  |
| CURRENT SPRS SCORE: [  n  ] / 110                       |
+----------------------------------------------------------+
| BY DOMAIN            | MET | NOT MET | NA | SPRS DEDUCT |
|----------------------|-----|---------|-----|-------------|
| Access Control (AC)  | [n] |  [n]    | [n] |  [-n] pts  |
| Awareness & Trng (AT)| [n] |  [n]    | [n] |  [-n] pts  |
| Audit & Acctbl (AU)  | [n] |  [n]    | [n] |  [-n] pts  |
| Config Mgmt (CM)     | [n] |  [n]    | [n] |  [-n] pts  |
| ID & Auth (IA)       | [n] |  [n]    | [n] |  [-n] pts  |
| ...                  | ... |   ...   | .. |    ...     |
+----------------------------------------------------------+
| TOP 5 HIGHEST IMPACT NOT MET                             |
| [practice ID]   ████░  5 pts  [Not Met]                   |
| [practice ID]   ████░  5 pts  [Not Met]                   |
+----------------------------------------------------------+
```

### The Compliance Graph — First Population

After the baseline scan, the 3D Compliance Graph populates for the first time. **The internal data model uses a Sephirot/Merkaba/Hypercube schema (documented in the engineering codebase's Sacred Geometry DAG Node Schema spec) — none of that terminology is user-visible. See §10 for the mandatory translation table.**

**Blast Radius Visualization:**
Click any failing practice node → highlight all:
- Assets affected (glow amber)
- Threats exploiting this gap (pulse red)
- Dollar exposure: `(SPRS_weight / 110) × DoD_Revenue × Audit_Probability` — this formula requires the customer's actual DoD-revenue figure as an input; it is never populated with a placeholder or estimated default in a customer-facing report.

### SPRS Baseline Submission

Generated for sprs.apps.mil (DFARS 252.204-7019 requirement):
```
SPRS SUBMISSION REPORT
Organization: [org name] | CAGE: [cage]
Assessment Type: Self-Assessment (NIST SP 800-171 DoD Assessment Methodology)
Assessment Date: [date]
Score: [n]
Plan of Action: Yes (POA&M attached)
Signature: [ML-DSA-65 signed by ISSO]
```

### Error States — Phase 4

| Condition | UX Behavior |
|---|---|
| Baseline scan is run against a STIG profile/framework with only sample-coverage checkers (e.g., CIS, NIST 800-53 direct, NIST 800-171 direct, CMMC direct — as opposed to the STIG→CCI→NIST→CMMC translation chain) | Dashboard must show a coverage disclaimer per framework: "[Framework] coverage: 5 of [total] controls checked (sample set). Full framework coverage is on the roadmap. Findings shown reflect only the checked subset — absence of a finding does not imply full compliance." This disclaimer is not optional and cannot be dismissed permanently (may be collapsed per session). |
| Scan fails mid-run (host unreachable, permission denied on a subset of assets) | Do not discard partial results. Mark affected assets `scan_incomplete`, compute SPRS score only from assets with complete results, and surface: "[n] of [total] assets could not be fully scanned. SPRS score reflects [n] successfully scanned assets only. [Retry Failed Assets] [View Errors]." |
| SPRS score computation encounters a Finding with no `SPRSWeight` set (data integrity issue) | Fail loudly, not silently. Block SPRS score display with: "Score cannot be computed — [n] findings are missing SPRS weight data. This indicates a compliance-database integrity issue. [Report to Support]." Never default a missing weight to 0 or skip it silently, since that would produce an inflated, wrong score. |

---

## PHASE 5: PLAN OF ACTION AND MILESTONES (POA&M)

### What C3PAOs Accept in a POA&M

- All 5-point (CAT1) practices must generally be MET before assessment (see the Phase 6→7 hard gate in §0.6)
- POA&M items must have realistic completion dates (< 180 days)
- POA&M must have documented milestones (not just "we'll fix it")
- POA&M must be signed by responsible official

### UX: POA&M Generator

```
PRACTICE: [practice ID] | Weight: [n] | Status: NOT MET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Gap (from STIG findings):
  - [finding]: [description]

Milestone 1 ([date]): [action]
Milestone 2 ([date]): [action]

Effort: [n] hours | Responsible: [role]
Completion Target: [date]

[Generate ASAF Policy (APDL)] [Assign to Queue]
```

### Remediation Roadmap

```
CMMC REMEDIATION ROADMAP
Assessment Target: [date] ([n] days)

Week 1-2:  5-point practices     → SPRS: [n] → [n]
Week 3-4:  Remaining 5-point     → SPRS: [n] → [n]
Month 2:   3-point practices     → SPRS: [n] → [n]
Month 3:   1-point + evidence    → SPRS: [n] → [n]

Projected Assessment Score: [n]/110
Buffer: [n] days before assessment
```

### Error States — Phase 5

| Condition | UX Behavior |
|---|---|
| User attempts to set a milestone target date beyond 180 days from POA&M creation | Warn, don't hard-block (some genuinely take longer), but flag prominently: "Milestones beyond 180 days are atypical for C3PAO-accepted POA&Ms and may be challenged during assessment. Consider breaking this into interim milestones." |
| User attempts to generate an Evidence Package (Phase 8) while any CAT1 POA&M item remains open | Hard block per the §0.6 state machine — Phase 6→7 gate requires all CAT1 practices MET, not just POA&M'd. Message: "[n] CAT1 (5-point) practices are still open in your POA&M. These must be remediated to MET status — not merely planned — before proceeding to Readiness." |
| POA&M item has milestones but no responsible role assigned | Block "Assign to Queue": "A responsible role is required before this POA&M item can be tracked." |

---

## PHASE 6: REMEDIATION (ASAF Daemon + Staging Gate)

### The Architecture of Trusted Change

Every remediation action:
1. Generated as APDL (ASAF Policy Declaration Language) — see full grammar in §9
2. Staged in mirror environment first
3. Requires human approval before production
4. Is ML-DSA-65 signed and DAG-attested (chain of custody)

### APDL — Inline Policy Display

When a user clicks a failing node, the sidebar shows:

```asaf
@symbol(Eban) @framework(CMMC.L2) @tier(Sovereign) @gate(human)
@asset([hostname]) @practice([practice ID]) @sprs_weight(5)
control AC-2 {
  require: account_review_period = 90d
  require: shared_accounts = none
  require: inactive_threshold = 90d
  deny: guest_accounts
  maps: CMMC.AC.L2-3.1.1, NIST.AC-2, CCI-000192, STIG.[rule ID]
  remediation: {
    command: ["userdel", "shared_admin"]
    command: ["chage", "-E", "0", "guest_account"]
    ansible_role: "asaf.access_control.account_management"
  }
}
```

Note: `@symbol(Eban)` is required for all kernel-level and system-level operations. The ASAF Daemon will reject unsigned ChangeRequests silently (from the caller's perspective — but the rejection is logged, not silently dropped from the audit trail; see the Daemon execution gate order in the engineering AGENTS.md).

### Staging Gate UX

```
+------------------------------------------------------+
| STAGING GATE — [practice ID]                          |
| Asset: [hostname]                                     |
+------------------------------------------------------+
| Before:              After (Staging):                |
| [current state]       [proposed state]                |
|                                                      |
| Post-staging STIG:                                    |
| [finding ID]: [PASS/FAIL] (was [prior status])        |
|                                                      |
| CMMC Practice: [practice ID] → [MET/still NOT MET]    |
| SPRS Impact: [+/-n] points ([old] → [new])            |
|                                                      |
| [Approve → Apply to Production]  ← ML-DSA-65 signed |
| [Reject] [Modify] [Defer to POA&M]                  |
+------------------------------------------------------+
```

### Remediation DAG Chain

```
Node: remediation / Netzach (Level 4)
  action: "[practice] remediation applied to [asset]"
  symbol: Eban (fortress)
  ChangeRequest: {AgentID, ControlID, Commands, Signature, DAGParent}

Node: attestation / Hod (Level 3)
  action: "[practice] verified MET post-remediation"
  evidence: {stig_results, timestamp, verifier}
  ML-DSA-65 signed
```

This chain = C3PAO-ready evidence for this control. Staging run → human approval → production execution → verification scan. All cryptographically linked. A C3PAO can verify without trusting the vendor.

### Error States — Phase 6

| Condition | UX Behavior |
|---|---|
| Staging application succeeds but post-staging verification scan still shows FAIL (the "fix" didn't work) | **Do not permit "Approve → Apply to Production."** The button is disabled whenever post-staging STIG status is not PASS. Message: "Staging verification failed — the proposed change did not resolve [finding ID]. This will not be applied to production. [Modify] [Escalate to Support]." This is the single highest-priority error state in the document — a remediation that silently fails to fix the underlying issue but gets applied anyway is the exact failure mode that destroys evidence-package credibility. |
| ASAF Daemon rejects a ChangeRequest (bad signature, missing Eban symbol, or staging-required-but-attempted-production) | The UI must surface **why**, not just "rejected." Three distinct messages: (a) "Signature invalid — this change request could not be verified and was not executed." (b) "This operation requires kernel-level privilege (Eban symbol) which was not present in the request." (c) "This change was submitted directly to production without a staging run. All changes must stage first." Each rejection reason writes its own DAG node — rejections are part of the audit trail, not just successes. |
| User selects "Defer to POA&M" on a CAT1 (5-point) finding | Warn: "This is a CAT1 finding. Deferring to POA&M will block progression to the Readiness phase until it is later remediated to MET. [Confirm Defer] [Remediate Now Instead]." |
| Mirror/staging environment is unavailable (e.g., no mirror configured for an asset) | Block staging-gate entry entirely for that asset: "No staging environment is configured for [asset]. Remediation cannot proceed without a staging validation step. [Configure Staging] [Contact Support]." Never allow a direct-to-production path as a workaround. |

---

## PHASE 7: ASSESSMENT READINESS GATE

### Pre-Assessment Checklist

```
ASSESSMENT READINESS GATE
C3PAO: [name] | Date: [date] | Days: [n]

MANDATORY:
[status] All 5-point practices: MET
[status] All 3-point practices: [n] remaining
[status] SSP: Complete and signed
[status] POA&M: All items milestoned and owned
[status] SPRS: Submitted to sprs.apps.mil
[status] Incident Response Plan: [status]
[status] Security Awareness Training: [status]

INTERVIEW PREP:
[ ] System Owner — scheduled?
[ ] ISSO / Security Officer — scheduled?
[ ] System Administrator — scheduled?
[ ] CUI Handler (end user) — scheduled?

DOCUMENT STATUS:
[status] Access Control Policy
[status] Incident Response Plan
[status] Configuration Management Policy
```

### Godfather Report (Executive Brief)

```
EXECUTIVE COMPLIANCE BRIEF — [Organization]
Generated: [date] | ML-DSA-65 Signed

BOTTOM LINE: [n]% ready for CMMC Level 2 certification.
Projected passing score by [date] ([n] days before assessment).

DoD CONTRACT REVENUE AT RISK: [customer-provided figure — never a placeholder default]
If assessment fails: [n]-month delay = [computed range] revenue gap

DONE:
[n]/110 practices: FULLY COMPLIANT
Asset inventory: [n] assets classified
SSP: Completed and signed ([date])

REMAINING:
[n] practices ([n]-point, [n] SPRS points total)
[open items]

RECOMMENDATION (priority order):
1. [highest-impact remaining item]
2. [next]
...

[Chain depth: [n] DAG nodes | Verify at: [verification endpoint]]
```

### Error States — Phase 7

| Condition | UX Behavior |
|---|---|
| Readiness gate check is run but the Phase 6→7 hard gate (all CAT1 MET) was somehow bypassed (data-integrity check) | Re-validate the gate condition independently at Phase 7 entry, not just trust the Phase 6 exit state. If violated: hard-stop, "Readiness cannot be assessed — [n] CAT1 practices are not MET. This should not be reachable; please contact support with error code GATE_INTEGRITY_violation." This is a defense-in-depth check, not a normal user-facing flow. |
| Godfather Report is requested but "DoD Contract Revenue at Risk" field has not been provided by the customer | Do not compute or display a dollar figure. Show: "Revenue-at-risk analysis requires your DoD contract revenue figure. [Enter Contract Revenue]" — leave blank rather than default/estimate, since a wrong dollar figure in an executive brief is worse than no figure. |
| Interview scheduling checklist items are unchecked at the assessment date minus 7 days | Escalate visually (not just a checkbox — a banner): "Assessment is in 7 days and [n] required interviews are not yet scheduled. This is a common assessment-failure cause." |

---

## PHASE 8: EVIDENCE PACKAGE GENERATION

### Package Structure

```
CMMC_EVIDENCE_PACKAGE_[Org]_[date]/
├── README.md               ← Package manifest + verification instructions
├── SPRS_Submission.pdf     ← Score calculation + submission confirmation
├── SSP/
│   ├── SSP_OSCAL.json      ← Machine-readable (NIST OSCAL format)
│   └── SSP_Executive.pdf   ← Human-readable
├── Assessment/
│   ├── Assessment_Results_OSCAL.json  ← 110 practices: MET/NOT MET
│   ├── STIG_Findings.csv             ← All findings + remediation status
│   └── Control_Evidence/             ← Per-practice folders
│       ├── [practice ID]/
│       │   ├── policy.pdf
│       │   ├── stig_scan_result.json
│       │   ├── remediation_dag_node.json  ← Signed DAG proof
│       │   └── post_remediation_scan.json
│       └── [remaining practice folders]
├── POAM/
│   ├── POAM_OSCAL.json     ← Machine-readable
│   └── POAM_Table.csv      ← Traditional format
├── Attestation/
│   ├── DAG_Chain_Export.json   ← Complete signed DAG chain
│   ├── Signature_Bundle.json   ← All ML-DSA-65 signatures
│   └── Verification_Guide.md  ← C3PAO verification instructions
└── Policies/
    ├── Access_Control_Policy.pdf
    ├── Incident_Response_Plan.pdf
    └── [other required policies]
```

### OSCAL Assessment Results Fragment

```json
{
  "assessment-results": {
    "findings": [
      {
        "control-id": "3.1.1",
        "description": "[implementation narrative]",
        "target": {"status": {"state": "satisfied"}},
        "dag_attestation": {
          "node_id": "sha256:[hash]",
          "pqc_signature": "mldsa65:[signature]",
          "signed_at": "[ISO 8601 timestamp]",
          "chain_depth": "[n]"
        }
      }
    ]
  }
}
```

### DAG Chain Verification

C3PAOs can verify the package cryptographically:
```bash
asaf-verify ./CMMC_EVIDENCE_PACKAGE_[Org]_[date]/
# Expected output:
# DAG chain: VALID ([n] nodes, 1 root)
# Signatures: ALL VALID (ML-DSA-65, FIPS 204)
# Assessment date: [timestamp]
# SPRS Score: [n]/110
# Tampered: NO
```

**What the chain proves:** Every action — every scan, every remediation, every human approval — is linked in a content-addressed chain where altering any node breaks the chain. Final node signature covers entire history.

**Algorithm:** ML-DSA-65 (CRYSTALS-Dilithium, FIPS 204) + SHA-256 content addressing.

### Error States — Phase 8

| Condition | UX Behavior |
|---|---|
| Evidence Package generation is requested but the Phase 7 readiness gate has ❌ items | Hard block per §0.6: "Evidence Package cannot be generated — Readiness checklist has [n] unresolved items. [Return to Readiness]." |
| `asaf-verify` is run by a C3PAO on a package and finds a broken chain (tampering detected, however unlikely) | This is a critical-severity condition. The tool must output unambiguously: "DAG chain: **INVALID** — chain break detected at node [id]. This package cannot be trusted as presented. Contact the issuing organization." Never soften this language or attempt partial-trust scoring. |
| Package generation completes but one or more Control_Evidence folders are missing artifacts (e.g., a remediation_dag_node.json failed to export) | Do not silently ship an incomplete package. Fail generation with a manifest diff: "Evidence Package generation failed — [n] practice folders are missing required artifacts: [list]. [Retry] [View Details]." |

---

## COMPLIANCE GRAPH: THE LIVING VISUALIZATION

### Graph State by Phase

| Phase | What Appears (User-Facing Labels — see §10 for internal↔external mapping) |
|-------|-------------|
| After Scope (1) | Governance root node + 14 domain groups (gray, unpopulated) |
| After Assets (2) | Asset nodes for 100% of classified inventory (blue) |
| After SSP (3) | 110 control nodes (linked to domain groups) |
| After Baseline (4) | Finding nodes (red, pulsing on CAT1) + threat nodes |
| During Remediation (6) | Nodes turn green as fixes are verified MET |
| Readiness (7) | Near-fully green; governance root fully connected |
| Evidence (8) | Attestation nodes appear (white, signed-proof indicator) |

### Node Interactions

**Click a red finding node:**
- Sidebar: STIG rule, CMMC practice, SPRS weight, C3PAO objectives
- Blast radius: connected assets glow, threats pulse
- Action: [Stage Fix] [View Evidence] [Open POA&M Item]

**Click an asset node:**
- Sidebar: Asset details, STIG profile, all findings
- Drill-down: practices affected by this asset

**Click a domain group node:**
- All practices in domain, progress bar
- [Generate APDL for domain]

**Click the governance root:**
- Godfather Report
- SPRS score + assessment countdown
- Critical path to 100%

### Node Glow Semantics (user-facing — internal state_code mapping in §0.5)

- **Fast red pulse:** Critical, SPRS weight 5, blocking assessment
- **Slow orange pulse:** Moderate, SPRS weight 3
- **Yellow static:** Contractor Risk Managed — watch only
- **Green static:** MET — resolved
- **White indicator:** Attestation — DAG linked, signature valid
- **Blue outline:** Security Protection Asset — active defense

---

## SCREEN ARCHITECTURE

```
Tab 1: COMPLIANCE GRAPH
  ├── Force-directed graph (see §10 for internal↔external label mapping)
  ├── Left panel: Phase selector / scope filter
  ├── Right sidebar (288px): Node detail + APDL + actions
  └── Bottom bar: SPRS score + readiness gauge + days to assessment

Tab 2: ERT ANALYSIS
  ├── Package A: Asset Discovery (Sonar topology map)
  ├── Package B: Vulnerability Assessment (CVE integration)
  ├── Package C: STIG Assessment (all findings, filter by domain)
  └── Package D: Godfather Report (executive narrative)

Tab 3: SSP BUILDER
  ├── Phase 1: Scope declaration wizard
  ├── Phase 3: 110-practice editor (AI-assisted, human-reviewed)
  └── OSCAL export + PDF

Tab 4: EVIDENCE EXPORT
  ├── Phase 5: POA&M table
  ├── Phase 8: Evidence package builder
  ├── SPRS submission generator
  └── C3PAO readiness checklist

Tab 5: SETTINGS
  ├── License status
  ├── KHEPRA_LLM_PROVIDER selection (sovereign vs. commercial chain)
  ├── ASAF Daemon status
  └── Organization profile
```

---

## §9 APDL — FULL LANGUAGE SPECIFICATION

APDL (ASAF Policy Declaration Language) is generated by the UI when a user selects a remediation. Users see and can edit the generated declaration; they do not have to write it from scratch.

### Grammar (EBNF)

```ebnf
policy        ::= annotation+ "control" identifier "{" statement+ "}"

annotation    ::= "@symbol(" symbol_name ")"
                 | "@framework(" framework_id ")"
                 | "@tier(" tier_name ")"
                 | "@gate(" gate_type ")"
                 | "@asset(" hostname ")"
                 | "@practice(" practice_id ")"
                 | "@sprs_weight(" integer ")"

symbol_name   ::= "Eban" | "Nkyinkyim" | "Dwennimmen" | "Fawohodie"
                  (* Only "Eban" is currently gate-enforced for kernel ops.
                     Others are descriptive/routing metadata only — this
                     distinction must be documented in code comments and
                     is NOT decorative. *)

framework_id  ::= "CMMC.L1" | "CMMC.L2" | "CMMC.L3" | "NIST.800-171"

tier_name     ::= "Sovereign" | "Hybrid" | "Edge"

gate_type     ::= "human" | "auto"
                  (* "auto" is reserved for future use; current release
                     requires "human" for all production ChangeRequests
                     regardless of declared gate_type — this is enforced
                     at the Daemon level, not just the UI level. *)

statement     ::= require_stmt | deny_stmt | maps_stmt | remediation_stmt

require_stmt  ::= "require:" field "=" value
deny_stmt     ::= "deny:" field
maps_stmt     ::= "maps:" mapping_list
                  (* Every entry in mapping_list is validated against the
                     25,185-mapping database at parse time. An unresolvable
                     mapping reference is a parse error, not a warning. *)

remediation_stmt ::= "remediation:" "{" command_list ansible_role? "}"
command_list  ::= ("command:" "[" string_list "]")+
                  (* Multiple command entries execute in declared order.
                     If any command in the sequence fails, execution halts
                     and no subsequent commands run — this is NOT
                     transactional/rollback, it is fail-stop. Staging
                     verification (Phase 6) is what catches a failed
                     multi-step remediation before it reaches production. *)
ansible_role  ::= "ansible_role:" string
                  (* Optional. If the referenced Ansible role does not
                     exist in the role library, this is a parse-time
                     error: "Ansible role '[name]' not found in
                     asaf.* role library." The UI must not generate
                     an ansible_role reference to a role it hasn't
                     verified exists. *)
```

### Symbol Enforcement Semantics

Only `Eban` carries runtime enforcement today: the ASAF Daemon's four-check execution gate (signature → symbol → staging → DAG anchor, documented in the engineering AGENTS.md) requires `Eban` specifically for any command touching kernel parameters, PAM, SELinux, GRUB, or kernel modules. Other symbol values (`Nkyinkyim`, `Dwennimmen`, `Fawohodie`) are currently descriptive metadata used for DAG classification and routing, not privilege gates. **This document does not overstate their enforcement status** — if a symbol is not gate-enforced, that must be stated plainly in both this spec and in code comments, to prevent a future engineer or auditor from assuming a security guarantee that doesn't exist.

### Error Handling

| Failure Mode | Behavior |
|---|---|
| `maps:` references a control ID not in the 25,185-mapping database | Parse-time error. The policy cannot be generated. UI shows: "This remediation references an unmapped control. This may indicate a database gap — contact support." |
| `remediation:` block has commands but no `ansible_role`, and the multi-step command sequence fails partway on the target host | The Daemon's fail-stop behavior halts further commands. The staging-gate post-verification scan (Phase 6) will show the STIG check still failing, which blocks "Approve → Apply to Production" per the Phase 6 error-state table. |
| `@gate(auto)` is declared | Accepted at parse time as valid syntax (forward compatibility) but the Daemon overrides it to require human approval in the current release. The UI must show: "Auto-approval is not yet enabled in this release — this change will require human staging approval regardless of the declared gate type." |

---

## §10 PRESENTATION LAYER TRANSLATION TABLE

**Mandatory for every CISO-facing screen.** The internal DAG data model uses a Sephirot/Merkaba/Hypercube ontology (documented separately in the engineering codebase's Sacred Geometry DAG Node Schema). That vocabulary is a backend classification scheme — a defense contractor's compliance lead never sees these terms. This table is the required lookup for every engineer building a UI screen against the DAG.

| Internal Term (backend/DAG only) | User-Facing Label (CISO/UI) |
|---|---|
| `meta_governance` / Keter | Governance Root |
| `strategic_control` / Chokmah | Domain (Control Family) |
| `tactical_control` / Binah | Practice |
| `asset` / Chesed | Asset |
| `threat` / Geburah | Threat / Vulnerability |
| `finding` / Tiphereth | Finding |
| `remediation` / Netzach | Remediation |
| `attestation` / Hod | Verification / Proof |
| `agent_action` / Yesod | System Action |
| `raw_event` / Malkuth | Event Log |
| Merkaba polarity "Sun" | (color-coded red — no label shown) |
| Merkaba polarity "Earth" | (color-coded blue — no label shown) |
| Merkaba polarity "Seed" | (color-coded white/gray — no label shown) |
| Hypercube `state_code` (0–15) | Severity + Status badges (e.g., "Critical, Open, Verified") — the 4-bit encoding is never displayed as a raw number |

**Rule for engineers:** if you are building a component under `frontend/compliance-graph/` and you find yourself typing `Sephirot`, `Chesed`, `Merkaba`, or a raw `state_code` integer into a JSX label, string, or tooltip, stop and use this table instead. Code comments, variable names, and the backend schema itself may use the internal vocabulary freely — only the rendered UI is restricted.

---

## §11 SCALE & PERFORMANCE ENVELOPE

The product is explicitly scoped for a stated asset-count range per tier. This section exists because the force-directed Compliance Graph and Sonar discovery both have real, testable performance characteristics that differ from "works on a demo laptop."

| Tier | Tested Asset Range | Compliance Graph Behavior | Discovery Behavior |
|---|---|---|---|
| Pilot ($45K–$55K/yr) | 1–50 assets | Full force-directed graph, all nodes rendered individually | Single-pass Sonar scan completes in minutes |
| Program ($120K–$150K/yr) | 50–500 assets | Graph remains usable; default view may auto-filter to "findings only" above ~250 nodes to preserve interactivity | Scan may be scheduled/incremental rather than single-pass |
| Enterprise ($150K–$250K+/yr) | 500+ assets | **Above 500 assets, the default graph view must switch to a filtered/aggregated mode** (e.g., group by domain or asset category, expand on demand) rather than attempting to force-render every node — this is a stated design requirement, not a known bug to fix later | Requires incremental/scheduled discovery; a single blocking full-network scan is not the expected mode at this scale |

**This is a design envelope, not a current benchmark claim.** If the engineering team has not load-tested the graph at 500+ nodes, that testing is a prerequisite before Enterprise-tier customers are onboarded with that expectation set — this section defines the target behavior, and actual performance must be validated against it before the claim is made to a customer.

---

## APPENDIX A: ALL 110 CMMC L2 PRACTICES WITH SPRS WEIGHTS

*(Unchanged from source material — content below was independently accurate against the CMMC Assessment Guide and did not require correction.)*

### AC — Access Control (22 practices)

| Practice | Description | SPRS Wt |
|----------|-------------|---------|
| AC.L2-3.1.1 | Limit access to authorized users | 5 |
| AC.L2-3.1.2 | Limit access to authorized transactions/functions | 5 |
| AC.L2-3.1.3 | Control CUI flow per approved authorizations | 3 |
| AC.L2-3.1.4 | Separate duties of individuals | 3 |
| AC.L2-3.1.5 | Employ least privilege | 5 |
| AC.L2-3.1.6 | Use non-privileged accounts for non-security functions | 1 |
| AC.L2-3.1.7 | Prevent non-privileged execution of privileged functions | 3 |
| AC.L2-3.1.8 | Limit unsuccessful login attempts | 3 |
| AC.L2-3.1.9 | Provide privacy and security notices | 1 |
| AC.L2-3.1.10 | Use session lock after inactivity | 1 |
| AC.L2-3.1.11 | Terminate sessions after defined conditions | 1 |
| AC.L2-3.1.12 | Monitor and control remote access | 3 |
| AC.L2-3.1.13 | Use cryptographic mechanisms for remote access | 5 |
| AC.L2-3.1.14 | Route remote access via managed access control points | 3 |
| AC.L2-3.1.15 | Authorize remote execution of privileged commands | 3 |
| AC.L2-3.1.16 | Authorize wireless access prior to connection | 3 |
| AC.L2-3.1.17 | Protect wireless access with authentication and encryption | 5 |
| AC.L2-3.1.18 | Control connection of mobile devices | 3 |
| AC.L2-3.1.19 | Encrypt CUI on mobile devices | 5 |
| AC.L2-3.1.20 | Verify/control connections to external systems | 3 |
| AC.L2-3.1.21 | Limit use of portable storage | 1 |
| AC.L2-3.1.22 | Control CUI on publicly accessible systems | 3 |

### AT — Awareness and Training (3 practices)

| Practice | Description | SPRS Wt |
|----------|-------------|---------|
| AT.L2-3.2.1 | Ensure personnel awareness of security risks | 3 |
| AT.L2-3.2.2 | Ensure personnel trained to carry out responsibilities | 3 |
| AT.L2-3.2.3 | Security awareness training on recognizing threats | 3 |

### AU — Audit and Accountability (9 practices)

| Practice | Description | SPRS Wt |
|----------|-------------|---------|
| AU.L2-3.3.1 | Create and retain system audit logs | 5 |
| AU.L2-3.3.2 | Ensure individual accountability (unique identifiers) | 3 |
| AU.L2-3.3.3 | Review and update logged events | 3 |
| AU.L2-3.3.4 | Alert on audit logging process failure | 3 |
| AU.L2-3.3.5 | Correlate audit record review | 3 |
| AU.L2-3.3.6 | Audit record reduction and report generation | 1 |
| AU.L2-3.3.7 | Provide time correlation for audit records | 1 |
| AU.L2-3.3.8 | Protect audit information from unauthorized access | 3 |
| AU.L2-3.3.9 | Limit audit management to privileged users | 1 |

### CM — Configuration Management (9 practices)

| Practice | Description | SPRS Wt |
|----------|-------------|---------|
| CM.L2-3.4.1 | Establish and maintain baseline configurations | 3 |
| CM.L2-3.4.2 | Establish and enforce security configuration settings | 3 |
| CM.L2-3.4.3 | Track, review, approve system changes | 3 |
| CM.L2-3.4.4 | Analyze security impact of changes | 3 |
| CM.L2-3.4.5 | Define/document/approve/log physical/logical access restrictions | 1 |
| CM.L2-3.4.6 | Employ principle of least functionality | 3 |
| CM.L2-3.4.7 | Restrict/prohibit/prevent use of nonessential programs | 3 |
| CM.L2-3.4.8 | Apply deny-by-exception policy to prevent use of unauthorized software | 3 |
| CM.L2-3.4.9 | Control and monitor user-installed software | 3 |

### IA — Identification and Authentication (11 practices)

| Practice | Description | SPRS Wt |
|----------|-------------|---------|
| IA.L2-3.5.1 | Identify system users, processes, devices | 5 |
| IA.L2-3.5.2 | Authenticate (or verify) identities before allowing access | 5 |
| IA.L2-3.5.3 | Use multifactor authentication for local/network/remote access | 5 |
| IA.L2-3.5.4 | Employ replay-resistant authentication | 3 |
| IA.L2-3.5.5 | Employ identifier management | 3 |
| IA.L2-3.5.6 | Employ authenticator management | 3 |
| IA.L2-3.5.7 | Enforce minimum password complexity | 3 |
| IA.L2-3.5.8 | Prohibit password reuse | 1 |
| IA.L2-3.5.9 | Allow temporary password use with immediate change | 1 |
| IA.L2-3.5.10 | Store and transmit only cryptographically protected passwords | 5 |
| IA.L2-3.5.11 | Obscure feedback of authentication information | 1 |

### IR — Incident Response (3 practices)

| Practice | Description | SPRS Wt |
|----------|-------------|---------|
| IR.L2-3.6.1 | Establish operational incident-handling capability | 3 |
| IR.L2-3.6.2 | Track, document, report incidents | 3 |
| IR.L2-3.6.3 | Test incident response capability | 3 |

### MA — Maintenance (6 practices)

| Practice | Description | SPRS Wt |
|----------|-------------|---------|
| MA.L2-3.7.1 | Perform maintenance on organizational systems | 3 |
| MA.L2-3.7.2 | Provide controls on tools, techniques, mechanisms | 3 |
| MA.L2-3.7.3 | Ensure equipment removed for maintenance is sanitized | 3 |
| MA.L2-3.7.4 | Check media with diagnostic/test programs | 3 |
| MA.L2-3.7.5 | Require MFA for remote maintenance sessions | 3 |
| MA.L2-3.7.6 | Supervise maintenance activities of personnel without required access | 3 |

### MP — Media Protection (9 practices)

| Practice | Description | SPRS Wt |
|----------|-------------|---------|
| MP.L2-3.8.1 | Protect system media with CUI, both paper and digital | 3 |
| MP.L2-3.8.2 | Limit access to CUI on system media to authorized users | 3 |
| MP.L2-3.8.3 | Sanitize or destroy system media before disposal/reuse | 3 |
| MP.L2-3.8.4 | Mark media with necessary CUI markings | 1 |
| MP.L2-3.8.5 | Control access to media with CUI | 1 |
| MP.L2-3.8.6 | Implement cryptographic mechanisms when CUI media is transported | 3 |
| MP.L2-3.8.7 | Control use of removable media on system components | 3 |
| MP.L2-3.8.8 | Prohibit use of portable storage without identifiable owner | 1 |
| MP.L2-3.8.9 | Protect backups of CUI at storage locations | 3 |

### PE — Physical and Environmental Protection (6 practices)

| Practice | Description | SPRS Wt |
|----------|-------------|---------|
| PE.L2-3.10.1 | Limit physical access to CUI systems to authorized individuals | 3 |
| PE.L2-3.10.2 | Protect and monitor the physical facility | 3 |
| PE.L2-3.10.3 | Escort visitors and monitor visitor activity | 1 |
| PE.L2-3.10.4 | Maintain audit logs of physical access | 1 |
| PE.L2-3.10.5 | Control and manage physical access devices | 1 |
| PE.L2-3.10.6 | Enforce safeguarding measures for CUI at alternate work sites | 3 |

### PS — Personnel Security (2 practices)

| Practice | Description | SPRS Wt |
|----------|-------------|---------|
| PS.L2-3.9.1 | Screen individuals prior to authorizing access | 3 |
| PS.L2-3.9.2 | Ensure CUI is protected during and after personnel actions | 3 |

### RA — Risk Assessment (5 practices)

| Practice | Description | SPRS Wt |
|----------|-------------|---------|
| RA.L2-3.11.1 | Periodically assess risk to organizational operations | 3 |
| RA.L2-3.11.2 | Scan for vulnerabilities in organizational systems | 5 |
| RA.L2-3.11.3 | Remediate vulnerabilities in accordance with risk assessments | 3 |
| RA.L2-3.11.4 | Periodically assess risk of supply chain threats | 3 |
| RA.L2-3.11.5 | Update risk assessment findings when significant changes occur | 3 |

### CA — Security Assessment (4 practices)

| Practice | Description | SPRS Wt |
|----------|-------------|---------|
| CA.L2-3.12.1 | Periodically assess security controls | 3 |
| CA.L2-3.12.2 | Develop and implement POA&Ms | 3 |
| CA.L2-3.12.3 | Monitor security controls on ongoing basis | 3 |
| CA.L2-3.12.4 | Develop, document, and periodically update SSPs | 3 |

### SC — System and Communications Protection (16 practices)

| Practice | Description | SPRS Wt |
|----------|-------------|---------|
| SC.L2-3.13.1 | Monitor, control, protect communications at boundary | 5 |
| SC.L2-3.13.2 | Employ architectural designs and engineering principles | 3 |
| SC.L2-3.13.3 | Separate user functionality from system management functionality | 3 |
| SC.L2-3.13.4 | Prevent unauthorized/unintended information transfer | 3 |
| SC.L2-3.13.5 | Implement subnetworks for publicly accessible system components | 5 |
| SC.L2-3.13.6 | Deny network communications traffic by default | 5 |
| SC.L2-3.13.7 | Prevent remote devices from simultaneously connecting to system and other resources | 3 |
| SC.L2-3.13.8 | Implement cryptographic mechanisms to prevent unauthorized CUI disclosure | 5 |
| SC.L2-3.13.9 | Terminate network connections after defined time period | 3 |
| SC.L2-3.13.10 | Establish and manage cryptographic keys | 3 |
| SC.L2-3.13.11 | Employ FIPS-validated cryptography when used to protect CUI | 5 |
| SC.L2-3.13.12 | Prohibit remote activation of collaborative computing devices | 3 |
| SC.L2-3.13.13 | Control and monitor use of mobile code | 3 |
| SC.L2-3.13.14 | Control and monitor use of VoIP technologies | 1 |
| SC.L2-3.13.15 | Protect the authenticity of communications sessions | 3 |
| SC.L2-3.13.16 | Protect CUI at rest | 5 |

### SI — System and Information Integrity (7 practices)

| Practice | Description | SPRS Wt |
|----------|-------------|---------|
| SI.L2-3.14.1 | Identify, report, and correct system flaws | 3 |
| SI.L2-3.14.2 | Provide protection from malicious code | 5 |
| SI.L2-3.14.3 | Monitor system security alerts and advisories | 3 |
| SI.L2-3.14.4 | Update malicious code protection mechanisms | 3 |
| SI.L2-3.14.5 | Perform periodic scans of the system | 5 |
| SI.L2-3.14.6 | Monitor organizational systems to detect attacks | 5 |
| SI.L2-3.14.7 | Identify unauthorized use of organizational systems | 5 |

---

## APPENDIX B: SPRS SCORE CALCULATOR

```
STARTING SCORE: 110

For each NOT MET practice, subtract SPRS weight:
  SPRS = 110 - Σ(weight × NOT_MET_count_per_weight)

THRESHOLDS:
  110:     Perfect — all practices met
  80-109:  Strong — C3PAO pass very likely
  50-79:   Moderate — POA&M required, borderline
  0-49:    Weak — significant remediation required
  < 0:     Critical — systemic failures

SPRS SUBMISSION (DFARS 252.204-7019):
  Portal: https://sprs.apps.mil/
  Deadline: Within 30 days of self-assessment
  Frequency: Update when score changes significantly
```

---

## APPENDIX C: C3PAO READINESS CHECKLIST

**Documentation (Examine):**
- [ ] System Security Plan (current, signed by system owner)
- [ ] POA&M (all items dated, owned, milestoned)
- [ ] Access Control Policy
- [ ] Incident Response Plan (must include CUI breach procedures)
- [ ] Configuration Management Policy
- [ ] Media Protection Policy
- [ ] Network diagrams (current)
- [ ] Asset inventory (current)
- [ ] Training records (all CUI-handling personnel)
- [ ] Vulnerability scan results (last 90 days)
- [ ] Audit log samples

**Personnel (Interview):**
- [ ] System Owner — can describe boundary and CUI flow
- [ ] ISSO/Security Officer — can describe all security controls
- [ ] System Administrator — can demonstrate controls in operation
- [ ] End user handling CUI — can explain training and awareness

**Technical (Test):**
- [ ] Access control enforcement (test account verification)
- [ ] Audit logging (trigger event, verify log entry)
- [ ] MFA working on all CUI systems
- [ ] CUI at rest encryption verified
- [ ] CUI in transit encryption verified
- [ ] Incident response walkthrough completed

---

## APPENDIX D: IRON BANK DEPLOYMENT

For DoD program offices and direct DISA contractors:

`registry1.dso.mil/ironbank/nouchix/adinkhepra` (submission pending resubmission — see business blockers below)

**Current status:** previously rejected. Two resubmission gates: (1) a confirmed government Mission Owner sponsor as an active customer, and (2) full compliance with current Iron Bank documentation requirements. This is a business/relationship blocker (securing the government POC), not a code blocker — the technical hardening (RHEL-09-STIG base image, vendored dependencies, static linking, non-root execution) is already in place.

The Iron Bank listing, once approved, gives the CLI + daemon the clearance to operate inside government networks — enabling assessment of contractor environments from inside the government customer's perimeter.

---

*AdinKhepra ASAF — The CMMC Quran, v2.0 (Corrected Edition)*
*SecRed Knowledge Inc. / NouchiX*
*Classification: CONFIDENTIAL — For Customer and Internal Use Only*
*Compliance logic and database mappings: patent-pending USPTO #73565085*
*This document supersedes CMMC Bible v1.0 in all respects. See Change Log for corrections applied.*
