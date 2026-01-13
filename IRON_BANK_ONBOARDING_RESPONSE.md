# Iron Bank Onboarding - Response to Jeff Goluba
**Date:** January 13, 2026
**Product:** ADINKHEPRA (Agentic Security Attestation Framework)
**Vendor:** NouchiX SecRed Knowledge Inc.
**Contact:** Souhimbou Doh Kone (SGT, US Army Reserve) - skone@alumni.albany.edu

---

## Response to Onboarding Questions

### 1. What does your software do? (2-3 sentences)

**ADINKHEPRA** is a post-quantum cryptographic attestation engine that creates verifiable, immutable security audit trails for DoD environments. It combines NIST-approved post-quantum cryptography (ML-DSA/Dilithium3, ML-KEM/Kyber-1024) with STIG compliance automation, cryptographic bill of materials (CBOM) generation, and directed acyclic graph (DAG) forensics to provide mathematically-provable security postures rather than checklist-driven compliance theater. The system operates in air-gapped, disconnected tactical edge environments with zero external dependencies, specifically designed for DoD zero-trust architectures at Impact Levels 2-6.

---

### 2. Who is your end user and how do you expect them to use it? Are you already working with a government program?

#### End Users

**Primary Users:**
- **DoD System Administrators & Security Officers** at military installations (NIPR/SIPR/JWICS environments)
- **Defense contractors** requiring CMMC Level 3 compliance and supply chain risk management
- **DoD DevSecOps teams** needing continuous STIG validation and PQC migration support
- **Cyber Protection Teams (CPT)** conducting threat hunting and forensic investigations

**Use Cases:**
1. **STIG Compliance Automation:** Continuous validation of RHEL-09-STIG-V1R3 controls with automated CKL (checklist) generation
2. **Post-Quantum Cryptography Discovery:** Scanning systems for cryptographic assets vulnerable to quantum computing attacks (Harvest Now, Decrypt Later threats)
3. **Supply Chain Risk Management:** Generating Software/Cryptographic Bills of Materials (SBOM/CBOM) per EO 14028 and NIST SP 800-218
4. **Forensic-Grade Audit Trails:** Creating tamper-proof, PQC-signed event chains using directed acyclic graphs for incident response
5. **Air-Gapped Operations:** Operating in disconnected tactical edge environments (submarines, aircraft, forward operating bases) with no internet connectivity

#### Government Program Status

**Current Government Engagement:**
- **US Army Reserve:** Developer (SGT Souhimbou Kone) is an active-duty US Army Reserve soldier with Secret clearance
- **DoD Platform One:** Preparing for Iron Bank submission (this onboarding process)
- **DISA STIG Compliance:** Product implements RHEL-09-STIG-V1R3 with 13 custom post-quantum cryptography controls
- **NIST PQC Migration:** Aligned with NIST IR 8547 (Transition to Post-Quantum Cryptography Standards)

**Target Deployments:**
- DoD Impact Level 2-6 environments (NIPR/SIPR/JWICS)
- Defense Industrial Base (DIB) contractors requiring CMMC Level 3
- National Guard cyber protection teams
- Air Force cyber squadrons
- Navy Information Warfare Centers

**Pilot Programs (Proposed):**
- Army Cyber Center of Excellence (Fort Moore, GA)
- Air Force Materiel Command (AFMC) software factories
- Defense Logistics Agency (DLA) supply chain security

---

### 3. Import/Export Controls

**Status:** ⚠️ **CRITICAL CLARIFICATION REQUIRED**

#### Our Understanding of Export Controls

**Current Assessment:** ADINKHEPRA **DOES NOT** have export controls that would restrict IL2 deployment.

**Rationale:**
1. **Cryptography Used:** All cryptographic algorithms are **publicly available, open-source, NIST-approved standards**:
   - **ML-DSA (Dilithium3):** FIPS 204 (approved August 2024)
   - **ML-KEM (Kyber-1024):** FIPS 203 (approved August 2024)
   - **ECDSA P-384:** FIPS 186-4 (approved since 2013)
   - **AES-256-GCM:** FIPS 197 (approved since 2001)
   - **SHA-3:** FIPS 202 (approved since 2015)

2. **No Proprietary Cryptographic Algorithms:** While ADINKHEPRA contains a proprietary lattice-based signature scheme (Khepra-PQC) for research purposes, this is **defense-in-depth only** and **not required for operation**. All security-critical operations use NIST FIPS-approved algorithms.

3. **Open-Source Dependencies:** All cryptographic implementations come from:
   - Cloudflare CIRCL library (open-source, MIT license)
   - Go standard library `crypto/` package (BSD license)
   - BoringSSL (FIPS 140-3 validated, open-source)

4. **EAR Classification:** Under 15 CFR § 740.13(e), publicly available cryptographic software is generally exempt from export licensing (EAR99).

