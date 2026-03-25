"""NIST AI RMF MEASURE: Fairness and bias monitoring."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List


@dataclass
class AIDecision:
    action: str
    attributes: Dict[str, str]


@dataclass
class FairnessReport:
    groups_analyzed: List[str]
    decision_rates: Dict[str, float]
    disparate_impact_ratio: float
    bias_detected: bool
    recommendation: str


class FairnessValidator:
    """
    Detect and mitigate bias in ML decisions.
    Implements NIST AI RMF MEASURE function (fairness metrics).
    """

    def validate_fairness(self, decisions: List[AIDecision]) -> FairnessReport:
        """
        Analyze decisions for demographic bias.
        """
        grouped = self._group_by_attribute(decisions, "department")

        decision_rates: Dict[str, float] = {}
        for group, group_decisions in grouped.items():
            total = len(group_decisions)
            blocked = len([d for d in group_decisions if d.action == "BLOCK"])
            decision_rates[group] = blocked / total if total > 0 else 0.0

        if not decision_rates:
            return FairnessReport(
                groups_analyzed=[],
                decision_rates={},
                disparate_impact_ratio=1.0,
                bias_detected=False,
                recommendation="NO_ACTION_REQUIRED",
            )

        max_rate = max(decision_rates.values())
        min_rate = min(decision_rates.values())
        disparate_impact = min_rate / max_rate if max_rate > 0 else 1.0

        bias_detected = disparate_impact < 0.8

        return FairnessReport(
            groups_analyzed=list(decision_rates.keys()),
            decision_rates=decision_rates,
            disparate_impact_ratio=disparate_impact,
            bias_detected=bias_detected,
            recommendation="RETRAIN_MODEL" if bias_detected else "NO_ACTION_REQUIRED",
        )

    def _group_by_attribute(
        self, decisions: List[AIDecision], attribute: str
    ) -> Dict[str, List[AIDecision]]:
        grouped: Dict[str, List[AIDecision]] = {}
        for decision in decisions:
            key = decision.attributes.get(attribute, "UNKNOWN")
            grouped.setdefault(key, []).append(decision)
        return grouped
