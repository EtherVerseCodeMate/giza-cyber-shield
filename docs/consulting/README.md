# Khepra Protocol: Consulting Documentation
**Internal Use - Field Operations & Customer Discovery**

---

## Quick Navigation

### 🎯 Customer Discovery & Sales
1. **[Executive Roundtable Pitch](EXECUTIVE_ROUNDTABLE_PITCH.md)** ⭐ START HERE
   - 30-second elevator pitch
   - Laymen-term explanations
   - Objection handling
   - Pricing tiers
   - Success stories

2. **[Demo Script (Visual)](DEMO_SCRIPT_VISUAL.md)** ⭐ DEMO GUIDE
   - 15-minute live demo breakdown
   - Minute-by-minute talking points
   - Visual aids and terminal outputs
   - Q&A handling scripts
   - Backup plans if demo fails

### 📋 Pilot Program Execution
3. **[Deployment Playbook](DEPLOYMENT_PLAYBOOK.md)** ⭐ OPERATIONS MANUAL
   - Chapter 3: Executive Roundtable demo workflow
   - Chapter 4: 4-week pilot program (day-by-day)
   - Week 1: Discovery & deployment
   - Week 2-3: Analysis & intelligence fusion
   - Week 4: Executive briefing & handoff
   - TTPs: Air-gap, SSH, and validation procedures

4. **[Engagement Playbook](ENGAGEMENT_PLAYBOOK.md)**
   - Original consultant field guide
   - Sonar deployment procedures
   - Clean-room analysis workflow

### 🏗️ Architecture & Strategy
5. **[Deployment Models](DEPLOYMENT_MODELS.md)**
   - Edge (air-gapped): SCIF, submarine, oil rig
   - Hybrid (managed): Corporate LAN/WAN
   - Sovereign (dedicated): Private cloud

6. **[Operational Guide (STIG Audit)](OPERATIONAL_GUIDE_STIG_AUDIT.md)**
   - STIG compliance verification
   - Audit preparation

---

## How to Use This Documentation

### Scenario 1: "I'm pitching to executives tomorrow"
**Read in this order**:
1. [Executive Roundtable Pitch](EXECUTIVE_ROUNDTABLE_PITCH.md) - Memorize key talking points
2. [Demo Script (Visual)](DEMO_SCRIPT_VISUAL.md) - Practice the 15-minute demo
3. [Deployment Playbook](DEPLOYMENT_PLAYBOOK.md) - Chapter 3 only (demo workflow)

**Time required**: 2 hours to prepare

---

### Scenario 2: "I just closed a pilot deal, now what?"
**Read in this order**:
1. [Deployment Playbook](DEPLOYMENT_PLAYBOOK.md) - Chapter 4 (4-week execution plan)
2. [Engagement Playbook](ENGAGEMENT_PLAYBOOK.md) - Detailed Sonar deployment steps
3. [Deployment Models](DEPLOYMENT_MODELS.md) - Choose client's environment type

**Time required**: 1 hour to plan Week 1 kickoff

---

