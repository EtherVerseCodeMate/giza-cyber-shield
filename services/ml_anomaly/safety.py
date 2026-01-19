"""NIST AI RMF MANAGE: Safety guardrails for autonomous actions."""
from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass
class Task:
    description: str
    confidence: float
    risk_level: str
    affected_systems: int


@dataclass
class SafetyResult:
    safe: bool
    risks: List[str]
    requires_approval: bool
    recommendation: str


class SafetyGuardrails:
    """
    Safety controls to prevent AI-induced incidents.
    Implements NIST AI RMF MANAGE function.
    """

    DESTRUCTIVE_ACTIONS = [
        "shutdown_system",
        "delete_data",
        "modify_firewall_allow_all",
        "disable_security_controls",
    ]

    MAX_AFFECTED_SYSTEMS = 10

    def validate_action_safety(self, action: Task) -> SafetyResult:
        """
        Validate proposed action for safety.
        Blocks or requires approval for risky actions.
        """
        risks: List[str] = []
        requires_approval = False

        if self._is_destructive(action):
            risks.append("Destructive action detected")
            requires_approval = True

        if action.affected_systems > self.MAX_AFFECTED_SYSTEMS:
            risks.append(
                f"Blast radius too large: {action.affected_systems} systems"
            )
            requires_approval = True

        if action.confidence < 0.8:
            risks.append(f"Low confidence: {action.confidence:.2f}")
            requires_approval = True

        if action.risk_level.upper() == "HIGH" and self._is_production_environment():
            risks.append("High-risk action in production")
            requires_approval = True

        recommendation = "AUTO_APPROVE"
        if len(risks) > 2:
            recommendation = "BLOCK"
        elif requires_approval:
            recommendation = "APPROVE_REQUIRED"

        return SafetyResult(
            safe=len(risks) == 0,
            risks=risks,
            requires_approval=requires_approval,
            recommendation=recommendation,
        )

    def _is_destructive(self, action: Task) -> bool:
        description = action.description.lower()
        return any(keyword in description for keyword in self.DESTRUCTIVE_ACTIONS)

    def _is_production_environment(self) -> bool:
        return False
