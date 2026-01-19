"""NIST Privacy Framework: Privacy-preserving inference utilities."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List
import hashlib


@dataclass
class AnonymizedData:
    features: List[float]
    metadata: Dict[str, str]
    original_pii_count: int


class PrivacyProtection:
    """
    Privacy-preserving ML inference.
    Implements NIST Privacy Framework + AI RMF integration.
    """

    PII_FIELDS = {"username", "email", "ip_address", "hostname", "user_id"}

    def anonymize_features(
        self, features: List[float], metadata: Dict[str, str]
    ) -> AnonymizedData:
        """
        Remove PII before ML processing.
        Supports air-gapped deployment.
        """
        anonymized_features = list(features)
        anonymized_metadata: Dict[str, str] = {}

        pii_fields = [key for key in metadata.keys() if key.lower() in self.PII_FIELDS]

        for key, value in metadata.items():
            if key.lower() in self.PII_FIELDS:
                anonymized_metadata[key] = self._hash_pii(value)
            else:
                anonymized_metadata[key] = value

        return AnonymizedData(
            features=anonymized_features,
            metadata=anonymized_metadata,
            original_pii_count=len(pii_fields),
        )

    def _hash_pii(self, value: str) -> str:
        """One-way hash for PII correlation without exposure."""
        return hashlib.sha256(value.encode()).hexdigest()[:16]
