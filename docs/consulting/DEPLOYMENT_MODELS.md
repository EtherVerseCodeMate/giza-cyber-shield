# KHEPRA Protocol: Deployment & Assurance Models

**Version:** 1.0 (Commercial Ready)  
**Date:** 2025-12-14  
**Classification:** APPROVED FOR CLIENT DISTRIBUTION

---

## 1. Executive Summary: The Three Sovereignties
The KHEPRA Audit Platform is designed for high-assurance, regulated environments where data sovereignty is paramount. Unlike traditional SaaS tools that rely on cloud-based AI and telemetry, KHEPRA operates on a **Zero-Dependency** and **Local-First** architecture.

We offer three distinct delivery models, each mathematically guaranteed by our **Post-Quantum Cryptography (PQC)** and **Causal Integrity (DAG)** primitives.

**Operator Manual Reference**: Complete technical deployment procedures are documented in **TC 25-ADINKHEPRA-001** (Training Circular 25, AdinKhepra Iron Bank, Edition 001), an Army-standard operator manual covering installation, operation, and troubleshooting. Request from your account manager.

---

## 2. Product SKUs & Technical Guarantees

### SKU 1: KHEPRA-EDGE (On-Prem / Air-Gapped)
**Target**: Defense, Intelligence, Critical Infrastructure (OT/ICS).  
**Description**: The "Cold Iron" deployment. KHEPRA runs entirely inside the client’s secure enclave. No internet connection required.

| Feature | Technical Guarantee | Contractual Vehicle |
| :--- | :--- | :--- |
| **Integrity** | **Causal Integrity DAG**: Every scan, ingests, and finding is a cryptographically signed event in a local ledger. | License Agreement (Per-Node) |
| **Isolation** | **Zero-Dependency**: No external API calls. No "call home". Native Go binary auditing. | Master Service Agreement (MSA) |
| **Security** | **PQC Identity**: Audit artifacts are signed with **Dilithium-Mode3**, offering formally verifiable proof of origin. | Baseline Install SOW |

**Workflow**:
1.  **Drop**: Client receives signed `adinkhepra` binary and STIG library via secure media.
2.  **Audit**: Client runs `adinkhepra stig scan -root / -out report.json` locally.
3.  **Result**: A locally stored, signed JSON/PDF Risk Report. Data never leaves the room.

**Technical Implementation** (TC 25-ADINKHEPRA-001):
- Installation: Chapter 3, Section 3-2 (Binary Installation)
- STIG Scanning: Chapter 4, Section 4-3 (STIG Compliance Validation)
- Genesis Backups: Chapter 4, Section 4-6 (Phoenix Protocol for disaster recovery)
- License Requirements: Premium or HSM edition (Section 3-4)

---

### SKU 2: KHEPRA-HYBRID (Operator Assist)
**Target**: Financial Services, Healthcare, Regulated Enterprise.  
**Description**: Local execution with remote "Human-in-the-Loop" expert advisory.

| Feature | Technical Guarantee | Contractual Vehicle |
| :--- | :--- | :--- |
| **Transport** | **PQC Envelope**: Data is exported as a `.khepra` bundle, encrypted via **Kyber-1024** and accessible *only* by the authorized Operator Key. | Managed Services Agreement (MSA) |
| **Privacy** | **Symbolic Classification**: The AAE engine strictly enforces what data is packed. Sensitive raw evidence can be redacted, sending only Compliance Status. | Responsibility Matrix (RACI) |
| **Advisory** | **Co-Pilot**: Remote experts analyze the `.khepra` bundle and return a signed Remediation Plan. | Continuous Compliance Addendum |

**Workflow**:
1.  **Scan**: Client runs audit locally.
2.  **Encrypt**: Client runs `adinkhepra kuntinkantan operator_key.pub report.json`.
3.  **Transfer**: The mathematically locked `.adinkhepra` file is emailed/uploaded to the Service Provider.
4.  **Restore**: Service Provider decrypts (`adinkhepra sankofa operator_key report.json.adinkhepra`) and analyzes.

**Technical Implementation** (TC 25-ADINKHEPRA-001):
- Local STIG Scan: Chapter 4, Section 4-3
- PQC Encryption (Kuntinkantan): Chapter 4, Section 4-5 ("Bend Reality" - Kyber-1024 envelope)
- PQC Decryption (Sankofa): Chapter 4, Section 4-5 ("Return and Retrieve")
- Symbolic Classification: Chapter 2, Section 2-2 (Adinkra Symbolism for data tagging)
- License Requirements: Premium edition with encryption capabilities (Section 3-4)

