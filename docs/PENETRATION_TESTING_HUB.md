# Penetration Testing Hub (Khepra Intelligence)

This document serves as the primary knowledge base for the Khepra AGI's offensive capabilities ("Commando Mode"). It lists essential tools, their purposes, and usage patterns.

## 1. Reconnaissance & Discovery
*   **Nmap**: The de-facto standard for network discovery and security auditing. Khepra uses this for T1046 (Network Service Discovery).
*   **Dirsearch**: Web path scanner to find hidden directories/files (T1083).
*   **Amass**: In-depth DNS enumeration and attack surface mapping.

## 2. Vulnerability Assessment
*   **OpenVAS / GVM**: Full-featured vulnerability scanner.
*   **Nuclei**: Template-based vulnerability scanner, highly extensible.
*   **Nikto**: Web server scanner for dangerous files/CGIs.

## 3. Exploitation (The Arsenal)
*   **Metasploit Framework**: Comprehensive exploitation framework. Khepra should identify if this is active but NOT use it autonomously without explicit "Level 5" authorization.
*   **SQLMap**: Automatic SQL injection and database takeover tool.
*   **Commando VM**: Mandiant's comprehensive Windows distribution for pentesting.

## 4. Web Application Security
*   **Burp Suite**: The standard for web app testing (Proxy, Scanner, Intruder).
*   **OWASP ZAP**: Open-source alternative to Burp, capable of automated scanning.

## 5. Post-Exploitation & C2
*   **Empire**: PowerShell and Python C2 framework.
*   **Sliver**: Cross-platform adversary emulation/red team framework (Go-based).

## Khepra Integration Strategy (Iron Bank Compliance)
To maintain "Binary Ingestion" compliance for SCIF environments:
1.  **Native Capabilities**: Khepra implements basic versions of these tools (e.g., Go-native port scanning) to reduce external dependencies.
2.  **Docker/Podman**: If "Heavy" tools (like OpenVAS) are needed, Khepra attempts to run them via container runtimes if available.
3.  **Capability Gap**: If a tool is missing and cannot be containerized, Khepra flags a "Capability Gap" in its report.
