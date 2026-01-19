"""
SouHimBou AGI - Response Generation Module
"The Voice that Speaks the Ancient Wisdom"

Responsibility:
    - Generate contextual responses based on classified intent
    - Provide actionable security guidance without LLM
    - Template-based response system with dynamic parameter injection

NIST AI RMF Alignment:
    - Explainable: Every response traceable to template + context
    - Safe: No hallucination risk - deterministic output
    - Accountable: Full audit trail of response generation
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Any, Optional
from .intent import SecurityIntent


@dataclass
class ResponseContext:
    """Context for response generation."""
    intent: SecurityIntent
    params: Dict[str, str]
    anomaly_score: Optional[float] = None
    state: str = "ack"  # ack, progress, complete, error
    progress: Optional[int] = None
    findings_count: Optional[int] = None
    risk_score: Optional[float] = None
    error_message: Optional[str] = None
    extra: Dict[str, Any] = None

    def __post_init__(self):
        if self.extra is None:
            self.extra = {}


class SecurityResponder:
    """
    Template-based + context-aware response generation.
    Replaces LLM for generating helpful security responses.

    Design Principles:
    - Deterministic: Same context always produces same response
    - Professional: DoD-appropriate tone and terminology
    - Actionable: Every response includes next steps
    - Fast: Microsecond response time
    """

    # Response templates organized by intent and state
    RESPONSE_TEMPLATES: Dict[SecurityIntent, Dict[str, str]] = {
        SecurityIntent.SCAN: {
            "ack": "COMMANDO ACKNOWLEDGED. Initiating {scan_type} scan on {target}.",
            "ack_no_target": "COMMANDO ACKNOWLEDGED. Initiating {scan_type} scan. Specify target or scanning local environment.",
            "progress": "Scan in progress... {progress}% complete. {findings_count} findings detected.",
            "complete": "Scan complete. {findings_count} findings detected. Risk score: {risk_score:.1f}/10.",
            "error": "Scan operation failed: {error_message}. Check target accessibility and permissions.",
        },
        SecurityIntent.FIREWALL: {
            "ack": "FIREWALL DEPLOYMENT. Preparing rule for port {port} on {target}.",
            "ack_no_port": "FIREWALL CONFIGURATION. Specify port number and action (block/allow).",
            "progress": "Deploying firewall rule... {progress}% complete.",
            "complete": "Firewall rule deployed successfully. Port {port} now {action}.",
            "error": "Firewall deployment failed: {error_message}. Verify permissions.",
        },
        SecurityIntent.REMEDIATE: {
            "ack": "REMEDIATION SEQUENCE INITIATED. Analyzing fix requirements.",
            "progress": "Applying patches... {progress}% complete. {findings_count} items addressed.",
            "complete": "Remediation complete. {findings_count} issues resolved. System hardened.",
            "error": "Remediation failed: {error_message}. Manual intervention may be required.",
        },
        SecurityIntent.VULNHUNT: {
            "ack": "VULNERABILITY HUNT INITIATED. Scanning dependencies and configurations.",
            "ack_cve": "VULNERABILITY HUNT INITIATED. Searching for {cve_id} across all assets.",
            "progress": "Vulnerability scan... {progress}% complete. {findings_count} CVEs identified.",
            "complete": "Hunt complete. {findings_count} vulnerabilities found. {critical_count} critical.",
            "error": "Vulnerability scan failed: {error_message}.",
        },
        SecurityIntent.PENTEST: {
            "ack": "RED TEAM OPERATIONS AUTHORIZED. Initiating penetration test on {target}.",
            "ack_no_target": "RED TEAM OPERATIONS. Specify target for authorized penetration testing.",
            "progress": "Pentest in progress... {progress}% complete. {findings_count} attack vectors identified.",
            "complete": "Penetration test complete. {findings_count} vulnerabilities exploited. Report ready.",
            "error": "Pentest operation failed: {error_message}.",
        },
        SecurityIntent.FORENSICS: {
            "ack": "FORENSIC ACQUISITION INITIATED. Preserving chain of custody.",
            "progress": "Collecting evidence... {progress}% complete. {findings_count} artifacts captured.",
            "complete": "Forensic collection complete. {findings_count} artifacts preserved. Timeline generated.",
            "error": "Forensic acquisition failed: {error_message}. Evidence integrity maintained.",
        },
        SecurityIntent.COMPLIANCE: {
            "ack": "COMPLIANCE AUDIT INITIATED. Framework: {framework}.",
            "ack_no_framework": "COMPLIANCE AUDIT. Available frameworks: STIG, CMMC, NIST 800-53, NIST 800-171, FedRAMP.",
            "progress": "Compliance check... {progress}% complete. {passing_count}/{total_count} controls passing.",
            "complete": "Compliance audit complete. Score: {score}%. Level: {level}.",
            "error": "Compliance check failed: {error_message}.",
        },
        SecurityIntent.ENCRYPTION: {
            "ack": "ENCRYPTION OPERATION INITIALIZED. Algorithm: {algorithm}.",
            "ack_no_algo": "ENCRYPTION READY. Supported: AES-256-GCM, Kyber-1024, Dilithium-3.",
            "progress": "Encryption in progress... {progress}% complete.",
            "complete": "Encryption complete. {bytes_processed} bytes processed. Key stored securely.",
            "error": "Encryption failed: {error_message}. Keys not compromised.",
        },
        SecurityIntent.PQC: {
            "ack": "PQC MIGRATION SCANNER ACTIVATED. Analyzing cryptographic inventory.",
            "progress": "Scanning for quantum-vulnerable algorithms... {progress}% complete.",
            "complete": "PQC scan complete. {vulnerable_count} quantum-vulnerable implementations found. Migration plan ready.",
            "error": "PQC scan failed: {error_message}.",
        },
        SecurityIntent.IR: {
            "ack": "INCIDENT RESPONSE ACTIVATED. Threat level: {threat_level}.",
            "ack_default": "INCIDENT RESPONSE READY. Available playbooks: Isolate, Contain, Eradicate, Recover.",
            "progress": "IR playbook executing... {progress}% complete. {actions_taken} actions completed.",
            "complete": "Incident contained. {actions_taken} response actions executed. Post-incident report ready.",
            "error": "IR action failed: {error_message}. Escalating to manual response.",
        },
        SecurityIntent.DRBC: {
            "ack": "DISASTER RECOVERY INITIALIZED. Initiating backup procedures.",
            "progress": "Backup in progress... {progress}% complete. {bytes_backed} bytes secured.",
            "complete": "DR/BC complete. RPO: {rpo}. RTO: {rto}. Genesis backup verified.",
            "error": "DR/BC operation failed: {error_message}. Failover may be required.",
        },
        SecurityIntent.HELP: {
            "general": """KASA OPERATIONAL MANUAL

