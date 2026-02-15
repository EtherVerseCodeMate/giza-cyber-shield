# Audit: threatexpress/procdot_sandbox

**Date:** 2026-02-15
**Repo:** https://github.com/threatexpress/procdot_sandbox
**License:** MIT
**Auditor context:** Evaluating visual analysis and deep inspection capabilities for potential integration into Giza-Cyber-Shield (ADINKHEPRA/ASAF)

---

## 1. What procdot_sandbox Actually Is

A **setup guide and batch automation wrapper** around existing third-party Windows tools:

| Component | Role | Owned by repo? |
|-----------|------|-----------------|
| ProcDot | Graphviz-based process activity visualization | No (procdot.com, closed-source) |
| ProcMon | Process/file/registry monitoring | No (Microsoft Sysinternals) |
| WinDump/WinPcap | Packet capture | No (winpcap.org) |
| Graphviz | Graph rendering engine | No (graphviz.org) |
| AutoAnalysis.bat | Orchestration script to start/stop capture | **Yes** |
| CSV_parser | Python script to filter ProcMon CSV noise | **Yes** |

The repo's own intellectual property amounts to:
- A batch file that orchestrates starting ProcMon + WinDump, waiting for user to execute malware, then stopping capture
- A Python CSV filter script
- Installation/configuration notes

**This is not a library, framework, or engine.** It is documentation and glue scripts for a Windows-only malware analysis workflow.

---

## 2. The "Visual Aspect" - Honest Assessment

The visualization you see in ProcDot demos is **not from this repo**. It comes from **ProcDot itself** (procdot.com), which is:
- A closed-source Windows binary
- Not MIT licensed (ProcDot has its own license)
- Not embeddable or callable as a library
- Dependent on Graphviz DOT format rendering

What ProcDot does well:
- Correlates ProcMon CSV logs with PCAP network captures
- Renders interactive process activity graphs (file I/O, registry, network calls)
- Shows temporal process behavior as directed graphs

**What this means for integration: you cannot extract ProcDot's visualization engine.** The repo only provides setup instructions to use it.

---

## 3. Gap Analysis Against Giza-Cyber-Shield

### What giza-cyber-shield ALREADY has that overlaps or exceeds procdot_sandbox:

| Capability | Giza-Cyber-Shield | procdot_sandbox |
|------------|-------------------|-----------------|
| Process monitoring | `pkg/forensics/collector.go` - cross-platform process enumeration, hashing, chain-of-custody | ProcMon (Windows-only, third-party) |
| Network capture analysis | `pkg/packet/` - PCAP JSON ingestion with cryptographic risk analysis (TLS version, PQC readiness) | WinDump raw PCAP (no analysis) |
| Directed graph visualization | `KhepraDAGVisualization.tsx` using @xyflow/react, `AgentDAG.ts` for causal chains | ProcDot (closed-source, not embeddable) |
| Network topology graphs | `AssetNetworkVisualization.tsx` (Canvas 2D), `TrustConstellation3D.tsx` (3D force-directed) | None |
| Threat investigation | `ThreatInvestigation.tsx` + VirusTotal/Shodan integrations | Manual analyst workflow |
| Process behavior analysis | `DOCAArgus.tsx` - process monitoring layer + ML anomaly detection | Manual ProcDot graph inspection |
| Automation | Full API-driven scanning (Sonar), autonomous agents (Sekhem Triad) | Single batch file |
| Cross-platform | Go + Linux/Windows/macOS | Windows-only |
| Report generation | PDF, Excel, CKL, CycloneDX, JSON, CSV | None (manual screenshots) |

### What procdot_sandbox has that giza-cyber-shield does NOT:

| Capability | Assessment |
|------------|-----------|
| ProcMon CSV correlation with PCAP into unified process behavior graph | Giza has the *data sources* (forensic snapshots, PCAP analysis) but lacks a **unified process-behavior-to-network-activity correlation view** |
| Temporal process activity visualization (what did process X do, in order, with file/reg/net events on a timeline) | Giza's DAG visualization shows security action chains, not raw process behavior timelines |
| CSV noise filtering for ProcMon output | Trivial Python script; not a meaningful capability gap |

---

## 4. Verdict: Should You Integrate This?

### No. Here's why:

**The repo itself provides near-zero reusable code.** It's a batch file and a CSV parser. The visual capability you're attracted to belongs to ProcDot (closed-source) and Graphviz (which you could use directly).

**Your existing stack is architecturally superior** in every dimension:
- You already have DAG visualization (`@xyflow/react`), 3D graphs (`react-force-graph-3d`), and D3
- You already have process monitoring (`pkg/forensics`)
- You already have PCAP analysis (`pkg/packet`)
- You already have a web-based dashboard (Next.js) vs. their desktop-only Windows workflow
- You already have ML-powered anomaly detection vs. their manual graph inspection

**The dependency chain is problematic:**
- ProcDot is closed-source and cannot be embedded
- ProcMon is Windows-only and Microsoft-proprietary
- WinPcap is deprecated (project recommends Npcap now)
- The Cuckoo sandbox it originally used is abandoned (they acknowledge this)

---

## 5. What IS Worth Taking From This (Concept, Not Code)

The **concept** of correlating process behavior logs with network captures into a unified timeline graph is legitimate and valuable. Giza-Cyber-Shield has the data but not the specific visualization.

### Concrete recommendations if you want to close this gap:

1. **Build a Process Behavior Timeline component** (`ProcessBehaviorTimeline.tsx`)
   - Consume data from `pkg/forensics/collector.go` (process snapshots, file hashes, network connections)
   - Render using your existing `@xyflow/react` or D3 stack
   - Show temporal sequence: process spawn -> file I/O -> registry changes -> network calls
   - This is what makes ProcDot useful, and you can build it natively

2. **Add PCAP-to-process correlation in the Go backend**
   - `pkg/packet/` already parses PCAP JSON and analyzes crypto risk
   - Extend it to correlate source PIDs with `pkg/forensics` process snapshots
   - This gives you the same ProcDot-style correlation but with PQC risk scoring on top

3. **Skip everything else from that repo**
   - The batch file automation is trivially replaceable by your existing Sonar orchestrator
   - The CSV parser is a few lines of Python that add no value to your stack

### Effort estimate for building the useful concept natively:
- Frontend component: one new React component using existing visualization libraries
- Backend correlation: extend existing `pkg/packet` and `pkg/forensics` packages
- Significantly less work than trying to shoehorn a Windows batch-file workflow into a Go/Next.js platform

---

## 6. Summary

| Question | Answer |
|----------|--------|
| Is the repo well-built? | It's a setup guide, not a software project. The scripts work for their purpose. |
| Is the license compatible? | MIT - yes, but there's nothing meaningful to license |
| Does it add visual capabilities? | No. The visuals come from ProcDot (closed-source, not in this repo) |
| Does it add deep inspection? | No. The inspection comes from ProcMon (Microsoft proprietary) |
| Should you integrate it? | **No** |
| Should you borrow concepts? | **Yes** - the process-behavior-to-network-correlation visualization pattern is a legitimate gap in your dashboard |
| What should you actually do? | Build a native `ProcessBehaviorTimeline` component using your existing D3/@xyflow stack fed by your existing forensics + packet packages |

**Bottom line:** The attraction is to ProcDot's *output* (the graphs), not to this repo's *code* (a batch file). You already have better building blocks than ProcDot has - you just haven't wired them into this specific visualization yet.
