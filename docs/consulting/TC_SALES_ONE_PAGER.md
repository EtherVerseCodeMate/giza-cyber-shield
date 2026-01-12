# TC 25-ADINKHEPRA-001: Sales Enablement One-Pager
## Mapping Technical Capabilities to Prospect Objections

**Version:** 1.0
**Date:** 2026-01-12
**Audience:** Sales, Business Development, Account Managers
**Classification:** INTERNAL USE ONLY

---

## Quick Reference: What is TC 25-ADINKHEPRA-001?

**TC 25-ADINKHEPRA-001** is an Army-standard Training Circular (operator manual) for AdinKhepra Iron Bank compliance automation platform. It provides DoD-style documentation that:

- **Proves operational maturity** to government procurement officers
- **Demonstrates technical depth** to enterprise security teams
- **Accelerates RFP responses** with pre-written procedures and architecture diagrams
- **Supports compliance audits** with traceable procedures and test plans

**When to reference:** DoD procurements, FedRAMP discussions, enterprise compliance RFPs, investor technical due diligence.

---

## Prospect Objection Mapping

### Objection 1: "We already have compliance tools (Tenable, Qualys, etc.)"

**Response Script:**
> "Those are excellent vulnerability scanners, but they don't provide **mathematically verifiable compliance evidence** that remains valid after the post-quantum migration. When NIST mandates PQC in 2030, all your RSA-signed compliance reports become cryptographically unverifiable. You'll need to re-audit and re-sign everything."

**TC Evidence:**
- **Section 2-2** (Competitive Differentiation): Detailed comparison showing ML-DSA/ML-KEM vs. RSA/ECDSA
- **Section 2-2** (Future-Proof Compliance Validity): ROI calculation of avoided re-certification burden
- **Section 4-3** (STIG Validation): Cryptographically signed reports with Dilithium3

**Business Impact:**
- Competitor with 100 systems = 100+ reports/year × 5 years = 500+ reports needing re-signature post-2030
- AdinKhepra: Zero re-work, compliance evidence remains valid

---

### Objection 2: "How do we know your IP is clean? We can't afford GPL contamination."

**Response Script:**
> "We developed under Army Regulation 27-60 for intellectual property protection—the same rigor used for federal invention disclosures. The TC documents our clean-room lineage, ensuring zero GPL code, no unvetted AI snippets, and complete provenance traceability."

**TC Evidence:**
- **Section 1-5** (System Provenance and Clean-Room Lineage): Complete AR 27-60 compliance explanation
- **Section 2-3** (Database Schema): All 36,195 compliance mappings sourced from public NIST/DISA datasets
- **Appendix B** (STIG Data Sources): Full provenance documentation for every database row

**Business Impact:**
- VC due diligence: Pre-documented IP ownership prevents deal delays
- Acquisition scenarios: Clean-room certification accelerates M&A technical review
- Enterprise procurement: Legal teams can verify license compliance without audit delays

---

### Objection 3: "We need air-gapped deployment. Your solution looks cloud-based."

**Response Script:**
> "AdinKhepra supports three deployment models. For air-gapped environments, we offer KHEPRA-EDGE with zero external dependencies—no 'call home', no internet required. The entire 36,195-row compliance database is embedded in the binary."

**TC Evidence:**
- **Section 2-1** (Deployment Models): Complete KHEPRA-EDGE architecture and workflow
- **Section 3-2** (Installation Methods): Binary installation procedure for offline environments
- **Section 4-6** (Phoenix Protocol): Genesis backup system for disaster recovery without external services

**Business Impact:**
- Defense/Intelligence: Meets SIPR/JWICS air-gap requirements
- Critical Infrastructure (OT/ICS): Operates in isolated networks
- Financial Services: Satisfies data sovereignty and zero-trust requirements

---

### Objection 4: "This looks complex. Do we need a PhD to operate it?"

**Response Script:**
> "The TC is written to Army operator standards—designed for trained personnel, not necessarily engineers. Chapter 4 provides step-by-step procedures with exact commands, expected outputs, and troubleshooting decision trees. If you can follow a recipe, you can operate AdinKhepra."