#### Potential Confusion in Our Initial Submission

**What We May Have Indicated Incorrectly:**

If we checked "Yes" to import/export controls, this was **in error**. We may have been overly cautious due to:
- Proprietary Khepra-PQC algorithm (which is **not export-controlled** but is **trade secret protected**)
- Advanced cryptanalysis capabilities (cryptographic asset discovery)
- Military-focused use case

**Corrected Answer:** **NO, ADINKHEPRA does not have import/export controls** that would prevent IL2 registry deployment.

#### Request for Guidance

**Question for Iron Bank Team:**

Does Iron Bank consider **cryptographic vulnerability scanning tools** (tools that discover and classify cryptographic algorithms in target systems) to be export-controlled?

- ADINKHEPRA includes capabilities to scan systems and identify weak cryptographic implementations (RSA-1024, MD5, etc.)
- This is similar to commercial tools like Qualys, Tenable, or Rapid7
- If this creates export control concerns, we can document these features as **optional modules** that can be disabled for international deployments

**Action Required from Our Team:**

If Iron Bank requires formal export control classification, we can obtain:
1. **CCATS (Commodity Classification Automated Tracking System)** determination from Bureau of Industry and Security (BIS)
2. **Self-classification** under EAR with legal counsel review
3. **Export compliance documentation** if needed for mission partners

**Recommendation:** We request a meeting with Iron Bank's export control liaison to clarify whether our STIG compliance + PQC scanning capabilities trigger ITAR/EAR restrictions.

---

### 4. Repository Structure Preference

#### Proposed Repository Organization

We prefer a **flat, single-repository structure** for the initial submission, with the option to expand into a multi-repo structure if additional modules are added later.

**Option A: Single Repository (Preferred for Initial Submission)**

```
ironbank/nouchix/
  └── adinkhepra/
      ├── Dockerfile
      ├── hardening_manifest.yaml
      ├── README.md
      ├── LICENSE
      ├── CHANGELOG.md
      ├── scripts/
      │   ├── functional-test.sh
      │   └── healthcheck.sh
      ├── justifications/
      │   └── README.md (for VAT findings)
      └── docs/
          ├── DEPLOYMENT_GUIDE.md
          └── STIG_COMPLIANCE.md
```

**Rationale:**
- ADINKHEPRA is distributed as a **single binary** (`sonar`) that includes all functionality
- No separate analyzers, agents, or helper tools (all-in-one design for air-gapped simplicity)
- Reduces complexity for initial hardening and accreditation
- Aligns with Binary Ingestion pattern (pre-compiled, signed binaries)

---

**Option B: Multi-Repository (Future Expansion)**

If we add additional components in the future (e.g., web dashboard, separate agent daemon, Kubernetes operator), we would propose:

```
ironbank/nouchix/
  ├── adinkhepra/
  │   └── core/              # Main attestation engine (sonar binary)
  ├── adinkhepra-agent/      # Optional telemetry agent (if separated)
  ├── adinkhepra-daemon/     # Continuous monitoring daemon (if separated)
  └── adinkhepra-webui/      # Web visualization dashboard (if added)
```

**This is similar to:**
- **GitLab's structure** (as shown in your example) with separate repos for `gitlab`, `gitlab-runner`, `gitlab-pages`, etc.
- **Prometheus ecosystem** (prometheus, alertmanager, pushgateway, node-exporter)
- **Elasticsearch stack** (elasticsearch, kibana, logstash)

---

#### Versioning Strategy

**Semantic Versioning:** `MAJOR.MINOR.PATCH` (e.g., `v1.0.0`, `v1.1.0`, `v2.0.0`)

**Release Cadence:**
- **Critical Security Updates:** As needed (within 24-48 hours of CVE disclosure)
- **Feature Releases:** Quarterly (aligned with Platform One release cycles)
- **Major Versions:** Annually (or when breaking changes are introduced)

---

#### Container Tagging Strategy

**Proposed Tags:**
```
registry1.dso.mil/nouchix/adinkhepra:1.0.0      # Specific version (immutable)
registry1.dso.mil/nouchix/adinkhepra:1.0        # Minor version (updates with patches)
registry1.dso.mil/nouchix/adinkhepra:1          # Major version (updates with minor releases)
registry1.dso.mil/nouchix/adinkhepra:latest     # Latest stable release
```

**Note:** We understand Iron Bank best practices may prefer **immutable tags only** (no `latest` or floating tags). We defer to Platform One standards.

---

## Additional Information for Onboarding

### Technical Architecture Summary

