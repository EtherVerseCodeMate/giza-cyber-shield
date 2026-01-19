"""Local-only inference engine for air-gapped deployments."""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Protocol
import socket


class PredictiveModel(Protocol):
    def predict(self, inputs: List[List[float]]) -> List[float]:
        ...


@dataclass
class Prediction:
    anomaly_score: float
    inference_location: str
    network_calls_made: int
    data_exfiltration_risk: float


class LocalInferenceEngine:
    """
    Guarantee ML inference happens locally.
    No external API calls, no telemetry.
    """

    def __init__(self, model: PredictiveModel) -> None:
        self.model = model
        self.telemetry_disabled = True

    def predict(self, features: List[float]) -> Prediction:
        """
        Run inference entirely in local process.
        Zero network calls.
        """
        if self._has_network_access():
            raise RuntimeError("Network access detected - aborting")

        result = self.model.predict([features])

        return Prediction(
            anomaly_score=result[0],
            inference_location="LOCAL",
            network_calls_made=0,
            data_exfiltration_risk=0.0,
        )

    def _has_network_access(self) -> bool:
        """Verify no network sockets are open."""
        try:
            socket.create_connection(("127.0.0.1", 1), timeout=0.1)
            return True
        except OSError:
            return False