---

### SKU 3: KHEPRA-SOVEREIGN (Dedicated Cloud)
**Target**: GovCloud, Specialized SaaS, Data Residencies.  
**Description**: A dedicated, single-tenant deployment in the client's own VPC/Cloud.

| Feature | Technical Guarantee | Contractual Vehicle |
| :--- | :--- | :--- |
| **Sovereignty** | **Telemetry Silence**: Guaranteed absence of external AI or vendor telemetry. The agent communicates *only* with the client's internal dashboard. | Cloud Data Processing Addendum (DPA) |
| **Residency** | **Region Pinning**: The DAG validates that all artifacts originated from the verified VPC, enforcing data residency controls. | Service Level Agreement (SLA) |
| **Monitoring** | **Zero Trust Loop**: The KASA agent performs continuous self-attestation. Any configuration drift triggers an immediate **Fawohodie** (Revocation) event. | Incident Response Retainer |

**Workflow**:
1.  **Deploy**: KHEPRA Agent deployed as a sidecar/daemon in the client's VPC.
2.  **Monitor**: Real-time STIG drift detection logged to a private S3/Database.
3.  **Alert**: Non-compliance triggers internal alerts within the client's sovereign boundary.

**Technical Implementation** (TC 25-ADINKHEPRA-001):
- Container Deployment: Chapter 3, Section 3-2 (Iron Bank Registry Installation)
- Continuous Validation: Chapter 4, Section 4-1 (Health Monitoring) + Section 4-3 (Automated STIG Scanning)
- Telemetry Silence: Chapter 2, Section 2-1 (Zero-Dependency Architecture)
- Multi-Classification Support: Chapter 2, Section 2-1 (Federated License Coordinator for NIPR/SIPR/JWICS)
- License Requirements: HSM edition with TPM binding and multi-tenant isolation (Section 3-4)

---

## 3. Technical Due Diligence (The "Why Khepra?" Proof)

KHEPRA is not just a tool; it is a **Chain of Custody**.

1.  **Mathematical Non-Repudiation**: Every line item in a KHEPRA report is linked to a time-stamped, signed node in the Trust Constellation DAG. You can mathematically prove *who* ran the scan, *when* it was run, and *that* the data hasn't been altered.
   - **TC Reference**: Section 2-2 (Competitive Differentiation - Mathematical Non-Repudiation)
   - **Technical Detail**: Dilithium3 (ML-DSA-65) signatures over SHA-256 hashes with operator fingerprints

2.  **Future-Proof Crypto**: While competitors rely on RSA/ECC (vulnerable to future quantum attacks), KHEPRA secures your audit trail with NIST-standardized **ML-DSA (Dilithium)** and **ML-KEM (Kyber)**. Your compliance proof remains valid in the post-quantum era.
   - **TC Reference**: Section 2-2 (Future-Proof Compliance Validity)
   - **ROI Impact**: Eliminates multi-million dollar re-certification burden when NIST mandates PQC migration (~2030)

3.  **Semantic Policy**: Our **Adinkra** engine allows us to embed policy directly into the data structure. A record tagged `Eban` (Fence) is treated differently by the code than one tagged `Funtunfunefu` (Dependency), enforcing logic at the data level.
   - **TC Reference**: Section 2-2 (Adinkra Symbolism)
   - **Cultural Foundation**: West African wisdom symbols encoding security semantics (Kuntinkantan = "Bend Reality", Sankofa = "Return and Retrieve")

4.  **36,195-Row Compliance Database**: Embedded STIG↔CCI↔NIST 800-53↔NIST 800-171↔CMMC mappings eliminate external dependencies and supply chain attack vectors.
   - **TC Reference**: Section 2-3 (Database Schema and Coverage)
   - **Business Value**: Automatic CMMC evidence generation for AC.3.018, SC.3.177, SI.3.216 controls

5.  **AR 27-60 Clean-Room Lineage**: Developed under Army intellectual property regulations to ensure audit-ready provenance and zero GPL/AI contamination.
   - **TC Reference**: Section 1-5 (System Provenance and Clean-Room Lineage)
   - **Due Diligence Advantage**: Pre-documented invention disclosures and ownership claims for VC/acquisition scenarios

---

*Verified by SouHimBou AGI Architect*