**Container Base Image:** `registry1.dso.mil/ironbank/redhat/ubi/ubi9-minimal`
**Language:** Go 1.25.3 (statically compiled, CGO_ENABLED=0)
**Binary Size:** ~50 MB (compressed: ~15 MB)
**Runtime Requirements:**
- CPU: 1 core minimum (2 cores recommended)
- RAM: 512 MB minimum (1 GB recommended)
- Storage: 100 MB (base) + 1 GB (for DAG database)
- Network: **None required** (air-gap capable)

### Security Hardening Applied

✅ **RHEL-09-STIG-V1R3** compliant (13 custom PQC controls added)
✅ **Non-root execution** (UID 1001, GID 0)
✅ **Read-only root filesystem** compatible
✅ **No setuid/setgid binaries**
✅ **Minimal attack surface** (UBI9-minimal base, no unnecessary packages)
✅ **FIPS 140-3 compliant** (via BoringCrypto when enabled)
✅ **OpenShift compatible** (arbitrary UID support)

### Continuous Monitoring Commitment

**CVE Response SLA:**
- **Critical (CVSS 9.0-10.0):** Acknowledgment within 24 hours, patch within 72 hours
- **High (CVSS 7.0-8.9):** Acknowledgment within 48 hours, patch within 1 week
- **Medium (CVSS 4.0-6.9):** Acknowledgment within 1 week, patch in next quarterly release

**VAT Monitoring:** We commit to daily monitoring of the VAT dashboard and timely justifications for all findings.

### Points of Contact

**Primary Technical Contact:**
SGT Souhimbou Doh Kone
US Army Reserve (Active)
Email: skone@alumni.albany.edu
Clearance: Secret (Active)

**Alternate Contact:**
NouchiX SecRed Knowledge Inc.
Email: cyber@nouchix.com
Phone: [To be provided]

**Business Development:**
Email: business@nouchix.com

---

## Questions for Iron Bank Team

1. **Export Controls:** Can we schedule a meeting with your export control liaison to clarify whether our cryptographic scanning capabilities trigger ITAR/EAR restrictions?

2. **Proprietary Algorithms:** Our product includes a proprietary post-quantum signature scheme (Khepra-PQC) as **defense-in-depth**, but all security-critical operations use NIST FIPS-approved algorithms. Will reviewers require additional documentation/justification for this?

3. **Binary Ingestion Pattern:** We plan to use the Binary Ingestion pattern (pre-compiled, signed binaries) to protect our IP. Can you confirm this is acceptable for our use case?

4. **Air-Gapped Validation:** Our product is designed for 100% offline operation. Do you have specific tests or requirements to validate air-gapped capability during the hardening process?

5. **Multi-Arch Support:** Our initial submission will be **AMD64 only**. Is ARM64 support required for initial approval, or can we add it in a subsequent release?

6. **STIG Validation:** We implement 13 custom PQC-specific STIG controls beyond RHEL-09-STIG-V1R3. Can these custom controls be documented in our hardening submission, or do they need to be submitted separately to DISA?

---

## Next Steps (Our Commitment)

1. **Complete Onboarding Registration** at repo1.dso.mil ✅ (in progress)
2. **Finalize Repository Structure** based on your feedback ⏳ (awaiting guidance)
3. **Prepare Hardening Artifacts** (README, LICENSE, CHANGELOG, hardening_manifest.yaml) ⏳ (in progress)
4. **Calculate SHA256 Checksums** for all binary artifacts ⏳ (in progress)
5. **Submit Initial Hardening Request** within 2 weeks of onboarding approval 📅 (target: January 27, 2026)

---

## Acknowledgment

Thank you for your support in onboarding ADINKHEPRA to Iron Bank! We are excited to contribute to Platform One's mission of fostering trust, innovation, and collaboration in the DoD software ecosystem.

We understand the rigor of the Iron Bank hardening process and are committed to working closely with your team to meet all security and compliance requirements.

**We look forward to your guidance on the questions above and are available for a call at your earliest convenience.**

---

**Respectfully submitted,**

SGT Souhimbou Doh Kone
Founder & Lead Developer
NouchiX SecRed Knowledge Inc.

**Distribution Statement A:** Approved for public release. Distribution is unlimited.

---

## Appendix: Supporting Documentation

The following documents are available upon request:

1. **ADINKHEPRA Architecture Overview** (`docs/architecture/CAUSAL_REALITY_ANALYSIS.md`)
2. **Cryptographic Stack Specification** (`docs/architecture/CRYPTOGRAPHIC_STACK.md`)
3. **STIG Compliance Matrix** (`pkg/stig/rhel09_stig.go` - 13 PQC controls)
4. **NIST 800-53 Mapping** (`pkg/compliance/nist80053.go`)
5. **Deployment Playbook** (`docs/consulting/DEPLOYMENT_PLAYBOOK.md`)
6. **Patent Application** (USPTO filing pending - trade secret protection)

**Classification:** UNCLASSIFIED
**Document Control:** IB-ONBOARD-20260113-v1.0
