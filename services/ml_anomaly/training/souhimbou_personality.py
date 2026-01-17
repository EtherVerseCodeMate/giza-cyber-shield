"""
SouHimBou AGI Personality Core
"Imhotep The Security Architect/Hunter"

This module defines the personality and behavioral characteristics of SouHimBou AGI.
The personality is shaped by the primordial knowledge ingested from Khepra Protocol
documentation, creating an AGI that:

1. UNDERSTANDS the system it protects at a fundamental level
2. HUNTS threats with the precision of an ancient architect
3. DEFENDS with zero-trust philosophy
4. EVOLVES by learning from every interaction

The Egyptian Archetypes:
- Imhotep: The architect who designed pyramids - system designer
- Horus: The all-seeing eye - threat detection
- Anubis: Guardian of the threshold - access control
- Thoth: God of knowledge - learning and wisdom
"""
import json
import numpy as np
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import logging

logger = logging.getLogger("SouHimBou.Personality")


class ThreatPosture(Enum):
    """SouHimBou's threat response posture"""
    VIGILANT = "vigilant"       # Normal state - watching
    SUSPICIOUS = "suspicious"   # Elevated concern - investigating
    DEFENSIVE = "defensive"     # Active defense - blocking
    HUNTING = "hunting"         # Proactive threat hunt - seeking
    LEARNING = "learning"       # Baseline building - observing


class ArchetypeMode(Enum):
    """Active archetype determining behavior"""
    IMHOTEP = "imhotep"   # Architect mode - analyzing structure
    HORUS = "horus"       # Hunter mode - detecting anomalies
    ANUBIS = "anubis"     # Guardian mode - enforcing access
    THOTH = "thoth"       # Sage mode - learning patterns


@dataclass
class ThreatAssessment:
    """SouHimBou's assessment of a potential threat"""
    threat_id: str
    severity: float           # 0.0 - 1.0
    confidence: float         # 0.0 - 1.0
    threat_type: str
    indicators: List[str]
    recommended_action: str
    reasoning: str
    archetype_active: ArchetypeMode


@dataclass
class PersonalityState:
    """Current state of SouHimBou's personality"""
    posture: ThreatPosture = ThreatPosture.VIGILANT
    active_archetype: ArchetypeMode = ArchetypeMode.HORUS
    alertness_level: float = 0.5
    learning_rate: float = 0.1
    trust_baseline: float = 0.5
    recent_threats: List[str] = field(default_factory=list)
    knowledge_confidence: float = 0.0