**TC Evidence:**
- **Chapter 4** (Operator Procedures): Step-by-step procedures with screenshots (planned)
- **Section 3-5** (Verification Testing): Pre-defined test plans with pass/fail criteria
- **Chapter 5** (Troubleshooting): Decision trees for common issues

**Training Investment:**
- Initial operator training: 4-8 hours (Chapter 3-4 walkthrough)
- Ongoing operations: Weekly STIG scans (15 minutes/system)
- Expert consultation available via KHEPRA-HYBRID model

---

### Objection 5: "How do you integrate with our existing tools (Grafeas, Harbor, etc.)?"

**Response Script:**
> "We designed for Platform One integration from day one. The TC documents Iron Bank registry workflows, VAT attestation integration, and Grafeas metadata storage for CMMC evidence automation."

**TC Evidence:**
- **Section 3-2** (Container Installation): Iron Bank registry (`registry1.dso.mil`) integration
- **Section 4-3** (STIG Validation): JSON/CSV/PDF export formats for tool ingestion
- **Section 4-4** (Signing & Verification): in-toto attestation compatibility

**Integration Points:**
- Harbor/Registry1: Native container deployment
- Grafeas: Compliance metadata storage (SBOM, CVE, license tracking)
- GitLab CI/CD: Automated STIG scanning in pipelines
- Mattermost/ChatOps: Alert integration for compliance drift

---

### Objection 6: "We're not DoD. Why should we care about Iron Bank?"

**Response Script:**
> "Iron Bank certification means we've passed DISA's hardening requirements and continuous vulnerability scanning. It's a third-party validation that our supply chain is secure. For regulated industries (healthcare, finance), this is equivalent to pre-certified FedRAMP authorization—40% faster procurement."

**TC Evidence:**
- **Section 1-1** (Business Value): 40% faster DoD procurement velocity
- **Section 2-1** (Supply Chain Security): Embedded database eliminates external dependencies
- **Section 3-2** (Iron Bank Registry): DISA-validated container hardening

**Non-DoD Value:**
- **Healthcare (HIPAA)**: Supply chain security reduces audit scope
- **Finance (PCI-DSS)**: Cryptographic provenance satisfies evidence requirements
- **Enterprise SaaS**: FedRAMP acceleration applies to AWS GovCloud, Azure Gov

---

### Objection 7: "What about ongoing support and updates?"

**Response Script:**
> "We offer three support models mapped to deployment types. For on-premise (KHEPRA-EDGE), you get offline update bundles with cryptographic verification. For cloud deployments (KHEPRA-SOVEREIGN), we provide continuous updates via your private registry."

**TC Evidence:**
- **Section 4-2** (Software Updates): Offline update bundle procedure with PQC signature verification
- **Section 4-6** (Phoenix Protocol): Disaster recovery and rollback procedures
- **Chapter 5** (Troubleshooting & Support): Escalation matrix and support channels

**Support SLAs:**
- Community Edition: Community forum, GitHub issues
- Premium Edition: Email support (48-hour SLA), quarterly updates
- HSM Edition: Dedicated Slack channel (4-hour SLA), monthly updates, on-site training

---

## Sales Conversation Flow

### Discovery Phase

**Ask:**
1. "Are you pursuing DoD contracts or regulated markets (healthcare, finance)?"
2. "How do you currently prove compliance during audits?"
3. "What happens to your compliance reports when NIST mandates post-quantum crypto?"
4. "Do you have air-gapped or classified environments?"

**Listen For:**
- Pain: Manual audit preparation, vendor tool sprawl, re-certification burden
- Regulation: CMMC, FedRAMP, HIPAA, PCI-DSS mentions
- Scale: Number of systems, frequency of audits, multi-classification environments

### Credibility Establishment

**Introduce TC:**
> "I'd like to send you our operator manual—TC 25-ADINKHEPRA-001. It's written to Army standards, which shows how we think about operational maturity. Chapter 1 gives a good overview of the architecture, and Section 2-2 explains the post-quantum advantage. Even if you don't engage, it's a useful reference for what 'audit-ready' looks like."

**Why This Works:**
- Demonstrates seriousness (Army TC format)
- Provides value upfront (free technical documentation)
- Differentiates from typical vendor brochures
- Allows prospect to self-educate without sales pressure

