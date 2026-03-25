"""
SouHimBou AGI - Task Recommendation Engine
"The Eye that Sees the Path Forward"

Responsibility:
    - Generate security task recommendations from analysis results
    - Implement the "Task Creation Agent" from BabyAGI pattern
    - Bridge between ML anomaly detection and actionable remediation

NIST AI RMF Alignment:
    - MANAGE: Autonomous risk mitigation recommendations
    - Accountable: Every recommendation has traceable reasoning
    - Safe: Recommendations respect blast radius limits
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Any, Optional
from enum import Enum
from .intent import SecurityIntent


class TaskPriority(Enum):
    """Task priority levels aligned with DoD severity."""
    CRITICAL = "CRITICAL"  # Immediate action required
    HIGH = "HIGH"          # Within 24 hours
    MEDIUM = "MED"         # Within 7 days
    LOW = "LOW"            # Scheduled maintenance


class AdinkraSymbol(Enum):
    """Adinkra symbols for explainable AI decisions."""
    SANKOFA = "Sankofa"          # Learn from the past (forensics, investigation)
    EBAN = "Eban"                # Security, safety (defensive actions)
    OWO_FORO_ADOBE = "OwoForoAdobe"  # Determination (patching, remediation)
    NYAME_DUA = "NyameDua"       # Divine protection (compliance)
    FAWOHODIE = "Fawohodie"      # Independence (isolation, containment)
    NKYINKYIM = "Nkyinkyim"      # Initiative, adaptability (dynamic response)
    AKOMA = "Akoma"              # Patience, endurance (monitoring)


@dataclass
class TaskRecommendation:
    """A recommended security task with full provenance."""
    id: str = ""
    description: str = ""
    priority: TaskPriority = TaskPriority.MEDIUM
    symbol: AdinkraSymbol = AdinkraSymbol.EBAN
    reason: str = ""
    source: str = ""  # sonar, forensics, compliance, anomaly, chat
    anomaly_score: float = 0.0
    confidence: float = 0.0
    cvss_score: Optional[float] = None
    affected_systems: int = 1
    related_findings: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.id:
            self.id = f"task_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"


@dataclass
class AnalysisResult:
    """Input for task recommendation engine."""
    anomaly_score: float = 0.0
    source: str = "unknown"
    intent: Optional[SecurityIntent] = None
    findings: List[Dict[str, Any]] = field(default_factory=list)
    context: Dict[str, Any] = field(default_factory=dict)


class TaskRecommender:
    """
    ML-powered task creation based on analysis results.
    This is the "Task Creation Agent" from BabyAGI.

    Design Principles:
    - Risk-driven: Higher anomaly → more urgent tasks
    - Contextual: Recommendations based on finding type
    - Explainable: Every task has Adinkra symbol + reasoning
    - Conservative: Prefers monitoring over action when uncertain
    """

    # Anomaly thresholds for automatic task generation
    ANOMALY_THRESHOLDS = {
        "forensic_snapshot": 0.7,   # High anomaly → capture evidence
        "containment": 0.85,        # Critical → isolate threat
        "enhanced_monitoring": 0.4,  # Medium → increase visibility
    }

    # CVSS to priority mapping
    CVSS_PRIORITY_MAP = {
        (9.0, 10.0): TaskPriority.CRITICAL,
        (7.0, 8.9): TaskPriority.HIGH,
        (4.0, 6.9): TaskPriority.MEDIUM,
        (0.0, 3.9): TaskPriority.LOW,
    }

    def recommend_tasks(
        self, analysis: AnalysisResult
    ) -> List[TaskRecommendation]:
        """
        Generate task recommendations based on analysis.
        Uses anomaly detection + rule-based logic.

        Args:
            analysis: AnalysisResult with anomaly score and findings

        Returns:
            List of TaskRecommendation objects
        """
        tasks: List[TaskRecommendation] = []

        # 1. Anomaly-driven tasks
        tasks.extend(self._generate_anomaly_tasks(analysis))

        # 2. Finding-driven tasks
        tasks.extend(self._generate_finding_tasks(analysis))

        # 3. Intent-driven tasks (if from chat interaction)
        if analysis.intent:
            tasks.extend(self._generate_intent_tasks(analysis))

        # Deduplicate by description
        seen = set()
        unique_tasks = []
        for task in tasks:
            if task.description not in seen:
                seen.add(task.description)
                unique_tasks.append(task)

        return unique_tasks

    def _generate_anomaly_tasks(
        self, analysis: AnalysisResult
    ) -> List[TaskRecommendation]:
        """Generate tasks based on anomaly score thresholds."""
        tasks = []
        score = analysis.anomaly_score

        # Critical anomaly → Emergency forensic snapshot
        if score >= self.ANOMALY_THRESHOLDS["containment"]:
            tasks.append(TaskRecommendation(
                description="EMERGENCY: Isolate affected system and capture forensic snapshot",
                priority=TaskPriority.CRITICAL,
                symbol=AdinkraSymbol.FAWOHODIE,
                reason=f"Critical anomaly score ({score:.2f}) indicates active threat",
                source=analysis.source,
                anomaly_score=score,
                confidence=0.95,
            ))

        elif score >= self.ANOMALY_THRESHOLDS["forensic_snapshot"]:
            tasks.append(TaskRecommendation(
                description="Capture forensic evidence for anomaly investigation",
                priority=TaskPriority.HIGH,
                symbol=AdinkraSymbol.SANKOFA,
                reason=f"High anomaly score ({score:.2f}) requires evidence preservation",
                source=analysis.source,
                anomaly_score=score,
                confidence=0.85,
            ))

        elif score >= self.ANOMALY_THRESHOLDS["enhanced_monitoring"]:
            tasks.append(TaskRecommendation(
                description="Enable enhanced monitoring on affected assets",
                priority=TaskPriority.MEDIUM,
                symbol=AdinkraSymbol.AKOMA,
                reason=f"Elevated anomaly score ({score:.2f}) warrants increased visibility",
                source=analysis.source,
                anomaly_score=score,
                confidence=0.7,
            ))

        return tasks

    def _generate_finding_tasks(
        self, analysis: AnalysisResult
    ) -> List[TaskRecommendation]:
        """Generate tasks based on specific findings."""
        tasks = []

        for finding in analysis.findings:
            finding_type = finding.get("type", "unknown")
            finding_id = finding.get("id", "unknown")

            if finding_type == "compliance_gap":
                tasks.append(self._create_compliance_task(finding, analysis))

            elif finding_type == "open_port":
                task = self._create_port_task(finding, analysis)
                if task:
                    tasks.append(task)

            elif finding_type == "cve":
                tasks.append(self._create_cve_task(finding, analysis))

            elif finding_type == "misconfiguration":
                tasks.append(self._create_config_task(finding, analysis))

            elif finding_type == "malware":
                tasks.append(self._create_malware_task(finding, analysis))

            elif finding_type == "pqc_vulnerable":
                tasks.append(self._create_pqc_task(finding, analysis))

        return tasks

    def _generate_intent_tasks(
        self, analysis: AnalysisResult
    ) -> List[TaskRecommendation]:
        """Generate follow-up tasks based on user intent."""
        tasks = []
        intent = analysis.intent

        # Map intents to suggested follow-up tasks
        follow_ups = {
            SecurityIntent.SCAN: [
                ("Review and prioritize scan findings", AdinkraSymbol.NKYINKYIM),
                ("Update asset inventory with discovered hosts", AdinkraSymbol.SANKOFA),
            ],
            SecurityIntent.FORENSICS: [
                ("Verify chain of custody documentation", AdinkraSymbol.SANKOFA),
                ("Cross-reference artifacts with threat intelligence", AdinkraSymbol.EBAN),
            ],
            SecurityIntent.COMPLIANCE: [
                ("Generate remediation plan for failed controls", AdinkraSymbol.OWO_FORO_ADOBE),
                ("Schedule re-assessment after remediation", AdinkraSymbol.NYAME_DUA),
            ],
            SecurityIntent.IR: [
                ("Document incident timeline", AdinkraSymbol.SANKOFA),
                ("Conduct post-incident review", AdinkraSymbol.NKYINKYIM),
            ],
        }

        if intent in follow_ups:
            for description, symbol in follow_ups[intent]:
                tasks.append(TaskRecommendation(
                    description=description,
                    priority=TaskPriority.MEDIUM,
                    symbol=symbol,
                    reason=f"Recommended follow-up for {intent.value} operation",
                    source="chat",
                    anomaly_score=analysis.anomaly_score,
                    confidence=0.6,
                ))

        return tasks

    def _create_compliance_task(
        self, finding: Dict, analysis: AnalysisResult
    ) -> TaskRecommendation:
        """Create task for compliance gap."""
        control = finding.get("control", "Unknown")
        framework = finding.get("framework", "Unknown")
        severity = finding.get("severity", "MEDIUM").upper()

        return TaskRecommendation(
            description=f"Remediate {control} ({framework})",
            priority=self._severity_to_priority(severity),
            symbol=AdinkraSymbol.NYAME_DUA,
            reason=finding.get("description", f"Compliance gap in {control}"),
            source=analysis.source,
            anomaly_score=analysis.anomaly_score,
            confidence=0.9,
            related_findings=[finding.get("id", "")],
            metadata={"framework": framework, "control": control},
        )

    def _create_port_task(
        self, finding: Dict, analysis: AnalysisResult
    ) -> Optional[TaskRecommendation]:
        """Create task for open port finding."""
        port = finding.get("port", "unknown")
        risk = finding.get("risk", "low").lower()
        service = finding.get("service", "unknown")

        # Only create tasks for high-risk ports
        if risk not in ("high", "critical"):
            return None

        return TaskRecommendation(
            description=f"Evaluate firewall rule for port {port} ({service})",
            priority=TaskPriority.HIGH if risk == "critical" else TaskPriority.MEDIUM,
            symbol=AdinkraSymbol.EBAN,
            reason=f"High-risk port {port} open: {service}",
            source=analysis.source,
            anomaly_score=analysis.anomaly_score,
            confidence=0.8,
            related_findings=[finding.get("id", "")],
            metadata={"port": port, "service": service},
        )

    def _create_cve_task(
        self, finding: Dict, analysis: AnalysisResult
    ) -> TaskRecommendation:
        """Create task for CVE finding."""
        cve_id = finding.get("cve_id", "Unknown")
        package = finding.get("package", "Unknown")
        cvss = finding.get("cvss", 5.0)

        return TaskRecommendation(
            description=f"Patch {cve_id} in {package}",
            priority=self._cvss_to_priority(cvss),
            symbol=AdinkraSymbol.OWO_FORO_ADOBE,
            reason=f"CVSS: {cvss} - {finding.get('description', '')}",
            source=analysis.source,
            anomaly_score=analysis.anomaly_score,
            confidence=0.95,
            cvss_score=cvss,
            related_findings=[finding.get("id", "")],
            metadata={"cve_id": cve_id, "package": package, "cvss": cvss},
        )

    def _create_config_task(
        self, finding: Dict, analysis: AnalysisResult
    ) -> TaskRecommendation:
        """Create task for misconfiguration finding."""
        config = finding.get("config", "Unknown")
        severity = finding.get("severity", "MEDIUM").upper()

        return TaskRecommendation(
            description=f"Correct misconfiguration: {config}",
            priority=self._severity_to_priority(severity),
            symbol=AdinkraSymbol.OWO_FORO_ADOBE,
            reason=finding.get("description", f"Configuration issue: {config}"),
            source=analysis.source,
            anomaly_score=analysis.anomaly_score,
            confidence=0.85,
            related_findings=[finding.get("id", "")],
        )

    def _create_malware_task(
        self, finding: Dict, analysis: AnalysisResult
    ) -> TaskRecommendation:
        """Create task for malware finding."""
        malware_name = finding.get("name", "Unknown malware")
        host = finding.get("host", "Unknown")

        return TaskRecommendation(
            description=f"URGENT: Contain and eradicate {malware_name} on {host}",
            priority=TaskPriority.CRITICAL,
            symbol=AdinkraSymbol.FAWOHODIE,
            reason=f"Malware detected: {malware_name}",
            source=analysis.source,
            anomaly_score=max(analysis.anomaly_score, 0.9),
            confidence=0.99,
            related_findings=[finding.get("id", "")],
            metadata={"malware": malware_name, "host": host},
        )

    def _create_pqc_task(
        self, finding: Dict, analysis: AnalysisResult
    ) -> TaskRecommendation:
        """Create task for PQC vulnerability."""
        algorithm = finding.get("algorithm", "Unknown")
        location = finding.get("location", "Unknown")

        return TaskRecommendation(
            description=f"Migrate from {algorithm} to PQC-safe algorithm",
            priority=TaskPriority.MEDIUM,  # PQC is important but not immediate
            symbol=AdinkraSymbol.NKYINKYIM,
            reason=f"Quantum-vulnerable algorithm: {algorithm} at {location}",
            source=analysis.source,
            anomaly_score=analysis.anomaly_score,
            confidence=0.9,
            related_findings=[finding.get("id", "")],
            metadata={"algorithm": algorithm, "location": location},
        )

    def _severity_to_priority(self, severity: str) -> TaskPriority:
        """Convert severity string to TaskPriority."""
        mapping = {
            "CRITICAL": TaskPriority.CRITICAL,
            "HIGH": TaskPriority.HIGH,
            "MEDIUM": TaskPriority.MEDIUM,
            "LOW": TaskPriority.LOW,
        }
        return mapping.get(severity.upper(), TaskPriority.MEDIUM)

    def _cvss_to_priority(self, cvss: float) -> TaskPriority:
        """Convert CVSS score to TaskPriority."""
        for (low, high), priority in self.CVSS_PRIORITY_MAP.items():
            if low <= cvss <= high:
                return priority
        return TaskPriority.MEDIUM
