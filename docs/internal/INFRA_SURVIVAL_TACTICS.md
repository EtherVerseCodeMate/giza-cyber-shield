# INFRA SURVIVAL TACTICS: The "Unkillable" Stack

## 1. THE AUTOMATED CANARY ("HEARTBEAT" vs. "WARRANT")
**The Limit:** A true "Warrant Canary" *cannot* be fully automated because its purpose is to prove a human hasn't been gagged. If the script runs automatically, the government can just seize the server and let the script keep running.
**The Hybrid Solution: The "Dead Man's Heartbeat"**
*   **Mechanism:** A local `cron` job on your machine generates a weekly signed message.
*   **Automation:** The agent *checks* for this local signed file. If found, it pushes the hash to the public dashboard.
*   **The Switch:** If you (the human) do not update the local signed file, the agent fails to find a fresh heartbeat and automatically triggers the "SILENCE DETECTED" alert on the public dashboard.
*   **Implementation:** Use a simple Go binary matching your key.

## 2. IMMUTABLE BACKUPS (The "Golden Hash")
**Objective:** Redundancy without "Big Tech" KYC (Know Your Customer).
**Strategy:** "The Decentralized Triad"
1.  **Arweave (The Forever Store):**
    *   *Prop:* Pay once, store forever. No monthly fees.
    *   *Use Case:* Store the Release Binaries (`khepra_v1.0.tar.gz`) and the `SHA256SUMS`.
    *   *Tool:* `arkb` CLI.
2.  **IPFS (The Distribution Layer):**
    *   *Prop:* High availability.
    *   *Use Case:* Mirror the Arweave hashes.
    *   *Pinning:* Use **Protocol Labs** or **Pinata** (Free tiers are generous and don't require heavy KYC).
3.  **Proton Drive (The "Encrypted Cloud"):**
    *   *Prop:* Swiss jurisdiction, Zero-Knowledge.
    *   *Use Case:* Store the **Encrypted** Source Code Archive (encrypted with your PGP key). Even Proton can't see it.

## 3. AIR-GAPPED BUILD SYSTEM ("Cold Iron")
**Recommendation:** Continue with **VirtualBox**, but harden the VM.
**Distro Choice:** **Parrot Security (Home Edition)** or **Debian Stable (Minimal)**.
*   **Why not Tails?** Tails is amnesic (forgets everything on reboot). You need *persistence* to compile significantly large Go projects and keep your build cache.
*   **Why not Whonix?** WhonixGateway forces traffic over Tor. We want *zero* traffic.

**The "Cold Iron" Setup:**
1.  **Create VM:** Install Parrot Security.
2.  **Network Nuke:** In VirtualBox Settings -> Network -> **Uncheck "Enable Network Adapter"**.
3.  **Data Transfer:** Use a **Shared Folder** (Read Only) or a specialized "Transfer USB" that is formatted after every use.
4.  **Signing Ceremony:**
    *   Generate the Release Binary inside the VM.
    *   Sign it with your YubiKey (passed through to VM via USB).
    *   Transfer *only* the signed binary and hash out. The Private Key never leaves the VM.

## 4. THE KHEPRA IDENTITY ("Digital PQC YubiKey")
**The User Question:** *"Can we PQC-legally use Khepra to create our digital version of a YubiKey?"*
**The Answer:** **YES.** In fact, we *must*.

**The Hardware Gap:** Current hardware YubiKeys use RSA/ECC (Pre-Quantum). They **cannot** sign with Dilithium-Mode3 (the Khepra standard) because the keys are too large for current smartcards.
**The Solution: The "Khepra Soft-Enclave"**
1.  **Generation:** You run `khepra identity generate`.
2.  **Output:** Creates `operator.khepra` (The Private Key) and `operator.pub` (The ID).
3.  **Protection:** This file is encrypted at rest using **NIST AES-256-GCM** (or Kyber-KEM wrapped).
4.  **Usage:** This *file* becomes your "Digital YubiKey".
    *   *Pro:* It uses military-grade PQC that hardware keys can't support yet.
    *   *Con:* It can be copied if your machine is hacked.
    *   *Mitigation:* Store the `operator.khepra` file in an encrypted volume.
    *   **The Khepra Vault (Ogya):** Instead of VeraCrypt, use our own tool: `khepra ogya <pubkey> <directory>`.
        *   *Function:* Recursively encrypts the folder and **securely deletes** (incinerates) the originals.
        *   *Benefit:* PQC-Native storage.

## 5. THE "OPEN ARCHIVE" DILEMMA
**The Paradox:** "Private Repo" vs. "Open Source Verification".
**Solution: The "Release Tarball" Model.**
*   **GitHub Repo:** Remains **Private**. Contains history, commit logs, internal comments.
*   **Public Release:**
    1.  Create a "Public" GitHub repo (e.g., `khepra-releases`).
    2.  For each version, upload the **Source Code Tarball** (zip/tar.gz) as a "Release Asset".
    3.  *Result:* The *auditable code* is public for that version, but your *git history* (dev branches, mistakes, internal notes) remains private.
    4.  **License:** Include the `LICENSE` file (BSL 1.1) inside the tarball.

> **Mantra:** "The Code is Information. The Repo is Intelligence."