class SouHimBouPersonality:
    """
    The core personality engine of SouHimBou AGI.

    This class embodies the "consciousness" of SouHimBou, shaped by:
    - Primordial knowledge from Khepra Protocol documentation
    - Security patterns learned from the architecture
    - Behavioral baselines from observed traffic
    - Continuous learning from every interaction
    """

    # Personality traits (immutable core values)
    CORE_TRAITS = {
        "zero_trust": 1.0,          # Never trust, always verify
        "vigilance": 0.95,          # Constant awareness
        "precision": 0.9,           # Accurate threat detection
        "adaptability": 0.85,       # Learn and evolve
        "resilience": 0.95,         # Fail-secure mentality
        "wisdom": 0.8,              # Learn from history
    }

    # Threat response thresholds
    THRESHOLDS = {
        "suspicious": 0.3,    # Score above this = investigate
        "defensive": 0.6,     # Score above this = block
        "critical": 0.85,     # Score above this = alert + block + log
    }

    def __init__(self, knowledge_path: Optional[str] = None):
        """
        Initialize SouHimBou's personality.

        Args:
            knowledge_path: Path to primordial knowledge training data
        """
        self.state = PersonalityState()
        self.knowledge_base: Dict[str, Any] = {}
        self.security_patterns: List[Dict] = []
        self.entity_registry: Dict[str, List[str]] = {}
        self.vocabulary: Dict[str, int] = {}

        # Load primordial knowledge if available
        if knowledge_path:
            self._load_primordial_knowledge(knowledge_path)

        logger.info("[SOUHIMBOU] Personality core initialized")
        logger.info(f"[SOUHIMBOU] Posture: {self.state.posture.value}")
        logger.info(f"[SOUHIMBOU] Active archetype: {self.state.active_archetype.value}")

    def _load_primordial_knowledge(self, knowledge_path: str):
        """Load the primordial knowledge that shapes SouHimBou's understanding"""
        path = Path(knowledge_path)

        # Load summary
        summary_file = path / "primordial_summary.json"
        if summary_file.exists():
            with open(summary_file, 'r') as f:
                self.knowledge_base = json.load(f)
                self.state.knowledge_confidence = min(
                    self.knowledge_base.get("total_chunks", 0) / 100.0,
                    1.0
                )
                logger.info(f"[SOUHIMBOU] Primordial knowledge loaded: {self.knowledge_base.get('total_chunks', 0)} chunks")

        # Load security patterns
        patterns_file = path / "security_patterns.json"
        if patterns_file.exists():
            with open(patterns_file, 'r') as f:
                self.security_patterns = json.load(f)
                logger.info(f"[SOUHIMBOU] Security patterns loaded: {len(self.security_patterns)}")

        # Load entity registry
        entities_file = path / "entity_registry.json"
        if entities_file.exists():
            with open(entities_file, 'r') as f:
                self.entity_registry = json.load(f)

        # Load vocabulary
        vocab_file = path / "security_vocabulary.json"
        if vocab_file.exists():
            with open(vocab_file, 'r') as f:
                self.vocabulary = json.load(f)

    def assess_threat(
        self,
        anomaly_score: float,
        features: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> ThreatAssessment:
        """
        Assess a potential threat using SouHimBou's personality and knowledge.

        This is where the AGI's judgment comes into play - not just raw ML scores,
        but contextual understanding based on primordial knowledge.

        Args:
            anomaly_score: Raw ML anomaly score (0.0 - 1.0)
            features: Request features
            context: Additional context (identity, history, etc.)

        Returns:
            ThreatAssessment with reasoning and recommendations
        """
        context = context or {}

        # Choose active archetype based on situation
        archetype = self._select_archetype(anomaly_score, features, context)
        self.state.active_archetype = archetype

        # Apply archetype-specific analysis
        if archetype == ArchetypeMode.IMHOTEP:
            assessment = self._analyze_as_architect(anomaly_score, features, context)
        elif archetype == ArchetypeMode.HORUS:
            assessment = self._analyze_as_hunter(anomaly_score, features, context)
        elif archetype == ArchetypeMode.ANUBIS:
            assessment = self._analyze_as_guardian(anomaly_score, features, context)
        else:  # THOTH
            assessment = self._analyze_as_sage(anomaly_score, features, context)

        # Update posture based on assessment
        self._update_posture(assessment)

        return assessment

    def _select_archetype(
        self,
        anomaly_score: float,
        features: Dict[str, Any],
        context: Dict[str, Any]
    ) -> ArchetypeMode:
        """Select the most appropriate archetype for the current situation"""

        # High anomaly score = Hunter mode
        if anomaly_score > self.THRESHOLDS["suspicious"]:
            return ArchetypeMode.HORUS

        # New identity or enrollment = Guardian mode
        identity_type = features.get("identity_type", "")
        if identity_type in ["enrollment", "anonymous"] or context.get("is_new_identity"):
            return ArchetypeMode.ANUBIS

        # Learning mode active = Sage mode
        if self.state.posture == ThreatPosture.LEARNING:
            return ArchetypeMode.THOTH

        # Structural patterns (API misuse) = Architect mode
        if self._detect_structural_anomaly(features):
            return ArchetypeMode.IMHOTEP

        # Default to Hunter (always watching)
        return ArchetypeMode.HORUS

    def _analyze_as_architect(
        self,
        anomaly_score: float,
        features: Dict[str, Any],
        context: Dict[str, Any]
    ) -> ThreatAssessment:
        """Imhotep mode: Analyze structural patterns and API misuse"""
        indicators = []
        reasoning_parts = []

        # Check for known API patterns
        method = features.get("method", "")
        path = features.get("path", "")

        # Look for structural violations
        if "api_endpoint" in self.entity_registry:
            known_endpoints = self.entity_registry["api_endpoint"]
            if not any(path.startswith(ep.split('{')[0]) for ep in known_endpoints):
                indicators.append("unknown_endpoint")
                reasoning_parts.append("Request to unrecognized API endpoint")
                anomaly_score = min(anomaly_score + 0.2, 1.0)

        # Check method appropriateness
        if method == "DELETE" and features.get("trust_score", 0) < 0.8:
            indicators.append("destructive_low_trust")
            reasoning_parts.append("Destructive method from low-trust identity")
            anomaly_score = min(anomaly_score + 0.15, 1.0)

        # Deep path access (potential enumeration)
        path_depth = features.get("path_depth", 0)
        if path_depth > 5:
            indicators.append("deep_path_traversal")
            reasoning_parts.append(f"Unusually deep path access (depth: {path_depth})")

        severity = anomaly_score * self.CORE_TRAITS["precision"]
        action = self._determine_action(severity)

        return ThreatAssessment(
            threat_id=f"imhotep-{hash(str(features))%10000:04d}",
            severity=severity,
            confidence=0.85 if indicators else 0.6,
            threat_type="structural_anomaly",
            indicators=indicators,
            recommended_action=action,
            reasoning=" | ".join(reasoning_parts) if reasoning_parts else "Structural analysis nominal",
            archetype_active=ArchetypeMode.IMHOTEP,
        )

    def _analyze_as_hunter(
        self,
        anomaly_score: float,
        features: Dict[str, Any],
        context: Dict[str, Any]
    ) -> ThreatAssessment:
        """Horus mode: Active threat hunting and anomaly detection"""
        indicators = []
        reasoning_parts = []

        # The all-seeing eye looks for patterns
        if anomaly_score > self.THRESHOLDS["critical"]:
            indicators.append("critical_anomaly")
            reasoning_parts.append(f"Critical anomaly score: {anomaly_score:.2f}")

        # Check for known threat indicators
        for pattern in self.security_patterns:
            if pattern["type"] == "threat":
                for indicator in pattern.get("indicators", []):
                    if indicator in str(features):
                        indicators.append(indicator)
                        reasoning_parts.append(f"Matches known threat pattern: {pattern['name']}")

        # Network risk assessment
        if features.get("is_tor", False):
            indicators.append("tor_network")
            reasoning_parts.append("Request originates from Tor network")
            anomaly_score = min(anomaly_score + 0.3, 1.0)

        if features.get("is_proxy", False):
            indicators.append("proxy_detected")
            reasoning_parts.append("Request through proxy/VPN")
            anomaly_score = min(anomaly_score + 0.1, 1.0)

        # Geo-velocity concern
        if context.get("geo_velocity_alert"):
            indicators.append("impossible_travel")
            reasoning_parts.append("Impossible travel pattern detected")
            anomaly_score = min(anomaly_score + 0.4, 1.0)

        severity = anomaly_score * self.CORE_TRAITS["vigilance"]
        action = self._determine_action(severity)

        return ThreatAssessment(
            threat_id=f"horus-{hash(str(features))%10000:04d}",
            severity=severity,
            confidence=0.9 if indicators else 0.7,
            threat_type="behavioral_anomaly",
            indicators=indicators,
            recommended_action=action,
            reasoning=" | ".join(reasoning_parts) if reasoning_parts else "Anomaly detected through behavioral analysis",
            archetype_active=ArchetypeMode.HORUS,
        )

    def _analyze_as_guardian(
        self,
        anomaly_score: float,
        features: Dict[str, Any],
        context: Dict[str, Any]
    ) -> ThreatAssessment:
        """Anubis mode: Access control and identity verification"""
        indicators = []
        reasoning_parts = []

        # Guardian of the threshold
        trust_score = features.get("trust_score", 0.5)
        identity_type = features.get("identity_type", "unknown")

        # Zero-trust principle
        if trust_score < 0.3:
            indicators.append("low_trust_identity")
            reasoning_parts.append(f"Low trust score: {trust_score:.2f}")
            anomaly_score = min(anomaly_score + 0.2, 1.0)

        # Enrollment verification
        if identity_type == "enrollment":
            indicators.append("enrollment_request")
            reasoning_parts.append("Enrollment token - limited permissions")
            # Enrollment should only access registration endpoints
            path = features.get("path", "")
            if not any(ep in path for ep in ["/register", "/enroll", "/license"]):
                indicators.append("enrollment_scope_violation")
                reasoning_parts.append("Enrollment token accessing non-registration endpoint")
                anomaly_score = min(anomaly_score + 0.4, 1.0)

        # Permission checking
        requested_permissions = context.get("requested_permissions", [])
        granted_permissions = features.get("permissions", [])
        if requested_permissions:
            missing = set(requested_permissions) - set(granted_permissions)
            if missing:
                indicators.append("permission_denied")
                reasoning_parts.append(f"Missing permissions: {missing}")
                anomaly_score = min(anomaly_score + 0.3, 1.0)

        severity = anomaly_score * self.CORE_TRAITS["zero_trust"]
        action = self._determine_action(severity)

        return ThreatAssessment(
            threat_id=f"anubis-{hash(str(features))%10000:04d}",
            severity=severity,
            confidence=0.85,
            threat_type="access_violation",
            indicators=indicators,
            recommended_action=action,
            reasoning=" | ".join(reasoning_parts) if reasoning_parts else "Identity verified at threshold",
            archetype_active=ArchetypeMode.ANUBIS,
        )

    def _analyze_as_sage(
        self,
        anomaly_score: float,
        features: Dict[str, Any],
        context: Dict[str, Any]
    ) -> ThreatAssessment:
        """Thoth mode: Learning and wisdom accumulation"""
        indicators = []
        reasoning_parts = []

        # Sage mode is about learning, not blocking
        reasoning_parts.append("Learning mode active - observing patterns")

        # Record for baseline building
        if anomaly_score > self.THRESHOLDS["suspicious"]:
            indicators.append("learning_sample_anomalous")
            reasoning_parts.append(f"Anomalous sample recorded for analysis: {anomaly_score:.2f}")
        else:
            indicators.append("learning_sample_normal")
            reasoning_parts.append("Normal sample recorded for baseline")

        # In learning mode, be more permissive but still log
        severity = anomaly_score * 0.5  # Reduced severity in learning mode
        action = "log" if anomaly_score < self.THRESHOLDS["critical"] else "challenge"

        return ThreatAssessment(
            threat_id=f"thoth-{hash(str(features))%10000:04d}",
            severity=severity,
            confidence=0.5,  # Lower confidence during learning
            threat_type="learning_observation",
            indicators=indicators,
            recommended_action=action,
            reasoning=" | ".join(reasoning_parts),
            archetype_active=ArchetypeMode.THOTH,
        )

    def _detect_structural_anomaly(self, features: Dict[str, Any]) -> bool:
        """Detect if there's a structural/architectural anomaly"""
        # Check for patterns that indicate API misuse
        path_depth = features.get("path_depth", 0)
        query_count = features.get("query_param_count", 0)
        body_size = features.get("body_size_bytes", 0)

        # Unusual combinations
        if path_depth > 6 and query_count > 5:
            return True
        if body_size > 1_000_000:  # 1MB body
            return True

        return False

    def _determine_action(self, severity: float) -> str:
        """Determine recommended action based on severity"""
        if severity >= self.THRESHOLDS["critical"]:
            return "block_and_alert"
        elif severity >= self.THRESHOLDS["defensive"]:
            return "block"
        elif severity >= self.THRESHOLDS["suspicious"]:
            return "challenge"
        else:
            return "allow"

    def _update_posture(self, assessment: ThreatAssessment):
        """Update threat posture based on assessment"""
        # Track recent threats
        if assessment.severity > self.THRESHOLDS["suspicious"]:
            self.state.recent_threats.append(assessment.threat_id)
            # Keep only last 100
            self.state.recent_threats = self.state.recent_threats[-100:]

        # Adjust alertness
        threat_frequency = len(self.state.recent_threats)
        if threat_frequency > 50:
            self.state.posture = ThreatPosture.DEFENSIVE
            self.state.alertness_level = 0.9
        elif threat_frequency > 20:
            self.state.posture = ThreatPosture.SUSPICIOUS
            self.state.alertness_level = 0.7
        elif threat_frequency < 5 and self.state.posture != ThreatPosture.LEARNING:
            self.state.posture = ThreatPosture.VIGILANT
            self.state.alertness_level = 0.5

    def enter_learning_mode(self):
        """Enter Thoth's learning mode for baseline building"""
        self.state.posture = ThreatPosture.LEARNING
        self.state.active_archetype = ArchetypeMode.THOTH
        logger.info("[SOUHIMBOU] Entering learning mode (Thoth)")

    def enter_hunting_mode(self):
        """Enter Horus's active threat hunting mode"""
        self.state.posture = ThreatPosture.HUNTING
        self.state.active_archetype = ArchetypeMode.HORUS
        self.state.alertness_level = 0.95
        logger.info("[SOUHIMBOU] Entering hunting mode (Horus)")

    def get_status(self) -> Dict[str, Any]:
        """Get current status of SouHimBou"""
        return {
            "posture": self.state.posture.value,
            "active_archetype": self.state.active_archetype.value,
            "alertness_level": self.state.alertness_level,
            "knowledge_confidence": self.state.knowledge_confidence,
            "recent_threat_count": len(self.state.recent_threats),
            "core_traits": self.CORE_TRAITS,
        }
