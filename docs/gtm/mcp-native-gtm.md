# MCP-Native GTM System

## Positioning

KHEPRA is a post-quantum MCP security layer that wraps agent tool calls with policy enforcement, signed execution evidence, and replayable audit provenance for regulated AI systems.

MCP is the distribution and control plane. KHEPRA's signed DAG is the evidence ledger.

## Product Lines

| Product | Buyer | Job |
| --- | --- | --- |
| KHEPRA MCP | AI platform and security engineers | Secure MCP tool execution, validation, signing, and local audit evidence. |
| SouHimBou AI | Agentic AI and security operations teams | MCP flight recorder, prompt/tool-call monitoring, and behavioral evidence. |
| AdinKhepra ASAF | Compliance, GRC, and DIB leadership | CMMC/STIG evidence automation and attested audit timelines. |
| Phantom Node | Air-gapped and edge operators | On-premise sovereign runtime for regulated networks. |

## Packaging Motion

1. Official MCP Registry: publish `io.github.etherversecodemate/khepra-mcp` as the canonical install surface.
2. GitHub Container Registry: publish OCI image `ghcr.io/etherversecodemate/khepra-mcp:<version>`.
3. Developer docs: lead with a five-minute stdio smoke test and a signed `tools/list` demo.
4. Enterprise conversion: route serious users to the AI Agent Evidence Gap Assessment.

## Revenue Model

| Tier | Price | Scope |
| --- | --- | --- |
| Community | Free | Local stdio MCP server, local signatures, volatile/local evidence. |
| Developer Pro / Mesh | Usage-based | Hosted DAG anchoring, evidence export, org-level policy, team telemetry. |
| Enterprise Sovereign | $50k+/year | Air-gapped Phantom Node, deployment support, CMMC/STIG evidence mapping, procurement support. |
| Diagnostic Assessment | $5k fixed fee | 48-hour AI Agent Evidence Gap Assessment for 3-5 repos or workflows. |

## AI Agent Evidence Gap Assessment

Offer:

- Review 3-5 repositories or agent workflows.
- Identify tool-call risk paths, prompt injection surfaces, and untracked privileged actions.
- Generate sample signed MCP evidence using KHEPRA.
- Map findings to CMMC Level 2 / NIST SP 800-171 evidence expectations.
- Deliver a remediation memo and pilot proposal.

Deliverables:

- Executive risk memo.
- Technical findings table.
- Sample KHEPRA evidence artifact.
- Recommended MCP guardrail architecture.
- Pilot scope and price.

## Design Partner Outreach Email

Subject: 48-hour AI agent evidence assessment for CMMC teams

Hi {{name}},

We are piloting KHEPRA, a post-quantum MCP security layer that turns AI agent tool calls into signed, replayable audit evidence.

For DIB teams preparing for CMMC enforcement, the risk is that autonomous coding and security agents now take actions that traditional evidence workflows do not capture. KHEPRA wraps those MCP tool calls with validation, policy routing, PQC signatures, and a tamper-evident audit chain.

We are offering a fixed-fee 48-hour assessment for 3-5 repositories or agent workflows. The output is a concise findings memo, a signed evidence sample, and a pilot architecture mapped to CMMC Level 2 / NIST SP 800-171 expectations.

Would a confidential technical briefing next week be useful?

Best,
{{sender}}

## LinkedIn Launch Copy

AI agents now execute code, inspect systems, call tools, and make security recommendations. Most organizations still audit those actions after the fact with fragmented logs.

We are releasing the KHEPRA MCP server: a post-quantum security layer for Model Context Protocol workflows.

KHEPRA wraps MCP tool calls with:

- input validation and path safety checks,
- risk-classified execution,
- post-quantum signed results,
- DAG-oriented evidence records,
- local stdio support for developer tools,
- OCI packaging for registry distribution.

The goal is simple: make agent activity provable enough for regulated environments.

We are looking for design partners in defense, critical infrastructure, and enterprise AI security who need better evidence for agentic workflows.

## Pilot SOW Outline

1. Discovery: agent workflow inventory, MCP hosts, current audit controls.
2. Deployment: local KHEPRA MCP server or OCI runtime.
3. Evidence: signed tool-call artifacts and DAG export.
4. Control mapping: CMMC Level 2 / NIST SP 800-171 evidence alignment.
5. Report: operational findings, pilot KPIs, production architecture.

Pilot duration: 2-4 weeks.

Pilot success metrics:

- Number of MCP tool calls captured.
- Percentage of privileged calls with signed evidence.
- Mean time to produce an evidence packet.
- Number of control mappings supported by generated artifacts.