AVAILABLE COMMANDS:
  SCAN [target]      - Network/vulnerability scan
  FIREWALL [port]    - Deploy micro-firewall rule
  REMEDIATE          - Apply security patches
  VULNHUNT           - Scan dependencies for CVEs
  PENTEST [target]   - Internal penetration test
  FORENSICS          - Collect system evidence
  COMPLIANCE [fw]    - Run compliance check (STIG/CMMC/NIST)
  ENCRYPT            - Encryption operations
  PQC                - Post-quantum crypto migration scan
  IR                 - Incident response playbooks
  DRBC               - Disaster recovery/backup
  STATUS             - System health report

Type any command or describe what you need.
""",
            "scan": """SCAN COMMAND GUIDE

USAGE: scan [target]

EXAMPLES:
  scan localhost       - Scan local system
  scan 192.168.1.0/24 - Scan network range
  scan example.com    - Scan external host
  scan port 443       - Port-specific scan

CAPABILITIES:
  - Port enumeration (1-65535)
  - Service fingerprinting
  - OS detection
  - Vulnerability correlation (CISA KEV)
  - AI anomaly scoring
""",
            "compliance": """COMPLIANCE COMMAND GUIDE

USAGE: compliance [framework]

SUPPORTED FRAMEWORKS:
  STIG      - DISA Security Technical Implementation Guides
  CMMC      - Cybersecurity Maturity Model Certification (Level 1-3)
  NIST      - NIST 800-53 / 800-171 controls
  FedRAMP   - Federal Risk and Authorization Management
  CIS       - Center for Internet Security Benchmarks

EXAMPLES:
  compliance stig     - Run STIG validation
  compliance cmmc     - Check CMMC Level 2 readiness
  compliance nist     - NIST 800-171 assessment
""",
        },
        SecurityIntent.STATUS: {
            "ack": """SYSTEM STATUS REPORT

Core Services:
  - SouHimBou ML: {ml_status}
  - KASA Engine: {engine_status}
  - DAG Server: {dag_status}
  - Sonar Scanner: {sonar_status}

Task Queue: {queue_count} pending
Active Scans: {active_scans}
Last Anomaly: {last_anomaly_time}

