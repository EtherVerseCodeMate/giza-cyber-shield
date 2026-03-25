
import os
import hashlib
import time
import random

# Mock Cryptographic Primitives (Simulating Kyber/XChaCha)
class MockKyber1024:
    @staticmethod
    def Encapsulate(pub_key):
        # Returns (Ciphertext, SharedSecret)
        ct = os.urandom(1568) # Fixed size capsule
        ss = os.urandom(32)   # Shared secret
        print("      [Kyber] Encapsulating... -> Ciphertext (1568b) + Shared Secret")
        return ct, ss

    @staticmethod
    def Decapsulate(priv_key, ct):
        # In simulation, we just regenerate a consistent SS derived from CT
        # Real impl uses Lattice math
        print("      [Kyber] Decapsulating... -> Recovering Shared Secret")
        return hashlib.sha256(ct).digest()[:32]

class MockXChaCha20:
    @staticmethod
    def Seal(key, nonce, plaintext, ad):
        print(f"      [XChaCha20] Sealing {len(plaintext)} bytes with AD binding...")
        return b"ENCRYPTED_" + plaintext

    @staticmethod
    def Open(key, nonce, ciphertext):
        print("      [XChaCha20] Opening and verifying Authenticated Data...")
        if ciphertext.startswith(b"ENCRYPTED_"):
            return ciphertext[10:], True
        return None, False

# B.1. Kuntinkantan implementation
def Kuntinkantan(pub_key, message):
    print(f"\n[B.1] Kuntinkantan (Reality Bending) on {len(message)} bytes")
    # 2. Encapsulate
    cypher, shared_secret = MockKyber1024.Encapsulate(pub_key)
    
    # 4. Derive Key (The Weave)
    key = hashlib.sha256(shared_secret).digest()
    
    # 6. Nonce (Time)
    nonce = os.urandom(24)
    
    # 8. Seal (The Matter)
    woven_matter = MockXChaCha20.Seal(key, nonce, message, ad=pub_key)
    
    # 10. Construct Artifact
    artifact = cypher + nonce + woven_matter
    print(f"      -> Artifact Created: {len(artifact)} bytes")
    return artifact

# B.2. Sankofa implementation
def Sankofa(priv_key, artifact):
    print(f"\n[B.2] Sankofa (Time Retrieval) on {len(artifact)} bytes")
    # 2-6. Parse
    len_cypher = 1568
    len_nonce = 24
    
    cypher = artifact[:len_cypher]
    nonce = artifact[len_cypher:len_cypher+len_nonce]
    woven_matter = artifact[len_cypher+len_nonce:]
    
    # 8. Decapsulate dummy (in sim we assume success if matching)
    shared_secret_sim = hashlib.sha256(cypher).digest()[:32] 
    
    # 10. Derive Key
    key = hashlib.sha256(shared_secret_sim).digest()
    
    # 12. Open
    msg, valid = MockXChaCha20.Open(key, nonce, woven_matter)
    
    if not valid:
        print("      [ERROR] The spirit rejected the key.")
        return None
        
    print(f"      -> Message Recovered: {msg}")
    return msg

# B.3. DAG Causal Addition
class DagMemory:
    def __init__(self):
        self.nodes = {}
    
    def store(self, node):
        self.nodes[node['id']] = node

class DagSim:
    @staticmethod
    def Add(node, memory):
        print(f"\n[B.3] DAG Add Node: {node['id']}")
        
        # 1. Uniqueness
        if node['id'] in memory.nodes:
            print("      [FAIL] Duplicate ID")
            return False
            
        # 2. Ancestor Check
        current_time = node['time']
        for pid in node['parents']:
            if pid not in memory.nodes:
                print(f"      [FAIL] Orphan (Parent {pid} missing)")
                return False
            
            # 3. Lorentz Check
            parent = memory.nodes[pid]
            delta_t = current_time - parent['time']
            if delta_t < 0:
                print(f"      [FAIL] Backdating Detected (Time Travel Violation)")
                return False
                
        # 4. Symbol Check
        if node['symbol'] not in ["Eban", "Nkyinkyim", "Fawohodie"]:
             print("      [FAIL] Heretical Symbol")
             return False
             
        memory.store(node)
        print("      [SUCCESS] Node Committed to Lattice")
        return True

# B.4. Ogya (Recursive Incineration)
def Ogya(pub_key, target_files):
    print(f"\n[B.4] Ogya (Recursive Incineration) on {len(target_files)} files")
    for fname in target_files:
         if fname.endswith(".khepra"): continue
         
         print(f"   - Processing: {fname}")
         data = b"Secret Data" # Read
         ash = Kuntinkantan(pub_key, data) # Encrypt
         print(f"   - Writing {fname}.khepra")
         print(f"   - INCINERATING {fname} (Secure Delete)")
         # In sim we just print
         
    return "Purification Complete"

if __name__ == "__main__":
    print("=== APPENDIX B: ALGORITHM SIMULATION ===")
    
    # Setup
    pk = b"KyberPubKey"
    sk = b"KyberPrivKey"
    msg = b"Peace Through Strength"
    
    # Run Crypto
    artifact = Kuntinkantan(pk, msg)
    recovered = Sankofa(sk, artifact)
    
    # Run DAG
    mem = DagMemory()
    root = {'id': 'genesis', 'time': 100, 'parents': [], 'symbol': 'Eban'}
    node1 = {'id': 'node1', 'time': 110, 'parents': ['genesis'], 'symbol': 'Nkyinkyim'}
    bad_node = {'id': 'node2', 'time': 90, 'parents': ['node1'], 'symbol': 'Fawohodie'} # Backdated
    
    DagSim.Add(root, mem)
    DagSim.Add(node1, mem)
    DagSim.Add(bad_node, mem)
    
    # Run Ogya
    Ogya(pk, ["secrets.txt", "plans.pdf"])