### Scenario 3: "Client is asking technical questions I can't answer"
**Quick Reference**:
- **"How does post-quantum crypto work?"** → [Executive Pitch, Page 8](EXECUTIVE_ROUNDTABLE_PITCH.md#why-this-matters-to-your-business)
- **"What's a DAG?"** → [Demo Script, Minute 9-11](DEMO_SCRIPT_VISUAL.md#minute-9-11-the-proof-dag-visualization)
- **"Can this work in air-gapped environments?"** → [Deployment Playbook, TTP-01](DEPLOYMENT_PLAYBOOK.md#ttp-01-air-gap-deployment-edge)
- **"What compliance frameworks do you support?"** → [Executive Pitch, CMMC Section](EXECUTIVE_ROUNDTABLE_PITCH.md#for-the-ceo-win-contracts)

---

## Key Concepts (Laymen Terms)

### What is Khepra?
**Analogy**: "A security X-ray machine that proves findings with nuclear-grade math instead of asking you to trust the auditor."

**Technical**: Post-quantum cryptographic attestation framework using DAG-based causality modeling.

---

### What is Sonar?
**Analogy**: "A security camera for your servers—takes a snapshot of what's installed, what ports are open, and what hackers can already see."

**Technical**: Lightweight agent (static binary, zero dependencies) that collects system state, correlates with threat intel (CISA KEV, Shodan, MITRE), and encrypts findings with Dilithium3 signatures.

---

### What is the DAG (Trust Constellation)?
**Analogy**: "A 3D map showing how hackers domino from Server A → Server B → Your database. Like Google Maps, but for attack paths."

**Technical**: Directed Acyclic Graph where nodes are findings (assets, vulnerabilities, controls) and edges are causal relationships (lateral movement, privilege escalation, data exfiltration paths).

---

### What is Causal Reality vs Compliance Theater?
**Compliance Theater**: "Checklist says 'SSH configured' ✓, but doesn't catch that it's exposed to the internet with a known exploit."

**Causal Reality**: "Port 22 open + CVE-2021-41617 (actively exploited) + default password + lateral movement to database = **$5.2M breach in 6 steps**. Here's the cryptographic proof."

---

## Pricing Quick Reference

| Tier | Scope | Duration | Price | Best For |
|------|-------|----------|-------|----------|
| **Tier 1** | 10 servers | 4 weeks | $15K | Proof of concept (DoD contractors, startups) |
| **Tier 2** | 50 servers | 8 weeks | $50K | Department pilot (mid-market, healthcare) |
| **Tier 3** | Unlimited (1 BU) | 12 weeks | $150K | Enterprise pilot (Fortune 500, federal) |

**Guarantee**: Find 10+ critical issues or 50% refund
**Early Adopter Discount**: 20% off for first 2 signups

---

## Success Metrics (What to Track)

### During Pilot
- [ ] Kickoff call completed (Week 1, Day 1-2)
- [ ] Sonar agents deployed (Week 1, Day 3-4)
- [ ] Snapshots collected and encrypted (Week 1, Day 5)
- [ ] DAG graph generated (Week 2, Day 10)
- [ ] CMMC scorecard completed (Week 2, Day 12)
- [ ] Executive report delivered (Week 3, Day 15)
- [ ] Executive briefing presented (Week 4, Day 21)

### Post-Pilot (Decision Point)
- [ ] Client feedback collected (within 1 week of briefing)
- [ ] Decision: Expand / Remediate / Pause?
- [ ] If Expand: SOW for enterprise deployment signed
- [ ] If Remediate: Re-scan scheduled (4-8 weeks out)
- [ ] If Pause: Quarterly check-in scheduled

---

## Common Objections & Responses

### "We already use [Tenable/Qualys/Rapid7]"
**Response**: "Those are scanners. Khepra is a proof engine—we integrate with them. Scanner finds problems, Khepra proves causality + generates cryptographic receipts."

**Analogy**: "Scanner = thermometer. Khepra = diagnosis + prescription."

---

### "This sounds expensive"
**Response**: "Compared to what? Traditional audit = $300K/year + 6 months. Pilot = $15K-$50K + 4 weeks. ROI = 500% in year 1 (saved audit fees)."

**Show**: [Pricing comparison slide](EXECUTIVE_ROUNDTABLE_PITCH.md#pricing-pilot-program)

---

### "How do we know it's accurate?"
**Response**: "Three proofs: (1) Cryptographic signatures (quantum-proof), (2) Reproducibility (you can re-run our scans), (3) Third-party correlation (CISA + Shodan + MITRE all agree)."

**Demo**: [Show signature verification](DEMO_SCRIPT_VISUAL.md#minute-12-14-the-deliverable-pdf-report)

---

### "What if it disrupts operations?"
**Response**: "Passive scan = 5-10 min per server, zero disruption. Active scan = 20-30 min, scheduled during maintenance windows. Real example: Scanned 50 servers overnight—IT didn't notice."

**Reference**: [Deployment Playbook, Sonar modes](DEPLOYMENT_PLAYBOOK.md#day-3-4-sonar-deployment)

---

## Next Steps After Reading

1. **If pitching this week**: Print [Executive Roundtable Pitch](EXECUTIVE_ROUNDTABLE_PITCH.md) and practice elevator pitch (30 seconds)
2. **If demoing this week**: Rehearse [Demo Script](DEMO_SCRIPT_VISUAL.md) with timer (15 minutes)
3. **If starting a pilot**: Review [Deployment Playbook Chapter 4](DEPLOYMENT_PLAYBOOK.md) and schedule Week 1 kickoff

---

## Support & Questions

**Internal Slack**: #khepra-field-ops
**Technical Lead**: [Name] - [Email]
**Sales Engineer**: [Name] - [Email]
**Documentation Updates**: Submit PR to this repo

---

**Document Maintained By**: NouchiX Field Operations Team
**Last Updated**: 2025-12-25
**Next Review**: Monthly (after each pilot retrospective)
