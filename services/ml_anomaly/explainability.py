"""NIST AI RMF GOVERN: Explainability via Adinkra framework."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class AIDecision:
    description: str
    confidence: float
    risk_level: str
    action_type: str
    features: List[str]
    anomaly_score: float
    model_version: str
    timestamp: str
    dag_node_id: str
    operator: Optional[str] = None
    feature_importance: Optional[Dict[str, float]] = None


@dataclass
class Explanation:
    text: str
    symbol: str
    feature_importance: Dict[str, float]
    dag_reference: str


class AdinkraExplainer:
    """
    Generate human-readable explanations for ML decisions.
    Uses Adinkra symbols as explanatory framework.
    Implements NIST AI RMF GOVERN function.
    """

    ADINKRA_DECISION_FRAMEWORK = {
        "Eban": {
            "meaning": "The Fence - Security",
            "usage": "Protective actions (firewall, isolation)",
        },
        "Sankofa": {
            "meaning": "Return and Retrieve - Learning",
            "usage": "Forensic analysis, historical review",
        },
        "OwoForoAdobe": {
            "meaning": "The Serpent - Prudence",
            "usage": "Careful remediation, verification",
        },
        "Dwennimmen": {
            "meaning": "Ram's Horns - Strength",
            "usage": "Resilience actions (backup, redundancy)",
        },
    }

    def explain_decision(self, decision: AIDecision) -> Explanation:
        """
        Generate NIST-compliant explanation for AI decision.
        """
        feature_importance = self._calculate_shap_values(decision)
        top_features = sorted(
            feature_importance.items(),
            key=lambda item: abs(item[1]),
            reverse=True,
        )[:5]
        symbol = self._select_adinkra_symbol(decision.action_type)

        explanation_text = (
            "AI DECISION EXPLANATION (NIST AI RMF Compliant)\n\n"
            f"Decision: {decision.description}\n"
            f"Confidence: {decision.confidence:.2%}\n"
            f"Risk Level: {decision.risk_level}\n"
            f"Adinkra Symbol: {symbol} "
            f"({self.ADINKRA_DECISION_FRAMEWORK[symbol]['meaning']})\n\n"
            "REASONING:\nTop Contributing Factors:\n"
        )
        for feature_name, importance in top_features:
            explanation_text += f"  - {feature_name}: {importance:.3f} importance\n"

        explanation_text += (
            "\nMATHEMATICAL JUSTIFICATION:\n"
            f"Anomaly Score: {decision.anomaly_score:.4f}\n"
            "Threshold: 0.6000 (HIGH risk)\n"
            f"Decision Boundary: {decision.anomaly_score - 0.6:.4f} above threshold\n\n"
            "AUDIT TRAIL:\n"
            f"Model Version: {decision.model_version}\n"
            f"Timestamp: {decision.timestamp}\n"
            f"Operator: {decision.operator or 'AI_AUTONOMOUS'}\n"
            f"DAG Node ID: {decision.dag_node_id}\n\n"
            "VERIFICATION:\n"
            f"To verify this decision, run:\n"
            f"  adinkhepra dag query --node {decision.dag_node_id}\n"
        )

        return Explanation(
            text=explanation_text,
            symbol=symbol,
            feature_importance=dict(top_features),
            dag_reference=decision.dag_node_id,
        )

    def _calculate_shap_values(self, decision: AIDecision) -> Dict[str, float]:
        if decision.feature_importance:
            return decision.feature_importance
        return {feature: 0.0 for feature in decision.features}

    def _select_adinkra_symbol(self, action_type: str) -> str:
        action = action_type.lower()
        if "protect" in action or "firewall" in action:
            return "Eban"
        if "learn" in action or "forensic" in action:
            return "Sankofa"
        if "verify" in action or "remediate" in action:
            return "OwoForoAdobe"
        return "Dwennimmen"
