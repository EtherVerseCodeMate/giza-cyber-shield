# License Tiers and Deployment Models
**AdinKhepra Iron Bank - Revenue and Protection Strategy**

## 🎯 Three-Tier Licensing Model

### Tier 1: Community Edition (FREE)
**Target**: Open-source community, evaluation, non-DoD users

**Features**:
- ✅ Basic post-quantum cryptography (Cloudflare CIRCL)
- ✅ Dilithium3 signatures (NIST-standard implementation)
- ✅ Kyber1024 encryption (NIST-standard implementation)
- ✅ CVE scanning with local database
- ✅ Basic STIG compliance checking
- ❌ NO proprietary lattice algorithms
- ❌ NO white-box cryptography
- ❌ NO advanced compliance mapping (36K+ rows)
- ❌ NO license enforcement required

**Crypto Backend**: `github.com/cloudflare/circl`

**Cost to Customer**: $0
**Cost to NouchiX**: $0 (open-source distribution)

**Use Case**: Evaluation, academic research, non-classified systems

---

### Tier 2: DoD Premium (LICENSED) ⭐ DEFAULT
**Target**: DoD installations, defense contractors, IC agencies

**Features**:
- ✅ **Proprietary PQC algorithms** (your $45M lattice optimizations)
- ✅ **White-box cryptography** (algorithm + key obfuscation)
- ✅ **Advanced compliance mapping** (STIG↔CCI↔NIST 800-53↔CMMC)
- ✅ **Custom lattice reduction** (performance + security improvements)
- ✅ **License validation** (online validation + hourly heartbeat)
- ✅ **Binary obfuscation** (garble + strip + upx)
- ✅ **Legal protection** (18 U.S.C. § 1831, DFARS 252.227-7013)
- ✅ **Remote revocation** (immediate license kill switch)
- ❌ NO HSM dependency (works standalone)

**Crypto Backend**: `pkg/adinkra` (your proprietary implementation)

**Cost to Customer**: License fee (annual or perpetual)
**Cost to NouchiX**: Telemetry server hosting (~$5/month Cloudflare Workers)

**Requirements**:
- Valid DoD contract or authorization
- Machine ID registration with telemetry.souhimbou.org
- Network access for license validation (startup + hourly)
- Air-gapped deployments: License file delivered via secure courier

**Use Case**:
- Production DoD systems (NIPRNet, SIPRNet)
- Defense contractor environments
- IC agency deployments (NSA, DIA, CIA)
- FedRAMP/CMMC compliance requirements

---

### Tier 3: DoD Premium + HSM (OPTIONAL UPGRADE)
**Target**: High-security environments (SCIF, SAP, TS/SCI)

**Features**:
- ✅ **Everything in Tier 2** (premium PQC, white-box, compliance mapping)
- ✅ **HSM integration** (YubiHSM 2 or AWS CloudHSM)
- ✅ **FIPS 140-2 Level 3** tamper-proof hardware
- ✅ **Algorithm execution in secure hardware** (cannot be extracted)
- ✅ **Physical security** (HSM self-destructs on tamper)
- ✅ **Audit logging** (HSM tracks all cryptographic operations)

**Crypto Backend**: `HSM` (YubiHSM SDK or AWS CloudHSM API)

**Cost to Customer**:
- License fee (same as Tier 2)
- **+ HSM hardware/service** (customer purchases separately):
  - YubiHSM 2: ~$650 one-time (customer buys from YubiCo)
  - AWS CloudHSM: ~$1.60/hour = $1,200/month (customer pays AWS)

**Cost to NouchiX**: $0 additional (HSM is customer responsibility)

**Requirements**:
- Everything from Tier 2
- **+ Customer provides HSM**:
  - YubiHSM 2 USB device (on-premises)
  - OR AWS CloudHSM cluster (GovCloud)
- HSM configuration and key provisioning
- Physical security for HSM devices

**Use Case**:
- SCIF environments (Sensitive Compartmented Information Facility)
- SAP systems (Special Access Programs)
- TS/SCI clearance environments
- Nuclear command and control
- Cryptographic key management systems

---

## 🏗️ Architecture Comparison

### Community Edition Flow
```
Binary boots
    ↓
No license validation needed
    ↓
Load crypto backend: cloudflare/circl
    ↓
Dilithium3 signatures (NIST standard)
Kyber1024 encryption (NIST standard)
```