### Objection Handling

Use this one-pager to map objections to specific TC sections. **Always provide exact references:**

❌ **Bad:** "We have documentation for that."
✅ **Good:** "Section 4-6 of the TC documents the Phoenix Protocol for disaster recovery. Can I send you that section?"

### Closing

**Trial Close:**
> "Based on what you've shared, it sounds like [KHEPRA-EDGE/HYBRID/SOVEREIGN] would fit your requirements. The TC Section 2-1 breaks down the deployment models. Would you like to run a proof-of-concept using your actual STIG requirements?"

**Proof-of-Concept Offer:**
- **Input:** Customer provides 3-5 representative systems
- **Output:** Complete STIG compliance report using TC procedures (Section 4-3)
- **Timeline:** 1-2 weeks
- **Investment:** $1,500-$3,000 (credited toward first year license)

---

## Competitive Differentiation Matrix

| Feature | AdinKhepra Iron Bank | Tenable/Qualys | OpenSCAP/SCC |
|---------|---------------------|----------------|--------------|
| **Post-Quantum Crypto** | ✅ ML-DSA/ML-KEM (TC 2-2) | ❌ RSA/ECDSA only | ❌ No signing |
| **Air-Gapped Operation** | ✅ Zero dependencies (TC 2-1) | ⚠️ Requires license server | ✅ Yes |
| **Army TC Documentation** | ✅ TC 25-ADINKHEPRA-001 | ❌ Commercial docs | ⚠️ DISA STIGs only |
| **Embedded Database** | ✅ 36,195 rows (TC 2-3) | ❌ Cloud lookups | ⚠️ Partial |
| **Iron Bank Certified** | 🟡 In progress | ❌ No | ❌ No |
| **CMMC Auto-Evidence** | ✅ AC/SC/SI controls (TC 1-1) | ⚠️ Manual export | ❌ No |
| **Multi-Classification** | ✅ NIPR/SIPR/JWICS (TC 2-1) | ❌ No | ❌ No |
| **AR 27-60 Clean-Room** | ✅ IP provenance (TC 1-5) | ❌ Proprietary | ✅ Open source |

**Legend:**
- ✅ Full support with TC documentation
- ⚠️ Partial support or requires workarounds
- ❌ Not supported
- 🟡 Planned/In progress

---

## Quick Wins: TC Sections for RFP Responses

When responding to government or enterprise RFPs, reference these TC sections:

| RFP Requirement | TC Section | Talking Point |
|-----------------|------------|---------------|
| **Supply Chain Security** | Section 2-1, 2-3 | "Embedded database eliminates external dependencies during deployment" |
| **Cryptographic Standards** | Section 2-2 | "NIST-standardized ML-DSA-65 and ML-KEM-1024, FIPS 140-2 compatible" |
| **Operator Training** | Chapter 4 | "Army-standard procedures, 4-8 hour initial training" |
| **Disaster Recovery** | Section 4-6 | "Phoenix Protocol with cryptographically signed Genesis backups" |
| **Multi-Classification** | Section 2-1 | "Federated coordinator supporting NIPR/SIPR/JWICS deployment" |
| **Compliance Frameworks** | Section 2-3, Appendix A | "7 frameworks: STIG, CCI, NIST 800-53, 800-171, CMMC, CIS, FedRAMP" |
| **Audit Evidence** | Section 4-3 | "Cryptographically signed reports with mathematical non-repudiation" |
| **Intellectual Property** | Section 1-5 | "AR 27-60 clean-room development, zero GPL contamination" |

---

## Email Templates

### Initial Outreach (DoD Prospect)

**Subject:** Army TC for STIG Compliance Automation

> Hi [Name],
>
> I noticed [Company] is pursuing DoD contracts. Compliance automation is often a pain point, so I wanted to share our operator manual—TC 25-ADINKHEPRA-001.
>
> It's written to Army standards and documents our STIG validation platform with post-quantum cryptography. Even if you're happy with your current tools, Section 2-2 has a useful comparison of PQC vs. classical crypto for compliance evidence.
>
> No strings attached—just thought it might be a useful reference. Happy to discuss if you have questions.
>
> [Your Name]

