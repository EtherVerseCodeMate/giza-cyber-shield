# APPENDIX B: ALGORITHM PSEUDOCODE

**Patent Application:** KHEPRA Protocol (ASAF)  
**Docket:** KHEPRA-2025-PROV-002

---

## B.1. Kuntinkantan (Reality Bending / Encryption)

**Input:** 
*   `PubKey_K`: Kyber-1024 Public Key (1568 bytes)
*   `Message_M`: Arbitrary plaintext binary

**Output:** 
*   `Artifact_A`: The KHEPRA artifact

```text
ALGORITHM Kuntinkantan(PubKey_K, Message_M):
    1. // Generate Ephemeral Shared Secret (The Spirit)
    2. (Cypher_C, SharedSecret_S) ← Kyber1024.Encapsulate(PubKey_K)
    
    3. // Derive Symmetric Key (The Weave)
    4. Key_K ← SHA256(SharedSecret_S)
    
    5. // Generate Time Nonce
    6. Nonce_N ← Random(24 bytes) // 192-bit Extended Nonce
    
    7. // Encrypt Payload (The Matter)
    8. WovenMatter_W ← XChaCha20_Poly1305.Seal(Key_K, Nonce_N, Message_M, AD=PubKey_K)
       // Note: PubKey_K is used as Associated Data (AD) to bind ciphertext to identity.
    
    9. // Construct Artifact
    10. Artifact_A ← Concatenate(Cypher_C, Nonce_N, WovenMatter_W)
    
    11. RETURN Artifact_A
```

---

## B.2. Sankofa (Time Retrieval / Decryption)

**Input:**
*   `PrivKey_K`: Kyber-1024 Private Key (3168 bytes)
*   `Artifact_A`: KHEPRA artifact

**Output:**
*   `Message_M`: Decrypted plaintext

```text
ALGORITHM Sankofa(PrivKey_K, Artifact_A):
    1. // Parse Artifact Structure
    2. LEN_CYPHER ← 1568
    3. LEN_NONCE ← 24
    
    4. Cypher_C ← Artifact_A[0 : LEN_CYPHER]
    5. Nonce_N ← Artifact_A[LEN_CYPHER : LEN_CYPHER + LEN_NONCE]
    6. WovenMatter_W ← Artifact_A[LEN_CYPHER + LEN_NONCE : END]
    
    7. // Break the Clay (Decapsulate)
    8. SharedSecret_S ← Kyber1024.Decapsulate(PrivKey_K, Cypher_C)
    
    9. // Derive Symmetric Key
    10. Key_K ← SHA256(SharedSecret_S)
    
    11. // Unweave (Decrypt & Authenticate)
    12. Message_M, Valid ← XChaCha20_Poly1305.Open(Key_K, Nonce_N, WovenMatter_W)
    
    13. IF NOT Valid:
            THROW "The spirit rejected the key (Auth Fail)"
            
    14. RETURN Message_M
```

---

## B.3. DAG Causal Addition (Consensus)

**Input:**
*   `Node_New`: Proposed action node
*   `DAG_Memory`: Current graph state

**Output:**
*   `Success`: Boolean

```text
ALGORITHM DagAdd(Node_New, DAG_Memory):
    1. // 1. Global Uniqueness Check
    2. IF Node_New.ID EXISTS IN DAG_Memory:
           RETURN FALSE (Duplicate)
           
    3. // 2. Ancestor Existence Check
    4. FOR ParentID IN Node_New.Parents:
           IF ParentID NOT IN DAG_Memory:
               RETURN FALSE (Orphan)
               
    5. // 3. Lorentz-Causality Check
    6. FOR ParentID IN Node_New.Parents:
           Parent ← DAG_Memory[ParentID]
           Delta_T ← Node_New.Time - Parent.Time
           IF Delta_T < 0:
               RETURN FALSE (Backdating Detected)
               
    7. // 4. Semantic Symbol Check
    8. IF Node_New.Symbol NOT IN Allowed_Symbols:
           RETURN FALSE (Heretical Symbol)
           
    9. // Commit
    10. DAG_Memory.Store(Node_New)
    11. RETURN TRUE
```

---

## B.4. Ogya (Recursive Incineration)

```text
ALGORITHM Ogya(PubKey_K, Target_Dir):
    1. Files_F ← ListRecursive(Target_Dir)
    
    2. FOR File IN Files_F:
           IF File.Extension == ".khepra":
               CONTINUE // Do not burn what is already ash
               
           // Read & Encrypt
           Data ← Read(File)
           Ash ← Kuntinkantan(PubKey_K, Data)
           Write(File + ".khepra", Ash)
           
           // Secure Delete (Incinerate)
           Overwrite(File, RandomBytes)
           Delete(File)
           
    3. RETURN "Purification Complete"
```
