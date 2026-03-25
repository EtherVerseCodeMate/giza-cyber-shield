# APPENDIX A: MATHEMATICAL DERIVATIONS & ADINKRA ALGEBRAIC ENCODING (AAE)

**Patent Application:** KHEPRA Protocol (ASAF)  
**Docket:** KHEPRA-2025-PROV-002

---

## A.1. Adinkra Group Theoretic Isomorphisms

The KHEPRA Protocol derives its semantic security properties by mapping the topological structure of West African Adinkra symbols to algebraic group operations.

### Definition 1 (Adinkra Symbol Space)
Let $\mathcal{S}$ be the set of canonical Adinkra symbols used in the protocol:
$$ \mathcal{S} = \{ \text{Eban}, \text{Fawohodie}, \text{Nkyinkyim}, \text{Dwennimmen} \} $$

We define a bijective mapping $\Psi: \mathcal{S} \rightarrow D_8$ where $D_8$ is the Dihedral group of order 8 (symmetry of the square). This mapping preserves the "protection" properties of the symbol in the algebraic domain.

*   **Eban (The Fence):** Maps to the Identity element $e$ (Stability).
*   **Nkyinkyim (The Twist):** Maps to a rotation $r$ (Dynamic Lattice Transformation).
*   **Fawohodie (Independence):** Maps to reflection $s$ (Dual-Space mapping).

### Definition 2 (Symbolic Lattice Injection)
In standard ML-LWE (Module Learning With Errors), the public key is derived as:
$$ \mathbf{t} := \mathbf{A}\mathbf{s} + \mathbf{e} \pmod q $$

In KHEPRA, we introduce a **Symbolic Bias Term** $\Phi(S)$ derived from the adjacency matrix of the Adinkra graph:
$$ \mathbf{t}_{S} := \mathbf{A}\mathbf{s} + \mathbf{e} + \Phi(S) \pmod q $$

Where $\Phi(S)$ is a structural noise term that is:
1.  **Computationally distinguishable** from random noise without knowledge of $S$.
2.  **Statistically indistinguishable** from random noise for an adversary ignorant of the Adinkra mapping.

This ensures that a KHEPRA Public Key is valid *only* for the specific semantic context (Symbol) it was generated for.

---

## A.2. Lorentz-Invariant Timestamp Derivation

To prevent "Time-Travel" attacks in the DAG (Backdating), KHEPRA enforces causality via a Lorentz-Invariant metric.

Let an event $E$ be a tuple $(t, x, y, z)$ in spacetime.
For two events $E_1 (Parent)$ and $E_2 (Child)$ to be causally linked, the interval $\Delta s^2$ must be time-like or light-like:

$$ \Delta s^2 = c^2 (t_2 - t_1)^2 - \Delta \mathbf{r}^2 \ge 0 $$

In the KHEPRA network graph:
*   $c$: The maximum propagation speed of the network (governed by speed of light in fiber/RF).
*   $\Delta \mathbf{r}$: The geodesic distance between Agent Node $N_1$ and $N_2$.

**Derivation:**
If Node $A$ (at $t_1$) attests to Node $B$ (at $t_2$), the validation logic computes:
$$ v_{prop} = \frac{||\mathbf{r}_B - \mathbf{r}_A||}{t_2 - t_1} $$

If $v_{prop} > c$, the attestation is rejected as a **Causality Violation** (information traveled faster than light/net).

---

## A.3. Kyber-1024 / Dilithium-Mode-3 Integration

KHEPRA utilizes the specific parameter sets defined in NIST FIPS 203 and 204, but constrains the generation of the random seed $\rho$.

### seed expansion
$$ \rho' = \text{SHAKE-256}(\text{Entropy} || \text{Hash}(\text{Symbol\_Glyph})) $$

This derivation ensures that the entire lattice basis $\mathbf{A}$ is colored by the semantic meaning of the symbol.
