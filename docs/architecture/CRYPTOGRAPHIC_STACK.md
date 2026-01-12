# Khepra Protocol: Cryptographic Stack

## Overview
The Khepra Protocol employs a **Dual-Layer Defense Strategy**, combining government-compliant standards with advanced Post-Quantum Cryptography (PQC). This "Belt and Suspenders" approach ensures both regulatory certifications and future-proof security against quantum threats.

## Layer 1: The Compliance Layer (FIPS 140-3)
**Purpose**: Regulatory Certification & Standard Transport Security.

All stable release builds of Khepra are compiled with `GOEXPERIMENT=boringcrypto`. This forces the Go compiler to link against the **BoringCrypto** module, a NIST-validated cryptographic library.

- **Scope**: TLS connections (HTTPS), standard hashing (SHA-256 for non-critical logs), and AES encryption for disk storage where required by policy.
- **Why**: Ensures that `adinkhepra-agent` can be deployed in FedRAMP/GovCloud environments that require FIPS 140-2/3 validated cryptography for all data in transit and at rest (standard).

> [!NOTE]
> FIPS mode requires CGO (`CGO_ENABLED=1`) as it links to C-based cryptographic primitives.

## Layer 2: The Adinkra Layer (Post-Quantum)
**Purpose**: Zero-Trust Identity, Data Integrity & Quantum Resistance.

Running *on top* of the FIPS layer is our custom application-level cryptographic stack, **Adinkra**. This is what makes Khepra unique. It does not rely on standard FIPS algorithms for its core mission (verifying truth).

### Components
1. **Dilithium3 (Signature Scheme)**
   - Used for **Identity & Attestation**. Every node, dag entry, and audit log is signed using CRYSTALS-Dilithium Mode 3.
   - **Benefit**: Immune to Shor's Algorithm (Quantum Computers cannot forge these signatures).
   
2. **Kyber-1024 (Key Encapsulation)**
   - Used for **Secure Key Exchange**. When nodes communicate "off the record" or share sensitive keys, they negotiate using CRYSTALS-Kyber.
   
3. **Nkyinkyim (Obfuscation)**
   - A custom "Twist" on standard encoding.
   - Used to obfuscate PQC artifacts in transit, making them unreadable to standard automated scanners that might flag unknown high-entropy blobs.

## How They Stack
When an Agent sends a heartbeat to the Console:
1. **Payload Creation**: The agent creates a JSON payload containing system metrics.
2. **Adinkra Signing**: The agent hashes the payload and signs it with its **Dilithium3 Private Key**. This signature is attached to the payload.
3. **FIPS Transport**: The signed payload is sent over **HTTPS (TLS 1.3)**. The TLS tunnel is established using **FIPS-validated modules** (BoringCrypto) ensuring the *pipe* is compliant, while the *data* inside is Quantum-Proof.

```mermaid
graph TD
    A[Application Data] --> B[Adinkra Layer (PQC)]
    B -- Dilithium Signed --> C[FIPS Layer (BoringCrypto)]
    C -- TLS Encrypted --> D[Network / Internet]
```

## Build Configuration
To ensure compliance, the build system (`adinkhepra.py`) enforces FIPS mode by default:
- **Default**: `go build -tags boringcrypto` (Implicit via `GOEXPERIMENT`)
- **Developer Override**: `python adinkhepra.py build --no-fips` (For rapid testing in non-CGO environments)