### DoD Premium Flow (DEFAULT)
```
Binary boots
    ↓
Generate Machine ID (TPM + CPU + MAC + BIOS)
    ↓
Sign with embedded Dilithium3 private key
    ↓
POST telemetry.souhimbou.org/license/validate
    ↓
License valid? ✅
    ↓
Load crypto backend: pkg/adinkra
    ↓
Your proprietary $45M algorithms
Binary obfuscation (garble + strip + upx)
White-box cryptography
    ↓
Hourly heartbeat (remote revocation check)
```

### DoD Premium + HSM Flow (OPTIONAL)
```
Binary boots
    ↓
License validation (same as Tier 2)
    ↓
Check for HSM availability
    ↓
HSM detected? ✅ (YubiHSM or CloudHSM)
    ↓
Load crypto backend: HSM
    ↓
Connect to HSM (USB or network)
    ↓
Algorithm executes INSIDE HSM
(Tamper-proof, FIPS 140-2 Level 3)
    ↓
Even with physical binary access,
attacker cannot extract algorithm
```

---

## 💰 Revenue Model

### Licensing Revenue
- **DoD Premium**: $X per installation per year (or perpetual)
- **Volume discounts**: Enterprise agreements for large DoD units
- **Support contracts**: Priority support, custom features

### HSM Revenue: $0 Direct (Strategic Positioning)
- NouchiX does NOT sell HSM hardware
- NouchiX does NOT pay recurring HSM fees
- Customers purchase HSM directly from:
  - YubiCo (YubiHSM 2): ~$650 one-time
  - AWS (CloudHSM GovCloud): ~$1,200/month

