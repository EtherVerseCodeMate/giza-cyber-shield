# QUANTUM-READINESS BLAST RADIUS REPORT
## ABC Defense Corp — Demo Assessment

**Overall NTI Score: 8.7 / 10.0 — HIGH**  
**Q-Day Horizon: 2030–2035 (NSA CNSA 2.0)**  

| Asset | Type | Algorithm | NTI Score | Status | Phase |
|---|---|---|---|---|---|
| PQC-TLS-001 | TLS_CERT | RSA-2048 | 9.5 | VULNERABLE | PHASE_1 |
| PQC-SSH-001 | SSH_KEY | Ed25519 | 7.1 | VULNERABLE | PHASE_2 |
| PQC-CERT-001 | X509_CERT | RSA-2048 | 8.1 | VULNERABLE | PHASE_1 |
| PQC-VPN-001 | VPN_TUNNEL | DH-2048 | 8.6 | VULNERABLE | PHASE_1 |
| PQC-SIGN-001 | CODE_SIGN | ECDSA-P256 | 8.1 | VULNERABLE | PHASE_1 |

## Migration Roadmap

**Target:** ML-DSA-65 (NIST FIPS 204) + ML-KEM-1024 (NIST FIPS 203)  
**Estimated effort:** 24 days / $60,000  

### Phase 1 (< 6 months): TLS + VPN + X.509
### Phase 2 (6–12 months): SSH + Code Signing