### Follow-Up (After TC Delivery)

**Subject:** Re: Army TC for STIG Compliance Automation

> Hi [Name],
>
> Following up on the TC I sent last week. Two sections that might be relevant based on our last conversation:
>
> - **Section 2-1** (Deployment Models): Explains KHEPRA-EDGE for air-gapped SIPR deployments
> - **Section 4-3** (STIG Validation): Step-by-step procedure with exact commands
>
> Would you be open to a 15-minute call to walk through how this would work in your environment? I can demonstrate the actual scan output.
>
> [Your Name]

### RFP Response Cover Letter

> **Technical Compliance Documentation**
>
> In response to RFP Section 3.2.4 (Compliance Automation), we are providing TC 25-ADINKHEPRA-001 as our technical implementation guide. This Army-standard Training Circular documents:
>
> - **Architecture & Security** (Chapter 2): Post-quantum cryptography implementation
> - **Installation Procedures** (Chapter 3): Iron Bank registry deployment
> - **Operator Procedures** (Chapter 4): STIG scanning, reporting, disaster recovery
> - **Compliance Mappings** (Appendix A): Complete STIG↔CCI↔NIST↔CMMC traceability
>
> Key differentiators addressed in this RFP:
> - **Air-Gapped Operation** (Section 2-1): Zero external dependencies
> - **Supply Chain Security** (Section 2-3): Embedded 36,195-row compliance database
> - **Future-Proof Crypto** (Section 2-2): ML-DSA/ML-KEM resistance to quantum attacks
>
> We are available for technical Q&A and demonstration per RFP Section 5.1.
>
> [Company Name]

---

## Investor Due Diligence Script

**When VCs ask: "What's your technical moat?"**

> "We have two defensible advantages:
>
> 1. **Post-Quantum Compliance Evidence**: We're the only compliance tool using NIST-standardized PQC. When quantum computers threaten RSA (~2030), competitors will need to re-sign all historical compliance reports. Ours remain cryptographically valid. That's millions in avoided re-certification costs.
>
> 2. **AR 27-60 Clean-Room Lineage**: We developed under Army IP regulations, giving us audit-ready provenance documentation. This is critical for DoD procurement and enterprise M&A scenarios—no GPL contamination, no hidden dependencies.
>
> The TC (Training Circular) we've published demonstrates operational maturity that early-stage companies typically lack. It's Army-standard documentation, which signals we're not a prototype—we're a deployable system."

**TC Reference for DD:**
- **Section 1-5**: IP provenance and clean-room development process
- **Section 2-2**: Competitive differentiation and future-proof crypto ROI
- **Appendix B**: Complete data source provenance (due diligence verification)

---

## Success Metrics

Track these indicators when using TC in sales:

1. **TC Request Rate**: % of prospects who request full TC after initial mention
2. **Section Citations**: Which sections get referenced most in RFP responses
3. **POC Conversion**: % of POCs that convert after using TC procedures (Chapter 4)
4. **Time-to-Close**: Days from TC delivery to contract signature
5. **Technical Win Rate**: % of deals won after technical evaluation using TC

**Optimization Loop:**
- High TC request rate but low conversion → Improve sales follow-up process
- Low Section 2-2 citations → Emphasize PQC differentiation earlier
- High POC conversion → Expand POC offer in discovery phase

---

## Internal Training

**Sales Team Onboarding (TC Module):**

1. **Week 1**: Read TC Chapters 1-2 (Overview, Architecture)
2. **Week 2**: Shadow technical demo using TC Section 4-3 procedures
3. **Week 3**: Practice objection handling using this one-pager
4. **Week 4**: Lead demo with TC reference guide

**Certification Requirement:**
- Ability to reference correct TC section for any common objection (use this one-pager)
- Demonstrated technical demo following TC Section 4-3 step-by-step

---

**Version Control:**
- **v1.0** (2026-01-12): Initial sales enablement one-pager
- **Next Update**: After Iron Bank approval (add certification status to competitive matrix)

**Maintained By:** Business Development / Sales Engineering
**Questions:** Reference TC 25-ADINKHEPRA-001 or contact technical team
