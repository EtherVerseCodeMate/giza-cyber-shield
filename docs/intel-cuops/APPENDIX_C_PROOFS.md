# APPENDIX C: SECURITY PROOFS & REDUCTIONS

**Patent Application:** KHEPRA Protocol (ASAF)  
**Docket:** KHEPRA-2025-PROV-002

---

## C.1. Security Reduction of Kuntinkantan (Hybrid PQC-KEM)

**Theorem 1 (IND-CCA2 Security):**
The `Kuntinkantan` protocol is IND-CCA2 (Indistinguishable under Adaptive Chosen Ciphertext Attack) secure in the Random Oracle Model, assuming the hardness of the Module-LWE problem (ML-LWE) and the IND-CPA security of XChaCha20-Poly1305.

**Proof Sketch:**
1.  **Kyber-1024 Security:** FIPS 203 (ML-KEM) is proven IND-CCA2 secure reducing to ML-LWE. KHEPRA uses the standard Kyber encaps/decaps mechanism without modification to the lattice math, only to the key distribution context.
2.  **Symmetric Binding:** The shared secret $S$ is expanded via SHA-256 (Random Oracle) to key $K$. If Kyber is secure, $S$ is pseudorandom, therefore $K$ is pseudorandom.
3.  **AEAD Security:** XChaCha20-Poly1305 is an Authenticated Encryption with Associated Data (AEAD) scheme. It provides Confidentiality and Integrity.
4.  **Composition:** The KEM-DEM (Key Encapsulation Mechanism - Data Encapsulation Mechanism) paradigm proves that if the KEM is IND-CCA2 and the DEM is IND-CCA and INT-CTXT (Integrity of Ciphertext), the combined hybrid scheme is IND-CCA2.

**Conclusion:**
Breaking `Kuntinkantan` requires solving ML-LWE on a rank-4 lattice module of dimension 1024. This is conjectured to be hard for quantum computers.

---

## C.2. Unforgeability of Adinkra Identity (Eban)

**Theorem 2 (EUF-CMA):**
The `Eban` identity assertion is EUF-CMA (Existentially Unforgeable under Chosen Message Attack) secure, assuming the hardness of ML-SIS (Module Short Integer Solution) and ML-LWE.

**Proof Sketch:**
1.  **Underlying Primitive:** The signature scheme maps directly to Dilithium Mode 3 (ML-DSA-65).
2.  **Binding:** The protocol binds the Public Key hash (`OpenSSHPubSHA256`) into the `attest.Assertion` structure before signing.
3.  **Adversarial Model:** An adversary $\mathcal{A}$ attempts to forge a valid attestation for a symbol $S$ without the private key $sk$.
4.  **Reduction:** A successful forgery implies a solution to the Shortest Vector Problem (SVP) on the underlying lattice, which contradicts the hardness assumption.

---

## C.3. Causal Consistency of the KHEPRA DAG

**Theorem 3 (Impossibility of Backdating):**
It is computationally infeasible for an adversary to insert a Node $N_{fake}$ into the DAG at time $t_{past} < t_{current}$ such that it is accepted by honest nodes, provided the network contains at least one honest witness $W$.

**Proof Argument:**
1.  **Hash Chaining:** Every node $N$ includes a hash of its parents $H(P_i)$.
2.  **Avalanche Effect:** modifying a past node $P$ changes $H(P)$, which invalidates the signature of all children $C$ where $P \in Parents(C)$.
3.  **Witnessing:** Honest witness $W$ maintains a local copy of Tip $T$ at time $t_{current}$.
4.  **Conflict:** To backdate $N_{fake}$, the adversary must find a collision $N'_{fake}$ such that $H(N'_{fake}) = H(P)$ (Second Preimage Resistance) OR rewrite the entire history from $t_{past}$ to $t_{current}$ and convince $W$ to switch branches.
5.  **Adinkra Weighting:** KHEPRA's consensus algorithm weights branches by "Symbolic Mass" (Accumulated reputation of Adinkra symbols). A rewritten chain lacks the accumulated signatures of honest agents (who would not sign the fake chain), making the "Mass" of the fake chain $\approx 0$.

Therefore, history is immutable.
