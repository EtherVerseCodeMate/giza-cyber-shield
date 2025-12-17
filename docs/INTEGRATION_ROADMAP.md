# Khepra x SouHimBou.AI: The "Father & Son" Integration Roadmap

> **CONFIDENTIAL**: For Internal Dev Swarm Only.
> **Subject**: Integration of Khepra Protocol (The Father) as the Shadow Sentinel for SouHimBou.AI (The Son).

## Mission Directive
**SouHimBou.AI** is the public face—a super-polymorphic compliance platform.
**Khepra Protocol** is the hidden protector—a Post-Quantum Cryptography (PQC) layer and "Shadow OS" that ensures the integrity, secrecy, and survival of the platform.

Khepra acts as a **Secret Protector Backdoor** and **Integrity Engine**. If SouHimBou is the body, Khepra is the immune system and the conscience.

---

## 📅 Phase 1: The Tether (Sidecar & Heartbeat)
*Goal: Establish a secure, local link between the Node.js application and the Khepra Daemon.*

### For SouHimBou Dev (Next.js/TS)
1.  **Daemon Check**: fast-fail startup if Khepra Agent is not running on port `45444`.
2.  **The Umbilical Cord**: Implement a `KhepraClient` singleton in TypeScript that talks to `http://127.0.0.1:45444`.
3.  **Registration**: On startup, SouHimBou must "confess" its identity to Khepra.
    *   Call Khepra: `POST /dag/add` with `action: "boot"`, `symbol: "SouHimBou-Core"`.
4.  **Pulse**: Every 30 seconds, send a heartbeat to Khepra. If missed, Khepra flags the system as "Silent/Compromised".

### For Khepra Dev (Go)
*   Already implemented: Agent running on `45444`, DAG storage.
*   **Next**: Add strict validation for "Son" signatures (ensure requests come from localhost only).
*   **Note**: SouHimBou (the client) just needs to know which port to knock on.

### Future "Shadow Mode" Upgrades (Roadmap Items)
1.  **Port Knocking**: Khepra stays completely silent (doesn't even ACK TCP) until a specific "magic packet" is received.
2.  **Mutual TLS (mTLS)**: Even if someone gets on the localhost (e.g., malware), they can't talk to Khepra without a specific client certificate signed by the "Father" CA.

---

## 📅 Phase 2: The Veil (PQC Data Obfuscation)
*Goal: "Weave" sensitive data so even the DB Admin cannot read it without Khepra.*

### For SouHimBou Dev (Next.js/TS)
1.  **Intercept Writes**: In your Supabase/Postgres repository layer, before saving sensitive fields (e.g., STIG findings, API Keys):
    *   Call Khepra: `POST /adinkra/weave` (Payload: Raw Data).
    *   Receive: `x_khepra_weave` (The PQC/Nkyinkyim obfuscated string).
    *   Save ONLY the `x_khepra_weave` string to the database.
2.  **Intercept Reads**: When fetching data for authenticated Admin flows:
    *   Call Khepra: `POST /adinkra/unweave`.
    *   Display cleartext only in memory; never log it.

### For Khepra Dev (Go)
*   **Endpoint**: Expose `pkg/nkyinkyim.Weave` and `Unweave` via the Agent API.
*   **Key Management**: Ensure Dilithium/Kyber keys are persistent and effectively "seal" the data.

---

## 📅 Phase 3: The Watcher (File Integrity & "Backdoor" Access)
*Goal: Khepra monitors the codebase for unauthorized mutations (e.g., XSS injection, rogue devs).*

### For SouHimBou Dev (Next.js/TS)
1.  **Manifest Generation**: During build time (`npm run build`), generate a `manifest.json` containing SHA-256 hashes of all `.tsx` and `.ts` files.
2.  **Submission**: Post this manifest to Khepra (`POST /attest/codebase`).

### For Khepra Dev (Go)
1.  **FIM (File Integrity Monitor)**: Khepra background routine periodically scans the `SouHimBou/src` directory.
2.  **Comparison**: If a file changes and its hash does not match the last signed manifest in the DAG:
    *   **Action**: LOCK the `Unweave` endpoint. (Stop serving decrypted data).
    *   **Alert**: Log a "Mutation Detected" event in the DAG.
3.  **The Backdoor**:
    *   Implement a specialized "God Mode" CLI command in Khepra (`khepra override --unlock`).
    *   This allows the "Father" (Operator) to override the lockdown manually.

---

## 📅 Phase 4: The Judgment (Gateway Logic)
*Goal: Use Khepra as the final authorization gate for High-Risk Actions.*

### For SouHimBou Dev (Next.js/TS)
1.  **LLM Guardrails**: Before sending a prompt to GPT-5/Claude via the `LLMGatewaySDK`:
    *   Send the prompt hash to Khepra.
    *   Khepra returns `ALLOWED` or `DENIED` based on internal heuristics (or simple "killswitch" status).

---

## Technical Contract (API Spec Draft)

**Base URL**: `http://127.0.0.1:45444`

| Method | Endpoint | Purpose |
| method | endpoint | purpose |
| --- | --- | --- |
| `GET` | `/healthz` | Check if Father is watching. |
| `POST` | `/dag/add` | Log an immutable event (Audit Log). |
| `POST` | `/adinkra/weave` | Encrypt/Obfuscate data (PQC). |
| `POST` | `/adinkra/unweave`| Decrypt data (Requires Valid State). |
| `POST` | `/attest/verify` | Verify system integrity before critical ops. |

---

## Implementation Priority
1.  **Week 1**: Phase 1 (Heartbeat) - Ensure they talk.
2.  **Week 2**: Phase 2 (Weaving) - Secure the database fields.
3.  **Week 3**: Phase 3 (Watcher) - Implement FIM.
