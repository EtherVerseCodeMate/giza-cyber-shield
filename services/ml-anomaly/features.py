"""
Feature Engineering for Khepra Anomaly Detection
Transforms raw request data into ML-ready feature vectors.
"""
import numpy as np
from typing import Dict, List, Optional, Any
from datetime import datetime
from pydantic import BaseModel
import hashlib
import math


class RequestFeatures(BaseModel):
    """Request features from the gateway layer"""
    # Timing features
    timestamp: datetime
    hour_of_day: int
    day_of_week: int
    request_rate_hz: float = 0.0

    # Request characteristics
    method: str
    path_depth: int
    query_param_count: int
    body_size_bytes: int = 0
    header_count: int
    content_type: str = ""
    user_agent_hash: str = ""

    # Identity features
    identity_id: str = ""
    identity_type: str = ""
    trust_score: float = 0.5
    organization: str = ""

    # Network features
    client_ip: str = ""
    geo_country: str = ""
    geo_city: str = ""
    asn: int = 0
    is_proxy: bool = False
    is_tor: bool = False
    is_datacenter: bool = False

    # Behavioral features
    session_duration_sec: float = 0.0
    requests_in_session: int = 0
    unique_paths_accessed: int = 0
    error_rate: float = 0.0

    # Payload analysis
    payload_entropy: float = 0.0
    has_suspicious_chars: bool = False
    json_depth: int = 0


