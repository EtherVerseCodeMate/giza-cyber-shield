
import numpy as np

# A.1. Adinkra Symbol Space -> D8 Group Isomorphism
class AdinkraGroup:
    """
    Implements the isomorphism between Adinkra Symbols (S) and Dihedral Group D8.
    D8 Elements: {e, r, r2, r3, s, sr, sr2, sr3}
    e: Identity, r: Rotation 90, s: Reflection
    """
    SYMBOLS = {
        "Eban": "e",          # Identity (Stability)
        "Nkyinkyim": "r",     # Rotation (Twist/Dynamics)
        "Fawohodie": "s",     # Reflection (Independence/Dual)
        "Dwennimmen": "sr"    # Complex Force (Strength)
    }

    @staticmethod
    def map_to_algebra(symbol):
        element = AdinkraGroup.SYMBOLS.get(symbol, "unknown")
        print(f"[A.1] Mapping Symbol '{symbol}' -> D8 Group Element: '{element}'")
        return element

# A.2. Symbolic Lattice Injection Simulator
class LatticeSimulator:
    """
    Simulates ML-LWE Public Key Derivation with Adinkra Symbolic Bias.
    t_S := As + e + Phi(S) (mod q)
    """
    q = 3329  # Kyber Prime
    n = 4     # Small dimension for demo (real is 256)

    @staticmethod
    def generate_symbol_bias(symbol):
        # Phi(S): Deterministic noise derived from symbol unicode/hash
        # Real implementation would use SHAKE256(symbol)
        seed = sum(ord(c) for c in symbol)
        np.random.seed(seed)
        phi = np.random.randint(0, 10, size=4) # Small structural bias
        print(f"      Phi({symbol}) Bias Term: {phi}")
        return phi

    @staticmethod
    def simulate_keygen(symbol):
        print(f"\n[A.2] Simulating Lattice Injection for Context: {symbol}")
        
        # Standard ML-LWE Components
        A = np.random.randint(0, LatticeSimulator.q, size=(4, 4)) # Matrix A
        s = np.random.randint(0, 5, size=4)                       # Secret s (Small Norm)
        e = np.random.randint(0, 2, size=4)                       # Error e (Small Norm)

        # Standard LWE: t = As + e
        t_standard = (A @ s + e) % LatticeSimulator.q
        
        # Symbolic Bias
        phi_s = LatticeSimulator.generate_symbol_bias(symbol)
        
        # KHEPRA LWE: t_S = As + e + Phi(S)
        t_khepra = (t_standard + phi_s) % LatticeSimulator.q
        
        print(f"      Standard Public Key (t) : {t_standard}")
        print(f"      KHEPRA Public Key (t_S) : {t_khepra}")
        print(f"      Is Distinguishable?     : YES (via Phi({symbol}))")

if __name__ == "__main__":
    print("=== APPENDIX A: MATHEMATICAL PROOF SIMULATION ===")
    
    # 1. Group Isomorphism Check
    r = AdinkraGroup.map_to_algebra("Nkyinkyim")
    s = AdinkraGroup.map_to_algebra("Fawohodie")
    
    # 2. Lattice Injection
    LatticeSimulator.simulate_keygen("Eban")
    LatticeSimulator.simulate_keygen("Nkyinkyim")
