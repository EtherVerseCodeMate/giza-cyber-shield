# Khepra Protocol: Immutable DAG Implementation Plan
## "The Living Trust Constellation"

This document outlines the engineering roadmap to transition the Khepra DAG from an in-memory prototype to a cryptographically secure, immutable, and persistent event ledger.

---

### Phase I: The Immutable Vertex (The "Block")
**Objective:** Define a data structure that cannot be altered without breaking the cryptographic chain.

1.  **Content Hashing (The DNA):**
    *   The `Node.ID` must be the `SHA-3` (or `BLAKE2b`) hash of the canonicalized node content.
    *   `NodeID = Hash(Payload + ParentIDs + Timestamp + Nonce)`
2.  **PQC Signature (The Seal):**
    *   Every node must be signed by the creating Agent's Dilithium Private Key.
    *   `Node.Signature = Adinkra.Sign(NodeID, PrivKey)`
    *   This proves *who* added the truth to the constellation.
3.  **Parent Referencing (The Weave):**
    *   Every new node must reference at least 2 previous "Tip" nodes (unconfirmed transactions).
    *   This entangles the history; rewriting one node requires rewriting the entire future cone.

### Phase II: Persistence Engine (The Memory)
**Objective:** Ensure the constellation survives restarts and power failures.

1.  **Append-Only Log (AOL):**
    *   Implement a flat-file storage system (`data/ledger.khepra`).
    *   Writes are sequential (high performance).
    *   Reads utilize an in-memory index of `NodeID -> FileOffset`.
2.  **Generic KV Store (Optional Upgrade):**
    *   For higher performance, integrate `BadgerDB` (Go native) to store the DAG.

### Phase III: The Gossip Protocol (The Voice)
**Objective:** Allow Agents to share the constellation across the network.

1.  **P2P Transport:**
    *   Agents implement a `Sync()` RPC.
    *   "I have tips [A, B, C]. What do you have?"
2.  **Epidemic Propagation:**
    *   New nodes are flooded to peers.
    *   Conflicts (double-spends) rely on a voting weight (virtual voting) or simple "heaviest subtree" for MVP.

---

### Phase IV: Engineering Steps (Immediate)

#### Step 1: Upgrade `pkg/dag/dag.go`
*   Add `Hash` field to `Node` struct.
*   Add `Signature` field to `Node` struct.
*   Implement `Node.ComputeHash()` using `SHA-256` (or `SHAKE-256` from `pkg/adinkra`).
*   Implement `Node.Sign(privKey)` using `adinkra.Sign`.

#### Step 2: Implement `pkg/dag/store.go`
*   Create a `FileStore` struct to handle reading/writing JSON lines to disk.
*   On startup, replay the file to rebuild the in-memory index.

#### Step 3: Tip Selection Algorithm
*   Implement `GetTips()`: Return 2 random nodes that have no children yet.
*   This ensures the DAG grows wide and converges, rather than becoming a single chain.

#### Step 4: Visualize Real Data
*   Update the Agent API to serve the *actual* DAG structure to the Visualizer (D3.js).

---

### Conceptual Architecture
```go
type Vertex struct {
    // Header
    ID        Hash   // Hash of the Body
    Parents   []Hash // References to previous nodes
    Timestamp int64
    Nonce     uint64

    // Body
    Payload   []byte // The actual evidence/audit data
    
    // Proof
    Signature []byte // Dilithium signature of ID
}
```