class FeatureEncoder:
    """
    Encodes request features into fixed-size numeric vectors for ML processing.
    """

    # HTTP methods one-hot encoding order
    HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]

    # Identity types one-hot encoding order
    IDENTITY_TYPES = ["api_key", "jwt", "mtls", "enrollment", "anonymous"]

    # Content types one-hot encoding order
    CONTENT_TYPES = ["application/json", "application/xml", "text/plain",
                     "multipart/form-data", "application/x-www-form-urlencoded", "other"]

    def __init__(self, feature_dim: int = 32):
        self.feature_dim = feature_dim

        # Feature statistics for normalization
        self.stats = {
            "body_size_mean": 1000.0,
            "body_size_std": 5000.0,
            "path_depth_mean": 3.0,
            "path_depth_std": 2.0,
            "query_count_mean": 2.0,
            "query_count_std": 3.0,
            "header_count_mean": 10.0,
            "header_count_std": 5.0,
            "request_rate_mean": 1.0,
            "request_rate_std": 5.0,
            "session_duration_mean": 300.0,
            "session_duration_std": 600.0,
        }

    def encode(self, features: RequestFeatures) -> np.ndarray:
        """
        Encode request features into a fixed-size numeric vector.

        Args:
            features: RequestFeatures object

        Returns:
            numpy array of shape (feature_dim,)
        """
        encoded = []

        # 1. Timing features (4 dimensions)
        # Cyclical encoding for hour of day
        hour_sin = math.sin(2 * math.pi * features.hour_of_day / 24)
        hour_cos = math.cos(2 * math.pi * features.hour_of_day / 24)

        # Cyclical encoding for day of week
        day_sin = math.sin(2 * math.pi * features.day_of_week / 7)
        day_cos = math.cos(2 * math.pi * features.day_of_week / 7)

        encoded.extend([hour_sin, hour_cos, day_sin, day_cos])

        # 2. Request rate (1 dimension, normalized)
        rate_norm = self._normalize(
            features.request_rate_hz,
            self.stats["request_rate_mean"],
            self.stats["request_rate_std"]
        )
        encoded.append(rate_norm)

        # 3. HTTP method (one-hot, 7 dimensions -> compressed to 3)
        method_encoded = self._encode_method(features.method)
        encoded.extend(method_encoded)

        # 4. Request characteristics (4 dimensions)
        body_norm = self._normalize(
            features.body_size_bytes,
            self.stats["body_size_mean"],
            self.stats["body_size_std"]
        )
        path_norm = self._normalize(
            features.path_depth,
            self.stats["path_depth_mean"],
            self.stats["path_depth_std"]
        )
        query_norm = self._normalize(
            features.query_param_count,
            self.stats["query_count_mean"],
            self.stats["query_count_std"]
        )
        header_norm = self._normalize(
            features.header_count,
            self.stats["header_count_mean"],
            self.stats["header_count_std"]
        )
        encoded.extend([body_norm, path_norm, query_norm, header_norm])

        # 5. Content type (compressed encoding, 3 dimensions)
        content_encoded = self._encode_content_type(features.content_type)
        encoded.extend(content_encoded)

        # 6. Identity features (4 dimensions)
        identity_encoded = self._encode_identity(features)
        encoded.extend(identity_encoded)

        # 7. Trust score (1 dimension)
        encoded.append(features.trust_score)

        # 8. Network risk features (3 dimensions)
        network_risk = self._encode_network_risk(features)
        encoded.extend(network_risk)

        # 9. Behavioral features (4 dimensions)
        behavioral = self._encode_behavioral(features)
        encoded.extend(behavioral)

        # 10. Payload features (3 dimensions)
        payload = self._encode_payload(features)
        encoded.extend(payload)

        # Convert to numpy and pad/truncate to feature_dim
        encoded = np.array(encoded, dtype=np.float32)

        if len(encoded) < self.feature_dim:
            # Pad with zeros
            encoded = np.pad(encoded, (0, self.feature_dim - len(encoded)))
        elif len(encoded) > self.feature_dim:
            # Truncate
            encoded = encoded[:self.feature_dim]

        return encoded

    def _normalize(self, value: float, mean: float, std: float) -> float:
        """Z-score normalization with clipping"""
        if std == 0:
            return 0.0
        z = (value - mean) / std
        return np.clip(z, -3, 3) / 3  # Normalize to [-1, 1]

    def _encode_method(self, method: str) -> List[float]:
        """Compress HTTP method to 3 dimensions using learned embedding-like approach"""
        # Risk-based encoding: GET=safe, POST/PUT/PATCH=modify, DELETE=destroy
        method = method.upper()
        if method == "GET" or method == "HEAD":
            return [1.0, 0.0, 0.0]  # Read
        elif method == "POST" or method == "PUT" or method == "PATCH":
            return [0.0, 1.0, 0.0]  # Write
        elif method == "DELETE":
            return [0.0, 0.0, 1.0]  # Delete
        else:
            return [0.5, 0.5, 0.5]  # Unknown

    def _encode_content_type(self, content_type: str) -> List[float]:
        """Encode content type to 3 dimensions"""
        content_type = content_type.lower()
        if "json" in content_type:
            return [1.0, 0.0, 0.0]  # Structured
        elif "xml" in content_type or "html" in content_type:
            return [0.5, 0.5, 0.0]  # Semi-structured
        elif "multipart" in content_type or "form" in content_type:
            return [0.0, 1.0, 0.0]  # Form data
        elif "text" in content_type:
            return [0.0, 0.0, 1.0]  # Plain text
        else:
            return [0.3, 0.3, 0.3]  # Unknown

    def _encode_identity(self, features: RequestFeatures) -> List[float]:
        """Encode identity information to 4 dimensions"""
        # Identity type encoding
        id_type = features.identity_type.lower()
        if id_type == "mtls":
            type_score = 1.0  # Highest trust
        elif id_type == "jwt":
            type_score = 0.8
        elif id_type == "api_key":
            type_score = 0.6
        elif id_type == "enrollment":
            type_score = 0.3
        else:
            type_score = 0.0  # Anonymous/unknown

        # Hash-based identity embedding (deterministic from ID)
        if features.identity_id:
            id_hash = hashlib.md5(features.identity_id.encode()).digest()
            id_embed = [b / 255.0 for b in id_hash[:2]]
        else:
            id_embed = [0.5, 0.5]

        # Organization hash
        if features.organization:
            org_hash = hashlib.md5(features.organization.encode()).digest()
            org_embed = org_hash[0] / 255.0
        else:
            org_embed = 0.5

        return [type_score] + id_embed + [org_embed]

    def _encode_network_risk(self, features: RequestFeatures) -> List[float]:
        """Encode network risk indicators"""
        proxy_risk = 1.0 if features.is_proxy else 0.0
        tor_risk = 1.0 if features.is_tor else 0.0
        dc_risk = 0.5 if features.is_datacenter else 0.0

        # Combined network risk
        combined_risk = max(proxy_risk, tor_risk, dc_risk)

        return [proxy_risk, tor_risk, combined_risk]

    def _encode_behavioral(self, features: RequestFeatures) -> List[float]:
        """Encode behavioral features"""
        # Session duration (normalized)
        duration_norm = self._normalize(
            features.session_duration_sec,
            self.stats["session_duration_mean"],
            self.stats["session_duration_std"]
        )

        # Request density (requests per second in session)
        if features.session_duration_sec > 0:
            density = features.requests_in_session / features.session_duration_sec
        else:
            density = 0.0
        density_norm = min(density / 10.0, 1.0)  # Cap at 10 req/sec

        # Path diversity (unique paths / total requests)
        if features.requests_in_session > 0:
            diversity = features.unique_paths_accessed / features.requests_in_session
        else:
            diversity = 0.0

        # Error rate
        error_rate = min(features.error_rate, 1.0)

        return [duration_norm, density_norm, diversity, error_rate]

    def _encode_payload(self, features: RequestFeatures) -> List[float]:
        """Encode payload analysis features"""
        # Entropy (normalized to 0-1, max entropy ~8 for random bytes)
        entropy_norm = features.payload_entropy / 8.0

        # Suspicious characters flag
        suspicious = 1.0 if features.has_suspicious_chars else 0.0

        # JSON depth (normalized)
        depth_norm = min(features.json_depth / 10.0, 1.0)

        return [entropy_norm, suspicious, depth_norm]

    def update_stats(self, features_batch: List[RequestFeatures]):
        """Update normalization statistics from a batch of features"""
        if not features_batch:
            return

        body_sizes = [f.body_size_bytes for f in features_batch]
        path_depths = [f.path_depth for f in features_batch]
        query_counts = [f.query_param_count for f in features_batch]
        header_counts = [f.header_count for f in features_batch]
        request_rates = [f.request_rate_hz for f in features_batch]
        session_durations = [f.session_duration_sec for f in features_batch]

        # Running average update
        alpha = 0.1  # Learning rate for statistics update
        self.stats["body_size_mean"] = (
            (1 - alpha) * self.stats["body_size_mean"] + alpha * np.mean(body_sizes)
        )
        self.stats["body_size_std"] = (
            (1 - alpha) * self.stats["body_size_std"] + alpha * (np.std(body_sizes) + 1)
        )
        self.stats["path_depth_mean"] = (
            (1 - alpha) * self.stats["path_depth_mean"] + alpha * np.mean(path_depths)
        )
        self.stats["path_depth_std"] = (
            (1 - alpha) * self.stats["path_depth_std"] + alpha * (np.std(path_depths) + 1)
        )
        self.stats["query_count_mean"] = (
            (1 - alpha) * self.stats["query_count_mean"] + alpha * np.mean(query_counts)
        )
        self.stats["query_count_std"] = (
            (1 - alpha) * self.stats["query_count_std"] + alpha * (np.std(query_counts) + 1)
        )


