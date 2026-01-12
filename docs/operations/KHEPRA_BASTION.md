# KHEPRA-BASTION: Sovereign Disaster Recovery Architecture

## Executive Summary
This document outlines the **KHEPRA-BASTION** strategy, leveraging a **Proton VPN Private Gateway** to create a cryptographically isolated, "Invisible" entry point for the Khepra ecosystem. This architecture ensures **Survival Sovereignty** by decoupling the access layer from the physical hosting layer, allowing for rapid Disaster Recovery (DR) and Business Continuity (BC) without exposing the core infrastructure to the open internet.

## Core Concept: The "Cloud Bastion"
By renting a Dedicated VPN Server (Gateway) from Proton, you acquire a static, non-shared IP address within Swiss jurisdiction. We leverage this to implement a **"Zero-Trust Ingress"** model where the Khepra Application Server *only* accepts traffic from this specific Gateway IP.

### The Flow
```mermaid
graph LR
    User[Operator (You)] -- VPN Tunnel --> ProtonGW[Proton Private Gateway\n(Swiss IP: 74.118.125.101)]
    ProtonGW -- Encrypted Traffic --> KhepraFW[Khepra Server Firewall]
    KhepraFW -- Allow 74.118.125.101 ONLY --> App[Khepra Application\n(Port 443/45444)]
    World[Public Internet] -- Scans/Attacks --> KhepraFW
    KhepraFW -- DROP ALL --> World
```

## Implementation Strategy

### 1. Procurement & Setup
- **Action**: Acquire "Proton VPN Business" with 1+ Dedicated Server.
- **Config**: Assign the server to a specific high-stability region (e.g., CH-Zurich or IS-Reykjavik).
- **Team Access**: Distribute VPN credentials/profiles *only* to authorized Khepra Operators.

### 2. "Invisibility Cloak" Configuration
On the Khepra Hosting Server (VPS, Colo, or Basement Server), configure `iptables` or Cloud Security Groups to drop all ingress traffic by default, whitelisting *only* the Proton Gateway IP.

**Example `iptables` Rule:**
```bash
# Flush existing rules
iptables -F
# Set default policy to DROP
iptables -P INPUT DROP
# Allow Loopback
iptables -A INPUT -i lo -j ACCEPT
# Allow Established/Related
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
# === THE GOLDEN RULE ===
# Allow SSH/API ONLY from Proton Gateway IP
iptables -A INPUT -s 74.118.125.101 -p tcp -m multiport --dports 22,443,45444 -j ACCEPT
```

### 3. Business Continuity & Disaster Recovery (DR)
This specific architecture provides aggressive DR capabilities:

*   **Location Agnostic**: Since the "Entry IP" (Proton Gateway) is static, your team's access workflow never changes, even if you physically move the Khepra Server.
*   **Rapid Relocation**: If the Khepra Primary Server is compromised or the data center goes offline:
    1.  Spin up Backup Server (Warm Standby).
    2.  Apply the `iptables` whitelist for the Proton Gateway IP.
    3.  Update DNS A record (or just IP) to point to the new server.
    4.  **Result**: Operators are back online instantly without needing new VPNS or firewall configs on their laptops.

## "Survival Sovereignty" Benefits
1.  **Jurisdictional Shielding**: Your ingress log data resides with Proton (Switzerland), not a US ISP or Cloud Provider.
2.  **Anti-Censorship**: If local ISPs block your Khepra Server IP, you bypass it via the Proton tunnel. 
3.  **Attack Surface Reduction**: Shodan, Censys, and automated botnets cannot see your server. To them, it appears as a "Black Hole" (dead IP).

## Integration Steps
1.  **Purchase**: Add "Dedicated Server" in Proton Business Dashboard.
2.  **Identify**: Note the static IP assigned to your gateway. (74.118.125.101)
3.  **Harden**: Apply the Firewall Whitelist on your Khepra Server.
4.  **Verify**: Attempt to connect without VPN (Should Fail) -> Connect VPN (Should Succeed).