**Why this model works**:
1. ✅ **No operational costs for NouchiX** (customers pay vendors directly)
2. ✅ **Premium positioning** ("HSM-ready" is a selling point)
3. ✅ **Upsell opportunity** (Tier 3 at higher license price)
4. ✅ **Competitive moat** (competitors don't offer HSM integration)
5. ✅ **Customer flexibility** (bring your own HSM vendor)

### Compliance Mapping Revenue ($15.44M projected)
- 36,195+ row proprietary database (STIG↔CCI↔NIST↔CMMC)
- Sold as separate module or bundled with premium tier
- Replaces 40-hour manual mapping process

---

## 🔐 IP Protection by Tier

### Community Edition
- **Source Code**: Open on GitHub (github.com/EtherVerseCodeMate/giza-cyber-shield)
- **IP Protection**: None (uses Cloudflare CIRCL - MIT licensed)
- **Reverse Engineering**: Allowed (open-source)

### DoD Premium
- **Source Code**: NOT included in binary distribution
- **Binary Distribution**: Obfuscated (garble + strip + upx)
- **IP Protection**:
  - Legal: 18 U.S.C. § 1831 ($5M fine + 10 years imprisonment)
  - Legal: DMCA 17 U.S.C. § 1201 ($500K fine + 5 years imprisonment)
  - Legal: DFARS 252.227-7013 (restricted rights)
  - Technical: White-box cryptography (algorithm + key fused)
  - Technical: Binary obfuscation (6+ months to reverse engineer)
  - Technical: License enforcement (remote kill switch)
- **Reverse Engineering**: Prohibited (Federal crime)

### DoD Premium + HSM
- **Everything in DoD Premium**
- **PLUS**: Algorithm executes in tamper-proof hardware
- **Extraction**: Impossible (HSM self-destructs on physical attack)
- **FIPS Compliance**: FIPS 140-2 Level 3 certification

---

## 🚀 Deployment Models

### Air-Gapped (SCIF/Classified Networks)

**Tier 2 (Premium)**:
1. License file delivered via secure courier (encrypted USB)
2. License embedded in binary at build time
3. No network calls after installation
4. Offline mode: License validated once at deploy time

**Tier 3 (Premium + HSM)**:
1. Same as Tier 2
2. YubiHSM 2 physically installed in SCIF
3. HSM connected via USB to air-gapped server
4. No network connectivity required

### Networked (NIPRNet/SIPRNet)

**Tier 2 (Premium)**:
1. Online license validation at startup
2. Hourly heartbeat to telemetry.souhimbou.org
3. Remote revocation capability
4. Automatic telemetry (optional, disabled by default)

**Tier 3 (Premium + HSM)**:
1. Same as Tier 2 for license validation
2. AWS CloudHSM cluster in GovCloud (networked HSM)
3. High availability across multiple AZs

---

## 📊 Feature Matrix

| Feature | Community | DoD Premium | Premium + HSM |
|---------|-----------|-------------|---------------|
| Dilithium3 (NIST) | ✅ CIRCL | ✅ Proprietary | ✅ HSM |
| Kyber1024 (NIST) | ✅ CIRCL | ✅ Proprietary | ✅ HSM |
| Custom Lattice | ❌ | ✅ | ✅ |
| White-Box Crypto | ❌ | ✅ | ✅ |
| Binary Obfuscation | ❌ | ✅ | ✅ |
| Compliance Mapping (36K rows) | ❌ | ✅ | ✅ |
| License Enforcement | ❌ | ✅ | ✅ |
| Legal Protection | ❌ | ✅ | ✅ |
| HSM Integration | ❌ | ❌ | ✅ |
| FIPS 140-2 Level 3 | ❌ | ❌ | ✅ |
| Tamper-Proof HW | ❌ | ❌ | ✅ |
| Air-Gapped Support | ✅ | ✅ | ✅ |
| Remote Revocation | ❌ | ✅ | ✅ |
| **Cost to Customer** | **$0** | **$X/year** | **$X/year + HSM** |
| **Cost to NouchiX** | **$0** | **~$5/mo** | **~$5/mo** |

---

## 🎯 Go-to-Market Strategy

### Phase 1: Launch DoD Premium (Tier 2)
**Timeline**: Q1 2026
- Focus: DoD installations WITHOUT HSM requirement
- Selling Point: "$45M proprietary PQC algorithms + compliance automation"
- Target: Army, Navy, Air Force cyber units
- No HSM dependency = faster adoption

### Phase 2: Add HSM Support (Tier 3)
**Timeline**: Q2 2026
- Focus: High-security environments (IC, SAP, nuclear)
- Selling Point: "Only PQC solution with HSM integration for FIPS 140-2 Level 3"
- Target: NSA, DIA, CIA, nuclear facilities
- Customer brings their own HSM (no NouchiX costs)

### Phase 3: Community Edition Growth
**Timeline**: Ongoing
- Focus: Open-source adoption for awareness
- Selling Point: "Free PQC scanner with NIST-standard algorithms"
- Target: Academia, researchers, non-DoD evaluators
- Conversion funnel: Community → DoD Premium (when they need compliance)

---

## 🔧 Technical Implementation Priority

### Immediate (This Week)
1. ✅ **Tier 2 Implementation** (license validation in binary)
2. ✅ **Legal protection** (SECURITY.md, hardening_manifest.yaml)
3. ✅ **Telemetry server** (license API endpoints)

### Short-Term (This Month)
4. **Tier 1 Implementation** (community edition with CIRCL)
5. **Binary obfuscation** (garble + strip + upx)
6. **Iron Bank publication** (Tier 2 as default)

### Long-Term (Next Quarter)
7. **Tier 3 Implementation** (HSM integration - OPTIONAL)
8. **YubiHSM 2 integration** (on-premises HSM)
9. **AWS CloudHSM integration** (cloud HSM)

---

## ✅ Decision Summary

**Final Architecture**:
- ✅ **3-tier model**: Community (free) → Premium (licensed) → Premium+HSM (licensed+hardware)
- ✅ **HSM is OPTIONAL** - not a dependency for core product
- ✅ **No recurring HSM costs** for NouchiX (customers pay vendors directly)
- ✅ **Premium tier (Tier 2)** protects $45M IP with binary obfuscation + license enforcement
- ✅ **HSM tier (Tier 3)** offers maximum security for customers who want FIPS 140-2 Level 3

**Revenue Impact**:
- Tier 2 generates licensing revenue with minimal operational costs (~$5/mo)
- Tier 3 generates higher licensing revenue with ZERO additional costs (customer buys HSM)
- Community edition builds market awareness and evaluation pipeline

---

*Last Updated: 2026-01-10*
*Version: 1.0*
*Author: SGT Souhimbou Kone, NouchiX SecRed Knowledge Inc.*