class FeatureImportanceAnalyzer:
    """Analyzes which features contributed most to anomaly detection"""

    FEATURE_NAMES = [
        "hour_sin", "hour_cos", "day_sin", "day_cos",
        "request_rate",
        "method_read", "method_write", "method_delete",
        "body_size", "path_depth", "query_count", "header_count",
        "content_structured", "content_form", "content_text",
        "identity_type", "identity_hash1", "identity_hash2", "org_hash",
        "trust_score",
        "proxy_risk", "tor_risk", "network_risk",
        "session_duration", "request_density", "path_diversity", "error_rate",
        "payload_entropy", "suspicious_chars", "json_depth",
        "reserved1", "reserved2"  # Padding
    ]

    @classmethod
    def get_top_contributors(
        cls,
        feature_scores: Dict[str, float],
        top_k: int = 5
    ) -> List[str]:
        """Get the top contributing features to anomaly score"""
        sorted_features = sorted(
            feature_scores.items(),
            key=lambda x: abs(x[1]),
            reverse=True
        )
        return [f[0] for f in sorted_features[:top_k]]

    @classmethod
    def explain_anomaly(
        cls,
        features: np.ndarray,
        feature_scores: np.ndarray
    ) -> List[str]:
        """Generate human-readable explanations for anomaly"""
        explanations = []

        for i, (name, score) in enumerate(zip(cls.FEATURE_NAMES, feature_scores)):
            if abs(score) > 0.5:  # Significant contribution
                if "rate" in name.lower() and features[i] > 0.5:
                    explanations.append("Unusually high request rate")
                elif "tor" in name.lower() and features[i] > 0.5:
                    explanations.append("Request from Tor network")
                elif "proxy" in name.lower() and features[i] > 0.5:
                    explanations.append("Request from proxy/VPN")
                elif "error_rate" in name.lower() and features[i] > 0.5:
                    explanations.append("High error rate in session")
                elif "suspicious" in name.lower() and features[i] > 0.5:
                    explanations.append("Suspicious characters in payload")
                elif "hour" in name.lower() and abs(features[i]) > 0.7:
                    explanations.append("Unusual time of access")

        return explanations if explanations else ["Multiple minor anomalies detected"]