Soul Integrity: {soul_status}
""",
        },
        SecurityIntent.UNKNOWN: {
            "default": "Command not recognized. Type 'help' for available commands or describe your security need.",
        },
    }

    # Anomaly-based response modifiers
    ANOMALY_RESPONSES: Dict[str, str] = {
        "low": "Analysis complete. Anomaly score: {score:.2f}. System within normal parameters.",
        "medium": "Analysis complete. Anomaly score: {score:.2f}. Minor deviations detected. Recommend monitoring.",
        "high": "WARNING: Anomaly score: {score:.2f}. Significant deviation detected. Immediate review recommended.",
        "critical": "ALERT: Critical anomaly detected ({score:.2f}). Potential security incident. Initiating automatic response.",
    }

    def generate_response(self, context: ResponseContext) -> str:
        """
        Generate response based on intent and context.

        Args:
            context: ResponseContext with all relevant information

        Returns:
            Formatted response string
        """
        templates = self.RESPONSE_TEMPLATES.get(context.intent, {})

        # Handle error state first
        if context.state == "error" and context.error_message:
            template = templates.get("error", "Operation failed: {error_message}")
            return self._format_template(template, context)

        # Handle anomaly score injection
        if context.anomaly_score is not None:
            anomaly_response = self._get_anomaly_response(context.anomaly_score)
            if anomaly_response:
                base_response = self._get_base_response(templates, context)
                return f"{base_response}\n\n{anomaly_response}"

        return self._get_base_response(templates, context)

    def _get_base_response(
        self, templates: Dict[str, str], context: ResponseContext
    ) -> str:
        """Get the base response template and format it."""
        # Select appropriate template based on state and params
        template_key = context.state

        # Handle special cases
        if context.intent == SecurityIntent.HELP:
            # Check for specific help topics
            topic = context.params.get("topic", "general").lower()
            template = templates.get(topic, templates.get("general", ""))
            return template

        if context.intent == SecurityIntent.STATUS:
            template = templates.get("ack", "")
            return self._format_template(template, context)

        if context.intent == SecurityIntent.UNKNOWN:
            return templates.get("default", "Command not recognized.")

        # Check for missing required params and use alternative template
        if context.state == "ack":
            if context.intent == SecurityIntent.SCAN and not context.params.get("target"):
                template_key = "ack_no_target"
            elif context.intent == SecurityIntent.FIREWALL and not context.params.get("port"):
                template_key = "ack_no_port"
            elif context.intent == SecurityIntent.VULNHUNT and context.params.get("cve_id"):
                template_key = "ack_cve"
            elif context.intent == SecurityIntent.COMPLIANCE and not context.params.get("framework"):
                template_key = "ack_no_framework"
            elif context.intent == SecurityIntent.ENCRYPTION and not context.params.get("algorithm"):
                template_key = "ack_no_algo"
            elif context.intent == SecurityIntent.IR and not context.params.get("threat_level"):
                template_key = "ack_default"

        template = templates.get(template_key, templates.get("ack", "Processing request..."))
        return self._format_template(template, context)

    def _format_template(self, template: str, context: ResponseContext) -> str:
        """Format template with context values."""
        # Build format dictionary
        format_dict = {
            "target": context.params.get("target", "unspecified"),
            "port": context.params.get("port", "unspecified"),
            "framework": context.params.get("framework", "unspecified"),
            "algorithm": context.params.get("algorithm", "AES-256-GCM"),
            "cve_id": context.params.get("cve_id", ""),
            "scan_type": context.params.get("scan_type", "comprehensive"),
            "action": context.params.get("action", "blocked"),
            "threat_level": context.params.get("threat_level", "MEDIUM"),
            "progress": context.progress or 0,
            "findings_count": context.findings_count or 0,
            "risk_score": context.risk_score or 0.0,
            "error_message": context.error_message or "Unknown error",
            # Status defaults
            "ml_status": context.extra.get("ml_status", "ONLINE"),
            "engine_status": context.extra.get("engine_status", "ACTIVE"),
            "dag_status": context.extra.get("dag_status", "SYNCHRONIZED"),
            "sonar_status": context.extra.get("sonar_status", "READY"),
            "queue_count": context.extra.get("queue_count", 0),
            "active_scans": context.extra.get("active_scans", 0),
            "last_anomaly_time": context.extra.get("last_anomaly_time", "N/A"),
            "soul_status": context.extra.get("soul_status", "STABLE"),
            # Compliance
            "score": context.extra.get("score", 0),
            "level": context.extra.get("level", "Unknown"),
            "passing_count": context.extra.get("passing_count", 0),
            "total_count": context.extra.get("total_count", 0),
            # Encryption
            "bytes_processed": context.extra.get("bytes_processed", 0),
            # PQC
            "vulnerable_count": context.extra.get("vulnerable_count", 0),
            # IR
            "actions_taken": context.extra.get("actions_taken", 0),
            # DRBC
            "bytes_backed": context.extra.get("bytes_backed", 0),
            "rpo": context.extra.get("rpo", "N/A"),
            "rto": context.extra.get("rto", "N/A"),
            # Vuln
            "critical_count": context.extra.get("critical_count", 0),
        }

        try:
            return template.format(**format_dict)
        except KeyError as e:
            # Graceful degradation if template has unknown placeholders
            return template

    def _get_anomaly_response(self, score: float) -> Optional[str]:
        """Get anomaly-specific response based on score threshold."""
        if score >= 0.85:
            level = "critical"
        elif score >= 0.6:
            level = "high"
        elif score >= 0.3:
            level = "medium"
        else:
            level = "low"

        template = self.ANOMALY_RESPONSES.get(level, "")
        return template.format(score=score) if template else None

    def get_quick_help(self, intent: SecurityIntent) -> str:
        """Get quick help text for a specific intent."""
        help_templates = self.RESPONSE_TEMPLATES.get(SecurityIntent.HELP, {})
        intent_key = intent.value.lower()
        return help_templates.get(intent_key, f"No specific help available for {intent.value}.")
