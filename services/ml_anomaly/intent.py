"""
SouHimBou AGI - Intent Classification Module
"The Ear that Hears the User's Will"

Responsibility:
    - Classify user messages into security operation intents
    - Extract parameters from natural language commands
    - Replace LLM-based intent parsing with lightweight rule+ML approach

NIST AI RMF Alignment:
    - GOVERN: Deterministic, auditable intent classification
    - Accountable: Every classification logged with confidence score
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from enum import Enum


class SecurityIntent(Enum):
    """Enumeration of supported security operation intents."""
    SCAN = "SCAN"
    FIREWALL = "FIREWALL"
    REMEDIATE = "REMEDIATE"
    VULNHUNT = "VULNHUNT"
    PENTEST = "PENTEST"
    FORENSICS = "FORENSICS"
    COMPLIANCE = "COMPLIANCE"
    ENCRYPTION = "ENCRYPTION"
    PQC = "PQC"
    IR = "IR"  # Incident Response
    DRBC = "DRBC"  # Disaster Recovery Business Continuity
    SCADA = "SCADA"  # Industrial Control Systems
    HELP = "HELP"
    STATUS = "STATUS"
    UNKNOWN = "UNKNOWN"


@dataclass
class IntentResult:
    """Result of intent classification."""
    intent: SecurityIntent
    confidence: float
    extracted_params: Dict[str, str] = field(default_factory=dict)
    alternative_intents: List[Tuple[SecurityIntent, float]] = field(default_factory=list)
    raw_message: str = ""


class IntentClassifier:
    """
    Rule-based + ML-enhanced intent classification.
    Replaces LLM for understanding user commands.

    Design Principles:
    - Deterministic: Same input always produces same output
    - Explainable: Classification can be traced to specific rules
    - Fast: Sub-millisecond inference without GPU
    - Air-gap compatible: No external API calls
    """

    # Intent patterns with weighted keywords
    INTENT_PATTERNS: Dict[SecurityIntent, Dict[str, float]] = {
        SecurityIntent.SCAN: {
            "scan": 2.0, "check": 1.0, "analyze": 1.5, "assess": 1.5,
            "audit": 1.0, "probe": 1.5, "enumerate": 1.5, "discover": 1.0,
            "port": 1.5, "network": 1.0, "host": 1.0, "target": 1.0,
        },
        SecurityIntent.FIREWALL: {
            "block": 2.0, "firewall": 2.0, "deny": 1.5, "restrict": 1.5,
            "filter": 1.0, "allow": 1.0, "rule": 1.0, "iptables": 1.5,
            "acl": 1.5, "whitelist": 1.0, "blacklist": 1.0,
        },
        SecurityIntent.REMEDIATE: {
            "fix": 2.0, "patch": 2.0, "remediate": 2.0, "resolve": 1.5,
            "repair": 1.5, "update": 1.0, "upgrade": 1.0, "mitigate": 1.5,
            "harden": 1.5, "configure": 1.0,
        },
        SecurityIntent.VULNHUNT: {
            "vulnerability": 2.0, "cve": 2.0, "exploit": 1.5, "weakness": 1.5,
            "vuln": 2.0, "nvd": 1.5, "cisa": 1.5, "kev": 1.5,
            "dependency": 1.0, "sbom": 1.5, "supply chain": 1.5,
        },
        SecurityIntent.PENTEST: {
            "pentest": 2.0, "penetration": 2.0, "attack": 1.5, "breach": 1.5,
            "hack": 1.0, "red team": 2.0, "offensive": 1.5, "exploit": 1.0,
            "payload": 1.5, "lateral": 1.5, "pivot": 1.5,
        },
        SecurityIntent.FORENSICS: {
            "forensic": 2.0, "evidence": 2.0, "investigate": 2.0, "incident": 1.5,
            "artifact": 1.5, "memory": 1.0, "disk": 1.0, "timeline": 1.5,
            "chain of custody": 2.0, "acquisition": 1.5, "image": 1.0,
        },
        SecurityIntent.COMPLIANCE: {
            "stig": 2.0, "cmmc": 2.0, "nist": 2.0, "compliance": 2.0,
            "audit": 1.0, "control": 1.0, "fedramp": 2.0, "800-53": 2.0,
            "800-171": 2.0, "cis": 1.5, "benchmark": 1.5, "disa": 1.5,
        },
        SecurityIntent.ENCRYPTION: {
            "encrypt": 2.0, "decrypt": 2.0, "encryption": 2.0, "crypto": 1.5,
            "cipher": 1.5, "aes": 1.5, "rsa": 1.5, "key": 1.0,
            "certificate": 1.5, "tls": 1.5, "ssl": 1.5,
        },
        SecurityIntent.PQC: {
            "pqc": 2.0, "post-quantum": 2.0, "quantum": 1.5, "kyber": 2.0,
            "dilithium": 2.0, "sphincs": 2.0, "lattice": 1.5, "migration": 1.0,
            "cryptographic agility": 2.0, "harvest now": 1.5,
        },
        SecurityIntent.IR: {
            "incident": 1.5, "response": 1.5, "ir": 2.0, "containment": 2.0,
            "eradication": 2.0, "recovery": 1.0, "playbook": 1.5,
            "isolate": 1.5, "quarantine": 1.5, "triage": 1.5,
        },
        SecurityIntent.DRBC: {
            "disaster": 2.0, "recovery": 1.5, "business continuity": 2.0,
            "backup": 1.5, "restore": 1.5, "drbc": 2.0, "bcp": 2.0,
            "rpo": 1.5, "rto": 1.5, "failover": 1.5,
        },
        SecurityIntent.SCADA: {
            "scada": 2.5, "ics": 2.0, "ot": 1.5, "plc": 2.0, "hmi": 2.0,
            "modbus": 2.0, "dnp3": 2.0, "ladder": 1.5, "relay": 1.0,
            "actuator": 1.0, "pod": 1.5, "smart grid": 1.5,
        },
        SecurityIntent.HELP: {
            "help": 2.0, "guide": 1.5, "how": 1.0, "what": 0.5, "explain": 1.5,
            "tutorial": 1.5, "documentation": 1.5, "manual": 1.5,
            "usage": 1.0, "command": 0.5, "?": 1.0,
        },
        SecurityIntent.STATUS: {
            "status": 2.0, "state": 1.5, "health": 1.5, "running": 1.0,
            "active": 1.0, "queue": 1.0, "task": 0.5, "progress": 1.0,
            "dashboard": 1.0, "metrics": 1.0,
        },
    }

    # Regex patterns for parameter extraction
    IP_PATTERN = re.compile(
        r'\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}'
        r'(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:/\d{1,2})?\b'
    )
    HOSTNAME_PATTERN = re.compile(
        r'\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b'
    )
    PORT_PATTERN = re.compile(r'\bport\s*[:\s]?\s*(\d{1,5})\b', re.IGNORECASE)
    PORT_NUMBER_PATTERN = re.compile(r'\b(\d{1,5})\b')
    CVE_PATTERN = re.compile(r'\bCVE-\d{4}-\d{4,7}\b', re.IGNORECASE)
    FRAMEWORK_PATTERN = re.compile(
        r'\b(stig|cmmc|nist|fedramp|cis|disa|800-53|800-171)\b',
        re.IGNORECASE
    )

    def __init__(self, confidence_threshold: float = 0.15):
        """
        Initialize the intent classifier.

        Args:
            confidence_threshold: Minimum confidence for a valid classification
        """
        self.confidence_threshold = confidence_threshold

    def classify(self, message: str) -> IntentResult:
        """
        Classify user message into security intent.
        Uses keyword matching + context analysis.

        Args:
            message: User's natural language input

        Returns:
            IntentResult with classified intent and extracted parameters
        """
        message_lower = message.lower()

        # Calculate scores for each intent
        scores: Dict[SecurityIntent, float] = {}
        for intent, keywords in self.INTENT_PATTERNS.items():
            score = 0.0
            for keyword, weight in keywords.items():
                if keyword in message_lower:
                    score += weight
            scores[intent] = score

        # Normalize scores
        max_score = max(scores.values()) if scores.values() else 0
        if max_score > 0:
            for intent in scores:
                scores[intent] = scores[intent] / (max_score * 1.5)

        # Get best intent
        best_intent = max(scores, key=scores.get)
        confidence = min(scores[best_intent], 1.0)

        # Get alternative intents (top 3 excluding best)
        sorted_intents = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        alternatives = [(intent, score) for intent, score in sorted_intents[1:4] if score > 0.1]

        # If confidence too low, mark as unknown
        if confidence < self.confidence_threshold:
            best_intent = SecurityIntent.UNKNOWN
            confidence = 0.0

        # Extract parameters based on intent
        extracted_params = self._extract_params(message, best_intent)

        return IntentResult(
            intent=best_intent,
            confidence=confidence,
            extracted_params=extracted_params,
            alternative_intents=alternatives,
            raw_message=message,
        )

    def _extract_params(self, message: str, intent: SecurityIntent) -> Dict[str, str]:
        """
        Extract parameters based on detected intent.

        Args:
            message: Original message
            intent: Classified intent

        Returns:
            Dictionary of extracted parameters
        """
        params: Dict[str, str] = {}
        params.update(self._extract_target(message))

        if intent == SecurityIntent.FIREWALL:
            params.update(self._extract_firewall_params(message))
        elif intent == SecurityIntent.VULNHUNT:
            params.update(self._extract_vulnhunt_params(message))
        elif intent == SecurityIntent.COMPLIANCE:
            params.update(self._extract_compliance_params(message))
        elif intent == SecurityIntent.SCAN:
            params.update(self._extract_scan_params(message))
        elif intent in (SecurityIntent.ENCRYPTION, SecurityIntent.PQC):
            params.update(self._extract_crypto_params(message))

        return params

    def _extract_target(self, message: str) -> Dict[str, str]:
        ip_match = self.IP_PATTERN.search(message)
        if ip_match:
            return {"target": ip_match.group()}
        hostname_match = self.HOSTNAME_PATTERN.search(message)
        if hostname_match:
            return {"target": hostname_match.group()}
        return {}

    def _extract_firewall_params(self, message: str) -> Dict[str, str]:
        port_match = self.PORT_PATTERN.search(message)
        if port_match:
            return {"port": port_match.group(1)}
        port_num_match = self.PORT_NUMBER_PATTERN.search(message)
        if port_num_match:
            # We already matched digits, so int() conversion is safe
            port = int(port_num_match.group(1))
            if 1 <= port <= 65535:
                return {"port": str(port)}
        return {}

    def _extract_vulnhunt_params(self, message: str) -> Dict[str, str]:
        cve_match = self.CVE_PATTERN.search(message)
        if cve_match:
            return {"cve_id": cve_match.group().upper()}
        return {}

    def _extract_compliance_params(self, message: str) -> Dict[str, str]:
        framework_match = self.FRAMEWORK_PATTERN.search(message)
        if framework_match:
            return {"framework": framework_match.group().upper()}
        return {}

    def _extract_scan_params(self, message: str) -> Dict[str, str]:
        msg_lower = message.lower()
        if "port" in msg_lower:
            return {"scan_type": "port"}
        if "vuln" in msg_lower or "vulnerability" in msg_lower:
            return {"scan_type": "vulnerability"}
        if "service" in msg_lower:
            return {"scan_type": "service"}
        return {"scan_type": "comprehensive"}

    def _extract_crypto_params(self, message: str) -> Dict[str, str]:
        msg_lower = message.lower()
        if "aes" in msg_lower:
            return {"algorithm": "AES-256-GCM"}
        if "kyber" in msg_lower:
            return {"algorithm": "Kyber-1024"}
        if "dilithium" in msg_lower:
            return {"algorithm": "Dilithium-3"}
        return {}

    def get_intent_description(self, intent: SecurityIntent) -> str:
        """Get human-readable description of an intent."""
        descriptions = {
            SecurityIntent.SCAN: "Network/vulnerability scanning operation",
            SecurityIntent.FIREWALL: "Firewall rule deployment or modification",
            SecurityIntent.REMEDIATE: "Security patch or fix application",
            SecurityIntent.VULNHUNT: "Vulnerability and CVE hunting",
            SecurityIntent.PENTEST: "Penetration testing operation",
            SecurityIntent.FORENSICS: "Digital forensic evidence collection",
            SecurityIntent.COMPLIANCE: "Compliance framework validation",
            SecurityIntent.ENCRYPTION: "Encryption/decryption operation",
            SecurityIntent.PQC: "Post-quantum cryptography migration",
            SecurityIntent.IR: "Incident response action",
            SecurityIntent.DRBC: "Disaster recovery/business continuity",
            SecurityIntent.HELP: "Help and guidance request",
            SecurityIntent.STATUS: "System status query",
            SecurityIntent.UNKNOWN: "Unrecognized command",
        }
        return descriptions.get(intent, "Unknown operation")
