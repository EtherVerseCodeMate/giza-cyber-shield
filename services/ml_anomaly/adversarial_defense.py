"""NIST AI RMF PROTECT: Adversarial input detection."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Tuple


@dataclass
class AdversarialResult:
    is_adversarial: bool
    anomalies: List[Dict[str, float]]
    confidence: float


class AdversarialDefense:
    """
    Protect ML model from adversarial attacks.
    Implements NIST AI RMF PROTECT function.
    """

    def __init__(self, feature_stats: List[Tuple[float, float]] | None = None) -> None:
        self.feature_stats = feature_stats or []
        self.attack_log: List[Dict[str, object]] = []

    def detect_adversarial_input(self, features: List[float]) -> AdversarialResult:
        """
        Detect adversarial perturbations in input features.
        Uses statistical anomaly detection on feature distributions.
        """
        feature_stats = self._calculate_feature_stats(features)

        anomalies: List[Dict[str, float]] = []
        for i, (mean, std) in enumerate(feature_stats):
            std = std or 1.0
            z_score = abs((features[i] - mean) / std)
            if z_score > 3.0:
                anomalies.append(
                    {
                        "feature_idx": float(i),
                        "value": features[i],
                        "expected_mean": mean,
                        "z_score": z_score,
                    }
                )

        is_adversarial = len(anomalies) > 3

        if is_adversarial:
            self._log_attack_attempt(features, anomalies)

        confidence = 1.0 - (len(anomalies) / max(len(features), 1))
        return AdversarialResult(
            is_adversarial=is_adversarial,
            anomalies=anomalies,
            confidence=max(confidence, 0.0),
        )

    def _calculate_feature_stats(self, features: List[float]) -> List[Tuple[float, float]]:
        if self.feature_stats:
            return self.feature_stats
        return [(0.0, 1.0) for _ in features]

    def _log_attack_attempt(
        self, features: List[float], anomalies: List[Dict[str, float]]
    ) -> None:
        self.attack_log.append(
            {
                "timestamp": datetime.now().isoformat(),
                "feature_count": len(features),
                "anomaly_count": len(anomalies),
            }
        )
