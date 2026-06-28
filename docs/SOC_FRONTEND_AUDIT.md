# SOC Frontend Layer — Codebase Audit
**Status:** Verified against live files · 2026-06-28 00:25 EST
**Purpose:** Accurate input for pitch deck slide content — no claims made without file evidence

---

## Executive Finding

The SOC / SouHimBou AI frontend layer has **significant real TypeScript code** — but it is
structurally disconnected from the deployed product in three compounding ways:

1. **Components are orphaned** — not registered in `App.tsx` routes
2. **Backend Go layer is absent** — no `pkg/souhimbou/` Go package exists in the active repo
3. **Edge function source is in a deleted tree** — the functions called by the frontend exist
   in `souhimbou_ai/SouHimBou.AI/supabase/functions/` (77 functions), **not** in the active
   `supabase/functions/` directory (12 functions); deployment status of the 77 is unconfirmed

---

## Finding 1 — Orphaned Components (verified)

### What exists in the filesystem

| File | Size | Status |
|---|---|---|
| `src/components/compliance/AgenticComplianceOrchestrator.tsx` | 20,462 bytes / 457 lines | ✅ File exists, renders, has real logic |
| `src/components/enterprise/EnterpriseAgentDashboard.tsx` | 15,982 bytes / 385 lines | ✅ File exists, renders, has real logic |
| `src/components/enterprise/CMMCIntegrationDashboard.tsx` | 22,862 bytes | ✅ File exists |
| `src/components/enterprise/ComplianceDriftMonitor.tsx` | 22,869 bytes | ✅ File exists |
| `src/components/enterprise/ContinuousSTIGMonitoring.tsx` | 18,376 bytes | ✅ File exists |
| `src/components/enterprise/EnterpriseIntegrationsHub.tsx` | 19,666 bytes | ✅ File exists |
| `src/components/enterprise/EnterpriseSTIGDashboard.tsx` | 19,345 bytes | ✅ File exists |
| `src/components/enterprise/STIGRemediationOrchestrator.tsx` | 20,155 bytes | ✅ File exists |

**Total: ~160 KB of TypeScript SOC components.** Real code, not stubs.

### What is actually routed in `App.tsx`

Grep for `AgenticComplianceOrchestrator` in `App.tsx`: **0 matches**
Grep for `EnterpriseAgentManagement` in `App.tsx`: **0 matches**

`src/pages/EnterpriseAgentManagement.tsx` and `src/views/EnterpriseAgentManagement.tsx`
both import `EnterpriseAgentDashboard` — but **neither page is registered as a route in `App.tsx`**.

**Routes registered and reachable today:**
```
/dashboard          → STIGDashboard
/stig-dashboard     → STIGDashboard
/asset-scanning     → AssetScanning
/compliance-reports → ComplianceReports
/evidence-collection → EvidenceCollectionMVP
/compliance-graph   → ComplianceGraph
/threat-hunting     → ThreatHuntingDashboard
/intelligence       → GlobalIntelligenceDashboard
/command-center     → CommandCenter
/ultimate           → UltimateDashboard
```

**Unreachable (components exist, no route):**
- `EnterpriseAgentDashboard`, `AgenticComplianceOrchestrator`, `CMMCIntegrationDashboard`,
  `ComplianceDriftMonitor`, `ContinuousSTIGMonitoring`, `EnterpriseIntegrationsHub`,
  `EnterpriseSTIGDashboard`, `STIGRemediationOrchestrator`

---

## Finding 2 — Edge Function Dependency on Deleted Tree (verified)

`AgenticComplianceOrchestrator.tsx` line 173:
```typescript
await supabase.functions.invoke('agentic-compliance-orchestrator', { ... })
```

| Location | Present | Count |
|---|---|---|
| `supabase/functions/` (active project) | ❌ `agentic-compliance-orchestrator` not here | 12 total |
| `souhimbou_ai/SouHimBou.AI/supabase/functions/` | ✅ Present + 76 other SOC functions | 77 total |

Whether the 77 functions in the deleted tree are deployed to the live Supabase project
is **unconfirmed** — requires `supabase functions list` against the live project ref.

---

## Finding 3 — Go Backend: Absent (verified)

No `pkg/souhimbou/` Go package exists. AGENTS.md lists `pkg/souhimbou/agent.go`,
`pkg/souhimbou/soar.go`, `pkg/souhimbou/flight_recorder.go` — these are Sprint 2 planned work.

---

## Accurate State Table

| Layer | What exists | Routed / Live | Demo-able today |
|---|---|---|---|
| TypeScript SOC UI components | ~160 KB, 8+ files | ❌ Not routed | Only in isolation |
| Active Supabase functions (12) | Billing, license, STIG query, Stripe | ✅ Likely deployed | Yes |
| SOC edge functions (77, deleted tree) | Source exists | ⚠️ Unconfirmed | Cannot confirm |
| Go backend (SouHimBou AI) | Not built | ❌ Absent | No |
| ASAF sovereign binary | Built, validated 6/6 | ✅ Ships | Yes — full demo |

---

## Investor-Safe Language

> ✅ **"The sovereign binary ships with 25,185 compliance controls, FIPS 140-3 crypto,
> and a tamper-evident DAG. Validated. Live."**

> ✅ **"The SouHimBou AI SOC frontend is built — 8+ enterprise dashboards, ~160 KB of
> TypeScript — being wired into the application as Sprint 2."**

> ❌ **"Our full agentic SOC platform is live."** — Go backend doesn't exist;
> frontend not routed; 77-function backend deployment unconfirmed.

---

## Recommended Actions Before Any Investor Demo

**1. Wire one route** (< 2 hours) — Add `/enterprise-agents → EnterpriseAgentDashboard`
to `App.tsx`. The component works; it just needs a route.

**2. Confirm edge function deployment** (< 30 min):
```bash
supabase functions list --project-ref <your-ref>
```

**3. Fix version string** (< 5 min) — Binary says `v2.0`; release tag says `v0.1.1`. Sync them.

---

*Verified: 2026-06-28 · Files: `src/App.tsx`, `EnterpriseAgentDashboard.tsx`,*
*`AgenticComplianceOrchestrator.tsx`, `supabase/functions/`, `souhimbou_ai/SouHimBou.AI/supabase/functions/`*
