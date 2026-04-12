# ASAF × NemoClaw Implementation Plan

This implementation plan is derived from the **ASAF × NVIDIA NemoClaw GTM Strategy** to capture the immediate early-adopter market within the first 30–90 days of NemoClaw's launch.

## Phase 1: Core Engine & CLI Integration (Backend)

**Goal:** Enable `asaf scan --profile nemoclaw --target <host> --port 18789` functionality.

1. **NemoClaw Connector (`pkg/connectors/nemoclaw.go`)**
   - Implement discovery logic for NemoClaw/OpenShell configurations:
     - Search standard directories: `~/.nemoclaw`, `/etc/nemoclaw`, `/opt/nemoclaw`, project-level `.nemoclaw` files.
   - Parse OpenShell configuration formats (YAML/JSON).

2. **NMC Check Implementation (`pkg/scanners/nemoclaw_checks.go`)**
   - Implement exactly **NMC-001 through NMC-009**:
     - **NMC-004**: Detect network wildcard egress policies (e.g., `*` or `0.0.0.0/0`).
     - **NMC-007**: Scan for plaintext API keys within agent environments/configs.
     - Implement logic to map all other core checks returning a binary Pass/Fail and structured remediation guidance.

3. **ASAF CLI Update (`cmd/asaf/scan.go`)**
   - Add new flags/parameters supporting the `nemoclaw` target profiles.
   - Hook the results back through the CLI reporter to immediately show OpenShell guardrail status.

## Phase 2: Quantum-Safe Attestation (Backend)

**Goal:** Mint the tangible value-prop: the ADINKHEPRA Certificate.

1. **Attestation Engine Updates**
   - Update the PQC signature payload to formally recognize `platform: "nemoclaw"`.
   - Embed the `risk_score` and specific `NMC-*` check pass/fail matrices into the cryptographic hash.
2. **Evidence & PDF Export (`pkg/stig/pdf_export.go`)**
   - Inject a dedicated NemoClaw section detailing runtime sandboxing context.
   - Clearly delineate "NemoClaw provides rules; ASAF proved rules were enforced natively."

## Phase 3: Single-Funnel UI & Billing (Frontend)

**Goal:** Facilitate seamless evaluation-to-purchase conversion.

1. **Vercel Web App Updates**
   - **Hero Section & Final CTA**: Update sales copy emphasizing the NemoClaw independent audit angle.
   - **Scan Results UI**: Incorporate a polished NemoClaw Badge inside dashboard scan results indicating passing validation criteria.
2. **Onboarding Orchestrator (`/onboarding`)**
   - Streamline the hand-off from scanning `.nemoclaw` environments to the authentication/certification block.
3. **Stripe Billing Integration**
   - Gate the ADINKHEPRA certificate export behind the "ASAF Certify" ($99/mo) Stripe Checkout Session.
   - Update success webhooks to unlock the dashboard state and issue the PDF.
   - Include soft-upsell hooks for "Enterprise" ($499/mo) and "DoD/CMMC Bundle" ($1499/mo) if the client profile indicates Federal or High-Compliance data.

## Phase 4: GTM Actions (Immediate Execution)

1. **Documentation & Advocacy**
   - **Blog Post**: Draft and publish "NemoClaw is great — but your CISO still needs this" mapping NMC-1 through NMC-9.
   - **Community Seeding**: Answer threads on Hacker News & NVIDIA Developer Forums establishing ASAF strictly as an independent third-party auditor.
2. **Business Development**
   - Initiate outreach to Dell enterprise channels utilizing the GB300 NemoClaw preinstallation angle as the icebreaker.
   - File patent claim extension covering the distinct methodology of auditing NemoClaw/OpenShell policy enforcement.

---
### Phase 5: Post-MVP Roadmap items (Enterprise Only)
*Do not block MVP launch for these components.*
- **Continuous Monitoring**: Shift from one-off CLI scans to daemon-driven event monitoring for NemoClaw configuration drift.
- **STIG Overlay Generator**: Build a deterministic mapper associating NemoClaw policy constraints with the broader 36,000+ STIG compliance checklists.
- **Omni-channel Integration**: Expand compliance attestation for multiple messaging platform bots (Slack, Teams, Discord).
